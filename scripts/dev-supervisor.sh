#!/bin/bash
# GoalStream dev server with auto-restart and memory optimization
# The supervisor automatically restarts the server if it crashes due to memory pressure
export NODE_OPTIONS="--max-old-space-size=8192"

echo "[GoalStream] Starting dev server with 8GB heap..."

while true; do
  node node_modules/.bin/next dev -p 3000 2>&1 | tee dev.log
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    echo "[GoalStream] Server shut down cleanly."
    break
  fi
  echo "[GoalStream] Server crashed (exit $EXIT_CODE), restarting in 3s..."
  sleep 3
  # Clear Turbopack cache to reduce memory on restart
  rm -rf .next/dev 2>/dev/null
done
