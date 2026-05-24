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
**处理**: 按 policy.md 第97行「部门文档缺失 → CEO 通知该部门补写」，创建 Kanban 任务 t_aa94f3c3 给 review-01。

**问题2**: incident-response.md 缺乏审核专用异常场景。
**处理**: 新增第十章「审核异常」，覆盖4场景：数据获取失败、框架不适配、写入失败、超时。后续节号顺延（十一→十二）。

**问题3**: policy.md 第109行审核职责描述过于简略（仅一句话）。
**处理**: 细化为6点：审核与投票关系（不影响实时交易）、结论传递机制（review_reports → HR）、组长职责、不适配跳过机制、分类标准（PASS/WARN/FAIL）。
