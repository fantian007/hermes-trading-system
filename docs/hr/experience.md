## 2026-05-23 — v4.3 全员学习状态汇总与知识库记录

**背景：** CEO-001 完成 architecture.md v4.3 学习后，创建了通知 HR 的任务（t_aaecbfa0），要求将 CEO-001 学习确认和其他 Agent 学习状态一并记录到知识库。

**执行过程：**
1. 通过 sqlite3 查询全部 23 个 v4.3 相关 Kanban 任务的状态
2. 发现 16 个已完成、7 个卡在 crash-loop（sentiment + 6 个策略 Agent）
3. 崩溃原因：worker exited cleanly (rc=0) 而未调用 kanban_complete/kanban_block — 缺少对应 Hermes profile
4. 创建 docs/knowledge/hr/v4.3-learning-completion.md 完整记录
5. 创建 docs/knowledge/INDEX.md 索引文件
6. 创建 Kanban 任务给 advertising-agent 推送飞书

**经验：**
- Kanban 派发的任务如果对应 profile 不存在，会 crash-loop 进入死循环
- 不能等待这 7 个 stuck 任务完成 — 它们没有 profile 无法被调度
- 首先记录已完成的 14 位 Agent，7 个 stuck 任务做标记即可

## 2026-05-24 — v4.4 全员学习任务派发

**背景：** CEO-001 完成 architecture.md v4.4 更新后，创建通知 HR 的任务（t_99b9d9d8），要求通知全体 18 位 Agent 学习。
**执行：**
1. 读取 docs/architecture.md 确认 v4.3→v4.4 变更（知识库体系落地、部门文档初始化、跨部门知识索引、版本发布规范）
2. 创建 18 个 Kanban 学习任务，覆盖 9 个部门（舆情/数据/策略×7/选举/执行/广告/回测/审核×6）
3. 所有任务以 t_99b9d9d8 为父任务
4. 写入 docs/knowledge/hr/v4.4-learning-deployment.md
5. 更新 docs/knowledge/INDEX.md
6. 通知 advertising-agent 推送飞书

**经验：**
- v4.3 时 sentiment + strategy-02~06 因缺少 Hermes profile 导致 crash-loop，本次已全部补齐 profile，预计正常调度
- 18 个 Agent 包含新增的 review 部门 6 人和 backtest-agent

## 2026-05-24 — HR-001 巡检周期 #1：全系统配置文件修复

**背景：** 守护进程启动后执行巡检，发现 17 个 Agent profile YAML 文件存在系统性的模板复制 bug — "经验积累"部分的步骤编号中出现了 7 次重复的 "4." block，步骤 3 缺失，步骤 2 直接跳到 4。

**执行：**
1. strategy-01.yaml 通过 patch 工具修复
2. strategy-02~07.yaml 通过 subagent 并行修复
3. data-agent.yaml（已被之前运行修正）
4. hr-agent.yaml — write_file 全文件重写
5. election-committee.yaml — patch 修复
6. sentiment-agent.yaml — patch 修复
7. advertising-agent.yaml — patch 修复（rpc error 但已生效）
8. execution-agent.yaml — patch 修复（rpc error 但已生效）
9. ceo-agent.yaml — patch 修复（rpc error 但已生效）
10. 全局修复 "4. 每天回顾 → 5. 每天回顾" 共计 13 处

**系统状态：** 12 Agent 全员 ACTIVE，0 笔交易，全零胜率。系统冷启动中。

**经验：**
- patch 工具存在 Errno 2 的间歇性 bug（可能是 workspace tmp dir 被删除导致 CWD 失效），但实际修改已生效
- 对于大段替换，write_file 全局写入比 patch 更可靠
- 注意到 patch 的错误信息可能误导——返回 Errno 2 时修改仍然成功
- 多个文件的同一种 bug，先用 subagent 并行修复速度更快

## 2026-05-24 — HR 守护轮巡 #2

**状态：** 17 Agent ACTIVE，0 笔交易，全零胜率
**问题：** 无 — 系统冷启动中，无交易数据，无淘汰/影子期/警告判定需求
**操作：**
- audit-cycle.ts 运行正常，输出完整
- docs/hr/ 和 docs/knowledge/ 文档检查通过
- policy.md 和 incident-response.md 存在且完整
- 无人事变动需求，无审核报告待处理
**经验：**
- 时间判断：当前 04:35 CST，非 0:00，不启动全员学习
- 守护轮巡需保持简洁高效，避免过多工具调用
- 下次轮巡主要关注：是否有新 Agent 请求入职、是否有组长提淘汰需求、是否有 Agent 自行离职

## 2026-05-24 — HR 守护轮巡 #3

**背景：** DB 被重置后，agents 表只有 AGT-007(均线交叉策略分析官) 和 EXE-001(执行Agent)，共2人ACTIVE。departments 表、agent_status_log 表均空。

**系统状态快照：**
- 活跃: AGT-007(均线交叉), EXE-001(执行)
- 交易: 0笔
- 胜率: 全零
- 性质: 系统冷启动阶段（无交易历史）
- 时间: 04:39 CST，非 0:00，不触发全员学习

**文档检查：**
- docs/hr/README.md — 完整 v1.0
- docs/hr/experience.md — 3条记录 → 现在4条
- docs/hr/learned.md — 2条学习记录
- docs/knowledge/INDEX.md — 4条索引(HR/System)，trading/ 和 risk/ 为空
- docs/policy.md — v1.0 完整（10条禁止事项）
- docs/incident-response.md — 完整（11类异常处理）
- 所有部门 docs/ 均已创建并包含 README
- profiles/ 目录 23 个 YAML 文件齐全（但 DB 未同步）

**审计结果：**
- 无 Agent 达到淘汰线(最低0笔交易，无胜率数据)
- 无需触发淘汰/影子期/复活
- 无审核报告待处理
- 无人事变动需求

**经验：**
- DB 重置后 departments/agent_status_log 全空是系统冷启动的正常状态
- on-board-agent --list 只能看到 DB agents 表，看不到 profiles/ 目录中的 YAML 文件——两者不同步需由 CEO 或其他调度者恢复
- persona 表也被清空，HR-001 不可写入进化记录（等待 DB 同步后重试）

## 2026-05-24 — HR 守护轮巡 #4

**状态：** 2 Agent ACTIVE（AGT-007 均线交叉 + EXE-001 执行），0 笔交易，全零胜率
**时间：** 04:42 CST，非 0:00，不触发全员学习
**操作：**
- audit-cycle.ts 运行正常，输出 2 个 Agent 数据
- docs/hr/、docs/knowledge/、docs/policy.md、docs/incident-response.md 全部完整
- 所有 10 个部门 README 文档齐全
- 无入职/淘汰/影子期人事变动需求
- 无审核报告待处理
**结论：** 系统冷启动中，无操作事项

## 2026-05-24 — HR 守护轮巡 #5

**状态：** 8 Agent ACTIVE（AGT-007 均线交叉 + EXE-001 执行 + RAG-001~006 审核部门），0 笔交易，全零胜率
**时间：** 04:46 CST，非 0:00，不触发全员学习
**变化：** 相比轮巡 #4，新增 RAG-001~006 共 6 人（审核部门恢复）。departments 表已有 DPT-005 但 DPT-001~004/006~008 仍缺失。
**操作：**
- audit-cycle.ts 运行正常，输出 8 个 Agent 数据
- docs/hr/、docs/knowledge/、policy.md、incident-response.md 全部完整
- all 8 agents are ACTIVE with 0 trades, 0 win rate — 不需要触发淘汰/影子期/警告
- 无审核报告待处理
- 无人事变动的组长期待处理的需求
- 无 Agent 请求入职或离职
**经验：**
- 审核部门在轮巡 #3~#4 之间通过外部操作（可能 CEO 手动注册）恢复，DB 已同步
- 但其他部门（舆情/数据/策略/选举/执行/HR/广告）仍只在 profiles/ 有 YAML 文件，DB 未注册
- 当前无人事管理决策可做 — 所有 Agent 交易数为 0，无法计算有效胜率
