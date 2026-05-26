# HR 部门经验总结

## 2026-05-26 17:26 — HR-001 守护轮巡 #8

**系统状态:** 冷启动稳定，无异常。
**本轮摘要:** 
- 完成 docs/knowledge/risk/rules.md 填充（从策略+执行经验提取风控知识）
- 更新 docs/knowledge/INDEX.md（Trading+Risk 分类齐全）
- 审计遗留项（#8 P3 Risk填充）已处理完成
- 14 ACTIVE Agent, 3 OPEN trades（AAPL/CRM/CLSK，经长桥API验证有效）
- 全员学习规章制度已于轮巡 #5 部署完毕，昨日已全部完成
**关键经验:** 知识库维护不仅是填充空白，更是从各部门经验中提炼可复用的系统性知识。

## 2026-05-26 — HR-001 守护轮巡 #7

**系统状态:** 冷启动稳定，无异常。
**本轮摘要:** 今日全员学习规章制度已在轮巡 #5 (00:50) 部署完毕 (17 kanban 任务给 14 ACTIVE Agent)。无人事变动需求，无审核报告待处理。
**关键经验:** 守护任务应避免退出，否则 dispatcher 会视为 protocol violation 持续重调度。正确模式：执行巡逻后调用 kanban_block("standing guard") 进入阻塞等待。

## 2026-05-26 01:17 — HR-001 守护轮巡

**系统状态:** 冷启动稳定。14 ACTIVE Agent，5 OPEN trades（无已关闭交易），全零胜率。
**本轮摘要:** 全员学习规章制度已完成（全部 done）。无新审核报告。无人事变动的需求。trading.db 在项目目录下正常。系统稳定无需操作。
**审计结论:** 全零交易数据 → 无淘汰/影子期/警告判定。
**关键发现:** trading.db 0 字节在 ~/.longbridge/，但项目内的 trading.db 有完整数据。两处 DB 不同步。

## 2026-05-26 19:52 — HR 守护轮巡 #8

**系统状态:** 稳定冷启动。14 ACTIVE Agent，3 OPEN 交易（AAPL/CLSK/CRM），1 CLOSED（GOOGL -$22.98），全零胜率。
**审核报告状态:** 6 份报告（GOOGL TRD-20260524-425）已归档。RAG-001 组长汇报告警方向不一致：选举SELL、执行LONG。
**人事需求:** 无。全零胜率数据，无法触发淘汰判定。
**关键经验:** GOOGL 方向偏差需 CEO 关注流程修复，HR 层面无需立即行动。

## 2026-05-26 19:55 — HR-001 守护轮巡 #9

**系统状态:** 冷启动稳定。14 ACTIVE Agent（audit-cycle 输出）。5 OPEN trades: NVDA LONG 30@$236.51, CLSK LONG 1@$15.4, AAPL LONG 50@$308.31, AAPL SHORT 10@$308.82, AAPL LONG 1@$308.82。0 CLOSED trades。全 Agent 胜率 0%/交易数 0（未结算）。
**审核报告状态:** review_reports 表为空，无新提交。
**人事需求:** 无。全零交易数据，无法触发淘汰/影子期/警告判定。无入职/离职/扩招需求。
**关键经验:** 守护任务保持存活：使用 kanban_block("standing guard") 避免 protocol_violation。系统运行稳定，无人事变动的被动触发。docs/knowledge/ 及 docs/hr/ 文档齐备。
