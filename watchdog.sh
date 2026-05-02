#!/bin/bash
cd /home/z/my-project
echo "[$(date)] Watchdog started" >> /home/z/my-project/watchdog.log

while true; do
  # Try to connect to the server
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  
  if [ "$RESPONSE" != "200" ]; then
    echo "[$(date)] Server down (HTTP $RESPONSE), restarting..." >> /home/z/my-project/watchdog.log
    pkill -f "next dev" 2>/dev/null
    sleep 1
    rm -rf .next 2>/dev/null
    node_modules/.bin/next dev -p 3000 >> /home/z/my-project/dev.log 2>&1 &
    # Wait for it to start
    for i in $(seq 1 15); do
      sleep 1
      if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
        echo "[$(date)] Server restarted successfully" >> /home/z/my-project/watchdog.log
        break
      fi
    done
  fi
  sleep 3
done
