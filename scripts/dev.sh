#!/bin/bash
export NODE_OPTIONS="--max-old-space-size=8192"
exec next dev -p 3000 2>&1 | tee dev.log
