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

### 当前持仓
- AAPL.US: 5股 @ $308.40 (OPEN)
- 所有 SMCI/ARM 相关交易已被取消（CANCELLED）
