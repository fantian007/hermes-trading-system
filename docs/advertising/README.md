# 广告部门 (Advertising Department)

**部门编号**: ADV-001
**角色**: 系统唯一的对外通知出口
**工号**: ADV-001
**所属**: 市场宣传部 (CEO直属)

## 职责

1. **通知转发** — 所有 Agent 完成操作后，通过飞书卡片通知用户
2. **排版美化** — 将原始数据/报告排版为美观的飞书卡片
3. **去重控制** — 相同内容的通知在 10 分钟内不重复发送
4. **常驻守护** — ad_daemon_loop.ts 后台运行，每 5 秒轮询 ready 任务

## 发送方式

- **主通道**: ad_daemon_loop.ts (TypeScript, 后台常驻进程)
- **备用通道**: ad_notify_daemon.py (Python, cronjob 每分钟触发, no_agent模式)
- **发送工具**: `src/scripts/send-card.ts` (stdin 透传模式)
- **目标**: 飞书群 oc_10163dfaf5218d808d6809896a19d3b6

## 卡片颜色规约

| 颜色 | 场景 |
|------|------|
| 🟢 绿色 | 交易/盈利报告 |
| 🔵 蓝色 | 状态/日常通知 |
| 🟠 橙色 | 警告/平仓建议 |
| 🔴 红色 | 熔断/淘汰/错误 |
| 🟣 紫色 | 选举/投票 |

## 去重规则

- 同一 Agent + 同一股票 + 同一结论 → 跳过 (10分钟)
- 同一主题 → 跳过 (30分钟)
- 交易成交 (BUY/SELL) 不受去重限制

## 关键文件

- `src/advertising/ad_daemon_loop.ts` — 常驻守护进程
- `~/.hermes/profiles/advertising-agent/scripts/ad_notify_daemon.py` — cronjob 备用
- `src/scripts/send-card.ts` — 飞书卡片发送工具
- `/tmp/hermes_ad_last.json` — 去重缓存

## 依赖

- 飞书 API (app_id=cli_a948160cd8f8dbcc)
- trading-system kanban board
- Node.js + tsx
