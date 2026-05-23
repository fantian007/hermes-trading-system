# 数据部门 — 经验总结

> DAT-001 运维过程中的经验记录

---

## 2026-05-23

### 长桥 CLI 输出解析
- `longbridge --format json` 输出可能包含进度文本行（如 "Submitting..."），解析时必须从**末行往前**找第一个 `{` 或 `[` 开头的行作为有效 JSON
- 处理方式：`lines.reverse().find(l => l.startsWith('{') || l.startsWith('['))`

### 超时设置
- 单次长桥 CLI 查询 30s 超时已经够用
- 批量查询（如 watchlist 7 只股票）10s 足够
- 避免过长的超时阻塞数据管道

### 股池查询三阶段
- 第一阶段 SQLite 本地过滤（快）
- 第二阶段数据聚合与去重
- 第三阶段长桥批量查询（最多 10 只一批）
- 降级模式 `skipQuotes=true` 允许离线查询股池元数据

### News API
- 模拟盘 `longbridge news` 返回 403308，暂无可用方案
- 策略 Agent 可用 sentiment-scan.ts 或自主分析替代

### 工作流
- 被动等待请求 → 执行查询 → 返回结果 → 通知 advertising-agent
- 不做数据缓存，每次查询都是最新的
