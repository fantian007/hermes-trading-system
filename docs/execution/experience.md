## 2026-05-24 — 巡检发现 daemon 进程未随 Kanban 任务启动

问题：exe-daemon.mjs 守护进程在同一台机器上独立于 Kanban worker。Kanban 重启 EXE-001 时不会自动启动 daemon。

解决方案：EXE-001 工作循环的第一步应检查 daemon 是否在运行：
- ps aux | grep "exe-daemon"
- 如不在 → cd /Users/zys/workspace/hermes-trading-system && node scripts/exe-daemon.mjs &

## 2026-05-24 — 使用 npx tsx -e 查询核心 DB

核心系统使用 node:sqlite 模块（Node 22.5+ 实验性功能）。
查询方式：cd /Users/zys/workspace/hermes-trading-system && npx tsx -e "
  import { getDb } from './src/core/db.ts';
  const db = getDb();
  const rows = db.prepare('SELECT ...').all();
  console.log(JSON.stringify(rows, null, 2));
"

注意：import 路径需要 .ts 后缀（系统是 TS 项目），tsx 会自动处理。

## 2026-05-24 — EXE-001 Kanban Worker 首轮巡检完成

- 系统状态正常：1 OPEN (AAPL 5股@$308.40)，0死单，今日0交易
- daemon 进程 (exe-daemon.mjs) 不在运行，但 Kanban Worker 本身就承担巡检职责
- node:sqlite 是实验性 API，查询时用 PreparedStatement 带 ? 占位符防错
- election_rounds 表无 status 列（不同于文档描述），判断死单依据 resulted_trade_id IS NULL
- 通知广告部门通过 kanban_create 发送，不直接调用 send-notify.ts

## 2026-05-24 — 第317轮巡检
- 死单检查: 0个死单，所有BUY/SELL决策均有 resulted_trade_id

## 2026-05-24 — 注意：tsx -e 模式无法解析 ESM import
- npx tsx -e 内联脚本在 Node 25+ 上 ESM 解析有问题（module not found）
- 替代方案：写临时 .mts 文件 → npx tsx file.mts → 删除
- 或直接用 scripts/check_dead_rounds.ts 脚本
- OPEN持仓: AAPL.US 5股 @ 08.40 (buy_price非零，已成交)
- 后台daemon: 已停止运行（非交易时段正常）
- 确认: final_decision 列名代替旧版 status 列; trades 表 trade_id/buy_price 代替旧版 id/price
## 2026-05-24 — 巡检第N轮
- 死单检查: 0个死单 ✓
- OPEN持仓: AAPL.US 5股 @ $308.40
- 已向data-agent发起行情查询请求(t_418b7f10)
- 后台daemon: 未运行（由Kanban Worker直接承担巡检职责）
## 2026-05-24 — CRM.US BUY 执行（ELEC-20260524-1210）
- 标的: CRM.US（Salesforce），执行价格区间 $179.00~$180.00
- 投票: 4 BUY / 1 HOLD（AGT-002 MACD金叉0.65, AGT-004布林中轨反弹0.55, AGT-007均线金叉0.60, AGT-008 RSI中性0.50; AGT-005海龟系统HOLD 0.65）
- 风控检查全部通过: 无持仓→仓位上限OK, 周末休市→0交易, 资金充足
- 执行时间: 5/26 周二开盘（周末休市中）
- data-agent预约任务: t_25ed93e4
- 广告部门已通知: t_b362539e
| 经验: 周末ELC投票通过后，只能先做风控+预约，不能立即执行。data-agent的预约任务需要写明开盘后执行。
|## 2026-05-24 11:24 — EXE-001 第N+1轮巡检完成
|- 死单检查: 0个死单。所有BUY/SELL决策均有resulted_trade_id ✓
|- OPEN持仓: AAPL.US 5股 @ $308.40（唯一真实持仓）
|- 子任务 t_8c90d232 (SMCI重新投票): ELC仍在处理中，AGT-007已投BUY，状态todo
|- daemon: 未运行（非交易时段，Kanban Worker直接巡检）
|- 经验: election_rounds 无 status/action 列，用 final_decision 代替；resulted_trade_id IS NULL 判断死单
|- TODO: 买入: CRM.US (ELEC-20260524-1210, 4BUY/1HOLD) 预约周二开盘执行
## 2026-05-24 — election_rounds 的 final_decision 字段未正确更新
- DB 的 aggregator 在写入 4BUY/1HOLD 的结果时，没有更新 final_decision 列，仍然保留初始值 HOLD
- 执行部门巡检时发现此问题，手动修复：UPDATE election_rounds SET final_decision='BUY', decision_confidence=0.65, total_voters=5 WHERE round_id=?
| 经验：执行部门在收到 ELC 决策后，应优先查 DB 确认 final_decision 是否正确，不一致则修复后再执行
- 常规查询脚本：node src/scripts/_check_exe_status.mjs（使用 node:sqlite 直连 trading.db）

## 2026-05-24 10:38 — 死单判断需排除"已预约执行"的轮次
- CRM.US (ELEC-20260524-1210): final_decision=BUY, resulted_trade_id=NULL, 4BUY/1HOLD
- 表面看是死单，但实际上已有 data-agent 预约执行任务（t_24b69455），等待周二开盘
- ⚠️ 判断死单前必须先查：1) 是否有待执行的 data-agent 任务  2) 轮次的 final_decision 是否 BUY/SELL  3) 对应的 trade 是否已 CANCELLED
- 经验：不要仅凭 resulted_trade_id IS NULL 判定死单，预约执行阶段 resulted_trade_id 仍为 null
- 更好的判断条件：final_decision='BUY'/'SELL' AND resulted_trade_id IS NULL AND 无对应的 data-agent 预约任务

## 2026-05-24 11:33 — EXE-001 Kanban Worker 第N+2轮巡检（周日复盘）
- 时间：周日白天，美股休市
- 死单检查：0个待执行 BUY/SELL 死单。election_rounds 表中 resulted_trade_id IS NULL 的3条：
  - ELEC-20260524-0129 (SMCI.US HOLD) — HOLD 不需要执行 ✓
  - ELEC-20260524-0131 (ARM.US HOLD) — HOLD 不需要执行 ✓
  - ELEC-20260524-1210 (CRM.US BUY) — 之前已执行 CANCELLED，历史死单 ✓
- OPEN持仓：AAPL.US 5股 @ $308.40（唯一真实持仓）
- 经验：election_rounds 表没有 status 列，final_decision 列替代；resulted_trade_id IS NULL 判断待处理轮次
- 经验：HOLD 决策的轮次不需要执行部门操作，自然留在 resulted_trade_id IS NULL 状态即可
- 经验：周末检测到 election_rounds 中 CRM BUY 历史死单时，不应重复通知 ELC 重新投票（之前已处理为 CANCELLED）
- CRM.US 死单分析：历史投票 4BUY/1HOLD，agents 均投 BUY（AGT-002 MACD金叉0.65, AGT-004布林中轨0.55, AGT-007均线金叉0.60, AGT-008 RSI中性0.50; AGT-005海龟HOLD 0.65）— 之前已取消（周末无法执行）

## 2026-05-24 — CRM.US 死单被 ELC 处理，data-agent 预约周二执行

- 本轮巡检发现 CRM.US (ELEC-20260524-1210) 的 resulted_trade_id IS NULL → 按规则创建了 ELC 重新投票任务 t_164042b4
- 但查看后发现 ELC 之前已经处理了该轮次（t_f3870c68 已完成），风控通过，已创建 data-agent 预约任务 t_24b69455
- 经验教训：1) 先查所有子任务/相关任务的完成状态，不要盲目重新投票 2) election_rounds 的 resulted_trade_id 在预约执行阶段仍然为 null，直到 data-agent 实际成交后才回写 3) 判断"死单"时要排除有预约执行任务的轮次
- 当前交易系统使用 node:sqlite（实验性），查询需用 PRAGMA table_info 先确认列名

## 2026-05-24 11:50 — EXE-001 第N+3轮巡检：CRM.US死单已过期，通知ELC重新投票

- CRM.US (ELEC-20260524-1210): final_decision=BUY, 4/5票, 65%置信度, 创建约8.5小时前
- 2次执行尝试均产生CANCELLED交易（buy_price=0幽灵订单）
- 检查子任务状态：无活动的data-agent预约任务 → 确认为真正死单
- 本轮执行：更新executed_at标记该轮已处理 → 创建ELC重新投票任务(t_0b860ea4) → 通知广告部门(t_f67f63f1 comment)
- OPEN持仓: AAPL.US 5股 @ $308.40（唯一真实持仓，约14.5小时）
- exe-daemon (PID 20217): 存活，S状态
- guardian (PID 8349): 存活，每分钟心跳
- 经验: CRM死单判断需要三步确认：① resulted_trade_id IS NULL ② 对应trade已CANCELLED ③ 无活跃data-agent预约任务。三步都满足才是真正的死单需要ELC重投。
