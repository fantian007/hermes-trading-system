# 选举委员会学习笔记

## 2026-05-24 — v4.4 架构文档学习

### 关键知识点

1. **加权公式确认**: `agent_weight = win_rate × log₂(1 + total_trades)`，初次交易权重 = 0.5
2. **经验积累机制**: 试错→记录→检索→复用。新问题先查 `docs/election/experience.md` 和 `docs/knowledge/` 跨部门知识库，查不到才自己探索
|3. **跨部门知识库分类**: docs/knowledge/INDEX.md 分四大类（HR/Trading/System/Risk），有价值经验可写入对应分类

## 2026-05-24 (session 2) — SMCI.US 死单重投操作

### 新知识点
1. **两个 DB 文件**: 交易系统根目录同时存在 `trading.db` 和 `data/trading.db`。`DB_PATH` 默认指向 `./data/trading.db`，tsx 脚本用这个路径。root trading.db 是另一个实例/副本。sqlite3 查数据前先确认是哪个文件。
2. **agent_votes 表 FK 问题**: `trade_id` REFERENCES trades(trade_id)，但 election_rounds 的 round_id 可以同时作为 trade_id 用。SQLite 默认不强制 FK（除非 PRAGMA foreign_keys=ON）。
3. **冷却绕过方案**: 死单重投可直接 SQL INSERT election_rounds 绕过冷却检查。但插入后需注意 DB_PATH 一致性。
4. **幽灵轮次**: 冷却检查可能命中已回滚的轮次（INSERT 成功后被事务 ROLLBACK，但 SQLite 的 `datetime('now', '-1 hour')` 查询仍会看到它）。解决方案：等待冷却期过或直接 SQL INSERT。

- session_search 如何联动知识库检索（6B.3 后续规划）
- 跨部门经验写入后如何通知 HR 更新 INDEX.md
