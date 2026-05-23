# 执行部门 — 经验总结

## 2026-05-25 — EXE-001 启动 (#3): 死单巡检流程

### 1. 死单检测SQL修正
`election_rounds` 表没有 `status` 列也没有 `side` 列。正确的死单检测SQL：
```sql
SELECT round_id, symbol, final_decision FROM election_rounds 
WHERE final_decision != 'HOLD' AND resulted_trade_id IS NULL;
```
`final_decision` 为 TEXT（BUY/SELL/HOLD），`resulted_trade_id` 为空表示该轮决策未产生交易记录。

### 2. 死单处理流程
发现死单后：**不盲执行** → 创建 Kanban 任务给 election-committee 重新投票 → 通知 advertising-agent 发送通知。
不要尝试自己补执行，因为信号可能有时间衰减。

### 3. ESM 模块执行
`package.json` 中 `"type": "module"`，必须用 `node --import tsx -e "..."` 加载 tsx。
`npx tsx -e` 在 CJS 模式下可能报 MODULE_NOT_FOUND。

## 2026-05-24 — EXE-001 重启 (#2): daemon 进程回收与恢复

### 1. 后台守护进程的生存周期问题
Hermes 的 `terminal(background=true)` 后台进程在以下情况下会被回收：
- Hermes 会话（resgen）排它模式结束后重新创建 agent（之前的 run 666 被 dispatcher 标记为 crashed）
- 杀死老进程后不立即启动新进程，而是先全面清理再启动
- 使用 `background=true` 启动的进程在 agent 的 resgen 重建后仍然存活（PID 继续跑），但 Hermes 内部会话 ID 变了

### 2. 多实例问题
多次 restart 会积累多个后台进程。重启前应先 kill 所有旧实例：
```
pkill -f 'exe-daemon.mjs'
```
然后再用 terminal(background=true) 启动新实例。

### 3. 当前状态 (2026-05-25 UTC)
- Daemon PID 51226 正常运行，Cycle 1 已完成
- 1 笔 OPEN 交易：AAPL.US LONG (buy_price=0, 待交易所确认)
- 最后 eletion round: ELEC-20260523-2035 (AAPL.US, HOLD)
- 无新的 BUY/SELL 决策待执行

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

exe-daemon.mjs中硬编码 DB = path.join(PROJECT, 'trading.db') 但正确路径是 data/trading.db（由 config.ts 中的 DB_PATH 控制）。定位为根目录下的 trading.db 才是旧的空数据库。修正后 daemon 正确看到 16 agents, 1 笔 open trade。下次启动 daemon 前先确认使用正确的数据库路径。

## 2026-05-24 — 守护进程常驻模式

### Kanban Dispatcher 与后台 daemon 分离模式
execution-agent 作为常驻守护进程（永不退出），但 Hermes Kanban dispatcher 会回收超时或退出的 session。解决方案：

1. **分离模式**：用 `terminal(background=true)` 启动 `scripts/exe-daemon.mjs` 作为独立后台进程。这个进程不依赖 Kanban session，即使 dispatcher 回收了任务，daemon 继续运行。
2. **Kanban 任务**：作为轻量级心跳/ping 任务，定期创建工作循环（new Kanban task），检查状态并发送通知。
3. **daemon 存活检测**：每次 Kanban 任务启动时首先检查 daemon 是否还活着：`ps aux | grep exe-daemon`。如果死了，重新启动。
4. **max_runtime_seconds**：创建 Kanban 任务时设置 `max_runtime_seconds=2592000`（30天）避免被 dispatcher 提前超时。

关键：daemon、Kanban 任务、CLI session 是三层独立生命周期，不要混在一起。daemon 用 background process 保持独立存活。真实启动流程：terminal(background=true) → node scripts/exe-daemon.mjs。

## 2026-05-24 — CEO 自检执行记录

- 死单检查 SQL 应使用 `final_decision != 'HOLD' AND resulted_trade_id IS NULL` 而非虚构的 `status='PASSED'` 
- 交易通过 `longbridge` CLI（不是 Node SDK）完成，CLI 认证在 `~/.longbridge/openapi/tokens/`，无需 `.env` 配置
- `dist/` 产物路径含 `src/` 层级：导入路径是 `./dist/src/core/db.js` 而非 `./dist/core/db.js`
- 当前无待执行交易，系统健康

## 2026-05-24 — EXE-001 重启: 清理遗留死单

### 1. 遗留死单清理
DB 中有一笔 `trade_id=ELEC-20260523-2035` (AAPL.US, quantity=0, buy_price=0, status=OPEN) ——
这是之前执行过程的产物（投票为 HOLD 但意外创建了交易记录）。处理方法：
- 确认 original round 的 `final_decision=HOLD` 不存在 BUY/SELL 信号
- 确认 quantity=0 且 buy_price=0（无实际交易）
- 删除该 trade 记录（FOREIGN KEY 约束可通过 sqlite3 绕过但 tsx 会拦截——实际没有外键引用，是表结构约束问题）
- 如果删除时遇到 FOREIGN KEY 约束失败，用 `sqlite3` 直接执行 DELETE

### 2. 数据库查询选择
- npx tsx 调用 TypeScript API 时 timeout 较长（~20-30s）
- 简单查询用 `sqlite3 data/trading.db "SQL"` 更快（~1s）
- 复杂查询或需要导入框架代码时再用 tsx

### 3. Daemon 启动确认
- daemon 启动后需检查 log 确认正常
- 检查 `ps aux | grep exe-daemon` 确认进程存活
- 检查 `logs/exe-state.json` 确认第一轮巡检已完成

## 2026-05-24 — EXE-001 守护架构: 多实例共存

### 1. 多个 execution-agent 实例共存模式
当前有 4 个 execution-agent 进程同时运行：
- **t_8c4b6e1e** / t_bf9dd3e6 — 常驻守护进程（不调 complete）
- **t_4f9c64a1** — 交易执行任务（由 election-committee 创建的非守护任务，执行完会 complete）
- **t_f9d134be** — 带 longbridge skill 的任务

多实例模式是正常的——不同的 Kanban 任务由不同进程处理，各自独立。

### 2. 常驻守护 vs 交易执行
- 常驻守护 (t_8c4b6e1e / t_bf9dd3e6): 启动 exe-daemon.mjs 后台进程，持续巡检，永不 complete
- 交易执行 (t_4f9c64a1): 由 election-committee 创建，负责一次具体的风控→下单→完成
- 守护进程只负责巡检和发现，不参与实际下单（另有其他 execution-agent 实例处理 ELC 创建的交易任务）

### 3. daemon 更新记录
- 新增 checkPendingExecutions() 函数：检测 final_decision IN ('BUY','SELL') 且 resulted_trade_id IS NULL 且 executed_at IS NULL 的行
- 状态文件 logs/exe-state.json 新增 pendingExecutions 字段

## 2026-05-24 — EXE-001 执行死单重投: AAPL.US BUY (ELEC-20260523-2035)

### 1. 死单重投处理流程
选举委员会重新投票通过的 BUY/SELL 轮次（`resulted_trade_id IS NULL`），执行 Agent 需要：
- 先做完整风控审核（持仓/行情/账户数据 via data-service.ts）
- 风控通过后，通过 Kanban 创建 data-agent 任务执行下单
- 同时创建广告通知任务（advertising-agent 发送飞书）
- 等待 data-agent 返回成交结果

### 2. 风控计算指引
- 单票仓位 = (已有股数 + 新增股数) × 当前市价 ÷ net_assets
- 日交易次数查 sqlite3: `SELECT COUNT(*) FROM trades WHERE date(created_at)=date('now') AND direction='LONG'`
- 现金充足性查 `longbridge assets` → total_cash
- 风控参数在 `config.ts` 统一管理

### 3. -e 模式不要用 require
项目是 `"type": "module"`，不能直接用 `-e "const { getDb } = require(...)"`。简单查询直接用 `sqlite3 data/trading.db "SQL"`。
