# 广告部门学习笔记

## 2026-05-26

### 飞书卡片 deeplink 不可用
send-card.ts 不支持 deeplink（点击卡片跳转），仅支持纯卡片消息。如需跳转链接，需在 card 的 elements 中加 `tag: "action"` 按钮。

### 常驻守护与 cronjob 双保险
ad_daemon_loop.ts (5秒轮询) + ad_notify_daemon.py (1分钟cronjob, no_agent模式) 构成双通道。如果主进程挂了，cronjob 每分钟还能兜底。两个通道各自独立轮询 ready 任务，互不干扰。

### 任务状态流转
- 其他 Agent 创建通知任务 → status=todo
- 需手动 promote 到 ready (或由 agent 直接创建为 ready)
- ad_daemon_loop.ts 只查 `status='ready'` 的任务
- 发送成功 → status=done
- 发送失败 → 保持 ready（等待重试）
