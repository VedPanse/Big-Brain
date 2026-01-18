#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

pids=()

start_bg() {
  local label="$1"
  shift
  "$@" >"/tmp/bigbrain-${label}.log" 2>&1 &
  local pid=$!
  pids+=("$pid")
}

cleanup() {
  for pid in "${pids[@]}"; do
    kill "${pid}" 2>/dev/null || true
  done
}

trap cleanup INT TERM EXIT

start_bg "agent" npm run agent:dev
start_bg "dev" npm run dev

echo "http://localhost:5173/"
wait
