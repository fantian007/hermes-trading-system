# 数据部门 (Data Department)

> 系统唯一的长桥 API 接口层。被动响应，不分析、不决策、不开发。

---

## 🎯 部门目标

为交易系统所有 Agent 提供**准确、及时、稳定**的行情数据与交易执行能力。
数据是决策的基石 —— 数据错，全盘错。

---

## 👤 成员

| Agent | 角色 | 职责 |
|-------|------|------|
| DAT-001 | 数据接口官 | 系统唯一的长桥 API 接口，处理所有行情查询与交易执行请求 |

---

## 📋 职责

DAT-001 是被动服务 Agent，不主动发起分析或决策：

| 职责 | 说明 |
|------|------|
| **行情查询** | 实时报价、历史K线、账户信息、持仓查询、自选股列表、股池数据 |
| **交易执行** | 接收已决策的下单指令，提交至长桥券商 |
| **数据路由** | 接收任意 Agent 的数据请求 → 查询 → 返回 JSON 结果 |

---

## 🔧 支持的命令

### 数据查询 — `data-service.ts`

所有行情数据通过统一入口查询：

```
npx tsx src/scripts/data-service.ts --type <TYPE> [--symbol <SYM>] [--days <N>]
```

| --type | 说明 | 必需参数 | 示例 |
|--------|------|----------|------|
| `quote` | 实时报价 | `--symbol` | `--type quote --symbol NVDA.US` |
| `kline` | 历史K线 | `--symbol` | `--type kline --symbol AAPL.US --days 30` |
| `account` | 账户资产 | 无 | `--type account` |
| `positions` | 当前持仓 | 无 | `--type positions` |
| `watchlist` | 自选股行情 | 无 | `--type watchlist` |
| `pool` | 股池数据 | 无 | `--type pool` |
| `news` | 新闻（模拟盘暂不可用）| `--symbol` | `--type news --symbol NVDA.US` |

### 交易执行 — `execute-decision.ts`

对外提供下单接口，仅执行已通过选举共识的决策：

```
npx tsx src/scripts/execute-decision.ts \
  --round-id <ID> \
  --symbol <SYM> \
  --action BUY|SELL \
  --quantity <N>
```

---

## 🔄 数据流

```
请求方 Agent → DAT-001 → data-service.ts → 长桥 CLI (longbridge) → 长桥 API
                                          ↘ pool/query.ts → SQLite 股池
```

1. 任意 Agent 向 DAT-001 发起数据请求
2. DAT-001 调用 `data-service.ts` 或 `execute-decision.ts`
3. 脚本通过长桥 CLI (`longbridge --format json`) 查询券商
4. 返回 JSON 结果给请求方
5. DAT-001 通知 advertising-agent 记录操作日志

---

## ⚠️ 约束

- **被动响应**：不主动分析、不参与策略讨论、不自行决策
- **常驻守护**：不调 `kanban_complete`，永不退出
- **通知规则**：任何操作完成后通知 advertising-agent
- **升级链**：数据异常 → 报告 strategy-01 → CEO

---

## 🗂 关键文件

| 文件 | 说明 |
|------|------|
| `src/scripts/data-service.ts` | 统一行情数据服务（269行，6种查询类型） |
| `src/scripts/execute-decision.ts` | 交易下单执行脚本（99行） |
| `src/pool/query.ts` | 股池查询服务（278行，三阶段：SQLite→聚合→长桥批查询） |
| `src/trading/order.ts` | 订单提交底层（BUY/SELL） |
| `docs/data/experience.md` | 部门经验总结 |
| `docs/data/learned.md` | 学习笔记 |

---

## 📝 已知限制

- **News API**：模拟盘暂无权限（403308），返回 `available: false`
- **长桥 CLI HOME 问题**：Hermes profile 重设 HOME 导致 CLI 找不到 token，data-service.ts 已在 `execSync` 中显式设置 `HOME=/Users/zys`
- **超时策略**：单次查询 30s 超时，避免阻塞整个数据管道

---

> 最后更新：2026-05-23 | 维护者：DAT-001
