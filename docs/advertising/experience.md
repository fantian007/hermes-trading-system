# 📢 广告部门经验总结

> 由 ADV-001 自主维护 | 试错→记录→检索→复用

---

## 2026-05-23 — v4.3 架构文档学习：去重机制升级

**问题**: v4.3 第6A.6节明确要求广告部门新增去重逻辑，避免无新数据时重复推送飞书消息。

**可行方案**:
- 去重缓存 `/tmp/hermes_ad_last.json` 字段完整覆盖（agent, symbol, verdict, price, time）
- 跳过条件 4 条（同一结论、价格波动<0.5%、间隔<10分钟、系统状态无变化）
- 必须发送 5 类场景（交易成交、Agent状态变更、投票结果、熔断/紧急事件、距上次同类通知>30分钟）
- 与现有 system prompt 中定义的去重规则完全一致，无需额外修改

**经验**:
- 去重规则在 README.md 和 system prompt 中保持一致，避免规则冲突
- 缓存文件路径 `/tmp/hermes_ad_last.json` 需确保写入权限

---

## 2026-05-23 — send-card.ts 运行注意事项

**问题**: send-card.ts 必须用 `npx tsx` 运行，直接 `node` 会报 exit code 1。

**症状**: 飞书通知发送失败，脚本 silent crash

**尝试过的方案**: 检查 path、节点版本、模块导入

**可行方案**: 始终使用 `npx tsx src/scripts/send-card.ts <card.json>` 而不是 `node`

---

## 2026-05-23 — 知识库路径确认

**发现**: v4.3 新增知识库体系，广告部知识库路径为 `src/knowledge/advertising/`
部门文档路径为 `docs/advertising/`
两者不同：knowledge 存放经验笔记，docs 存放部门规范和工作流程

---

## 2026-05-23 — 问题升级链确认

**发现**: v4.3 第6A.4节正式文档化问题升级链：
1. 自己解决
2. 报告 CEO
3. CEO 无法解决 → 广告部门发飞书通知用户

与现行 system prompt 完全一致，无需修改。
