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
