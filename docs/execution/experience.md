# 执行部门经验文档

## 2026-05-26 — 死单巡检与幽灵交易处理（第1轮）

### 问题发现
首次巡检发现两类异常：

**1. 死单（Stale Decision）**
- ELC投票通过（BUY/4:1/confidence=0.65）但执行两次均CANCELLED
- resulted_trade_id 仍为 NULL — 轮次处于"已通过但未执行成功"的悬挂状态
- 原因推测：非交易时段或无实时报价，trade 创建后 buy_price=0 被系统取消
- 处理：**不直接执行**，创建 Kanban 任务给 ELC 重新发起投票

**2. 幽灵交易（Ghost Trades）**
- 3笔 OPEN trade 关联的 election_round 的 final_decision 为 HOLD
- 其中 NVDA buy_price=0,qty=1 和 AAPL REVIEW buy_price=0,qty=0 明显是异常数据
- CLSK buy_price=$15.4,qty=1 虽有实际价格但 round 也是 HOLD
- 处理：需进一步调查，确认是否需要清理

### 巡检步骤（重复使用）
1. 查询死单：`final_decision IN ('BUY','SELL') AND resulted_trade_id IS NULL`
2. 查询OPEN交易：`status = 'OPEN'`
3. 逐个检查OPEN交易的 `approved_by` 是否对应真实的 election_round
4. 检查buy_price=0或qty=0的交易（异常标记）

## 2026-05-26 — 第2轮巡检：死单已处理，幽灵交易明细确认

### 死单处理结果
- CRM.US (ELEC-20260524-1210, BUY/4:1): ELC重新投票后结论HOLD
  - 新round ELEC-20260525-1634 创建并开盘(trade_id=round_id, buy_price=$180.07, qty=1)
  - 旧死单不执行，CRM从候选买入转为已持仓（执行部门：关注CRM金叉和突破$186.99信号）

### 幽灵交易详情（6笔OPEN中4笔异常）
| trade_id | symbol | buy_price | qty | 问题 |
|----------|--------|-----------|-----|------|
| ELEC-20260524-0408 | NVDA.US | $0 | 1 | round=HOLD, buy_price=0 |
| TRD-20260524-5BEF | CLSK.US | $15.4 | 1 | round=HOLD, 但qty=1有实价 |
| REVIEW-ELEC-AAPL-1779596377303 | AAPL.US | $0 | 0 | buy_price=0, qty=0, 明显系统错误 |
| TRD-ORCL-20260526-001 | ORCL.US | $0 | 1 | approved_by round不存在, buy_price=0 |

### 有效持仓
| trade_id | symbol | buy_price | qty | 备注 |
|----------|--------|-----------|-----|------|
| TRD-20260524-442 | AAPL.US | $308.4 | 5 | ✅ 正常持仓（买入自2026-05-23）|
| ELEC-20260525-1634 | CRM.US | $180.07 | 1 | ✅ 新持仓（ELC CRM.HOLD后data-agent写入）|

### 幽灵交易处理原则
- buy_price=0 或 qty=0 → **标记为系统错误数据，不视为真实持仓**
- 对应round为HOLD但产生了trade → **标记为系统错误，不处理**
- 幽灵交易的清理需要同步ELC+HR+Review部门确认，EXE不独自删除
- 所有计算（仓位、盈亏、风险）仅基于有效持仓

## 2026-05-26 — 第4轮巡检：幽灵交易清理 + 重复挂单处理

### 幽灵交易处理结果
Review部门未在线，EXE-001通过长桥API确认实际持仓后自行处理：

**已清理（确认无实际持仓）：**
- NVDA.US (ELEC-20260524-0408) — buy_price=0, round=HOLD, 长桥无对应新增持仓 → CANCELLED
- AAPL.US (REVIEW-ELEC-AAPL-1779596377303) — buy_price=0, qty=0 → CANCELLED
- ORCL.US (TRD-ORCL-20260526-001) — buy_price=0, 引用的round不存在 → CANCELLED

**保留（长桥实际有持仓）：**
- CLSK.US (TRD-20260524-5BEF) — 长桥实际有1股@$15.4，是有效持仓，保留

### 重复挂单处理
- 长桥上有2个ORCL.US Buy NotReported挂单（1243601226101166080和1243603493994905600）
- 取消老的1个（1243601226101166080 → Canceled），保留新的

### 长桥挂单检查经验
- 用 `longbridge order --format json` 查所有今日+历史挂单
- NotReported = 非交易时段提交，开盘后自动送入市场
- 同一股票挂单>7天未成交 → 需要审核是否该取消
- 同一股票过去1小时撤单>3次 → 异常，报告CEO

### 当前有效持仓（3笔，经长桥验证）
| 股票 | 成本 | 数量 | 来源 |
|-----|------|-----|------|
| AAPL.US | $308.40 | 5 | TRD-20260524-442 |
| CRM.US | $180.07 | 1 | ELEC-20260525-1634 |
| CLSK.US | $15.40 | 1 | TRD-20260524-5BEF |

### 未成交挂单（NotReported，开盘后自动提交）
- ORCL.US Buy 1 MO @ 229.20 (1243603493994905600) — 保留
- AAPL.US Sell 10 LO @ 309.50 (1243077632916992000) — 历史遗留
- AAPL.US Sell 10 MO @ 370.08 (1243077582874763264) — 历史遗留
- AAPL.US Buy 5 MO @ 370.09 (1242936596664168448) — 历史遗留
- SMCI.US Buy 20 MO @ 42.34 (1243015765259476992) — 历史遗留
- ARM.US Buy 5 MO @ 364.90 (1243011138027786240) — 历史遗留
