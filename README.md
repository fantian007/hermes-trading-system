# 🗳️ AI 选举交易系统

> **多 Agent 协作的自动化美股交易系统** — 将交易决策抽象为选举投票机制，10 个 AI Agent 组成 8 个部门，通过自然语言对话做决策。

[![GitHub](https://img.shields.io/badge/Powered_by-Hermes_Kanban-6366f1)](https://github.com/nousresearch/hermes)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Agent](https://img.shields.io/badge/Agent-10-22c55e)](profiles/)
[![Department](https://img.shields.io/badge/Department-8-8b5cf6)](docs/architecture.md)

---

## 🧠 设计哲学

```
代码(KB) : Agent(自然语言)  ≈  0 : 100
```

| 归属 | 负责内容 |
|------|---------|
| **代码** | 读写 DB、调 Longbridge CLI、纯数据聚合 |
| **Agent** | **一切决策**：选股、盯盘、投票、风控、淘汰、下单量、买卖时机 |

**Agent 之间通过自然语言聊天做决策，脚本只做纯数据提供服务。没有脚本替 Agent 做任何判断。**
Agent 完全自治，不依赖外部调度——每个 Agent 是常驻守护进程，通过 Kanban 任务相互唤醒。

---

## 🏛️ 系统架构

```
舆情部门 ──监控新闻/行情──→ 发现利好→加入股池，发现利空→踢出股池，维持约20只
    │
    ├─ 股池变动 → 通知策略组长
    │
    ▼
策略部门 (组长一人28个策略视角) ──自主分析──→ 发现机会 → 发起投票请求
    │
    ▼
选举委员会 ──召集全体策略Agent投票──→ aggregate-votes.ts ──赞成≥反对→通过
    │
    ▼
执行部门 ──风控判断──→ 向数据部门提需求
    │
    ▼
数据部门 ──execute-decision.ts──→ 交易完成
    ├─ 通知审核部门 (组长一人5个审核视角)  → 事后审核
    └─ 通知选举委员会  → 回执关闭轮次
    │
    ▼
HR 部门 ──综合审核报告+胜率统计──→ 人事决策（淘汰/影子期/复活/警告）
    │
    ▼
广告部门 ──格式化消息──→ 飞书通知用户
    │
    └── HR拿不定主意时 ──发起投票──→ 飞书 → 用户回复确认

CEO ──每5分钟巡检──→ 守护所有Agent，定期督促文档/GitHub提交
backtest ──每24小时──→ 回测策略有效性
```

---

## 🏢 8 大部门 · 10 Agent

| # | 部门 | Agent | 人数 | 角色 |
|---|------|-------|------|------|
| 1 | 👑 **CEO（最高决策）** | `ceo-agent` | 1 | 系统守护，5分钟巡检，30分钟宣讲，0点督促文档+GitHub |
| 2 | 📡 **舆情部门** | `sentiment-agent` | 1 | 情报员，监控新闻，维护候选股池，每日0点新闻巡检 |
| 3 | 💹 **数据部门** | `data-agent` | 1 | IT 运维 + 交易操作，唯一的长桥接口 |
| 4 | 📊 **策略部门** | `strategy-director` | 1 | 独立分析师，一人28个策略视角 |
| 5 | 📋 **选举委员会** | `election-committee` | 1 | 投票召集人与计票人 |
| 6 | ✅ **审核部门** | `review-auditor` | 1 | 风控审计，一人5个审核视角 |
| 7 | 🚀 **执行部门** | `execution-agent` | 1 | 风控判断，交易执行 |
| 8 | ⚠️ **HR 部门** | `hr-agent` | 1 | 人力资源 + 组织发展 + 绩效审计 |
| 9 | 📢 **广告部门** | `advertising-agent` | 1 | 统一对外通知出口 |
| 10 | 🔬 **回测部门** | `backtest-agent` | 1 | 周期性策略回测与验证 |
| **合计** | | **10 Agent** | **10** | |

### 策略部门（28个策略视角）

**7个核心策略：**

| 工号 | 策略名称 | 核心逻辑 |
|------|---------|---------|
| AGT-002 | MACD金叉/死叉 | DIF上穿DEA→BUY，下穿→SELL |
| AGT-003 | 均线趋势 | MA5/10/20排列，多头→BUY，空头→SELL |
| AGT-004 | 布林带 | 轨道位置+带宽，放量触及上下轨 |
| AGT-005 | 成交量/资金流 | 放量方向判断资金流向 |
| AGT-006 | 海龟/趋势跟踪 | 20日突破→BUY，10日低点→SELL |
| AGT-007 | 技术面综合/修正 | 综合信号+行业热度修正 |
| AGT-008 | 主力行为+基本面 | 盘口+基本面交叉验证 |

**21个新增策略（CAT-001~021）：**

覆盖趋势跟踪、反转/均值回归、动量、套利、波动率、期权、事件驱动、多时间框架、微观结构、日内、震荡、基本面等12个类别。详见 `docs/strategy/strategies-20.md`。

### 审核部门（5个审核视角）

| 工号 | 名称 | 审核视角 |
|------|------|---------|
| RAG-001 | 审核组长 | MACD、RSI、布林带、海龟、均线交叉 |

---

## 🔄 完整交易流程

```mermaid
flowchart TB
    subgraph "舆情阶段"
        SENT[舆情部门] ==>|"监控→利好加/利空踢"| POOL[候选股池]
    end
    subgraph "策略阶段"
        STRATEGY[策略Agent (28个策略视角)] -.->|查股池| SENT
        STRATEGY ==>|"分析→发起投票"| EC[选举委员会]
    end
    subgraph "投票阶段"
        EC ==>|"征集意见"| STRATEGY
        EC ==>|"赞成≥反对→通过"| DECISION{决策}
    end
    subgraph "执行阶段"
        DECISION ==> EXEC[执行部门]
        EXEC ==> DATA[数据部门]
        DATA ==> TRADE[交易完成]
        DATA ==>|通知| REVIEW[审核部门 (5个审核视角)]
        DATA ==>|"回执"| EC
    end
    subgraph "人事"
        REVIEW ==> HR[HR 部门]
        HR ==>|"人事决策"| AGENTS[Agent档案]
    end
```

---

## 🧠 Agent 持续学习与人格进化

每个 Agent 在执行完操作后自动记录经验到 `agent_traits` 表，形成独立人格。

| 特征 | 说明 |
|------|------|
| `learned_pitfall` | 学到的教训 |
| `strength` / `weakness` | 自我认知的优势/劣势 |
| `risk_preference` | 风险偏好（保守/中等/激进） |
| `preferred_sectors` | 偏好行业 |
| `self_adjustments` | 自我调整记录 |

```bash
# 查看人格档案
npx tsx src/scripts/persona.ts --agent-id AGT-002 --action show

# 导出所有 Agent 人格（迁移用）
npx tsx src/scripts/persona.ts --agent-id all --action export --output ./export/agents.json
```

---

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **Hermes Kanban** | 多 Agent 编排 + 自然语言对话 |
| **TypeScript + Node.js** | 工具层脚本 |
| **SQLite** | 数据持久化（trades / agents / votes / stock_pool） |
| **DeepSeek chat** | 所有 Agent 统一模型 |
| **Longbridge OpenAPI** | 行情数据 + 模拟盘交易 |
| **飞书 API** | 通知推送 |
| **Jest** | 单元测试 |

---

## 📁 项目结构

```
hermes-trading-system/
├── profiles/                 # Hermes Agent 配置（每个 Agent 一个 YAML）
│   ├── ceo-agent.yaml               # CEO — 系统守护、巡检
│   ├── sentiment-agent.yaml         # 舆情部门 — 股池维护
│   ├── data-agent.yaml              # 数据部门 — 唯一长桥接口
│   ├── strategy-director.yaml       # 策略部门 — 28个策略视角
│   ├── election-committee.yaml      # 选举委员会 — 投票召集
│   ├── execution-agent.yaml         # 执行部门 — 交易执行
│   ├── review-auditor.yaml          # 审核部门 — 5个审核视角
│   ├── hr-agent.yaml                # HR 部门 — 人事管理
│   ├── advertising-agent.yaml       # 广告部门 — 飞书通知
│   └── backtest-agent.yaml          # 回测部门 — 策略回测
├── src/
│   ├── scripts/             # Agent 调用的独立入口脚本
│   │   ├── data-service.ts       # 行情数据查询
│   │   ├── execute-decision.ts   # 交易执行
│   │   ├── sentiment-*.ts        # 舆情部门（add/remove/pool/scan/news）
│   │   ├── review-*.ts           # 审核部门（audit/submit）
│   │   ├── aggregate-votes.ts    # 投票加权统计
│   │   ├── send-notify.ts        # 飞书通知
│   │   └── alarm.ts              # 工作日志记录
│   ├── pool/                # 候选股池管理
│   ├── voting/              # 投票编排 + 选举轮次
│   ├── trading/             # 下单执行
│   └── audit/               # 统计审计
├── docs/
│   ├── architecture.md           # 完整技术方案文档
│   ├── policy.md                 # 公司政策
│   ├── incident-response.md      # 异常处理手册
│   ├── rules.md                  # 系统规则
│   ├── <dept>/README.md          # 各部门概述
│   ├── <dept>/experience.md      # 各部门经验总结
│   ├── <dept>/learned.md         # 各部门学习笔记
│   ├── strategy/strategies-20.md # 20+策略参考手册
│   └── knowledge/                # 跨部门知识库
├── data/
│   └── trading.db         # SQLite 数据库（不提交 git）
├── sql/                    # 建表 + 迁移
├── tests/                  # Jest 单元测试
└── profiles/               # 所有 Agent profile（同上）
```

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库
npm run db:init

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 Longbridge API 凭证

# 4. 运行测试
npm test
```

### 启动常驻 Agent

所有 Agent 通过 Gateway 和 Kanban 以守护进程模式常驻运行：

```bash
# 1. 启动 Gateway（常驻）
hermes gateway run --replace

# 2. 为每个 Agent 创建常驻 Kanban 任务（带 1440m=24h 超时）
hermes kanban create "⏳ 常驻待命：ceo-agent" --body "CEO-001 常驻守护" --assignee ceo-agent --max-runtime 1440m
hermes kanban create "⏳ 常驻待命：sentiment-agent" --body "SENT-001 常驻" --assignee sentiment-agent --max-runtime 1440m
# ... 逐个创建所有 Agent 的常驻任务

# 3. 启动 Agent（background 模式）
hermes chat -p ceo-agent --accept-hooks --skills kanban-worker -q 'work kanban task <task_id>' &
```

Agent 启动后自动进入常驻循环：等待任务→执行→心跳→等待下一轮。不调 kanban_complete，永不退出。

---

## 📅 定时任务

| 任务 | 描述 | 频率 |
|------|------|------|
| CEO 巡检 | 检查所有 Agent 健康状态 | 每5分钟 |
| CEO 宣讲 | 全员自检提醒 | 每30分钟 |
| 新闻巡检 | 舆情搜集利好/利空新闻更新股池 | 每天0点 |
| 策略自成长 | strategy-director 学习新策略 | 每天0点 |
| 文档督促 | CEO 督促各部门更新文档 | 每天0点 |
| GitHub 提交 | 每日代码提交 | 每天0点 |
| 项目审计 | CEO 找5个问题修复 | 每天 |
| 持仓推送 | 获取持仓数据推送给选举委员会 | 每30分钟 |
| 策略回测 | 回测策略有效性 | 每24小时 |

---

## ⚖️ 许可证

MIT
