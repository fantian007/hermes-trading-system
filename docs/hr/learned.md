# HR 学习笔记

> 最后更新：2026-05-24 UTC+8

## 2026-05-24 — HR 守护进程启动

### 1. 系统启动初期状态

- 再次确认：系统处于冷启动阶段（12 ACTIVE Agent，0 笔交易，全零胜率）
- 人事管理暂时无可操作的淘汰/影子期/警告判定 — 所有 Agent 没有交易数据
- Profile 实践经验：patch 的 Errno 2 不一定真失败，修改可能已生效

### 2. 工作方式调整

- 守护进程不调 kanban_complete，永远 running，这意味着不能让一次工具调用无限期阻塞
- 每次轮巡保持简洁高效，避免过多工具调用消耗上下文窗口

### 3. 文档检查结果

- docs/hr/README.md — 完整 v1.0，包含所有流程 SOP
- docs/hr/experience.md — 3 条记录，格式良好
- docs/knowledge/INDEX.md — 4 条索引，覆盖 HR/System 领域
- docs/hr/learned.md — 新创建

## 2026-05-24 — HR 守护轮巡 #2

### 系统状态

- 17 Agent ACTIVE，0 笔交易，全零胜率
- 系统仍处于冷启动阶段（无交易历史）
- 新增 Agent: GEN-001（均线交叉策略分析官，profile: strategy-07，2026-05-23 入职）
- 文档体系完整：docs/hr/README.md / experience.md / learned.md 均正常
- docs/knowledge/ 索引覆盖 HR / System 领域，Trading / Risk 待补充

### 审计结论

- audit-cycle.ts 正常运行，输出完整
- 所有 Agent 无交易数据，不需要触发淘汰/影子期/警告
- 无审核报告需要处理
- 无人事变动的组长期待处理的

### 下轮关注

| 1. 是否有弃票 Agent 需要排查（sentiment-agent 等之前 crash-loop 的）
| 2. 检查 docs/knowledge/INDEX.md 是否需要更新
| 3. 检查 docs/policy.md 和 docs/incident-response.md 是否存在（供 0:00 学习使用）

## 2026-05-24 — HR 守护轮巡 #5 (04:46 CST)

### 系统状态
- 8 Agent ACTIVE（2→8，审核部门已恢复）
- 0 笔交易，全零胜率
- departments 表只有 DPT-005（审核部门），其余部门仍缺失
- 文档体系完整
- 冷启动阶段，无操作事项

### 下轮关注
1. 检查是否有新的 Agent 注册到 DB
2. 关注 0:00 到达时触发全员学习规章制度
3. 留意是否有组长或 Agent 提出入职/淘汰需求

## 2026-05-24 — HR 守护轮巡 #8 (04:56 CST)

### 系统状态
- 9 Agent ACTIVE（AGT-007 均线交叉 + AGT-004 布林带 + EXE-001 执行 + RAG-001~006 审核部门）
- 0 笔交易，全零胜率
- 系统冷启动中，无交易数据
- 当前 04:56 CST，非 0:00，不触发全员学习

### 操作
- audit-cycle.ts 运行正常，输出 9 个 Agent 数据
- docs/hr/、docs/knowledge/、docs/policy.md、docs/incident-response.md 全部完整
- docs/knowledge/INDEX.md 已是最新（更新于 04:33）
- 所有 10 个部门 README 文档齐全

### 审计结论
- 所有 Agent 交易数 0，胜率 0% — 无法触发淘汰/影子期/警告判定
- 无审核报告待处理
- 无人事变动的组长需求
- 无 Agent 请求入职或离职

### 下轮关注
1. 0:00 到达时触发全员学习规章制度
2. 系统启动后有新 Agent 注册到 DB
3. 有组长提入职/淘汰/影子期需求

## 2026-05-24 — HR 守护轮巡 #9 (05:00 CST) — 今日全员学习已执行

### 系统状态
- 9 Agent ACTIVE（AGT-004 布林带 + AGT-007 均线交叉 + EXE-001 执行 + RAG-001~006 审核部门）
- 0 笔交易，全零胜率
- 系统冷启动中

### 操作
1. 已阅读 policy.md (10章166行) + incident-response.md (11类120行)
2. 为全部 9 名在职 Agent 创建 kanban 学习任务
3. 运行 audit-cycle.ts — 全零绩效数据，无淘汰/影子期需求
4. 通知 advertising-agent 广播飞书

### 审计结论
- 所有 Agent 交易数 0 → 不触发任何人事变动
- 无审核报告待处理
- 无入职/淘汰/离职需求

### 下轮关注
1. 下次 0:00 时触发全员学习（如在线）
2. 检查学习任务完成情况，汇总确认
3. 是否有组长提人事需求

## 2026-05-24 — HR 守护轮巡 #11 (05:10 CST) — 状态延续

### 系统状态
- 10 Agent ACTIVE（AGT-002 MACD + AGT-004 布林带 + AGT-007 均线交叉 + EXE-001 执行 + RAG-001~006 审核）
- 0 笔交易，全零胜率
- 今日全员学习已于 05:00 轮次完成（9 个学习任务已派发）
- 文档体系完整，INDEX.md 最新

### 审计结论
- 全零交易数据 → 不触发任何人事变动
- 无审核报告待处理
- 无入职/淘汰/离职需求

### 重要发现
- 本守护任务的「永不退出」特性与 Kanban dispatcher 的 protocol_violation 检测存在冲突：策略文档要求不调 kanban_complete（永远 running），但 dispatcher 将 clean exit 视为违规。需要让进程保持存活、持续 heartbeat，永不自然退出
    
### 下轮关注
1. 下次 0:00 触发全员学习规章制度
2. 留意策略组长 strategy-01 是否活跃并提出人事需求
3. 关注是否有新 Agent 产生交易数据

## 2026-05-24 09:34 — 第26轮守护：冷启动状态，文档完整

**状态总览**：
- 10 ACTIVE Agent，0 交易，冷启动状态
- audit-cycle.ts 正常输出全零数据（0 交易 = 0 胜率，正常）
- 组织架构稳定：AGT-002/004/007（策略）+ 6 RAG（审核）+ EXE-001
- 22 个 profile YAML 齐全完好
- 各部门 README/experience/learned 文档齐全（review 部门待补充 README 以外其余也有）
- docs/policy.md（171 行）和 docs/incident-response.md（134 行）内容完整
- 知识库 INDEX.md 含 4 个类别条目
- 今日 0:00 学习尚未执行（现在是 09:34），等待 24:00 定时执行

**无异常**：
- 无淘汰/影子期/警告需求（所有 Agent 无交易记录，无法评估绩效）
- 无新 Agent 入职需求
- 无组织架构变更请求
- 无人事变动

**检查清单**：
1. ✅ 知识库完整性 — 分类齐全
2. ✅ 规章制度 — policy.md + incident-response.md 完整
3. ✅ Agent 列表 — 10 ACTIVE，无异常
4. ✅ Profile 配置 — 22 YAML 齐全
5. ✅ 部门文档 — 10 个部门文档完整

## 2026-05-24 09:38 — 第29轮守护：11 ACTIVE，AGT-005已入职

**状态总览**：
- 11 ACTIVE Agent（3 策略 + 1 执行 + 6 审核 + 1 审核组长）
- AGT-005（海龟交易策略官）已入职，状态 ACTIVE
- 0 交易，冷启动状态
- audit-cycle.ts 正常输出全零数据
- 文档完整，知识库 INDEX.md 正常
- 今日 0:00 全员学习 v4.4 已完成（之前轮次派发）

**无异常**：
- 无人事变动需求
- 无组织架构变更请求
- 系统稳定运行

## 2026-05-24 09:41 — 第30轮守护：11 ACTIVE 稳定，review/README.md 已补写

**完整巡检结果**：
- 系统运行正常，11 ACTIVE Agent（3 策略 + 1 执行 + 6 审核 + 1 审核组长）
- 0 交易，冷启动状态
- audit-cycle.ts 正常输出全零数据
- **review/README.md 已由 RAG-001 补写完成**（334行，完整的手册文档）
- docs/hr/experience.md 正常，docs/hr/learned.md 正常追加
- 知识库 INDEX.md 正常（2026-05-24 04:33）
- 无待处理的 Agent 需求 / 入职 / 离职 / 人事变动请求
- 距离今日 0:00 全员学习（v4.4已部署）还有约 14 小时

**人事决策**：无（0 交易数据）
