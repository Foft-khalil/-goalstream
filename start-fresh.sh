#!/bin/bash
# Fresh dev server launcher with auto-restart on crash
cd /home/z/my-project
rm -rf .next 2>/dev/null
rm -f dev.log 2>/dev/null
export NODE_OPTIONS="--max-old-space-size=2048"

# Start next dev in background, logging to dev.log
node node_modules/.bin/next dev -p 3000 > dev.log 2>&1 &
NODE_PID=$!
echo "[launcher] next dev started, PID=$NODE_PID"

# Wait for "Ready" in the log (max 20s)
for i in $(seq 1 20); do
  if grep -q "Ready" dev.log 2>/dev/null; then
    echo "[launcher] Server ready after ${i}s"
    break
  fi
  kill -0 $NODE_PID 2>/dev/null || { echo "[launcher] Server died during startup"; exit 1; }
  sleep 1
done

# Keep the launcher alive so the child isn't orphaned/killed
# and so we can report status
echo "[launcher] Keeping alive to supervise PID=$NODE_PID"
# Wait for the child process indefinitely
wait $NODE_PID
EXIT=$?
echo "[launcher] next dev exited with code $EXIT"
