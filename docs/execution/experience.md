# 执行部门经验文档

## 2026-05-26 — 死单巡检与幽灵交易处理

### 问题发现
首次巡检发现两类异常：

**1. 死单（Stale Decision）**
- ELC投票通过（BUY/4:1/confidence=0.65）但执行两次均CANCELLED
- resulted_trade_id 仍为 NULL — 轮次处于"已通过但未执行成功"的悬挂状态
- 原因推测：非交易时段或无实时报价，trade 创建后 buy_price=0 被系统取消
- 处理：**不直接执行**，创建 Kanban 任务给 ELC 重新发起投票

**2. 幽灵交易（Ghost Trades）**
- 3笔 OPEN trade 关联的 election_round 的 final_decision 为 HOLD，理论上不应产生交易
- 其中 NVDA buy_price=0,qty=1 和 AAPL REVIEW buy_price=0,qty=0 明显是异常数据
- CLSK buy_price=$15.4,qty=1 虽有实际价格但 round 也是 HOLD — 可能是 data-agent 手动操作造成
- 处理：需进一步调查数据源，确认是否需要清理

### 巡检清单（Execution Agent Day 1）
- [x] 检查死单（PASSED round 但 resulted_trade_id IS NULL）
- [x] 检查 OPEN 交易异常
- [x] 通知相关部门（ELC重新投票、Ad发送通知）
- [ ] 记录经验文档（本次）
- [ ] 更新 persona 档案
