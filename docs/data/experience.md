# Data Department Experience Log (data-agent DAT-001)

记录 data-agent 日常运行中积累的经验和解决方案。

---

## 2026-05-26 — 常驻守护进程的正确运行模式

**问题：** data-agent 作为常驻守护进程（被动等待其他 Agent 通过创建子任务请求数据），之前的 runs 都因为进程正常退出（未调 kanban_complete/kanban_block）而被派遣器判断为 protocol violation。

**解决方案：**
1. data-agent 常驻任务 `t_1a5b033d` 不应是无限循环不退出的进程（工具环境限制）
2. 改用 cronjob 轮询模式：每 2 分钟检查一次常驻任务下是否有新的子任务
3. 有子任务则处理，没有则静默（无需心跳 cronjob 本身）
4. 主会话启动 cronjob 后，发一次心跳并说明模式，然后完成任务（因为实际上是 cronjob 在干活）

**经验：** 常驻守护类任务的最佳实践是 cronjob 轮询模式，而不是在单次 API 调用中无限循环。

## 2026-05-26 — 常驻守护进程 protocol violation 的根因和修复

**问题：** 之前的 runs 全因为 exit_code=0（正常退出）且未调 kanban_complete/kanban_block 而被判定为 protocol violation。派遣器会持续 respawn 导致循环。

**根因：** data-agent profile 重定向 HOME 到 ~/.hermes/profiles/data-agent/home，导致 daemon 脚本中用 `~/.hermes/` 的路径找不到 kanban DB。

**解决方案：**
1. 后台 daemon 脚本 `/tmp/data-agent-daemon.py` 硬编码 DB 绝对路径 `/Users/zys/.hermes/kanban/boards/trading-system/kanban.db`
2. daemon 每 60 秒直接 SQLite INSERT 发心跳，pid 写入 `/tmp/data-agent-daemon.pid`
3. cronjob `a3544e699852` 每 2 分钟轮询子任务 + 检查 daemon 存活，死了就重启
4. 所有涉及 longbridge CLI 的命令添加 `HOME=/Users/zys` 前缀

**关键教训：** 任何在 data-agent profile 下运行的脚本，路径必须使用绝对路径，不能依赖 ~/ 或 $HOME。

## 2026-05-26 — LOB 数据处理经验

**OFI (Order Flow Imbalance) 是微观结构最简特征：** 计算 = (买盘主动成交量 - 卖盘主动成交量) / 总成交量。虽未直接用到长桥数据中，但了解这一特征有助于在数据请求阶段理解策略 Agent 可能的输入需求。

**多标的并行数据请求：** 如果未来有多个标的同时需要数据，可使用 `Promise.all` 无依赖异步批处理，避免串行等待。
