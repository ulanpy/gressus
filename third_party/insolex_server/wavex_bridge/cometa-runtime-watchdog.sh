#!/usr/bin/env bash
# Watch a running VM for a physical Cometa USB replug.  A replug normally
# returns the receiver as 04b4:4720; recover it live to 04b4:01aa.

set -euo pipefail

DOMAIN="gressus-insole-windows"
INTERVAL_SECONDS=1
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TRANSITION_TEST="$SCRIPT_DIR/cometa-usb-transition-test.sh"

usage() {
  cat <<'EOF'
Usage: cometa-runtime-watchdog.sh [--apply] [--domain NAME] [--interval SECONDS]

Without --apply the script only reports why it would or would not recover USB.
With --apply it loops forever. It acts only when all conditions hold:
  - VM is running;
  - persistent VM XML expects 04b4:01aa;
  - host sees physical receiver as 04b4:4720.

On that transition it invokes the live-only USB recovery test. It never starts
the VM and never changes RF configuration.
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

if [[ "$apply" != true ]]; then
  status="$(read_status)"
  IFS='|' read -r state host_pid saved_pid <<< "$status"
  printf 'VM=%s host_pid=%s persistent_pid=%s\n' "$state" "$host_pid" "$saved_pid"
  if [[ "$state" == "running" && "$host_pid" == "4720" && "$saved_pid" == "01aa" ]]; then
    echo "Action would be: recover live 4720 -> 01aa."
  else
    echo "No action is required or safe for the current state."
  fi
  exit 0
fi

echo "Cometa runtime watchdog started: domain=$DOMAIN interval=${INTERVAL_SECONDS}s"
last_status=""
while true; do
  status="$(read_status)"
  IFS='|' read -r state host_pid saved_pid <<< "$status"
  if [[ "$status" != "$last_status" ]]; then
    printf 'Observed: VM=%s host_pid=%s persistent_pid=%s\n' "$state" "$host_pid" "$saved_pid"
    last_status="$status"
  fi
  if [[ "$state" == "running" && "$host_pid" == "4720" && "$saved_pid" == "01aa" ]]; then
    echo "Detected replug/cold receiver mode 4720 while VM expects 01aa; recovering..."
    if "$TRANSITION_TEST" --apply --domain "$DOMAIN"; then
      echo "Live Cometa USB recovery completed. Windows supervisor should restart bridge on 01aa arrival."
    else
      echo "Live Cometa USB recovery failed; will retry only after the next poll." >&2
    fi
  fi
  sleep "$INTERVAL_SECONDS"
done
