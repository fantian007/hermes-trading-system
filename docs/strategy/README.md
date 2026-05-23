# 策略部门 (Strategy Department)

> 负责独立分析股票、发现交易机会、投票表决。系统唯一的中心调度器也在此部门。

---

## 部门概述

策略部门是交易系统的核心决策引擎。7 名策略 Agent 各自掌握不同的分析框架，独立扫描全股池，发现交易机会后通过选举会议室投票表决。组长 AGT-001（strategy-01）充当系统唯一的中心调度器，负责协调各部门工作流，但不参与分析与投票。

## 部门职责

| 职责 | 说明 |
|------|------|
| 独立分析 | 每名策略 Agent 按自身策略方法独立分析股池中所有标的 |
| 发现机会 | 识别买入/卖出信号，输出投票方向 + 置信度 + 理由 |
| 投票表决 | 收到盯盘部门触发后，向选举委员提交 `{vote_direction, confidence, reasoning}` |
| 调度协调 | AGT-001 负责全系统 Kanban 任务调度，确保各部门不空闲 |
| 经验沉淀 | 部门共识、学习笔记写入本目录文档，带日期戳 |
| 下属督促 | 组长督促 strategy-02~07 每日读取部门文档 |

## 成员

| 编号 | 代号 | 角色 | 策略方向 | 状态 |
|------|------|------|----------|------|
| AGT-001 | strategy-01 | **策略组长 / 中心调度器** | 不分析、不投票，只做任务调度 | ACTIVE |
| AGT-002 | strategy-02 | 策略分析师 | 均线交叉策略 (MA Crossover) | ACTIVE |
| AGT-003 | strategy-03 | 策略分析师 | MACD 金叉死叉 + 背离检测 | ACTIVE |
| AGT-004 | strategy-04 | 策略分析师 | RSI 超买超卖 + 背离 | ACTIVE |
| AGT-005 | strategy-05 | 策略分析师 | 布林带突破 (Bollinger Bands) | ACTIVE |
| AGT-006 | strategy-06 | 策略分析师 | 动量突破 + 成交量确认 | ACTIVE |
| AGT-007 | strategy-07 | 策略分析师 | 均线交叉死叉 + 缩量确认 | ACTIVE |

### 调度协议（AGT-001 专用）

AGT-001 是系统唯一的中心调度器，不参与分析与投票。每 3 分钟执行一轮：

1. `hermes kanban list` — 查看所有 Agent 状态
2. 对空闲 Agent 派发任务（跳过 running）
3. 检查策略输出 → 创建选举/执行/审核任务
4. 通知 advertising-agent 发飞书调度摘要
5. 等待 3 分钟，回到步骤 1

**问题升级链**：下级 → 直属上级 → CEO → 飞书通知用户（仅无法解决时）
- strategy-02~07 升级到 strategy-01（组长）
- strategy-01 升级到 CEO

## 目标

1. **独立分析全股池** — 每名 Agent 不依赖其他策略员的结论，自主完成分析
2. **发现交易机会** — 在股池（~10-20 只）中识别可执行的买入/卖出信号
3. **高质量投票** — 投票附带置信度与推理，为选举委员提供可靠决策依据
4. **持续学习** — 通过胜率反馈（审计部门）迭代分析方法论

## 对接方式

### 上游 → 策略部门

| 上游部门 | 触发方式 | 说明 |
|----------|----------|------|
| 舆情 (sentiment) | 股池更新 → Kanban 任务 | sentiment-agent 扫描后更新股池，触发分析任务 |
| 盯盘 (data) | 价格事件 → 投票轮次 | data-agent 检测异动后创建投票轮次 |
| CEO | 调度指令 → Kanban 任务 | CEO 可直接下发分析任务 |

### 策略部门 → 下游

| 下游部门 | 对接方式 | 说明 |
|----------|----------|------|
| 选举委员 (election) | Kanban 元数据 | 策略 Agent 在投票轮次中输出 `{vote_direction, confidence, reasoning}` |
| 广告 (advertising) | send-notify.ts | 每次分析完成通知广告部，由其推送飞书 |
| 审计 (review) | SQLite (win_reports) | 交易完成后策略 Agent 自报 WIN/LOSE |

### 部门内对接

- AGT-001 通过 Kanban 创建/查询任务调度 strategy-02~07
- strategy-02~07 分析完成后在 Kanban 任务 comment 中输出结果
- 部门文档在 `docs/strategy/` 目录共享，组长督促阅读

## 工具脚本

所有脚本位于 `src/scripts/`，纯数据 I/O，不含决策逻辑。决策由 Agent 完成。

```bash
# 分析工具（纯数据输出，Agent 解读）
npx tsx src/scripts/kline-fetch.ts --symbol NVDA.US --days 60     # 拉取 K 线
npx tsx src/scripts/indicator-calc.ts --symbol NVDA.US             # 技术指标计算

# 投票相关
npx tsx src/scripts/trigger-vote.ts                                # 查看待投票信号
npx tsx src/scripts/trigger-vote.ts --symbol NVDA.US --create-round

# 通知
npx tsx src/scripts/send-notify.ts --message "..."
```

## 文档维护

| 文件 | 用途 | 维护者 |
|------|------|--------|
| `README.md`（本文件） | 部门概述、职责、成员、对接 | AGT-001 |
| `experience.md` | 经验总结（日期戳） | 全体 |
| `learned.md` | 学习笔记（日期戳） | 全体 |

### 维护规则

- 学到新知识 → 追加到 `learned.md`（带 `## YYYY-MM-DD` 标题）
- 发现共识/规则 → 更新 `README.md`
- 每天 0:00 AGT-001 督促下属阅读本部门文档
- AGT-001 不调 `kanban_complete`，永不退出（守护进程）

---

> 最后更新：2026-05-23 by AGT-001
