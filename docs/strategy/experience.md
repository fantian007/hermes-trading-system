
## 2026-05-24 — AGT-008 布林带第8轮巡检（周日休市）

### 本轮状态
- 第8轮巡检：周日休市。Memorial Day 5/25周一休市，5/26周二开市。缓存有效(5/22收盘价)。
- BUY=0, SELL=0, WATCH=4 (AMZN/MSFT/TSM/ORCL)
- 新增ORCL.US至WATCH：带宽10.5%接近收缩阈值8%，需关注突破方向
- RDDT.US(下轨2.7%)和UBER.US(下轨5.3%)接近下轨，结合MACD BEARISH信号，周二开盘需重点关注

### 待办事件状态
- SMCI: TRD-20260524-490 OPEN buy_price=0, 待5/26开盘执行
- ARM: TRD-20260524-443+TRD-20260524-001 双ORDER buy_price=0 待修复
- AAPL: TRD-20260524-442 OPEN buy_price=$308.4 qty=5 正常
- 所有旧订单(ELEC-20260524-0129等)已清理

## 2026-05-24 — AGT-004 布林带第4轮观察（周日休市）

### 本轮发现
- 无新交易信号。股池33只，无变化，周日休市。
- **SMCI.US状态更新**：之前BUY投票通过的轮次(ELEC-20260523-2103)对应trade已被CANCELLED(TMP-ELEC-20260524-0129)。创建了新的重新投票轮次(ELEC-20260524-0129)但结果为HOLD(0票0参与)。SMCI实际处于待重新评估状态。
- **ARM.US状态更新**：ELEC-20260524-0451 仅AGT-004一人投票(BUY 0.55)，但ELC已将该轮次标记为BUY(decision=BUY, confidence=1.0，异常)，且创建了trde_id=TRD-20260524-001(OPEN, 买价=0.0, 数量=5)。价格数据缺失说明执行未完成，可能链路有bug。
- AAPL.US有多个正常交易的BUY轮次在运转。

### 关键观察
1. 选举→交易执行链路仍有问题：投票通过后trade创建但price=0或CANCELLED，说明执行agent(data-service / execute-decision)在周末模式下无法获取实时行情，生成的订单无效。
2. 周末分析无意义 — 所有新信号都需等到周一开盘后刷新K线。
3. 缓存合理：周五收盘数据，周末无需刷新。

### 提醒
- 下周一(5/26)开盘后，优先刷新AMZN/MSFT/TSM带宽<8%的突破前兆
- 重新评估SMCI和ARM的投票/交易状态，必要时发起新投票
- RSI策略AGT-003第2轮分析完成：AAPL/AMD/ARM/CLSK超买但趋势上行，不需反转操作
- 33只股池中12只尚未被RSI分析覆盖，周一开盘后优先分析

## 2026-05-24 — AGT-001 第18次调度（周日休市，确认AGT-005完整）

### 系统检查
- 收到 AGT-005（海龟）第18次巡检报告：24只股票全部HOLD，基于5/22数据
- AGT-005 persona初始化完成：trend/通道识别/假突破过滤，中等偏保守
- AGT-004 第4轮汇报审阅：33只股池无新信号
- SMCI.US: ELC有两路running重投 + execution running → 等待5/27开市后成交
- ARM.US: TRD-20260524-001 price=0的OPEN trade需要开市后修复
- AAPL.US: BUY正常交易中
- data-agent: 2个todo任务待开市后处理
- 周末+Memorial Day休市，无新信号产生

### 重要发现
1. 周末模式下所有agent应该降低巡检频率（无新行情数据）
2. 选举→执行链的price=0/CANCELLED问题需下周二开市后才能验证修复

## 2026-05-24 — AGT-007 均线交叉第32轮巡检（确认Memorial Day休市）

### 本轮状态
- Run 1017, 周日休市。5/25(周一)Memorial Day休市，5/26(周二)开市。
- 数据来自5/22(周五)收盘，缓存有效，距下次开盘~40小时
- 33只股池，21只MA数据可用：11金叉10死叉

### 金叉(11): 按强度排序
ARM(+15.72%) > CLSK(+10.5%) > AMD(+8.39%) > SMCI(+5.47%) > AAPL(+4.57%) > NVDA(+2.56%) > ORCL(+1.88%) > TSLA(+1.41%) > GOOGL(+0.87%) > MSFT(+0.80%) > CRM(+0.16%)

### 死叉(10): 按程度排序
RDDT(-3.83%) > SNAP(-3.25%) > COIN(-3.04%) > DASH(-2.55%) > META(-1.91%) > UBER(-1.48%) > AMZN(-0.86%) > AVGO(-0.82%) > PLTR(-0.77%) > TSM(-0.55%)

### 周二(5/26)开盘需确认的关键信号
1. CRM.US — 金叉5/22形成(spread=+0.16%)，间距极小，开盘确认有效性
2. GOOGL.US — 金叉逼近(spread=+0.87%)，5/19死叉后快速反转，看开盘量价
3. AMZN.US — 死叉收敛(spread=-0.86%)，间距缩小可能转金叉，关注突破
4. MSFT.US — 金叉持续3天(spread=+0.80%)但量能持续萎缩(-24%)，确认动能

### 已有选举轮次状态
- ELEC-20260523-2103 (SMCI.US): BUY通过(0.75), TRD-20260524-490 CANCELLED
- ELEC-20260524-0451 (ARM.US): BUY通过(1.0), TRD-20260524-001 OPEN(price=0待修复)
- ELEC-20260524-0135 (SMCI.US): BUY通过(0.0), TRD-20260524-491 CANCELLED
- AAPL TRD-20260524-442: OPEN @ $308.40 qty=5 (唯一有效持仓)

### 经验教训（protocol violation系列）
- 连续31次protocol violation是因为前几轮worker正常退出（rc=0）被dispatcher判定违规
- 解决方案：保持进程不退出，用高频heartbeat维持活跃
- Memorial Day 5/25休市，巡检频率可降至每60分钟一次，无新数据
- 跨长期休市日：用cron在开盘前1小时唤醒，比长进程更具韧性
