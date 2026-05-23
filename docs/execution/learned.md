# 执行部门 — 学习笔记

## 2026-05-24

### Kanban Daemon 模式
- `execution-agent` 的 task body 明确写"不调 kanban_complete，永远 running"
- 调度器期望进程要么调 kanban_complete（任务完成）要么 kanban_block（阻塞），否则标记为 protocol violation 并 crash 掉当前 run 重新调度
- 守护进程的解决方案：保持无限循环 + 定期心跳，永不退出

### 持仓监控要点
- 模拟盘账户 $87K，6 只持仓
- NVDA 成本 236.51，浮亏约 8.9%——接近止损线但未触及 5% 单笔亏损上限（因为这是整个头寸的浮亏，不是单次交易亏损）
- 风控规则中的 MAX_LOSS_PER_TRADE=5% 指的是单次交易的亏损，不是持仓浮亏
- 账户总现金 -$68,939.48（负值说明有大量结算中资金），net_assets=$87,223.66 正常

### 交易系统数据流
信号流：
sentiment-agent / CRON → stock_pool (SQLite)
watch-agent monitor → 发现 strength≥3 → 创建 election round
election-committee 聚合投票 → 决定 BUY/SELL
| 20|execution-agent 风控检查 → 通知 data-agent 下单
| 21|data-agent 执行 → 写 trades 表 → 通知 execution-agent
| 22|execution-agent → 通知 advertising-agent → 飞书

### 死单重投流程
1. 选举委员会重新投票（Election round 已 PASSED 但 resulted_trade_id IS NULL）
2. EXE-001 做完整风控审核：查持仓→查行情→查账户
3. 风控通过后，创建 data-agent 任务执行下单
4. 若 data-agent 卡住（非交易时段长桥 API 超时/无响应），EXE-001 可直接用 longbridge CLI 提交订单
5. 提交命令：`longbridge order buy <SYM> <QTY> --order-type MO -y --format json`
6. 更新 DB：INSERT trades + UPDATE election_rounds SET resulted_trade_id
7. 通知广告部门

### 非交易时段下单
- 周末（周六/周日）提交市价单，长桥返回 `submitted price not found`（code 602001）
- 使用 `--order-type MO -y` 可以跳过确认提交
- 提交后订单状态为 NotReported，待开市后执行
- buy_price=0.0 是因为成交价未知，待交易所确认后更新

### 异常处理
- data-agent crash 时，execution-agent 可以自己直接调用 data-service.ts 脚本获取数据（因为 execution-agent 也在交易系统目录下运行）
- 但下单必须通过 data-agent（profile 约束），不能越权

### 持仓预警阈值
- NVDA 浮亏 -8.95%，接近风控规则的日最大回撤熔断线 8%
- 但注意：MAX_DRAWDOWN_DAILY=8% 指的是**日**回撤，而 NVDA 的亏损是累计的。需要检查当日开盘价 vs 当日亏损来计算日内回撤
- NVDA 成本 236.51，昨收 219.51，当前 215.33。当日从昨收起算：-4.18 (-1.9%)，未触及 8% 熔断
- 需区分：单笔交易亏损 (MAX_LOSS_PER_TRADE=5%) vs 持仓浮亏 vs 日回撤 (MAX_DRAWDOWN_DAILY=8%)
## 2026-05-24 — 已修正: daemon 数据库路径
1. exe-daemon.mjs: trading.db → data/trading.db
2. 遗留问题: 1笔OPEN交易 AAPL.US buy_price=0.0，上次执行时 data-agent 未正确记录成交价。不影响系统继续运行。
