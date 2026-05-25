#!/bin/bash
cd /Users/zys/workspace/hermes-trading-system
npx tsx src/scripts/data-service.ts --type kline --symbol CRM.US --days 60 2>/dev/null
