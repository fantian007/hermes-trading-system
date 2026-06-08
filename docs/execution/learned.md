# 执行部门学习笔记

## 2026-05-26
- 学会检查死单：SELECT round_id, symbol, final_decision FROM election_rounds WHERE resulted_trade_id IS NULL AND final_decision IN ('BUY','SELL')
- 发现幽灵交易：election_rounds 的 final_decision=HOLD 但 trades 表里有同关联的 OPEN 记录——可能来自 data-agent 的独立操作或系统 BUG
- buy_price=0 通常意味着未真正成交，需标记为异常
- 协议违规导致重建：任务作为常驻守护进程（永不退出）运行时，不能调用 kanban_complete，但之前的 worker 正常退出（rc=0）触发了协议违规检测（期望是 kanban_complete 或 kanban_block）。对守护进程类任务，需确保进程持续运行，循环等待。

## 2026-05-27
- EXE-001 作为常驻守护进程重启后的流程：自动检查死单 → 检查持仓 → 检查待处理任务 → 自检 → 通知广告部门 → 进入工作循环
- election_rounds 表没有 status 列，而是通过 resulted_trade_id 是否为空和 executed_at 判断执行状态
- 3笔有效持仓需持续监控：AAPL(5@308.4), CLSK(1@15.4), CRM(1@180.07)
- t_2f38a449（自检回复）和 t_c2219dec（部门学习）可通过 kanban_comment 提交结果给 CEO，但本 worker 被 scoped 到 t_08db575d，不能 kanban_complete 其他任务

## 2026-06-08
- 复读部门文档时确认：系统DB只记录"系统自行创建的"交易，长桥API返回完整持仓。风控计算应以长桥API为准，DB为辅助对照。
- 执行部门是整个系统中唯一可以"不等ELC投票就行动"的场景是 P0紧急清仓令（舆情部门直接触发），其他所有交易行为必须经过ELC。
- 经验文档 experience.md 记录了从第1轮到第6轮的完整巡检链，是排查历史问题的第一手资料，每次巡检前应回顾 past rounds 避免重复踩坑。
- 部门文档（README/experience/learned）三者分工清晰：README=静态规则+对接方式，experience=动态操作经验，learned=个人成长笔记。

## 2026-05-26 (第12轮巡检后)
- 协议违规问题：调度器检测到 worker 退出时没调 kanban_complete/kanban_block 就标记为 crashed。本轮起确保循环不退出——不自调 kanban_complete，只在巡检中继续循环。
- election_rounds 无 status 列，判断死单方法：final_decision IN ('BUY','SELL') AND resulted_trade_id IS NULL。不可用 WHERE status='PASSED'，因为无此列。
- trades 表存储实际交易，无 PENDING 状态。订单状态在长桥 API 侧查询。
- 美东时间 08:32 = CST 20:32，距离开盘约 58 分钟。开盘前 CLSK/AAPL 加仓 MO 单标记为 NotReported 是正常行为。

## 2026-05-26 (第14轮巡检 — 当前轮次)
- DB_PATH 在 config.ts 中定义为 `./data/trading.db`（相对于项目根目录），不是 src/trading.db。
- election_rounds 表没有 action/status 列。final_decision 列代表最终决策（BUY/SELL/HOLD），resulted_trade_id 标记是否已执行。
- 死单检查的正确 SQL：`SELECT round_id, symbol, final_decision, resulted_trade_id FROM election_rounds WHERE final_decision IN ('BUY','SELL') AND resulted_trade_id IS NULL`
- GOOGL 做空的 sell_price=382.97 已被记录到 DB，但该笔 trade 仍为 OPEN 状态——因为做空是卖出再买回，所以 sell_price 记录卖空价格，买回平仓才算 CLOSED。
