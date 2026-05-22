---
name: trading-system
description: AI 选举交易系统 — 多 Agent 协作的自动化交易系统。使用 Hermes Kanban 编排，Longbridge 模拟盘交易。包含选股、盯盘、策略投票、选举决策、执行下单、审计淘汰的完整闭环。
version: 0.1.0
---

# Hermes AI 选举交易系统

多 Agent 选举交易系统 — 7 个部门、Phase 1 共 12 个 Agent 协作的自动化交易引擎。

## 系统架构

```
数据部门(1) ← ← ← 统一行情数据入口
     ↑
选股部门(4) → 盯盘部门(1) → 选举委员会(1) → 执行部门(1) → Longbridge
                               ↑                      ↓
                         审核部门×5(5)         审计+HR部门(1)
                               ↑                      ↓
                           事后审计 ← ← ← ← ← 交易结果
```

## Agent 职责

| Agent | Profile | 职责 |
|-------|---------|------|
| 数据 | data-agent | 统一行情数据接口，其他部门通过自然语言索取报价/K线/账户/持仓 |
| 选股 ×4 | strategy-01~04 | 技术分析扫描候选标的，将信号写入股池 |
| 盯盘 | watch-agent | 扫描股池，检测异动，发起投票轮次 |
| 审核官 ×5 | review-01~05 | 事后审核交易决策质量（PASS/WARN/FAIL），不参与事前投票 |
| 选举委员 | election-committee | 与审核官聊天收集意见，自己做最终决策 |
| 执行 | execution-agent | 下单执行、风控检查、持仓监控 |
| 审计+HR | auditor-agent | 胜率排名、淘汰/影子期/复活人事决策 |

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
hermes profile create -f profiles/data-agent.yaml
hermes profile create -f profiles/selector-price.yaml
hermes profile create -f profiles/watch-agent.yaml
hermes profile create -f profiles/election-committee.yaml
hermes profile create -f profiles/execution-agent.yaml
hermes profile create -f profiles/auditor-agent.yaml
hermes profile create -f profiles/review-01.yaml
hermes profile create -f profiles/review-02.yaml
hermes profile create -f profiles/review-03.yaml
hermes profile create -f profiles/review-04.yaml
hermes profile create -f profiles/review-05.yaml
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
