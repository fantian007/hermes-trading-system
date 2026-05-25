# HR 部门经验总结

## 2026-05-23 — 系统冷启动：DB 重置后组织为空
- **症状**：DB 重置后，`onboard-agent.ts --list` 显示空表，组织架构消失。
- **可行方案**：按 Phase 1 MVP 部署流程，按顺序逐个创建 Agent（先创建组长，再创建组员），然后用 `hermes profile create -f profiles/<name>.yaml` 确保 profile 注册。
- **教训**：DB 不走 Git，每次重置需手动重建组织架构。建议保留 db 备份。

## 2026-05-24 — HR 守护轮巡#3
- **症状**：DB 重置后仅 AGT-007 + EXE-001 共 2 ACTIVE / 0 交易。
- **检查项**：
  - departments/persona 全空（正常，刚初始化）
  - profiles/ 23 个 YAML 齐全
  - 文档完整，系统冷启动状态
- **结论**：冷启动无需人事变动。

## 2026-05-24 — review-01 审核 AAPL 减仓
- **症状**：审核部门提交审计报告，发现两个观察点：
  ① 选举轮次 total_voters=0 且 final_decision=HOLD，但执行了 SELL，流程脱节
  ② DB 仅记录 5 股东 vs 实盘 40+ 股东，数据不一致
- **处理**：通知广告部门广播审计结果，问题上报选举委员会和数据部门
