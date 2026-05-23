# 执行部门 — 经验总结

## 2026-05-24 — run 83 首次部署要点

### 1. Kanban Daemon 协议问题
execution-agent 是常驻守护进程（永不调 kanban_complete），但之前 3 次尝试都因进程退出 (exit code 0) 被调度器标记为 protocol violation。
- 必须保持无限循环，不能自然退出
- 每次工作循环结束后发心跳，然后继续循环

### 2. 数据部门协作方式
当前 data-agent 的 workspace 配置为 scratch（空目录），导致 data-agent 启动后无法通过相对路径找到项目目录。
- 工作区内直接执行 `cd /Users/zys/workspace/hermes-trading-system` 可以解决问题
- 如果需要 data-agent 协助查询/下单，需确保 data-agent 任务的 body 中指定绝对路径

### 3. 选举轮次状态检查
`trigger-vote.ts --list-rounds` 不存在该参数，脚本默认输出股池信号。
检查待处理选举轮次直接用 sqlite3 查 election_rounds 表：
```sql
SELECT * FROM election_rounds WHERE executed_at IS NULL;
```

### 4. OPEN 交易无价格问题
当前 trades 表中有两条记录 (AMD.US×10, TSM.US×10) 的 buy_price=0.0，状态为 OPEN。
可能是 execute-decision.ts 创建了 trade 记录但未成功获取成交价。
观察这些记录的后续状态变化。

### 5. 持仓实时价格获取
`data-service.ts --type quote --symbol XXX.US` 输出的是多行 JSON 对象。
解析方法：从输出中找到第一个 `{` 和最后一个 `}`，截取中间的 JSON 字符串解析。
多支股票需要逐个查询，没有批量报价接口。

### 6. 当前持仓损益 (2026-05-24 04:05 UTC)
```
NVDA  x30 @ 236.51 → $215.33  -8.95%  P&L -$635  ⚠️ 需关注
MSFT  x30 @ 418.89 → $418.57  -0.08%  P&L  -$10
META  x20 @ 610.05 → $610.26  +0.03%  P&L   +$4
GOOGL x12 @ 386.80 → $382.97  -0.99%  P&L  -$46
CLSK  x 1 @  15.40 →  $15.97  +3.70%  P&L   +$1
AAPL  x50 @ 308.31 → $308.82  +0.17%  P&L  +$26
```
总持仓价值 $51,274.81，总亏损 -$660.50 (-1.27%)。
账户总净资产 $87,223.66，风险等级 Safe。

### 7. 守护进程运行方式
作为 Kanban 常驻任务，execution-agent 不能退出。解决方案：
- 使用无限循环（while true），每次循环发心跳
- 循环间隔 ~60 秒
- 用 background process (terminal background=true) 运行 node 守护脚本
- 在当前 CLI 会话中保持活跃，每次心跳后由调度器保证持续运行
- 守护脚本 scripts/exe-daemon.mjs 每 60 秒轮询 election_rounds 表
- 发现新 election round 会记录到日志和 state json
- 当前账户状态：$87,223.66, 6只持仓 (NVDA/MSFT/META/GOOGL/CLSK/AAPL)
- 数据库为空（无 election rounds，无 trades，无 stock_pool 信号）
- 风控检查通过：无持仓超限、无熔断条件、无待执行交易

## 2026-05-24 — 首次执行交易：AAPL.US BUY 5 股

### 1. 实时数据优先
不要依赖本地 DB 中的持仓数据——长桥上的实际持仓才是真实状态。DB 可能滞后（如 AAPL 本地记录为 quantity=0，但长桥实际持有 50 股）。下单前先用 `longbridge positions` 和 `longbridge assets` 验证。

### 2. 非交易时段下单
周六/周日提交市价单，状态为 `NotReported`——订单已记录到长桥系统，但需等开市后成交。`order detail` 查询可追踪状态变化。

### 3. 风控计算方式
用 `longbridge assets --format json` 获取净净资产 ($87,223.66) 和总现金 ($36,090.79)。单票上限 = net_assets × 20% = $17,444。用 `longbridge positions` 获取实时持仓市值。

### 4. 既有 trade 记录的处理
当 election_rounds 的 resulted_trade_id 已指向一个 trade 记录时（如 trade_id=ELEC-20260523-2023），用 UPDATE 而非 INSERT。示例：
```python
UPDATE trades SET quantity = ? WHERE trade_id = ?
UPDATE election_rounds SET executed_at = datetime('now') WHERE round_id = ?
```

### 5. data-agent 替代方案
longbridge CLI 已安装在本地，可代替 data-agent 直接获取行情 (`longbridge quote`)、持仓 (`longbridge positions`)、资产 (`longbridge assets`) 和下订单 (`longbridge order buy/sell`)。比通过 Kanban 请求 data-agent 快得多。

## 2026-05-24 — EXE-001 重启: daemon DB 路径修正

exe-daemon.mjs 中硬编码 DB = path.join(PROJECT, 'trading.db') 但正确路径是 data/trading.db（由 config.ts 中的 DB_PATH 控制）。定位为根目录下的 trading.db 才是旧的空数据库。修正后 daemon 正确看到 16 agents, 1 笔 open trade。下次启动 daemon 前先确认使用正确的数据库路径。
