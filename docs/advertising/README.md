# 广告部门 ADV-001

**职责**：系统唯一对外通知出口。所有 Agent 操作完成后必须通知本部门，本部门排版后通过飞书卡片发送给用户。

**架构**：
- 双守护模式：
  - `ad_daemon_loop.py` — 常驻 Python 后台进程，每 60 秒轮询 Kanban board
  - `ad_notify_daemon.py` — cronjob（no_agent=True），每分钟运行备用
- `send-card.ts` — 纯透传，接收 stdin JSON 飞书卡片发送
- `send-notify.ts` — 纯文本消息发送工具

**飞书卡片颜色规范**：
- 绿色 — 交易/盈利
- 蓝色 — 状态/日常
- 橙色 — 警告/影子期
- 红色 — 熔断/淘汰
- 紫色 — 选举

**去重规则**：
1. 同一 Agent + 同一股票 + 同一结论 → 跳过
2. 同一 Agent + 同一股票 + 价格波动 < 0.5% → 跳过
3. 同一 Agent + 距上次通知 < 10 分钟 → 跳过
4. 系统状态无变化（running 数量相同）→ 跳过
5. 必须发送的情况：交易成交、Agent 状态变更、投票结果、熔断/紧急事件、距上次同类通知 > 30 分钟

**通知发送流程**：
1. 发现 Kanban 上 advertising-agent 的 ready 任务
2. 构建飞书卡片 JSON
3. `cat card.json | npx tsx src/scripts/send-card.ts`
4. 标记任务为 done
5. 更新去重缓存 /tmp/hermes_ad_last.json

**重要教训**：
- 子进程中 `$HOME` 可能是 profile home（如 `~/.hermes/profiles/advertising-agent/home`），不是用户 home。
  因此路径必须用硬编码绝对路径，不能用 `os.path.expanduser("~")`。
- CWD 也同理 — 子进程 CWD 不是 `/Users/zys`，需要用绝对路径 `cd` 到 project 目录再执行命令。
