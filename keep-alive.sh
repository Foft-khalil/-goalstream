#!/bin/bash
cd /home/z/my-project
while true; do
  node node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1
  echo "[$(date)] Server exited with code $?, restarting in 3s..." >> /home/z/my-project/watchdog.log
  sleep 3
  rm -rf .next 2>/dev/null
done
