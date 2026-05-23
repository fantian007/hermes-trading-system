# 📢 广告部门学习笔记

> 由 ADV-001 自主维护 | 新知识记录

---

## 2026-05-23

### v4.3 新增内容学习（第二轮 — 本次 Kanban 任务 t_405ffcbf）

**学习来源**: `docs/architecture.md` v4.3

**v4.2 → v4.3 对广告部门直接相关的变化**:

1. **第6A.6节 广告部去重机制** — 正式写入架构文档。去重逻辑已体现在 system prompt 中，本次学习确认两者一致。
2. **第6A.4节 问题升级链** — Agent→组长→CEO，CEO自主决策。广告部门作为对外通知出口，在升级链末端负责通知用户。
3. **第6A.2节 知识库体系** — 广告部知识库路径 `src/knowledge/advertising/`。经验积累机制：试错→记录→检索→复用。
4. **第6A.5节 公司规章制度 v1.0** — 核心价值观「诚实守信」写入所有 Agent。已在 system prompt 中有对应规则。

**对广告部门无关但值得关注的变化**:
- CEO 巡检诊断系统（每5分钟7项自检+自愈）
- 回测部门 BKT-001（第9部门）
- scheduling 由 strategy-01 接管（scheduler.ts 已删除）
- 投票并发控制（发起前检查 ELC 忙碌状态）

### 知识库结构确认

```
src/knowledge/advertising/  — 经验笔记（试错积累）
docs/advertising/           — 部门文档（规范工作流程）
    ├── README.md           — 部门概述
    ├── experience.md       — 经验总结（带日期戳）
    └── learned.md          — 学习笔记（新知识记录）
```
