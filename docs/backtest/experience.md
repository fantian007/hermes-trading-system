# 回测部门经验积累

## 2026-05-23 — 首次学习

- **经验1**：作为第9部门（v4.3新增），回测部门不参与任何交易决策，只做质量验证。回测结果是给CEO的参考依据，CEO据此评估策略Agent绩效。
- **经验2**：profile 中引用的 `src/scripts/sentiment-pool.ts` 用于获取当前股池，`src/backtest/runner.ts` 已存在但尚未有 CLI 调用模式验证其可用性。需要先确认 Longbridge 行情接口可用。
- **经验3**：v4.3 新增 10 大变更中有 2 项直接相关：问题升级链（自己修→strategy-01→CEO）和知识库体系（写入 docs/backtest/experience.md → 检索复用）。
- **经验4**：发现 docs/rules.md 不存在（architecture.md §6A.5 提及但文件未创建），这不属于回测部门职责，不主动处理，走升级链或等CEO发现。
