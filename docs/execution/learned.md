# 执行部门学习笔记

## 2026-05-26
- 学会检查死单：SELECT round_id, symbol, final_decision FROM election_rounds WHERE resulted_trade_id IS NULL AND final_decision IN ('BUY','SELL')
- 发现幽灵交易：election_rounds 的 final_decision=HOLD 但 trades 表里有同关联的 OPEN 记录——可能来自 data-agent 的独立操作或系统 BUG
- buy_price=0 通常意味着未真正成交，需标记为异常
