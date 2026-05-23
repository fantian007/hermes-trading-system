# CEO-001 学习笔记

> 记录进化过程中学到的知识、观察到的模式、值得全系统推广的经验。
> 如有全员适用，告知 HR-001 写入跨部门知识库。

---

### 2026-05-24 — 守护进程模式确认

**观察**: 之前 CEO 任务多次因 protocol_violation 崩溃。原因是任务 body 写着"不调 kanban_complete，永远 running"，但 LLM session 无法无限保持存活。

**解决**: 
- Kanban task 设 max_runtime=86400s (24h)
- 内部循环不做 sleep，而是通过 heartbeat 保持活性
- 真正的工作在每次 spawn 时执行一遍，然后循环等待下一轮 spawn
- 之前创建的 cron job (每3小时) 可以辅助周期任务

**推广**: 所有守护型 Agent 不需要 sleep 循环。完成当前工作后等待 dispatcher 重启即可，保持 heartbeat 防止被回收。

---

### 2026-05-24 — 系统启动模式

**观察**: 首次启动时，所有 14 个 Agent 被 gateway dispatcher 同时 spawn。没有 crash/blocked 问题。HR-agent 完成了一次性配置修复后自然 done——这是正确的。

**关键**: 守护 Agent 不应该做"一次性工作"（那是普通 task）。HR-agent 修复配置后 done 是对的；sentiment-agent、strategy-02~07 等应该持续 running。
