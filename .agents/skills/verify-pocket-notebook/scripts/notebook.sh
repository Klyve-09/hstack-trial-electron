#!/usr/bin/env bash
# Launch, check, drive, capture, and stop one Pocket Notebook verification
# instance on its own Xvfb display. See ../SKILL.md for the procedure.
set -euo pipefail

SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPTS" rev-parse --show-toplevel)"
RUN="${PN_RUN:-/tmp/pocket-notebook-verify/run}"
STATE="$RUN/state"
APP="$ROOT/out/Pocket Notebook-linux-x64/pocket-notebook"

die() {
  echo "notebook: $*" >&2
  exit 1
}
load() {
  [[ -f "$STATE" ]] || die "no instance state at $STATE; run launch first"
  # shellcheck source=/dev/null
  source "$STATE"
}
alive() { kill -0 "$1" 2>/dev/null; }

launch() {
  if [[ -f "$STATE" ]]; then
    # shellcheck source=/dev/null
    source "$STATE"
    if alive "$APP_PID" || alive "$XVFB_PID"; then
      die "an instance from $RUN is still running; run stop first"
    fi
  fi
  command -v Xvfb >/dev/null || die "Xvfb is not installed"
  command -v import >/dev/null || die "import (ImageMagick) is not installed"
  rm -rf "$RUN"
  mkdir -p "$RUN/config"
  local evidence="${PN_EVIDENCE:-/tmp/pocket-notebook-verify/evidence/$(date -u +%Y%m%dT%H%M%SZ)}"
  [[ "$evidence/" == "$RUN/"* ]] && die "PN_EVIDENCE must be outside PN_RUN; stop deletes PN_RUN"
  mkdir -p "$evidence"

  (cd "$ROOT" && npm run package >"$RUN/package.log" 2>&1) ||
    die "npm run package failed; see $RUN/package.log"

  setsid Xvfb -displayfd 3 -screen 0 1280x800x24 -nolisten tcp \
    3>"$RUN/display" >"$RUN/xvfb.log" 2>&1 &
  local xvfb_pid=$!
  for _ in $(seq 50); do [[ -s "$RUN/display" ]] && break; sleep 0.1; done
  [[ -s "$RUN/display" ]] || die "Xvfb did not report a display; see $RUN/xvfb.log"
  local display=":$(tr -d '[:space:]' <"$RUN/display")"

  # --no-sandbox: the VM cannot run Chromium's SUID sandbox helper and
  # restricts unprivileged user namespaces, so the app aborts without it.
  DISPLAY="$display" XDG_CONFIG_HOME="$RUN/config" setsid "$APP" \
    --no-sandbox --disable-gpu --remote-debugging-port=0 \
    >"$RUN/app.log" 2>&1 &
  local app_pid=$!

  cat >"$STATE" <<EOF
XVFB_PID=$xvfb_pid
APP_PID=$app_pid
DISPLAY_NAME=$display
DATA_DIR="$RUN/config/Pocket Notebook"
EVIDENCE="$evidence"
COMMIT=$(git -C "$ROOT" rev-parse --short HEAD)$(git -C "$ROOT" diff --quiet HEAD -- src index.html || echo -dirty)
EOF
  local port_file="$RUN/config/Pocket Notebook/DevToolsActivePort"
  for _ in $(seq 100); do [[ -s "$port_file" ]] && break; sleep 0.2; done
  [[ -s "$port_file" ]] || die "app did not open DevTools; see $RUN/app.log"
  echo "CDP_PORT=$(head -1 "$port_file")" >>"$STATE"
  load
  # Ready means the Items list rendered after the notebook file was read.
  "$0" cdp wait 'main h1 .count' --timeout 20000 >/dev/null
  echo "ready: display $DISPLAY_NAME, CDP port $CDP_PORT, commit $COMMIT"
  echo "data: $DATA_DIR"
  echo "evidence: $EVIDENCE"
}

doctor() {
  load
  local ok=1
  alive "$XVFB_PID" && echo "ok   Xvfb pid $XVFB_PID on $DISPLAY_NAME" ||
    { echo "FAIL Xvfb pid $XVFB_PID is gone"; ok=0; }
  alive "$APP_PID" && echo "ok   app pid $APP_PID" ||
    { echo "FAIL app pid $APP_PID is gone"; ok=0; }
  if [[ "$(head -1 "$DATA_DIR/DevToolsActivePort" 2>/dev/null)" == "$CDP_PORT" ]]; then
    echo "ok   CDP port $CDP_PORT belongs to data dir $DATA_DIR"
  else
    echo "FAIL CDP port $CDP_PORT is not owned by $DATA_DIR"
    ok=0
  fi
  local url
  if url="$("$0" cdp url 2>&1)" && [[ "$url" == "file://$ROOT/out/"* ]]; then
    echo "ok   page $url"
  else
    echo "FAIL page is not this checkout's build: $url"
    ok=0
  fi
  local head
  head="$(git -C "$ROOT" rev-parse --short HEAD)"
  [[ "$COMMIT" == "$head"* ]] && echo "ok   build commit $COMMIT" ||
    { echo "FAIL launched at $COMMIT but HEAD is $head; stop and launch again"; ok=0; }
  ((ok)) || exit 1
}

shot() {
  load
  local label="${1:?usage: shot <label>}"
  local count
  count=$(find "$EVIDENCE" -name '*.png' | wc -l)
  local base
  base="$EVIDENCE/$(printf '%02d' $((count + 1)))-$label"
  DISPLAY="$DISPLAY_NAME" import -window root "$base.png"
  "$0" cdp axtree >"$base.ax.txt"
  echo "$(date -u +%FT%TZ) commit=$COMMIT $base.png" >>"$EVIDENCE/captures.txt"
  echo "$base.png"
}

stop() {
  [[ -f "$STATE" ]] || { echo "nothing to stop in $RUN"; return; }
  # shellcheck source=/dev/null
  source "$STATE"
  local pid
  for pid in "$APP_PID" "$XVFB_PID"; do
    alive "$pid" || continue
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 50); do alive "$pid" || break; sleep 0.1; done
    alive "$pid" && kill -KILL -- "-$pid" 2>/dev/null || true
  done
  rm -rf "$RUN"
  echo "stopped; evidence kept at $EVIDENCE"
}

case "${1:-}" in
  launch) launch ;;
  doctor) doctor ;;
  shot) shift; shot "$@" ;;
  cdp) shift; load; exec node "$SCRIPTS/cdp.mjs" "$CDP_PORT" "$@" ;;
  data) load; cat "$DATA_DIR/items.json" ;;
  stop) stop ;;
  *) die "usage: notebook.sh launch|doctor|cdp <command> ...|shot <label>|data|stop" ;;
esac
