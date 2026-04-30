#!/bin/bash
# Warmup script - pre-compiles all API routes to avoid OOM during user navigation
# Run this after starting the dev server

echo "[Warmup] Pre-compiling API routes..."

# Wait for server to be ready
for i in {1..30}; do
  if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "[Warmup] Server ready, compiling routes..."

# Compile routes one at a time with delays to avoid memory spikes
curl -s -o /dev/null --max-time 60 http://localhost:3000/api/football 2>/dev/null
echo "[Warmup] Football API compiled ✓"
sleep 2

curl -s -o /dev/null --max-time 20 "http://localhost:3000/api/standings?category=championnats" 2>/dev/null
echo "[Warmup] Standings (championnats) compiled ✓"
sleep 2

curl -s -o /dev/null --max-time 20 "http://localhost:3000/api/standings?category=coupes" 2>/dev/null
echo "[Warmup] Standings (coupes) compiled ✓"
sleep 2

curl -s -o /dev/null --max-time 20 "http://localhost:3000/api/standings?category=nationales" 2>/dev/null
echo "[Warmup] Standings (nationales) compiled ✓"
sleep 2

curl -s -o /dev/null --max-time 20 http://localhost:3000/api/basketball 2>/dev/null
echo "[Warmup] Basketball API compiled ✓"
sleep 2

curl -s -o /dev/null --max-time 20 http://localhost:3000/ 2>/dev/null
echo "[Warmup] Page compiled ✓"

echo "[Warmup] All routes compiled and cached!"
