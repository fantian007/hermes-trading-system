---
name: trading-system
description: AI 选举交易系统 — 多 Agent 协作的自动化交易系统。使用 Hermes Kanban 编排，Longbridge 模拟盘交易。包含选股、盯盘、策略投票、选举决策、执行下单、审计淘汰的完整闭环。
version: 0.1.0
---

# Hermes AI 选举交易系统

多 Agent 选举交易系统 — 6 个部门、Phase 1 共 10 个 Agent 协作的自动化交易引擎。

## 系统架构

```
选股部门(1) → 盯盘部门(1) → 策略部门(5) → 选举委员会(1) → 执行部门(1) → Longbridge
                                                          ↓
                              审计部门(1) ← ← ← ← ← ← ← ← ←
```

## Agent 职责

| Agent | Profile | 职责 |
|-------|---------|------|
| 选股-价格异动 | selector-price | 监控价格异动，提交信号到股池 |
| 盯盘 | watch-agent | 扫描股池，触发投票轮次 |
| 策略 ×5 | strategy-01~05 | 独立分析行情并投票 |
| 选举委员 | election-committee | 加权聚合投票，输出决策 |
| 执行 | execution-agent | 下单执行、风控 |
| 审计 | auditor-agent | 胜率统计、淘汰管理 |

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
hermes profile create -f profiles/selector-price.yaml
hermes profile create -f profiles/watch-agent.yaml
hermes profile create -f profiles/election-committee.yaml
hermes profile create -f profiles/execution-agent.yaml
hermes profile create -f profiles/auditor-agent.yaml
hermes profile create -f profiles/strategy-01.yaml
hermes profile create -f profiles/strategy-02.yaml
hermes profile create -f profiles/strategy-03.yaml
hermes profile create -f profiles/strategy-04.yaml
hermes profile create -f profiles/strategy-05.yaml
```

### 5. 运行盯盘（主循环入口）
```bash
npx tsx src/scripts/trigger-vote.ts
```

## 数据库

SQLite — `data/trading.db`。10 张核心表：
agents · agent_status_log · trades · agent_votes · win_reports · election_rounds · stock_pool · agent_traits · strategy_signatures · daily_ledger

## 测试
```bash
npm test
```

## 架构文档

详见飞书文档: https://bytedance.feishu.cn/docx/G4qmdQeuKo2hSXxMbk4c2jRsn3c
架构图: architecture.html
