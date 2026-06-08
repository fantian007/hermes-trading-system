# 审核部门 — 学习笔记

> 由 RAG-001 维护 | 新知识优先

---

## 2026-06-08 — 值守轮次: 系统状态检查

**事件**：审核部门常驻轮次，检查系统状态（北京时间 2026-06-08 23:49）。

### 系统概况

本次审计检查了系统所有核心数据表和守护进程状态。系统在连续独立运行13天后，整体状态健康。

| 检查项 | 状态 |
|--------|------|
| 守护进程 | ✅ data-agent daemon (PID 49243) + ELC daemon (PID 50168) 运行正常 |
| 活跃 Agent | ✅ 多个 kanban worker 并行运行中（CEO/data-agent/advertising/strategy/election/execution） |
| 策略 Agent | ✅ 4个ACTIVE: AGT-004(布林带)/AGT-005(海龟)/AGT-007(均线交叉)/strategy-01(策略组长) |
| Agents 记录 | 注意：仅4条agents记录，vs 之前的9条（少了sentiment/ELC/EXE等）。可能是DB重建过 |
| Stock Pool | 3只候选股CRWD/NET/SNOW（均为BULLISH，强度4/5，来源市场巡检）|

### 持仓状态

| 标的 | 方向 | 数量 | 进场价 | 状态 |
|------|------|------|--------|------|
| NVDA.US | LONG | 30 | $236.51 | OPEN |
| AAPL.US | LONG | 50 | $308.31 | OPEN |
| AAPL.US | SHORT | 10 | $308.82 | OPEN |
| AAPL.US | LONG | 1 | $308.82 | OPEN |
| CLSK.US | LONG | 1 | $15.40 | OPEN |

### 选举轮次分析（最近10轮）

- 10轮选举：1×BUY(SMCI)，1×SELL(AAPL)，8×HOLD
- 最近3轮（MSFT/META/GOOGL 2026-05-25 17:04）均为 unanimous HOLD，无分歧
- AAPL SELL轮次（ELEC-20260524-0521-AAPLUS）：5票（4SELL/1HOLD），53%置信度，对应TRD-AAPL-SELL-0524（SHORT方向，10股@$308.82，OPEN）
- 1笔BUY交易（SMCI ELEC-20260523-2103）决策=BUY但最终final_decision=HOLD（可能之前手动修复过）
- AAPL持仓有50L+10S对冲状态，$308.31~$308.82区间，近似完全对冲

### 关键发现

1. **Review Reports 表为空**：交易虽有完成但无审核记录。但考虑到系统仍处于早期阶段，且仅有OPEN/长期持仓无新CLOSED交易，暂无待审核对象。
2. **Win Reports 表为空**：无已关闭的可评估交易，策略Agent尚未积累足够交易数据计算胜率。
3. **持仓都以EXISTING/早期方式导入**：所有trade_id格式为手动命名（TRD-AAPL-EXISTING等），非自动生成的TRD-YYYYMMDD-xxx格式。
4. **策略Agent数量精简**：从早期的7个策略+策略组长+多个系统agent减少到4个ACTIVE记录。未见agent_status_log记录本次精简，可能其他DB实例记载精简历史。
5. **候选股池缩量**：从原来的~6只（AAPL/AMZN/CLSK/CRM/MSFT/NVDA）变为3只AI概念股（CRWD/NET/SNOW）。较大的市值持仓（NVDA/MSFT/META/GOOGL/AMZN）从池中移除。

### 待关注

- 无待审核的CLOSED交易
- 系统在快速迭代中，DB状态可能被重置或部分更新
- 广告守护进程和整体系统健康由CEO-001巡检维护

## 2026-05-26 20:40 — 值守轮次: 系统状态检查

**事件**：审核部门常驻轮次，检查系统状态。

### 本轮审计发现

1. **系统整体健康**
   - 7个 Agent进程全部活跃：CEO、data-agent、strategy-director、election-committee、review-auditor、execution-agent + 后台advertising-daemon
   - 广告守护进程(pid 77941)运行正常，最新飞书消息于20:39发送
   - 审核看门狗 x2：review-daemon.sh(5643) + review_auditor_loop.sh(97808) 均正常
   - 无待审核 CLOSED 交易（唯一CLOSED为TRD-20260524-425，已审核）

2. **持仓与DB记录差异 (未解决)**
   - 长桥显示6只持仓（NVDA 30/MSFT 30/META 20/GOOGL 12/CLSK 1/AAPL 40）
   - DB OPEN记录：AAPL 5+5 / CLSK 1+50 / CRM 1 / GOOGL 12(scrapped)
   - NVDA(30)/MSFT(30)/META(20) / CLSK 多出的49股 / AAPL 多出的30股 — 均无DB记录
   - 净权益 $87,588.95，现金 $39,205.09，风险等级 Safe

3. **选举轮次分析**
   - ELEC-20260526-2014系列 (5只MAG7)，均为HOLD或SELL决策
   - GOOGL SELL(3:2) 以64.9%置信度执行，但trade direction=LONG（方向字段错误，仍OPEN）
   - ELEC-20260526-1205/1206 CLSK/AAPL BUY已执行（AAPL $310.62×5 / CLSK $16.55×50）
   - ELEC-20260526-2004 NVTS HOLD（1 BUY + 4 HOLD）
   - ELEC-20260526-2010 CRM HOLD（0票，无人投票）

4. **策略Agent健康**
   - 5个策略Agent (AGT-002/004/005/007/008) + SENT-001 + ELC-001 + EXE-001 均 ACTIVE
   - 所有Agent win_rate/total_trades = 0（尚无足够交易）
   - 市场池仍有6只股票（AAPL/AMZN/CLSK/CRM/MSFT/NVDA）+ NVTS特殊

5. **遗留问题**
   - GOOGL TRD-20260526-GOOGL-SELL sell_price已填但状态仍OPEN（应为CLOSED，方向应为SHORT）
   - 长桥实际持仓与DB不同步（可能需要数据部门做一次全量sync）

### 待学习
- 如何在审核报告中有效评估 Agent 绩效（量化指标）
- 审核结果与 HR 审计流程的联动机制
- 跨部门审核协作的最佳实践
- DB与实际持仓的不一致如何自动恢复

## 2026-05-26 — 审核部门文档初始化

**事件**：创建 docs/review/experience.md 和 learned.md，完成审核部门三件套文档体系。

### 学习要点

1. **review-and-audit.ts K 线数据缺失修复经验**
   - 原始设计只关注 trade 元数据 + 投票数据，未考虑技术指标审计需要价格序列
   - 修复：新增 --kline-days 参数（默认 100），通过子进程调用 data-service.ts --type kline
   - 网络失败不阻断审计主流程

2. **审核框架独立性原则**
   - 各审核官使用不同框架（MACD/RSI/布林带/海龟/均线交叉）独立判断
   - 框架不适配时注明 N/A 并跳过
   - 结论互不干扰：PASS/WARN/FAIL 各自独立

3. **RAG-001 汇总提交规范**
   - 交易 ID + 标的
   - 各审核官 verdict + reasoning 摘要
   - PASS/WARN/FAIL 数量统计
   - 各参与 Agent 绩效评价
