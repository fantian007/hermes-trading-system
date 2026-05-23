#!/usr/bin/env bash
# Wrapper to ensure stdout is line-buffered for daemon.ts
cd /Users/zys/workspace/hermes-trading-system
exec node --import tsx src/scripts/daemon.ts 2>&1
