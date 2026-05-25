# 执行部门 (Execution Department)

## 概述
执行部门是交易系统的最终执行环节，负责：
- 风控判断（下单前逐项执行风控规则）
- 交易执行（通过数据部门操作长桥 API）
- 仓位监控与审查
- 订单管理（撤单、重挂、异常处理）

## 对接方式
- **数据部门 (data-agent)**：所有长桥操作通过 Kanban 任务发给 data-agent
- **选举委员会 (election-committee)**：接收 BUY/SELL 决策
- **广告部门 (advertising-agent)**：所有操作完成通知的唯一出口
- **HR 部门 (hr-agent)**：交易记录统计、绩效核算

## 核心规则
1. 死单不直接执行 → 通知 ELC 重新投票
2. 幽灵交易（round final=HOLD 但有 OPEN trade）需调查数据源头
3. 非交易时段不提交订单
4. 每次操作完成后通知广告部门

## Agent 列表
- EXE-001: 执行主代理（常驻守护进程）
