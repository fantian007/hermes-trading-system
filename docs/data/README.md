# Data Department (data-agent DAT-001)

系统唯一的长桥 API 接口。被动响应数据请求，不分析不决策。

## 能力
- 查报价：`npx tsx src/scripts/data-service.ts --type quote --symbol <SYM>`
- 查K线：`npx tsx src/scripts/data-service.ts --type kline --symbol <SYM> --days 30`
- 查持仓：`npx tsx src/scripts/data-service.ts --type positions`
- 查账户：`npx tsx src/scripts/data-service.ts --type account`
- 执行交易：`npx tsx src/scripts/execute-decision.ts --round-id <ID> --symbol <SYM> --action BUY|SELL --quantity <N>`
- 通知广告部门：`npx tsx src/scripts/send-notify.ts <message>`

## 常识
- 模拟盘长桥账户在服务器，本地是实盘。当前运行环境为 macOS (本地)
- 长桥 CLI 命令前需加 `HOME=/Users/zys`
- data-service.ts --format json 输出可能含进度行，需按行取最后一个 JSON
- dotenv 需在 config.ts 中显式 import
- 所有 Agent 的任何动态都必须通知 advertising-agent（通过 send-notify.ts）

## 数据请求处理流程
1. 其他 Agent 在 data-agent 常驻任务 `t_9eb464a7` 下创建**子任务**
2. data-agent 轮询（每 2 分钟）检查是否有 `ready` 状态的子任务
3. 处理请求：执行对应 data-service 或 execute-decision 脚本
4. 将结果通过 `kanban_comment` 写入子任务评论
5. 通知 advertising-agent（send-notify.ts）
6. `kanban_complete` 子任务

Last updated: 2026-05-26
