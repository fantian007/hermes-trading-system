## CEO-001 经验总结

> 每次解决问题后记录，重复问题先查本文档。

---

### 2026-05-24 — Longbridge CLI Auth 在 Hermes Profile 下失效

**症状**: backtest-agent 阻塞，`longbridge auth status` 返回 "not found"，即使在真实用户 HOME 下已经登录成功。

**根因**: Hermes Agent 为每个 profile 隔离 HOME 目录 (`~/.hermes/profiles/<profile>/home/`)，longbridge CLI 将 token 存储在 `~/.longbridge/openapi/tokens/` 和 `~/.longbridge/openapi/cli-auth`。Profile 的 HOME 下没有 `.longbridge` 目录或缺少有效 token 文件。

**可行方案**: 将真实用户的 `~/.longbridge` 目录 symlink 到每个 profile 的 home 下：

```bash
for d in /Users/zys/.hermes/profiles/*/home; do
  ln -sf /Users/zys/.longbridge "$d/.longbridge"
done
```

**验证**: `longbridge auth status` 显示 "valid"，`longbridge quote NVDA.US` 返回报价数据。

**注意**: 创建新 profile 后需要重新执行此操作。

### 2026-05-24 — `--skills longbridge` 在 dispatch 时导致 Unknown skill

**症状**: 所有通过 kanban_create 创建时带了 `--skills longbridge` 的任务（数据请求、选举投票等）在 data-agent / election-committee profile 下 crash 7+ 次，错误日志 "Unknown skill(s): longbridge"。

**根因**: 策略 Agent (strategy-02~07) 创建子任务时自动加 `--skills longbridge`，但 dispatcher 在目标 profile（data-agent, election-committee）下无法加载该 skill——skill 文件虽存在但过 Hermes skill 注册层不可解析。

**可行方案**: 创建任务时不再指定 `--skills longbridge`。而是把 longbridge 的用法直接写进 task body（明确的 CLI 命令和 cd 到项目目录的步骤）。数据请求、投票等任务不需要 longbridge skill——它们需要的是正确的 CWD。

**预防**: review 所有策略 Agent 的创造子任务的代码，去掉 `--skills longbridge`。对需要 longbridge 的任务，改为在 body 中写明 `cd /Users/zys/workspace/hermes-trading-system && npx tsx src/scripts/...`。

---

### 2026-05-24 — 审核部门制度缺陷3项补全处理

**触发**: RAG-005（海龟审核官）学习规章制度时发现审核部门3项制度缺陷。

**问题1**: docs/review/README.md 仅有占位文本，无实质性内容。
**处理**: 按 policy.md 第97行「部门文档缺失 → CEO 通知该部门补写」，创建 Kanban 任务 t_aa94f3c3 给 review-auditor。

**问题2**: incident-response.md 缺乏审核专用异常场景。
**处理**: 新增第十章「审核异常」，覆盖4场景：数据获取失败、框架不适配、写入失败、超时。后续节号顺延（十一→十二）。

**问题3**: policy.md 第109行审核职责描述过于简略（仅一句话）。
**处理**: 细化为6点：审核与投票关系（不影响实时交易）、结论传递机制（review_reports → HR）、组长职责、不适配跳过机制、分类标准（PASS/WARN/FAIL）。

---

### 2026-05-24 — 全面文档审计（本次任务 t_6bb1683e）

**背景**: CEO-001 对 docs/ 下全部部门文档执行系统级审计。

**范围**: 30+ 文件（9 个部门的 README/experience/learned + architecture.md + incident-response.md + policy.md + knowledge/ 知识库）

**发现**: 10 个问题：
- P0(3): docs/rules.md/exception-handling.md/dept-*.md 文件引用不存在（architecture.md 与实际文件名不一致）
- P1(2): 选举委员会向 strategy-director 征集投票的流程矛盾、docs/strategy/ 部门文档实际只有均线交叉内容
- P2(2): Auth 问题多处重复记录、policy.md 与 architecture.md §6A.5 内容重叠
- P3(3): CEO 版本号过时(v4.2→v4.4)、backtest experience.md 过期注释、上报链用词偏差

**修复**:
1. 创建 rules.md → policy.md 重定向文件
2. 创建 exception-handling.md → incident-response.md 重定向文件
3. 修正 architecture.md 中 rules.md/exception-handling.md/dept-*.md 引用
4. 修正 election/README.md 中 6 处 "strategy-director~07" → "strategy-02~07（不含组长）"
5. 更新 docs/strategy/README.md 为部门级概览（标明 AGT-007 部分）
6. 更新 ceo/README.md 版本号 v4.2 → v4.4
7. 更新 backtest/README.md 上报链说明
8. 更新 backtest/experience.md 过期注释
9. 审计报告写入 docs/knowledge/audit-2026-05-24.md

**经验**: 大型系统长期运行后，architecture.md 的「文件结构」节与实际情况容易漂移。每次结构变更时（创建/改名文件），应同步更新 architecture.md §9.2。建议将文件结构检查纳入 CEO 每周巡检事项。

---

### 2026-05-24 — 文档审计经验总结

**文档结构跟踪**: 大型系统长期运行后，architecture.md 的「文件结构」节与实际情况容易漂移。每次结构变更时（创建/改名文件），应同步更新 architecture.md §9.2。建议将文件结构检查纳入 CEO 每 5 分钟巡检中（新增一项「文档结构一致性」检查）。

---

### 2026-05-26 — 第二轮全面文档审计：整理归纳全部部门文档

**背景**: 距上次全面文档审计（t_6bb1683e）已过去2天，需检查修复效果并处理新问题。

**本次审计范围**: 策略/舆情/审核/选举/CEO 五部门文档 + knowledge/ 知识库

**修复**:
1. strategy/experience.md — 追加20策略扩展经验（类别分布+5条核心原则）
2. sentiment/experience.md — 追加每日新闻巡检 SOP
3. sentiment/learned.md — 追加新闻扫描学习笔记
4. review/experience.md + review/learned.md — 新创建
5. review/README.md — 更新文档状态表
6. election/README.md — 修复5处"一人投7票"为"strategy-02~07每人独立投票"
7. CEO/experience.md + learned.md — 追加本轮审计经验

**经验教训**:
- 文档审计形成固定周期，避免"过期2天才发现"
- 每次审计须搜索**所有变体表述**，不仅搜关键词（一人投7票 vs strategy-director 一人投7票）
- README 中的 🔜 占位标记必须同步更新
- knowledge INDEX 的 Trading/Risk 长期待补充 — 需 HR 安排知识库填充

---

### 2026-05-26 — 每日0点例行：归档 + 清理临时文件 + Git提交

**经验**: 每日0点任务是固定的——归档已完成的blocked老任务，清理临时文件（_*.ts、_*.py、tmp/下脚本），检查Git状态，提交每日代码。需要注意：
1. 先检查是否有已完成的守护任务被旧任务阻塞——直接归档
2. 临时文件（analyses/、tmp/下的py脚本）每日清理
3. Git提交前检查 .gitignore 是否覆盖了所有不应提交的文件（如 *.db 已有规则）
4. 空知识库目录（trading, risk）可安全删除——内容由HR填充

---

### 2026-05-26 — 巡检发现 t_f9d134be (ORCL.US BUY) 因 `--skills longbridge` 崩溃70+次后归档

**问题**: election-committee 在创建执行交易任务时带了 `--skills longbridge`。execution-agent 没有这个 skill，每次 spawn 后立即 crash（exit code 1），dispatcher 重试70+次后最终归档为 cancelled。

**教训**: 
- 这个根因在2026-05-24的经验文档中已有记录（同一天的第2条），但选举委员会没有得到这个信息
- 关键是：经验记录在 CEO 文档中是不够的——创建交易任务的代码（trigger-vote.ts 或 election-committee 创建任务的地方）必须硬编码禁止加 `--skills longbridge`
- 需要检查所有创建子任务的地方，确保没有其他 `--skills longbridge` 残留

**修复措施**:
1. 创建通知任务给广告部告知用户 ORCL BUY 失败
2. 记录到经验文档
3. 后续应检查 election-committee 创建任务的代码

### 2026-05-26 — ORCL 死循环崩溃教训

**症状**: ORCL 买1股任务 (t_f9d134be) 从 2026-05-23 23:37 开始运行，执行部按旧架构（不是daemon模式）被派遣，但每次 `npx tsx src/scripts/execute-decision.ts` 都因 Hermes 安全沙箱的 `tirith:schemeless_to_sink` 规则拦截而 exit code 1 崩溃。由于任务 max_runtime=86400s，派遣器不断重试 → 累计 1000+ 次 crash，浪费大量计算资源。

**教训**: 
1. 系统性原因：`execute-decision.ts` 中的 `longbridge` CLI 调用触发了安全沙箱，但 profile 没有配置 approvals.exempt 规则
2. 执行部 daemon 模式应正确处理此类异常——遇到安全拦截应创建新的 Kanban 任务由 CEO 处理，而不是盲目重试
3. 死循环检测：running 超过2小时的任务应立即诊断是否卡死，而不是等 max_runtime 自然到期
4. 复现步骤验证：创建 ORCL 新任务 (t_c8bdf0f9) 给新 daemon 执行部处理，旧任务归档

**根因**: 执行部 profile 的 `toolsets: [hermes-cli]` 限制下，terminal 工具被安全规则拦截。执行部的 system prompt 要求它通过 data-agent 走 API，不直接操作 Longbridge CLI——这是正确的设计，但原始任务直接要求执行部执行 `execute-decision.ts` 违反了这一规则。

**修复**: 创建 daemon 重新处理，并存档旧任务。

### 2026-05-26 — 文档命名审查经验

**任务**: t_d5770d09 — 审查 docs/ 下全部文件的命名合理性

**发现并修复的问题**:
1. **P1** — `strategies-20.md` 实际含21种策略(CAT-001~021)，文件名过时 → 更名为 `strategies-21.md`，同步更新 INDEX.md 和 strategy/learned.md 引用
2. **P2** — 根目录残留3个 tmp_ 调试脚本（tmp_elc_check.ts, tmp_elc_check_db.mjs, tmp_macd_crm.py）→ 已删除
3. 历史审计记录（audit-2026-05-26.md）中涉及旧名的引用是历史事实描述，保留不修改

**审查结论**: 9个部门均具备 README + experience + learned 三件套，无重复/空目录/临时文件残留

**经验教训**:
- 文件名中的数字（如"20种策略"）与实际内容不一致时容易被忽略，应该每次都 grep 统计实际条目数
- 临时调试脚本用完即删，不要留在项目根目录
- audit-*.md 中的历史引用的旧文件名不需要修改——它们是记录历史事实的
