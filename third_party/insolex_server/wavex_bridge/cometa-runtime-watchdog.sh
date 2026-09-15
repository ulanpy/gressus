#!/usr/bin/env bash
# Keep the Windows VM usable whenever the physical Cometa receiver is present.
# A cold/replugged receiver normally appears as 04b4:4720 and must transition
# through Windows to 04b4:01aa before WaveX can use it.

set -euo pipefail

DOMAIN="gressus-insole-windows"
INTERVAL_SECONDS=1
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TRANSITION_TEST="$SCRIPT_DIR/cometa-usb-transition-test.sh"
COLD_PREFLIGHT="$SCRIPT_DIR/cometa-cold-boot-preflight.sh"

usage() {
  cat <<'EOF'
Usage: cometa-runtime-watchdog.sh [--apply] [--domain NAME] [--interval SECONDS]

Without --apply the script reports the current state and intended action.
With --apply it loops forever, but acts only while a supported physical
receiver (04b4:01aa or 04b4:4720) is visible on the Linux host:
  - shut off VM: runs the cold-boot preflight, which starts the VM;
  - paused VM: resumes it;
  - crashed/stopping VM: force-stops it, then retries cold boot next poll;
  - running VM with 4720 and persistent XML 01aa: runs live USB recovery;
  - running VM with 4720 and any other persistent USB mode: force-restarts it
    through cold-boot preflight.

It intentionally does nothing when no supported receiver is connected. It
never starts WaveX or changes RF/insole configuration; the Windows Scheduled
Task remains the sole owner of wavex-bridge.
EOF
}

apply=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) apply=true ;;
    --domain) DOMAIN="${2:?missing value for --domain}"; shift ;;
    --interval) INTERVAL_SECONDS="${2:?missing value for --interval}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

receiver_pid() {
  lsusb | sed -nE 's/.*ID 04b4:(01aa|4720).*/\1/p' | head -n 1
}

persistent_pid() {
  virsh -c qemu:///system dumpxml --inactive "$DOMAIN" |
    sed -nE "s/.*<product id='0x(01aa|4720)'\/>.*/\1/p" | head -n 1
}

read_status() {
  local state host_pid saved_pid
  state="$(virsh -c qemu:///system domstate "$DOMAIN" | tr -d '\r')"
  host_pid="$(receiver_pid || true)"
  saved_pid="$(persistent_pid || true)"
  printf '%s|%s|%s\n' "$state" "${host_pid:-not-found}" "${saved_pid:-not-found}"
}

planned_action() {
  local state="$1" host_pid="$2" saved_pid="$3"

  if [[ "$host_pid" != "01aa" && "$host_pid" != "4720" ]]; then
    echo "No action: no supported Cometa receiver is connected."
    return
  fi

  case "$state" in
    running|blocked)
      if [[ "$host_pid" == "4720" && "$saved_pid" == "01aa" ]]; then
        echo "Action: recover live 4720 -> 01aa."
      elif [[ "$host_pid" == "4720" ]]; then
        echo "Action: force-stop VM, then cold-boot it through preflight."
      else
        echo "No action: VM and receiver are already active."
      fi
      ;;
    "shut off")
      echo "Action: cold-boot VM through preflight."
      ;;
    paused)
      echo "Action: resume VM."
      ;;
    pmsuspended)
      echo "Action: wake VM from guest power management suspend."
      ;;
    *)
      echo "Action: force-stop VM state '$state', then cold-boot it through preflight."
      ;;
  esac
}

ensure_vm_for_receiver() {
  local state="$1" host_pid="$2" saved_pid="$3"

  if [[ "$host_pid" != "01aa" && "$host_pid" != "4720" ]]; then
    return
  fi

  case "$state" in
    running|blocked)
      if [[ "$host_pid" == "4720" && "$saved_pid" == "01aa" ]]; then
        echo "Detected receiver mode 4720 while running VM expects 01aa; recovering live..."
        if "$TRANSITION_TEST" --apply --domain "$DOMAIN"; then
          echo "Live Cometa USB recovery completed. Windows supervisor should restart bridge on 01aa arrival."
        else
          echo "Live Cometa USB recovery failed; will retry on the next poll." >&2
        fi
      elif [[ "$host_pid" == "4720" ]]; then
        echo "Running VM still has cold receiver mode 4720 (persistent PID: $saved_pid); forcing restart through preflight..."
        virsh -c qemu:///system destroy "$DOMAIN" || true
      fi
      ;;
    "shut off")
      echo "Receiver $host_pid is connected while VM is shut off; starting cold-boot preflight..."
      if "$COLD_PREFLIGHT" --apply --domain "$DOMAIN"; then
        echo "Cold-boot preflight completed."
      else
        echo "Cold-boot preflight failed; will retry on the next poll." >&2
      fi
      ;;
    paused)
      echo "Receiver is connected while VM is paused; resuming VM..."
      virsh -c qemu:///system resume "$DOMAIN" || true
      ;;
    pmsuspended)
      echo "Receiver is connected while VM is guest-suspended; waking VM..."
      virsh -c qemu:///system dompmwakeup "$DOMAIN" || \
        virsh -c qemu:///system resume "$DOMAIN" || true
      ;;
    *)
      echo "Receiver is connected while VM is '$state'; force-stopping it before cold-boot retry..."
      virsh -c qemu:///system destroy "$DOMAIN" || true
      ;;
  esac
}

if [[ "$apply" != true ]]; then
  status="$(read_status)"
  IFS='|' read -r state host_pid saved_pid <<< "$status"
  printf 'VM=%s host_pid=%s persistent_pid=%s\n' "$state" "$host_pid" "$saved_pid"
  planned_action "$state" "$host_pid" "$saved_pid"
  exit 0
fi

echo "Cometa VM supervisor started: domain=$DOMAIN interval=${INTERVAL_SECONDS}s"
last_status=""
while true; do
  status="$(read_status)"
  IFS='|' read -r state host_pid saved_pid <<< "$status"
  if [[ "$status" != "$last_status" ]]; then
    printf 'Observed: VM=%s host_pid=%s persistent_pid=%s\n' "$state" "$host_pid" "$saved_pid"
    last_status="$status"
  fi
  ensure_vm_for_receiver "$state" "$host_pid" "$saved_pid"
  sleep "$INTERVAL_SECONDS"
done
