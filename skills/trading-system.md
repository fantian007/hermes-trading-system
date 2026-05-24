---
name: trading-system
description: AI 选举交易系统 — 多 Agent 协作的自动化交易系统。Hermes Kanban 编排，Longbridge 模拟盘交易。9 个 Agent 全自动闭环：选股、投票、执行、审核、成长。
version: 0.2.0
---

# Hermes AI 选举交易系统

多 Agent 选举交易系统 — 9 个 Agent 协作的自动化交易引擎。策略部门与审核部门分别合并到单一组长，实现 7 个策略视角 + 5 个审核视角的并行模拟。

## 系统架构

```
                    ┌──────────────────┐
                    │  舆情部门         │
                    │  sentiment-agent │
                    │  (股池维护)       │
                    └────────┬─────────┘
                             │ BULLISH/BEARISH 信号
                             ↓
┌────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 数据部门     │    │  策略部门组长     │    │  回测部门         │
│ data-agent │◄──►│  strategy-01     │    │  backtest-agent  │
│ (行情/交易)  │    │  (7个策略视角)    │    │  (历史验证)       │
└────────────┘    └────────┬─────────┘    └──────────────────┘
                           │ 7票 (BUY/SELL/HOLD)
                           ↓
                    ┌──────────────────┐
                    │  选举委员会       │
                    │  election-comm.  │
                    │  (召集+统计)      │
                    └────────┬─────────┘
                             │ 通过/驳回
                             ↓
                    ┌──────────────────┐
                    │  执行部门         │
                    │  execution-agent │
                    │  (风控+下单)      │
                    └────────┬─────────┘
                             │ 交易完成通知
                             ↓
                    ┌──────────────────┐
                    │  审核部门组长     │
                    │  review-01       │
                    │  (5个审核视角)    │
                    └────────┬─────────┘
                             │ 审核报告
                             ↓
                    ┌──────────────────┐         ┌──────────────────┐
                    │  HR 部门          │◄───────►│  广告部门         │
                    │  hr-agent        │         │ advertising-agent│
                    │  (人事+知识库)    │         │ (唯一对外出口)    │
                    └──────────────────┘         └──────────────────┘

                    ┌──────────────────┐
                    │  CEO (ceo-agent) │
                    │  (巡检+自愈)      │
                    └──────────────────┘
```

## 9 个 Agent 职责

| Agent | 工号 | 部门 | 职责 |
|-------|------|------|------|
| **sentiment-agent** | SENT-001 | 舆情部门 | 监控股票涨跌/新闻/利好利空，维护候选股池（~20只） |
| **data-agent** | DAT-001 | 数据部门 | 系统唯一数据接口，被动响应行情/K线/持仓/交易请求 |
| **strategy-01** | AGT-001 | 策略部门 | **身兼两职**：(1) 中心调度器，每3分钟巡检派发任务；(2) 一人模拟7个策略视角（MACD金叉、均线趋势、布林带、成交量、海龟、技术面综合、主力行为+基本面）各投1票 |
| **election-committee** | ELC-001 | 选举委员会 | 向策略部门征集投票，统计加权结果，判断通过/驳回，提交执行 |
| **execution-agent** | EXE-001 | 执行部门 | 接收选举决策 → 风控检查（振幅、资金流、盘口、主力行为、挂单）→ 通过 data-agent 下单 |
| **review-01** | RAG-001 | 审核部门 | **一人模拟5个审核视角**（MACD、RSI、布林带、海龟、均线交叉），对每笔已成交交易独立审核（PASS/WARN/FAIL），汇总报告给HR |
| **hr-agent** | HR-001 | HR 部门 | 组织架构咨询、Agent 绩效审计、人事变动管理（入职/淘汰/复活）、知识库管理、全员规章制度学习 |
| **advertising-agent** | ADV-001 | 广告部门 | **系统唯一对外通知出口**。所有 Agent 操作完成都通知此 Agent，由它飞书发给用户（带去重规则） |
| **backtest-agent** | BKT-001 | 回测部门 | 每日跑回测（180天），生成回测报告，发现策略退化趋势并告警；每日学习新回测方法 |
| **ceo-agent** | CEO-001 | CEO | 最高决策者：每5分钟系统巡检（健康诊断+自愈）、每30分钟全员宣讲、每日0:00督促文档更新+Git提交、每日项目审计 |

> 替补：`backtest-agent` 为周期性 Agent（每日1次），其余均为常驻守护进程。

## 新架构关键变更

- **去掉了 scheduler-agent** — 调度职责并入 strategy-01 的第二职责
- **去掉了 watch-agent** — 盯盘职责并入 sentiment-agent + strategy-01 巡检
- **去掉了 auditor-agent** — 审计职责并入 hr-agent（人事决策由HR综合审核报告+胜率数据判断）
- **去掉了 review-02~05** — 全部合并到 review-01 身上，由他一人模拟5个审核视角
- **去掉了 strategy-02~08** — 全部合并到 strategy-01 身上，由他一人模拟7个策略视角
- **新增 advertising-agent** — 系统唯一对外通知出口
- **新增 backtest-agent** — 独立回测部门
- **每日自成长** — strategy-01 和 review-01 每天自行学习新的策略/审核视角

## 快速开始

### 1. 安装依赖
```bash
cd ~/workspace/hermes-trading-system
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 填入 FEISHU_APP_SECRET、LONGBRIDGE_APP_KEY 等
```

### 3. 初始化数据库
```bash
npx tsx sql/init.ts
npx tsx sql/seeds/seed.ts
```

### 4. 注册 Hermes Profiles
```bash
hermes profile create -f profiles/sentiment-agent.yaml
hermes profile create -f profiles/data-agent.yaml
hermes profile create -f profiles/strategy-01.yaml
hermes profile create -f profiles/election-committee.yaml
hermes profile create -f profiles/execution-agent.yaml
hermes profile create -f profiles/review-01.yaml
hermes profile create -f profiles/hr-agent.yaml
hermes profile create -f profiles/advertising-agent.yaml
hermes profile create -f profiles/backtest-agent.yaml
hermes profile create -f profiles/ceo-agent.yaml
```

### 5. 启动系统
主入口为 strategy-01 的中心调度循环（每3分钟巡检+派发）和 CEO 的系统巡检（每5分钟）。各 Agent 通过 Kanban 任务编排联动。

## 数据流

```
sentiment-agent 维护股池               → strategy-01 获取股池分析
strategy-01 (7票) 投票                 → election-committee 统计
election-committee 投票通过            → execution-agent 风控+下单
execution-agent → data-agent 执行      → 结果返回
data-agent 通知交易完成                → review-01 审核
review-01 (5个视角) 审核报告           → hr-agent 审计
hr-agent 人事决策                      → advertising-agent 飞书通知
backtest-agent 每日回测                → CEO 决策优化
```

## 数据库

SQLite — `data/trading.db`。核心表：
- agents · agent_status_log · trades · agent_votes · win_reports
- election_rounds · stock_pool · agent_traits · strategy_signatures
- daily_ledger · review_reports

## 关键脚本

| 脚本 | 用途 |
|------|------|
| `src/scripts/sentiment-scan.ts` | 市场扫描 + 股池维护 |
| `src/scripts/sentiment-add.ts` | 加入股池 |
| `src/scripts/sentiment-remove.ts` | 踢出股池 |
| `src/scripts/data-service.ts` | 统一数据查询（报价/K线/持仓/账户） |
| `src/scripts/execute-decision.ts` | 执行交易 |
| `src/scripts/review-and-audit.ts` | 获取审核数据 |
| `src/scripts/review-submit.ts` | 提交单个审核视角 verdict |
| `src/scripts/aggregate-votes.ts` | 统计加权投票 |
| `src/scripts/onboard-agent.ts` | Agent 入职/组织架构 |
| `src/scripts/terminate-agent.ts` | Agent 离职/淘汰 |
| `src/scripts/audit-cycle.ts` | 胜率/排名统计 |
| `src/scripts/persona.ts` | Agent 人格进化记录 |
| `src/scripts/alarm.ts` | 工作日志/时间记录 |
| `src/backtest/runner.ts` | 180天策略回测 |

## 自成长机制

- **strategy-01**: 每天0:00搜索新策略，评估是否新增策略视角（AGT-009+），更新到 docs/strategy/learned.md
- **review-01**: 每天0:00回顾当天审核交易，学习新审核框架，更新到 docs/review/learned.md
- **backtest-agent**: 每天学习回测方法论，优化 runner.ts，更新到 docs/backtest/learned.md
- **ceo-agent**: 每天为各策略 Agent 创建学习任务，学新剔旧

## 测试
```bash
npm test
```

## 架构文档

详见飞书文档: https://bytedance.feishu.cn/docx/G4qmdQeuKo2hSXxMbk4c2jRsn3c
架构图: architecture.html
