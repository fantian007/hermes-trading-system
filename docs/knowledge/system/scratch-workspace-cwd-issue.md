# Scratch Workspace CWD 损坏问题（Terminal子系统）

> 2026-05-24 — 记录于 AGT-004 (布林带分析师) 调度事故

## 问题

当 Hermes Agent 在 scratch workspace 中运行时，如果该 workspace 目录被前序运行清理（或手动删除），
agent 进程的 CWD 会变成不存在的路径。Python 的 `os.getcwd()` 会抛出 `Errno 2 (ENOENT)`，
导致所有 shell 命令（npx, git, node, python 等）均无法执行。

## 触发条件

1. Agent 被调度到一个 scratch workspace
2. 该 agent 进行了一些操作但未完成时 spawned 了子任务，或者任务被 `done` 后又被重新 dispatch
3. 前序运行结束后 workspace 被系统清理
4. 新运行的 agent 进程继承了 CWD 指向已删除路径

## 表现

- 所有 terminal 命令报错（CWD 损坏）
- agent 无法执行任何 shell 操作
- kanban 工具（kanban_show, kanban_comment 等）仍正常工作
- 父任务的 kanban_create 等也正常工作

## 修复方法

不需要重启 agent 进程！以下方法有效：

### 方法1：通知组长创建新任务（推荐）
1. 当前 agent 通过 kanban_create 向组长汇报已完成的成果
2. 组长确认数据已持久化后，关闭当前任务
3. 组长创建新任务（新 workspace）给同一或不同 agent
4. 新 workspace 自动修复 CWD 问题

### 方法2：在 agent 级别修复（如果 agent 有 terminal 工具可用）
```python
import os
os.chdir("/path/to/existing/dir")
```

## 预防措施

1. 在所有任务的 body 和 agent 自己的脚本中，都使用绝对路径
2. 数据结果尽量在 kanban comment 中持久化，不要只依赖文件
3. scratch workspace 中的文件在任务完成后可能被清理，重要数据应保存在外部路径
