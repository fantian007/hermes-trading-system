#!/usr/bin/env bash
# Wrapper to ensure stdout is line-buffered for scheduler.ts
cd /Users/zys/workspace/hermes-trading-system
exec node --import tsx src/scripts/scheduler.ts 2>&1
