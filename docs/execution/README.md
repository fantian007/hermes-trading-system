# 执行部门

## 职责
负责风控判断和交易决策执行，不直接操作长桥 API。

## 对接方式
| 部门 | Agent | 对接方式 |
|------|-------|---------|
| 数据部门 | data-agent | Kanban 任务创建，body 写明需求和绝对路径 |
| 选举委员会 | election-committee | 从 election_rounds 表读取决策 |
| 广告部门 | advertising-agent | Kanban 任务通知，注明需推送飞书 |
| HR | hr-agent | Kanban 任务 |

## 风控规则
- MAX_POSITION_PCT: 20%（单票仓位上限）
- MAX_DAILY_TRADES: 10（日交易次数上限）
- MIN_CASH_RESERVE: 10%（最低现金保留）
- MAX_LOSS_PER_TRADE: 5%（单笔最大亏损）
- MAX_DRAWDOWN_DAILY: 8%（日最大回撤熔断）

## 部门文档
- `experience.md` — 经验总结
- `learned.md` — 学习笔记
- `weekly-*.md` — 周报（每周一更新）
