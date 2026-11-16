#!/usr/bin/env bash
set -euo pipefail

[[ $(uname -s) == Darwin ]] || { echo 'FAIL: this check requires macOS' >&2; exit 1; }
npm run make

# Bash 3.2 (the macOS default) has no globstar or mapfile.
archives=()
while IFS= read -r -d '' file; do
  archives+=("$file")
done < <(find out/make/zip/darwin -type f -name '*.zip' -print0)
[[ ${#archives[@]} == 1 ]] || { echo "FAIL: expected exactly one macOS zip, found ${#archives[@]}" >&2; exit 1; }
archive=${archives[0]}
printf 'Package: %s\nSize: %s bytes\n' "$archive" "$(stat -f '%z' "$archive")"
shasum -a 256 "$archive"

install_dir=$(mktemp -d)
log="$install_dir/app.log"
pid=''
renderer=''
cleanup() {
  echo '=== App stdout/stderr ==='
  if [[ -f $log ]]; then cat "$log"; else echo '(app was not launched)'; fi
  if [[ -n $pid ]]; then
    kill "$pid" 2>/dev/null || true
    [[ -z $renderer ]] || kill "$renderer" 2>/dev/null || true
    sleep 1
    kill -KILL "$pid" 2>/dev/null || true
    [[ -z $renderer ]] || kill -KILL "$renderer" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
  rm -rf "$install_dir"
}
trap cleanup EXIT

ditto -x -k "$archive" "$install_dir"
shopt -s nullglob
apps=("$install_dir/"*.app)
[[ ${#apps[@]} == 1 && -d ${apps[0]} ]] || { echo 'FAIL: expected exactly one installed .app' >&2; exit 1; }
app=${apps[0]}
echo '=== Informational codesign metadata; this is not an identity signature ==='
codesign -dv --verbose=2 "$app" 2>&1 || true
executables=()
for file in "$app/Contents/MacOS/"*; do
  [[ -f $file && -x $file ]] && executables+=("$file")
done
[[ ${#executables[@]} == 1 ]] || { echo 'FAIL: expected exactly one installed app executable' >&2; exit 1; }
printf 'Installed executable: %s\n' "${executables[0]}"
"${executables[0]}" > "$log" 2>&1 &
pid=$!

is_descendant() {
  local ancestor=$1
  while [[ $ancestor =~ ^[0-9]+$ ]] && (( ancestor > 1 )); do
    ancestor=$(ps -o ppid= -p "$ancestor" | tr -d ' ') || return 1
    [[ $ancestor != "$pid" ]] || return 0
  done
  return 1
}
for ((attempt=0; attempt<30; attempt++)); do
  kill -0 "$pid" 2>/dev/null || break
  while IFS= read -r candidate; do
    if is_descendant "$candidate"; then
      renderer=$candidate
      break
    fi
  done < <(pgrep -u "$(id -u)" -f -- '--type=renderer' || true)
  [[ -n $renderer ]] && break
  sleep 1
done
# Allow early startup crashes to surface after a renderer first appears.
sleep 3
if ! kill -0 "$pid" 2>/dev/null; then
  echo 'FAIL: main process exited early' >&2
  exit 1
fi
if [[ -z $renderer ]] || ! kill -0 "$renderer" 2>/dev/null || ! is_descendant "$renderer"; then
  echo 'FAIL: no live renderer descendant of main process' >&2
  exit 1
fi
ps -o pid,ppid,args -p "$pid,$renderer"
echo "PASS: installed app main PID=$pid and renderer descendant PID=$renderer are running."
