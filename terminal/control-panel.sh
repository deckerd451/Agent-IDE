#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.dev-logs"
SERVER_LOG="$LOG_DIR/server.log"
VITE_LOG="$LOG_DIR/vite.log"
SERVER_PID="$LOG_DIR/server.pid"
VITE_PID="$LOG_DIR/vite.pid"
APP_URL="http://localhost:5173"

cd "$ROOT_DIR" || exit 1
mkdir -p "$LOG_DIR"

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

status_label() {
  if is_running "$1"; then
    printf 'running (pid %s)' "$(cat "$1")"
  else
    printf 'stopped'
  fi
}

print_status() {
  printf '\nAgent IDE status\n'
  printf '  API server: %s\n' "$(status_label "$SERVER_PID")"
  printf '  Vite:       %s\n' "$(status_label "$VITE_PID")"
  printf '  Logs:       %s\n\n' "$LOG_DIR"
}

stop_process() {
  local name="$1"
  local pid_file="$2"
  if is_running "$pid_file"; then
    local pid
    pid="$(cat "$pid_file")"
    printf 'Stopping %s (pid %s)...\n' "$name" "$pid"
    kill "$pid" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

stop_servers() {
  stop_process "Vite" "$VITE_PID"
  stop_process "API server" "$SERVER_PID"
  print_status
}

start_servers() {
  mkdir -p "$LOG_DIR"
  if ! is_running "$SERVER_PID"; then
    printf 'Starting API server with npm run server...\n'
    nohup npm run server >>"$SERVER_LOG" 2>&1 &
    echo $! >"$SERVER_PID"
  else
    printf 'API server already running.\n'
  fi

  if ! is_running "$VITE_PID"; then
    printf 'Starting Vite with npm run dev...\n'
    nohup npm run dev >>"$VITE_LOG" 2>&1 &
    echo $! >"$VITE_PID"
  else
    printf 'Vite already running.\n'
  fi
  print_status
}

restart_servers() {
  stop_servers
  start_servers
}

open_browser() {
  printf 'Opening %s...\n' "$APP_URL"
  if command -v open >/dev/null 2>&1; then
    open "$APP_URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$APP_URL"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -m webbrowser "$APP_URL"
  else
    printf 'No browser opener found. Visit %s manually.\n' "$APP_URL"
  fi
}

show_log() {
  local file="$1"
  touch "$file"
  if command -v less >/dev/null 2>&1 && [[ -t 1 ]]; then
    less +G "$file"
  else
    tail -n 80 "$file"
  fi
}

pull_test_build_restart() {
  git pull --ff-only && npm test && npm run build && restart_servers
}

menu() {
  while true; do
    print_status
    cat <<MENU
Agent IDE terminal control panel
  1) Start / restart dev servers
  2) Stop dev servers
  3) Pull latest + test + build + restart
  4) Run tests
  5) Build
  6) Git status
  7) Open Agent IDE in browser
  8) Show server log
  9) Show Vite log
  10) Quit
MENU
    if ! read -r -p "Choose an option: " choice; then
      printf '\nNo interactive input detected; control panel launched successfully and is exiting.\n'
      exit 0
    fi
    case "$choice" in
      1) restart_servers ;;
      2) stop_servers ;;
      3) pull_test_build_restart ;;
      4) npm test ;;
      5) npm run build ;;
      6) git status --short --branch ;;
      7) open_browser ;;
      8) show_log "$SERVER_LOG" ;;
      9) show_log "$VITE_LOG" ;;
      10|q|Q) exit 0 ;;
      *) printf 'Unknown option: %s\n' "$choice" ;;
    esac
  done
}

case "${1:-}" in
  start) start_servers ;;
  stop) stop_servers ;;
  restart) restart_servers ;;
  status) print_status ;;
  test) npm test ;;
  build) npm run build ;;
  open) open_browser ;;
  server-log) show_log "$SERVER_LOG" ;;
  vite-log) show_log "$VITE_LOG" ;;
  pull-test-build-restart) pull_test_build_restart ;;
  "") menu ;;
  *) printf 'Usage: npm run control [-- start|stop|restart|status|test|build|open|server-log|vite-log|pull-test-build-restart]\n'; exit 2 ;;
esac
