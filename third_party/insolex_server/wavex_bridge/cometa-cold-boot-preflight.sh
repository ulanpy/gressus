#!/usr/bin/env bash
#
# Bring a cold-booted Cometa receiver (04b4:4720) into its WaveX/Daq USB mode
# (04b4:01aa) before the Windows WaveX bridge is started.
#
# This is deliberately a preflight, not a systemd service: it starts the VM
# but never starts WaveX or changes insole capture configuration.

set -euo pipefail

DOMAIN="gressus-insole-windows"
TIMEOUT_SECONDS=90
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
XML_4720="$SCRIPT_DIR/cometa-receiver-usb.xml"
XML_01AA="$SCRIPT_DIR/cometa-receiver-usb-01aa.xml"

usage() {
  cat <<'EOF'
Usage: cometa-cold-boot-preflight.sh [--apply] [--domain NAME] [--timeout SECONDS]

Without --apply, print the detected host receiver PID and the planned action.

With --apply, the VM must be shut off and WaveX applications must be closed.
The script:
  - saves the current persistent domain XML to a temporary backup;
  - starts the VM with the currently detected USB PID;
  - for 04b4:4720, waits for the Windows Cometa driver to re-enumerate 01aa;
  - replaces the persistent and live attachment with 04b4:01aa.

It never starts wavex-bridge, EMG & Motion Tools, or changes RF/insole settings.
EOF
}

apply=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --domain) DOMAIN="${2:?missing value for --domain}"; shift ;;
    --timeout) TIMEOUT_SECONDS="${2:?missing value for --timeout}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

receiver_pid() {
  lsusb | sed -nE 's/.*ID 04b4:(01aa|4720).*/\1/p' | head -n 1
}

domstate() {
  virsh -c qemu:///system domstate "$DOMAIN" | tr -d '\r'
}

set_persistent_usb() {
  local wanted_xml="$1"
  # Each detach is idempotent from the script's perspective: at most one
  # Cometa hostdev exists in the persistent domain definition.
  virsh -c qemu:///system detach-device "$DOMAIN" --file "$XML_4720" --config || true
  virsh -c qemu:///system detach-device "$DOMAIN" --file "$XML_01AA" --config || true
  virsh -c qemu:///system attach-device "$DOMAIN" --file "$wanted_xml" --config
}

state="$(domstate)"
pid="$(receiver_pid || true)"

echo "VM: $DOMAIN ($state)"
echo "Host receiver PID: ${pid:-not found}"

if [[ "$pid" != "01aa" && "$pid" != "4720" ]]; then
  echo "No supported Cometa receiver is visible on the Linux host." >&2
  exit 1
fi

if [[ "$state" != "shut off" ]]; then
  cat >&2 <<'EOF'
Cold-boot preflight only runs while the VM is shut off.
Shut Windows down cleanly first. For an already running VM use the live-only
cometa-usb-transition-test.sh experiment instead.
EOF
  exit 1
fi

if [[ "$apply" != true ]]; then
  if [[ "$pid" == "01aa" ]]; then
    echo "Dry run: start VM with the already working 01aa USB mode."
  else
    echo "Dry run: start VM temporarily with 4720, then wait up to ${TIMEOUT_SECONDS}s for 01aa."
  fi
  exit 0
fi

backup_dir="$(mktemp -d /tmp/gressus-cometa-preflight.XXXXXX)"
backup_xml="$backup_dir/${DOMAIN}.xml"
virsh -c qemu:///system dumpxml --inactive "$DOMAIN" > "$backup_xml"
echo "Persistent domain XML backup: $backup_xml"

if [[ "$pid" == "01aa" ]]; then
  echo "Receiver is already in WaveX/Daq mode; persisting 01aa and starting VM."
  set_persistent_usb "$XML_01AA"
  virsh -c qemu:///system start "$DOMAIN"
  echo "Preflight complete: VM started with 01aa."
  exit 0
fi

echo "Receiver is in cold mode 4720; persisting it temporarily and starting VM."
set_persistent_usb "$XML_4720"
virsh -c qemu:///system start "$DOMAIN"

echo "Waiting up to ${TIMEOUT_SECONDS}s for Windows Cometa driver: 4720 -> 01aa..."
for ((second = 1; second <= TIMEOUT_SECONDS; second++)); do
  sleep 1
  pid="$(receiver_pid || true)"
  printf '  %2ss: %s\n' "$second" "${pid:-not found}"
  if [[ "$pid" == "01aa" ]]; then
    break
  fi
done

if [[ "$pid" != "01aa" ]]; then
  cat >&2 <<EOF
No 01aa transition was observed. The VM remains running with temporary 4720
configuration. The original persistent XML backup is: $backup_xml
Do not start WaveX in 4720 mode. Shut the VM down, then restore with:
  virsh -c qemu:///system define "$backup_xml"
EOF
  exit 1
fi

echo "01aa observed; making WaveX/Daq mode persistent and reattaching it live."
virsh -c qemu:///system detach-device "$DOMAIN" --file "$XML_4720" --live || true
set_persistent_usb "$XML_01AA"
virsh -c qemu:///system attach-device "$DOMAIN" --file "$XML_01AA" --live

echo "Preflight complete: 01aa is persistent and attached live."
echo "Next: verify 'EMG and Motion X Device' in Windows, then start wavex-bridge --rf-start."
