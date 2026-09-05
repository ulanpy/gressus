#!/usr/bin/env bash
#
# Experimental, live-only check for the Cometa receiver USB mode transition.
# It intentionally never changes the persistent libvirt domain configuration.

set -euo pipefail

DOMAIN="gressus-insole-windows"
TIMEOUT_SECONDS=30
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
XML_4720="$SCRIPT_DIR/cometa-receiver-usb.xml"
XML_01AA="$SCRIPT_DIR/cometa-receiver-usb-01aa.xml"

usage() {
  cat <<'EOF'
Usage: cometa-usb-transition-test.sh [--apply] [--domain NAME] [--timeout SECONDS]

Without --apply, prints the current receiver mode and the planned experiment.

With --apply, while the VM is already running:
  1. clears live-only stale Cometa attachments;
  2. attaches receiver mode 04b4:4720 to Windows;
  3. waits for the receiver to re-enumerate as 04b4:01aa;
  4. attaches 04b4:01aa to Windows if the transition is observed.

It does not use --config and therefore never changes what will happen on the
next VM boot. Close WaveX bridge, EMG & Motion Tools and WaveX.Example first.
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

state="$(virsh -c qemu:///system domstate "$DOMAIN" | tr -d '\r')"
pid="$(receiver_pid || true)"

echo "VM: $DOMAIN ($state)"
echo "Host receiver PID: ${pid:-not found}"

if [[ "$pid" == "01aa" ]]; then
  echo "Receiver is already in the WaveX/Daq mode (04b4:01aa); no transition is needed."
  exit 0
fi

if [[ "$pid" != "4720" ]]; then
  echo "No supported Cometa receiver is visible on the Linux host." >&2
  exit 1
fi

if [[ "$state" != "running" ]]; then
  cat >&2 <<'EOF'
The experimental hand-off needs an already running Windows VM.
This script intentionally does not change persistent USB configuration or start
the VM. Start the VM manually only when its current persistent USB PID matches
the physical receiver, then run this command again.
EOF
  exit 1
fi

if [[ "$apply" != true ]]; then
  cat <<EOF
Dry run only. The receiver is in 04b4:4720, so --apply will detach any stale
live Cometa attachment, attach 4720 to Windows, then poll up to
${TIMEOUT_SECONDS}s for host re-enumeration as 01aa. Persistent VM XML is not
changed.
EOF
  exit 0
fi

echo "Clearing live-only stale Cometa attachments (errors here are harmless)..."
virsh -c qemu:///system detach-device "$DOMAIN" --file "$XML_4720" --live || true
virsh -c qemu:///system detach-device "$DOMAIN" --file "$XML_01AA" --live || true

echo "Attaching 04b4:4720 to Windows..."
virsh -c qemu:///system attach-device "$DOMAIN" --file "$XML_4720" --live

echo "Waiting up to ${TIMEOUT_SECONDS}s for 4720 -> 01aa re-enumeration..."
for ((second = 1; second <= TIMEOUT_SECONDS; second++)); do
  sleep 1
  pid="$(receiver_pid || true)"
  printf '  %2ss: %s\n' "$second" "${pid:-not found}"
  if [[ "$pid" == "01aa" ]]; then
    break
  fi
done

if [[ "$pid" != "01aa" ]]; then
  cat >&2 <<'EOF'
No 01aa transition was observed. Persistent VM XML was not modified.
The experiment is inconclusive; do not start WaveX in 4720 mode.
EOF
  exit 1
fi

echo "01aa observed. Replacing the live USB attachment with WaveX/Daq mode..."
virsh -c qemu:///system detach-device "$DOMAIN" --file "$XML_4720" --live || true
virsh -c qemu:///system attach-device "$DOMAIN" --file "$XML_01AA" --live

echo "Success: 01aa is attached live. Verify in Windows:"
echo "  Get-PnpDevice -PresentOnly | Where-Object { \$_.InstanceId -match 'VID_04B4&PID_01AA' } | Format-List Status,FriendlyName,InstanceId"
