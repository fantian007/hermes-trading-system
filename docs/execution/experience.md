# 执行部门经验记录

## 2026-05-24 — 首次巡检报告

### 数据库结构
- `election_rounds` 表没有 `status` 列，用 `final_decision` 判断是否通过
  - `final_decision='BUY'` 或 `final_decision='SELL'` 且 `resulted_trade_id IS NULL` → 死单
- `trades` 表：`direction` 列（LONG），`status` 列（OPEN/CANCELLED/CLOSED/PENDING/EXECUTING）
- 无 `account_snapshots` 表，目前没有记录账户余额的快照表

### 死单判断
死单条件：`final_decision IN ('BUY','SELL') AND (resulted_trade_id IS NULL OR resulted_trade_id = '')`
所有已投票的选举轮次都有 `resulted_trade_id`（即使交易被 CANCELLED 也会关联），所以目前没有真正意义上的死单。

### 执行流程
1. npx tsx 直接在项目目录下运行 `.ts` 文件或用 `-e` 执行内联脚本
2. 脚本需用绝对路径导入 db 模块：`from '/Users/zys/workspace/hermes-trading-system/src/core/db.ts'`
3. DB 是本地 SQLite，无需网络连接

### 持仓清理状态
- ✅ 真实持仓：AAPL.US 5股 @ $308.40 (OPEN)
- ✅ 幽灵单已清理：SMCI/ARM 相关买价=$0 的取消单均已 CANCELLED
- ✅ 死单：无（所有 BUY/SELL 轮次都关联了 trade，即使交易被取消）
- SMCI.US 重新投票已完成（ELC 3票 BUY，加权0.75），data-agent 待周一开市执行

### 2026-05-24 — Run 1029 巡检
- daemon 使用 `exe-daemon.mjs`（sqlite3 CLI 查询），非 daemon.ts
- `.known_rounds.txt` 记录已知轮次，避免重复告警
- 轮回合/周日无新交易决策
- 5/26 周二开市后 ELC 的 SMCI BUY 将执行
