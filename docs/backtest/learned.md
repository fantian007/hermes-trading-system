# 回测学习记录

## 2026-05-23

1. **架构定位**：回测是验证 Agent 决策质量的手段，不修改 Agent 人格。回测输出 JSON 对比：代码决策 vs Agent 决策。结果用于改善 Agent prompt 和 profile 设计。（来源：architecture.md §10）
2. **runner.ts 实现细节**：当前回测引擎从 Longbridge 拉取历史 K 线，逐日推进，用聚合器纯计算替代真实 LLM 调用（回测数百天不可能每次调 LLM）。包含完整交易周期模拟（选股→投票→执行→止损→审核），输出 Sharpe、胜率、最大回撤、审核通过率等指标。
3. **v4.3 知识库体系**：经验积累机制为试错→记录→检索→复用。Agent 在每次操作后反思经验写入部门知识库，下次通过 session_search 调取历史经验。（来源：architecture.md §6A.2）
