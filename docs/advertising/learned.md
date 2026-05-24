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

---

## 2026-05-24 — v4.4 架构文档学习（本次 Kanban 任务 t_925b57b9）

**学习来源**: `docs/architecture.md` v4.4

**v4.3 → v4.4 关键变化**:

1. **知识库体系从框架设计进入实际落地阶段**
   - 各部门经验库(experience.md)和学习笔记(learned.md)已初始化
   - 回测部门文档完备（README.md + experience.md + learned.md）
   - 跨部门知识索引 INDEX.md 已建立（HR/Trading/System/Risk 四大分类）

2. **架构文档版本发布规范正式写入**（第6B.2节）
   - v4.0~v4.4 各版本变更时间线文档化

3. **后续规划**（第6B.3节）
   - 各部门日常运维中持续补充 experience.md 和 learned.md
   - Trading/System/Risk 分类知识库内容填充（当前待补充）

**对广告部门直接影响**:
- 无新增去重规则变更，第6A.6节仍为现有去重逻辑
- 广告部门 README.md/experience.md/learned.md 已在 v4.3 周期初始化完毕
- 广告部经验库路径 `src/knowledge/advertising/` 和部门文档路径 `docs/advertising/` 的分工已正确建立

---
## 2026-05-24 — 推送 RAG-001 v4.4 架构文档学习完成通知

- 审核部门组长 RAG-001 完成 v4.4 架构文档（1220行）全文学习
- 蓝色卡片推送成功，message_id: om_x100b6e29915caca8b118d825774e684
- 审核部门纯事后审核定位：PASS/WARN/FAIL 技术审核 + Agent 绩效评估

---

## 2026-05-24 — 残余调度任务处理

**事件**: AGT-005（海龟策略）残余调度任务 `t_e5b0ec85` 启动，但原调度任务 `t_e1ac8e68` 在 Kanban 看板上已不存在（已完成/清理）。任务被 dispatcher 标记为 archived。

**处理**:
- 确认任务已归档，无需调用 `kanban_complete`
- 系统其他14个 Agent 均在正常 running 状态
- 主任务 `t_2f4e3fad` 为广告部门常驻实例
- 上次通知缓存：BKT-001 deep_learning_report 于 2026-05-24T03:58 发送
- 无待处理的未通知消息

**经验**: 残余调度启动时，直接确认状态即可，无需额外操作。

## 2026-05-24 — send-card.ts 接口调整
- send-card.ts 期望标准输入的是 **card内容JSON对象**（即 elements/header/config），而非包含 receive_id/msg_type 的完整消息封装
- sendCard 函数内部会自动添加 receive_id (从 feishu.chatId) 和 msg_type='interactive'，并将 card 做 JSON.stringify 作为 content
- 往级输入包含 receive_id 时会导致 double-escaping 报错 (ErrCode: 200621)
