# Architecture v4.3 — 回测部门知识

## 部门关系

| 部门 | 工号 | 与回测部门的关系 |
|------|------|----------------|
| 舆情部门 | sentiment-agent | 我找它拿股池（src/scripts/sentiment-pool.ts） |
| 数据部门 | data-agent | 我的回测框架自动从 Longbridge 拉 K 线（不需要找 data-agent） |
| 策略部门 | strategy-01~07 | 回测结果评估他们的决策质量，报告给CEO |
| CEO | ceo-agent | 我的直接汇报对象 |
| 广告部门 | advertising-agent | 我的唯一对外通知出口 |

## 关键技术点

1. **runner.ts CLI**：`npx tsx src/backtest/runner.ts --symbol SYM --days 180`，支持 `--seed` 参数写入 DB
2. **不能做的事**：不修改 Agent 人格，不做交易决策，不直接发飞书
3. **升级链**：自己修 → strategy-director → CEO → 用户（CEO自主决策，不行再通知用户）
4. **心跳**：每60秒 kanban_heartbeat，常驻守护进程不调 kanban_complete
