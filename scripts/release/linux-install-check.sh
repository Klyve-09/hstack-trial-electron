#!/usr/bin/env bash
set -euo pipefail

kind=$1
artifact=$2
case "$kind" in
  deb)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y "$artifact" xvfb xauth procps util-linux
    name=$(dpkg-deb -f "$artifact" Package)
    dpkg -s "$name"
    mapfile -t files < <(dpkg -L "$name")
    ;;
  rpm)
    dnf install -y "$artifact" xorg-x11-server-Xvfb xorg-x11-xauth procps-ng util-linux
    name=$(rpm -qp --queryformat '%{NAME}' "$artifact")
    rpm -qi "$name"
    mapfile -t files < <(rpm -ql "$name")
    ;;
  *) exit 2 ;;
esac

executable=''
for file in "${files[@]}"; do
  if [[ $file == */pocket-notebook && -x $file && ! -d $file ]]; then
    executable=$file
    break
  fi
done
[[ -n $executable ]] || { echo 'FAIL: installed executable not found' >&2; exit 1; }
echo "Installed executable: $executable"
if [[ $kind == deb ]]; then
  echo '=== Installed application license (Debian has no standard License control field) ==='
  license_file="$(dirname "$(readlink -f "$executable")")/resources/LICENSE"
  printf 'License: %s\n' "$(head -n 1 "$license_file")"
  cat "$license_file"
fi

useradd -m appcheck
Xvfb :99 -screen 0 1280x800x24 > /tmp/xvfb.log 2>&1 &
xvfb_pid=$!
trap 'kill "$xvfb_pid" 2>/dev/null || true' EXIT
for ((i=0; i<50; i++)); do
  [[ -S /tmp/.X11-unix/X99 ]] && break
  sleep 0.1
done
[[ -S /tmp/.X11-unix/X99 ]] || { cat /tmp/xvfb.log; exit 1; }

# The child shell retains the app PID and checks only descendants of that PID.
runuser -u appcheck -- env DISPLAY=:99 APP_EXECUTABLE="$executable" bash <<'CHECK'
set -euo pipefail
ulimit -c 0
log=$(mktemp)
pid=''
cleanup() {
  if [[ -n $pid ]]; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -f "$log"
}
trap cleanup EXIT
launch() {
  "$APP_EXECUTABLE" --disable-gpu "$@" > "$log" 2>&1 &
  pid=$!
}
launch
sleep 3
if ! kill -0 "$pid" 2>/dev/null && grep -Eqi 'No usable sandbox|Failed to move to new namespace|SUID sandbox|namespace sandbox|Operation not permitted' "$log"; then
  echo '=== Sandbox-on attempt stdout/stderr ==='
  cat "$log"
  wait "$pid" 2>/dev/null || true
  echo 'Container blocks the non-root Chromium sandbox. Retrying with test-only --no-sandbox (app settings unchanged).'
  launch --no-sandbox
fi
renderer=''
for ((attempt=0; attempt<30; attempt++)); do
  kill -0 "$pid" 2>/dev/null || break
  while read -r candidate; do
    ancestor=$candidate
    while [[ $ancestor =~ ^[0-9]+$ ]] && (( ancestor > 1 )); do
      ancestor=$(ps -o ppid= -p "$ancestor" | tr -d ' ') || break
      if [[ $ancestor == "$pid" ]]; then
        renderer=$candidate
        break
      fi
    done
    [[ -n $renderer ]] && break
  done < <(pgrep -u "$(id -u)" -f -- '--type=renderer' || true)
  [[ -n $renderer ]] && break
  sleep 1
done
# Allow early startup crashes to surface even after a renderer first appears.
sleep 3
echo '=== App stdout/stderr ==='
cat "$log"
if ! kill -0 "$pid" 2>/dev/null; then
  echo 'FAIL: main process exited early' >&2
  exit 1
fi
if [[ -z $renderer ]] || ! kill -0 "$renderer" 2>/dev/null; then
  echo 'FAIL: no live renderer descendant of main process' >&2
  exit 1
fi
ps -o pid,ppid,args -p "$pid,$renderer"
echo "PASS: installed app main PID=$pid and renderer descendant PID=$renderer are running."
CHECK
echo "PASS: $kind install-and-launch check"
