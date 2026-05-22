# AI 选举交易系统 — 技术方案 v4

> **版本**: Phase 1 MVP v2026.05 | **状态**: 编码完成 | **Agent 数量**: 19 | **部门**: 8 | **改造**: 2026.05 — 所有决策完全交给 Agent 自然语言，脚本仅做纯数据读写 | **合并**: 2026.05 — 选股+盯盘合并为策略部门，7 位分析师自主分析 | **新增**: 舆情部门，负责股池维护

---

## 1. 设计哲学

```
代码(KB):Agent(自然语言)  ≈  0:100
```

| 归属 | 负责内容 | 示例 |
|------|---------|------|
| **代码** | 读写 DB、调 Longbridge CLI、纯数据聚合 | `data-service.ts` 查询行情、`aggregate-votes.ts` 统计加权票数 |
| **Agent** | **一切决策**：选股、盯盘、投票、风控、淘汰、下单量、买卖时机 | "NVDA 均线金叉了，我觉得可以买"、"RAG-003 40%胜率进影子期" |

核心原则：**Agent 之间通过自然语言聊天做决策，脚本只做纯数据提供服务。没有脚本替 Agent 做任何判断。**

已删除的所有替 Agent 决策的脚本：
- ~~`smart-scanner.ts`~~ — 之前替 Agent 做选股和止损判断
- ~~`selector-technical.ts`~~ — 之前替 Agent 做技术指标判断
- ~~`selector-risk.ts`~~ — 之前替 Agent 做止损/止盈判断

---

## 2. 系统架构总览

```mermaid
graph TB
    subgraph "舆情阶段（股池维护）"
        SENT[舆情部门<br/>sentiment-agent] ==>|"发现利好→加入股池<br/>发现利空→踢出股池<br/>维持约20只"| POOL[(候选股池<br/>stock_pool)]
    end

    subgraph "策略阶段（自主分析）"
        STRATEGY[策略Agent ×7<br/>strategy-01~07] -.->|"查看股池列表<br/>获取股票信息"| SENT
        STRATEGY ==>|"自己找 data-agent 查数据<br/>自己分析、自己判断<br/>发现机会后发起投票请求"| EC[选举委员会<br/>election-committee]
    end

    subgraph "投票阶段"
        EC ==>|"向全体策略Agent征集意见"| STRATEGY
        STRATEGY ==>|"BUY/SELL/HOLD 投票"| EC
        EC -.->|"查看加权统计"| AGG[aggregate-votes.ts<br/>纯加权统计]
        EC ==>|"赞成≥反对→通过<br/>赞成<反对→驳回"| DECISION{最终决策}
    end

    subgraph "执行阶段"
        DECISION ==>|"BUY/SELL指令"| EXEC[执行部门<br/>execution-agent]
        EXEC ==>|"风控判断→向数据部门提需求"| DATA[数据部门<br/>data-agent]
        DATA ==>|"跑 execute-decision.ts"| TRADE[(交易记录<br/>trades)]
        DATA ==>|"交易完成通知"| REVIEW[审核部门 ×6<br/>review-01~06]
    end

    subgraph "审核阶段（事后）"
        REVIEW ==>|"跑 review-and-audit.ts<br/>看数据自己审核"| REPORTS[(审核报告<br/>review_reports)]
        REPORTS ==>|"审核结果含绩效评估"| HR[HR 部门<br/>hr-agent]
    end

    subgraph "人事决策阶段"
        HR ==>|"综合审核报告+胜率统计"| DECIDE{淘汰/影子期/复活/警告}
        DECIDE ==> AGENTS[(Agent档案<br/>agents)]
    end

    subgraph "数据基础"
        DATA -.->|"所有部门找他要数据"| ALL[所有Agent]
    end

    subgraph "广告部门"
        AD[广告部门<br/>advertising-agent] -.->|"对外通知"| FEISHU[(飞书消息)]
    end

    AD -.-> ALL
    ALL -.-> AD

    style SENT fill:#e65100,color:#fff
    style POOL fill:#bf360c,color:#fff
    style DATA fill:#1a237e,color:#fff
    style STRATEGY fill:#004d40,color:#fff
    style EC fill:#4a148c,color:#fff
    style REVIEW fill:#01579b,color:#fff
    style EXEC fill:#b71c1c,color:#fff
    style HR fill:#33691e,color:#fff
```

### 数据流简图

```
|舆情部门 ──监控新闻/行情/爬虫──→ 自己分析 → 发现利好→加入股池，发现利空→踢出股池
|策略Agent ──找舆情部门看股池──→ 获取候选股列表 ──找 data-agent 要数据──→ 行情 JSON ──自己分析→ 发起投票请求给选举委员会
|选举委员会 ──向全体策略Agent征集意见──→ 汇总投票 ──跑 aggregate-votes──→ 加权统计 ──赞成≥反对→通过→通知执行部门
|执行部门 ──做风控判断──→ 向数据部门提需求──→ 数据部门跑 execute-decision──→ 交易完成通知审核部门
|数据部门 ──交易完成通知──→ 选举委员会 ──收到回执后→ 发审计详情给HR部门
|数据部门 ──交易完成通知──→ 审核官 ──跑 review-and-audit──→ 交易详情 ──自己审核→ PASS/WARN/FAIL+绩效评估
|审核部门 ──审核报告提交──→ HR 部门 ──综合审核结果+胜率统计→ 淘汰/影子期/复活/警告
|其他部门 ──自然语言咨询──→ HR 部门 ──查阅知识库→ 告知对接部门
|任何部门 ──自然语言告知──→ 广告部门 ──运行 send-notify.ts──→ 飞书消息
|任何Agent ──"XX需求该找谁?"──→ HR部门 ──查阅组织架构知识库→ 告知对接部门
```

---

## 3. 6 大部门职责

### 3.1 部门矩阵

| # | 部门 | Agent | 工号体系 | 人数 | 对话风格 | 自然人对应 |
|---|------|-------|---------|------|---------|-----------|
| 1 | **舆情部门** | `sentiment-agent` | — | 1 | 情报员，监控全网 | 数据分析/情报分析 |
| 2 | **数据部门** | `data-agent` | — | 1 | 工具人，你问我答 | IT 运维 + 交易操作 |
| 3 | **策略部门** | `strategy-01~07` | AGT-001~007 | 7 | 独立分析师，自主排班 | 分析师/交易员 |
| 4 | **选举委员会** | `election-committee` | — | 1 | 最终拍板人 | 投资总监 |
| 5 | **审核部门** | `review-01~06` | RAG-001~006 | 6 | 事后诸葛亮 | 风控审计 |
| 6 | **执行部门** | `execution-agent` | — | 1 | 风控判断，向数据部门提需求 | 风控官 |
| 7 | **HR 部门** | `hr-agent` | — | 1 | 组织人事 | 人力资源/组织发展 |
| 8 | **广告部门** | `advertising-agent` | — | 1 | 传声筒，有求必应 | 公关/客服 |

### 3.2 各部门详细职责

#### 舆情部门 — sentiment-agent

```
角色定位：系统唯一的候选股池维护者
工作方式：自主监控新闻/行情/爬虫，将利好股票加入股池，利空股票踢出股池，维持约 20 只候选股
```

舆情部门全权负责股池管理。策略部门**只读取、不写入**股池。

核心工作流程：
1. **监控与发现** — 查看新闻、热门股票、财报、价格异动，自己判断哪些利好
2. **加入股池** — 发现利好股票，跑 `sentiment-add.ts` 写入 stock_pool 表
3. **通知策略组长** — 股池变动后，立即通知 strategy-01："刚把 NVDA 加入股池，利好，强度 4"
4. **清理与维护** — 发现利空信号，跑 `sentiment-remove.ts` 标记为 REMOVED，同时通知 strategy-01
5. **过期清理** — 超时（7天）未分析的信号自动过期
6. **供策略部门查询** — 策略分析师自然语言问"当前股池有什么"，舆情部门跑 `sentiment-pool.ts --list` 回复

策略组长收到通知后，向组员分配分析任务。每个分析师自主决定用什么周期、什么形式监控。

| 请求类型 | 实际命令 |
|---------|---------|
| 市场扫描 | `sentiment-scan.ts --all` |
| 加入利好信号 | `sentiment-add.ts --symbol NVDA.US --signal-type BULLISH --strength 4 --source "财报分析" --reason "Q1营收超预期"` |
| 踢出利空信号 | `sentiment-remove.ts --symbol NVDA.US --reason "出口限制加严"` |
| 查看当前股池 | `sentiment-pool.ts --list` |

重要规则：
- **舆情部门是股池的唯一维护者**，策略部门只读不写
- 舆情部门只做数据获取和写入，**不做交易决策**
- 维持股池约 20 只活跃候选股

#### 数据部门 — data-agent

```
角色定位：系统唯一的长桥 API 接口
工作方式：被动响应，其他部门通过自然语言请求数据或执行交易
```

数据部门负责**所有长桥 API 调用**，包括行情查询和交易执行：

| 请求类型 | 实际命令 |
|---------|---------|
| "查 NVDA 报价" | `data-service.ts --type quote --symbol NVDA.US` |
| "查 AAPL 最近 30 天 K 线" | `data-service.ts --type kline --symbol AAPL.US --days 30` |
| "查账户情况" | `data-service.ts --type account` |
| "看自选股行情" | `data-service.ts --type watchlist` |
| "看当前持仓" | `data-service.ts --type positions` |
| "执行部门说：买入 NVDA 50 股" | `execute-decision.ts --action BUY --symbol NVDA.US --quantity 50` |
| "执行部门说：卖出 NVDA" | `execute-decision.ts --action SELL --symbol NVDA.US --quantity 0` |

重要规则：
- **其他部门不能直接操作长桥 API**，必须通过 data-agent
- 交易执行由执行部门提需求 → 数据部门执行 → 结果返回给执行部门
- 数据部门不做风控判断，收到指令就执行

#### 策略部门 — strategy-01~07

```
角色定位：独立分析师团队，自主排班、自主分析、自主投票
工作方式：每个分析师自己决定分析节奏和标的，组长只负责人事管理和对外对接
```

| 工号 | 名称 | 策略框架 | 分析视角 |
|------|------|---------|---------|
| AGT-001 | 策略部门组长 | — | 负责人事管理和对外对接，**不参与分析投票** |
| AGT-002 | MACD 策略官 | DIF/DEA 交叉+柱状图 | "MACD 支持哪个方向？有没有背离？" |
| AGT-003 | RSI 策略官 | 相对强弱指标 | "现在是超买还是超卖？趋势配合吗？" |
| AGT-004 | 布林带策略官 | 轨道位置+带宽 | "价格在布林带哪个位置？带宽有收缩吗？" |
| AGT-005 | 海龟策略官 | 突破 N 日高低点+ATR | "有突破吗？突破质量如何？" |
| AGT-006 | 价格异动策略官 | 涨跌幅异常+放量突破 | "盘面有什么异动？量价配合如何？" |
| AGT-007 | 均线交叉策略官 | MA5/MA20 位置关系 | "均线在说什么？金叉还是缠绕？" |

策略部门的核心工作方式：

1. **查看股池** — 从舆情部门（sentiment-agent）获取当前候选股列表，知道哪些股票值得关注
2. **自主选标的** — 自选股、热点标的、盘中异动，各自挑
3. **自我分析** — 找 data-agent 查行情数据，用自己的策略框架判断
4. **发起投票请求** — 发现交易机会后，发起投票请求给选举委员会。选举委员会向全体策略 Agent 征求意见，赞成>=反对则通过

组长 AGT-001 只负责对外接口和人事管理，**不参与具体策略分析和投票**。舆情部门股池变动时通知组长，组长分配分析任务给组员。组员自主决定监控周期和方式，完成后回复组长进度。

没有脚本替他们做选股判断。所有决策依靠 Agent 自己的分析能力。】

#### 选举委员会 — election-committee

```
角色定位：投票召集人与计票人
工作方式：收集策略部门投票，赞成>=反对则提交执行部门
```

选举委员会**自己不做行情分析**。分析是策略部门的事。
选举委员会**不做风控判断**。风控是执行部门的事。
选举委员会的唯一职责是：召集投票 → 统计 → 判断通过/驳回 → 通知 → 等回执 → 审计。

冷却规则：同一标的在一小时内不能重复发起投票轮次，脚本 `createElectionRound` 中会检查，命中冷却时抛出错误。

工作流程：

```mermaid
flowchart TB
    START[收到策略Agent的<br/>投票请求] --> CREATE[创建选举轮次<br/>trigger-vote.ts]
    CREATE --> POLL[向所有策略Agent<br/>征求意见 BUY/SELL/HOLD]
    POLL --> STATS[跑 aggregate-votes.ts<br/>看加权统计]
    STATS --> JUDGE{赞成 >= 反对?}
    JUDGE -->|赞成≥反对<br/>BUY 3.2 vs SELL 1.1| EXEC[通知执行部门<br/>执行交易]
    JUDGE -->|赞成<反对<br/>BUY 1.5 vs SELL 2.8| REJECT[驳回请求<br/>通知发起方]
    EXEC --> WAIT[等待<br/>数据部门执行回执]
    WAIT -->|收到 trade_id| DONE[将本轮完整详情<br/>发给HR部门]
    REJECT --> DONE
```

关键差异对比（重构前后）：

| 阶段 | 之前（代码决策） | 之后（Agent 决策） |
|------|---------------|-----------------|
| 投票聚合 | `determineDecision()` 5步算法自动出结果 | Agent 读 JSON 自己判断 |
| 投票征集 | 代码自动调审核官投票 | 选举委员会向全体策略 Agent 自然语言征集 |
| 投票规则 | 算法自动得权重 | 赞成 >= 反对 则通过 |
| 下单量 | 代码自动计算 | Agent 自己算 |
| 最终决策 | 代码输出 BUY/SELL/HOLD | Agent 自己拍板 |

#### 审核部门 ×6 — review-01~06

**纯事后审核。** 不参与任何事前流程——不投票、不预测、不分析候选标的。
交易执行完成后，数据部门将交易详情发送给审核部门，审核官基于各自框架评估决策质量。
审核官没有硬性规则——他们看 K 线数据后自己分析、自己判断。

审核结果包含两方面：
1. **技术审核** — PASS / WARN / FAIL + 分析理由，证明该交易在技术面上是否合理
2. **Agent 绩效评估** — 该笔交易中各参与 Agent 的表现评价（谁的判断准确、谁的判断有偏差）

| 工号 | 名称 | 审核框架 | 审核视角 |
|------|------|---------|---------|
| RAG-001 | 审核部门组长 | — | 只负责人事管理和对外对接，**不参与具体审核** |
| RAG-002 | MACD审核官 | MACD柱状图+信号线 | "DIF/DEA 是否支持该方向?" |
| RAG-003 | RSI审核官 | 超买/超卖区域 | "入场时 RSI 在合理区间吗?" |
| RAG-004 | 布林带审核官 | 轨道位置+带宽 | "价格在布林带中的位置合适吗?" |
| RAG-005 | 海龟交易审核官 | 唐奇安通道 | "是否形成了有效突破?" |
| RAG-006 | 均线交叉审核官 | MA5/MA20 位置关系 | "买入时均线位置合理吗？" |

输出：**审核报告**（含技术审核结论 + Agent 绩效评估），写入 `review_reports` 表，同时提交给 HR 部门并提醒 HR 执行审计。

HR 部门收到审核报告后执行审计流程（被动触发），同时也主动定期扫描胜率数据。

HR 部门综合审核报告 + 胜率统计数据，决定 Agent 的人事状态（淘汰/影子期/复活/警告）。

审核部门**不直接做人事决策**。他们只管审核交易质量，人事决定权在 HR。

#### 执行部门 — execution-agent

```
角色定位：风控判断和交易决策中心
工作方式：向数据部门提需求，不直接操作长桥 API
```

职责：
1. 收到选举委员会的 BUY/SELL 指令后做风控判断
2. 风控通过后，**向数据部门提需求**执行下单
3. 持续监控持仓，发现卖出信号报告选举委员会

风控底线（Agent 自行决定是否严格遵守）：
- 单票仓位上限：20%
- 日交易次数上限：10 次
- 最低现金保留：10%
- 单笔最大亏损：5%
- 日最大回撤熔断：8%

执行部门不直接操作长桥 API。所有行情查询和交易执行通过数据部门完成：

| 执行部门的需求 | 数据部门执行 |
|--------------|-------------|
| "帮我查当前 NVDA 持仓" | `data-service.ts --type positions` |
| "帮我查账户可用资金" | `data-service.ts --type account` |
| "帮我买入 NVDA 50 股" | `execute-decision.ts --action BUY --symbol NVDA.US --quantity 50` |
| "帮我卖出 NVDA" | `execute-decision.ts --action SELL --symbol NVDA.US --quantity 0` |

#### HR 部门 — hr-agent

```
角色定位：系统的人力资源与组织发展中心
工作方式：主动记录、被动咨询、定期审计
```

HR 部门维护一个"组织架构知识库"，记录每个部门、每个 Agent 的信息：

| 信息项 | 内容 | 维护方式 |
|--------|------|---------|
| 工号 | 每位 Agent 的唯一标识 | 创建 Agent 时录入 |
| 部门 | 所属部门及组长 | 部门成立时确定 |
| 部门职责 | 该部门的核心定位 | 部门成立时确定 |
| 岗位 | 部门内的具体角色 | 创建 Agent 时录入 |
| 岗位能力 | 该 Agent 擅长做什么 | 创建 Agent 时录入，可更新 |

每个部门设一名组长：

| 部门 | 组长 | Agent |
|------|------|-------|
| 舆情部门 | sentiment-agent | sentiment-agent |
| 数据部门 | data-agent | data-agent |
| 策略部门 | strategy-01 | strategy-01~07 |
| 选举委员会 | election-committee | election-committee |
| 审核部门 | review-01 | review-01~06 |
| 执行部门 | execution-agent | execution-agent |
| HR 部门 | hr-agent | hr-agent |
| 广告部门 | advertising-agent | advertising-agent |

|组长职责：组长是部门**唯一对外接口**。外部需求先找组长，组长向组员分配任务，组员完成后回复组长，组长汇总后回复给外部对接 Agent。单人部门组长即自己，直接处理所有需求。|

HR 部门的三项核心事务：

**① 人力需求对接 + 扩招 SOP**

扩招触发有两种方式：

**方式 A：组长主动提出**
部门组长如果觉得人手不足，直接找 HR 对话提用人需求。

**方式 B：组员主动向组长反馈**
组员如果任务繁重处理不过来，先向自己的组长反馈。组长确认后，组长找 HR 提用人需求。
单人部门（data-agent、execution-agent、election-committee、advertising-agent）直接找 HR。

HR 确认后执行入职。

**入职流程：**
组长向 HR 提需求 → HR 确认 → 运行 `onboard-agent.ts` 分配工号 + 生成 Profile → **组长分配具体职责和任务**

**HR 分配工号并生成 Profile**
HR 与新 Agent 对话确认信息后，运行：
```
npx tsx src/scripts/onboard-agent.ts --assign-id '{"agent_name":"...","profile_name":"...","dept_name":"...","role_title":"...","responsibilities":"...","assigned_by":"HR-001"}'
```
脚本自动完成三件事：
- 生成工号（AGT-005），写入 `agents` 表
- 记录人事变动流水到 `agent_status_log`
- **自动生成 Profile YAML 文件**到 `profiles/` 目录（含岗位、职责、组长信息）

HR 将新工号和 Profile 文件介绍给组长，**由组长负责分配具体职责和日常任务**。组长直接编辑该 YAML 文件完善 system_prompt，填入新人具体做什么事、受谁调配。

**职责写在 Profile 里，不是 DB 里**
Agent 的岗位和职责不存储在 DB 中——它们通过 `system_prompt` 写入 Profile YAML 文件。每个 Agent 启动时从自己的 Profile 读取身份信息。

HR 可使用 `--list` 随时查看组织架构全貌：
```
npx tsx src/scripts/onboard-agent.ts --list
```

**② 组织架构咨询（被动响应）**
其他 Agent 如果不知道某个需求该找谁，可以问 HR 部门。
HR 查阅知识库后，**优先返回该部门的组长**（如果是多人部门）：
"帮我查 NVDA 报价" → "这是数据部门的事，找组长 data-agent"
"对交易结果不满意需要申诉" → "找 election-committee"
"有人事问题" → "我来查一下胜率排名，直接帮你处理"

**③ Agent 绩效审计（定期执行）**

HR 的绩效审计综合两方面数据：

**数据来源 1：审核部门提交的审核报告**
审核官在每笔交易完成后提交审核报告，包含技术审核结论 + 对各个参与 Agent 的绩效评估。

**数据来源 2：胜率统计**
```
npx tsx src/scripts/audit-cycle.ts
```
输出各 Agent 的胜率、交易次数、排名等 JSON。

HR 阅读**审核报告 + 胜率数据**，综合判断做人事决策：

```mermaid
flowchart LR
    REPORT[审核部门提交<br/>审核报告含绩效评估] --> HR{HR 综合判断}
    STATS[audit-cycle.ts<br/>胜率排名 JSON] --> HR
    HR -->|"审核差+胜率低"| SHADOW[通知该Agent<br/>进入影子期]
    HR -->|"审核报告警告+趋势恶化"| WARN[发警告通知]
    HR -->|"影子期后审核好转+胜率回升"| REVIVE[通知复活]
    HR -->|"影子期后审核仍差+胜率仍低"| FIRE[通知淘汰]
    HR -->|"审核优秀+胜率高"| PRAISE[主动给正向反馈]
```

**④ 人事变动管理**

离职/剔除流程（三种触发场景）：

| 场景 | 谁发起 | 流程 |
|------|--------|------|
| 绩效淘汰 | HR（审计后） | HR 通知组长确认 → 执行离职 → 广告广播 |
| 组长剔除 | 组长 | 组长找 HR 提剔除需求 → HR 确认 → 执行 |
| 自行离职 | Agent 本人 | Agent 找 HR → HR 通知组长确认 → 执行 |

HR 执行离职操作：
```
npx tsx src/scripts/terminate-agent.ts --fire '{"agent_id":"AGT-003","reason":"绩效不达标","triggered_by":"HR-001","notify_leader":"AGT-001","notify_hr":"HR-001"}'
```
脚本自动：更新 agents 状态为 TERMINATED、记录变动流水、删除 profile YAML 文件。

查看已离职 Agent：
```
npx tsx src/scripts/terminate-agent.ts --list-fired
```

所有人事变动**不是代码自动执行**的。HR 判断后通过广告部门发飞书公告。

#### 广告部门 — advertising-agent

```
角色定位：系统唯一的对外通知出口
工作方式：被动响应，其他部门通过自然语言请求发送通知
```

| 请求类型 | 实际命令 |
|---------|---------|
| "告诉用户：NVDA 交易完成，盈利 $350" | `npx tsx src/scripts/send-notify.ts --message "NVDA 交易完成，盈利 $350"` |
| "广播一下：RAG-003 进入影子期" | `npx tsx src/scripts/send-notify.ts --message "RAG-003 进入影子期"` |
| "发紧急通知：日回撤 8.5% 熔断" | `npx tsx src/scripts/send-notify.ts --message "🚨 熔断触发：日回撤 8.5%"` |
| "帮我查 TRD-001 的交易广播" | `npx tsx src/scripts/broadcast-trade.ts --trade-id TRD-001` |

重要规则：
1. **只有广告部门才能对外发通知**——其他部门不能直接调用飞书 API
2. 消息内容由发送方提供，广告部门只做原文传递
3. 发送后回复对方"已发送"
4. 如果对方需要先查数据（如交易广播），可以先用 broadcast-trade.ts 查，确认后再发

---

## 4. 数据库设计

SQLite，文件 `data/trading.db`。

### 4.1 表结构关系

```mermaid
erDiagram
    agents ||--o{ agent_votes : "投票"
    agents ||--o{ win_reports : "胜负上报"
    agents ||--o{ agent_traits : "人格持久化"
    agents ||--o{ review_reports : "审核报告"
    agents ||--o{ agent_status_log : "人事变动"
    agents ||--o{ strategy_signatures : "策略签名"
    trades ||--o{ agent_votes : "所属轮次"
    trades ||--o{ win_reports : "胜负"
    trades ||--o{ review_reports : "审核"
    trades ||--|| election_rounds : "对应的选举轮次"
    stock_pool ||--o{ "选股信号" : "候选池"
    daily_ledger ||--|| "每日风控" : "账簿"

    agents {
        string agent_id PK "工号 AGT-001"
        string agent_name "名称"
        string profile_name "Hermes profile 名"
        string strategy_source "策略来源"
        string strategy_summary "核心概念"
        string status "ACTIVE/SHADOW/TERMINATED"
        int win_count "胜场数"
        int total_trades "总交易数"
        float win_rate "胜率"
        float win_rate_recent_5 "近5笔胜率"
    }

    trades {
        string trade_id PK "TRD-20260521-001"
        string symbol "NVDA.US"
        string direction "LONG/SHORT"
        float buy_price "买入价"
        float sell_price "卖出价"
        int quantity "数量"
        float pnl "盈亏金额"
        float pnl_pct "盈亏比例"
        string status "OPEN/CLOSED/CANCELLED"
    }

    election_rounds {
        string round_id PK "ELEC-20260521-1430"
        string symbol "标的"
        int total_voters "总投票人数"
        int buy_votes "买票数"
        int sell_votes "卖票数"
        int hold_votes "持票数"
        string final_decision "BUY/SELL/HOLD"
        string resulted_trade_id "结果交易ID"
    }

    agent_votes {
        string vote_id PK
        string trade_id FK
        string agent_id FK
        string vote_direction "BUY/SELL/HOLD"
        float confidence "置信度 0-1"
        string reasoning "理由"
        int is_shadow "是否影子期投票"
    }

    review_reports {
        string report_id PK "REV-..."
        string trade_id FK
        string agent_id FK
        string verdict "PASS/WARN/FAIL"
        string reasoning "理由"
        string review_framework "审核框架"
    }

    agent_traits {
        string agent_id FK
        string trait_key "人格特征键"
        string trait_value "特征值"
        string trait_type "NUMBER/CATEGORY/PATTERN/HISTORY"
        float confidence "置信度"
        int sample_count "采样次数"
    }

    stock_pool {
        string symbol "标的"
        string signal_type "BULLISH/BEARISH"
        int strength "强度 1-5"
        string source "来源"
        string agent_id FK "提交信号的选股Agent"
        string status "ACTIVE/EXPIRED/REMOVED"
    }

    win_reports {
        string report_id PK
        string trade_id FK
        string agent_id FK
        string result "WIN/LOSE/MISS"
        string self_reflection "自我反思 JSON"
    }

    agent_status_log {
        int id PK
        string agent_id FK
        string from_status "原状态"
        string to_status "新状态"
        string reason "原因"
        string triggered_by "触发者"
    }

    daily_ledger {
        string date PK "2026-05-21"
        int trade_count "日交易数"
        float total_pnl "日总盈亏"
        float max_drawdown "最大回撤"
        int melted "是否熔断"
    }
```

### 4.2 核心表清单（12 张）

| # | 表名 | 用途 | 关键字段 |
|---|------|------|---------|
| 1 | `agents` | Agent 员工档案 | agent_id, status, win_rate |
| 2 | `agent_status_log` | 人事变动流水 | from_status, to_status, reason |
| 3 | `trades` | 交易主表 | symbol, direction, pnl |
| 4 | `agent_votes` | 每次投票记录 | vote_direction, confidence |
| 5 | `win_reports` | 胜负上报 | result, self_reflection |
| 6 | `election_rounds` | 选举轮次 | final_decision, total_voters |
| 7 | `stock_pool` | 候选股池 | signal_type, strength |
| 8 | `agent_traits` | Agent 人格数据 | trait_key, trait_value, confidence |
| 9 | `strategy_signatures` | 策略签名去重 | source_book, core_concept |
| 10 | `review_reports` | 审核报告 | verdict, review_framework |
| 11 | `daily_ledger` | 每日风控账簿 | trade_count, max_drawdown |
| 12 | `(schema_migrations)` | 迁移记录 | — |
| 13 | `departments` | 部门组织架构 | dept_id, dept_name, leader_agent_id |

---

## 5. 核心业务流程

### 5.1 完整交易周期

```
策略分析 → 投票 → 决策 → 执行 → 审计 → 审核
                                      ↓
                                   关闭交易
```

```mermaid
sequenceDiagram
    participant S as 策略(AGT)
    participant R as 审核官(RAG)
    participant EC as 选委会
    participant EX as 执行
    participant A as HR 部门

    S->>S: 自主分析NVDA行情
    S->>EC: "均线金叉了，建议BUY NVDA"
    S->>EC: "MACD柱状图放大，也看BUY"
    S->>EC: "RSI 62中性偏多，BUY"
    S->>EC: "布林带中轨向上，BUY"
    S->>EC: "海龟通道没突破，HOLD"
    S->>EC: "价格异动+2.3%，BUY"
    EC->>R: "策略官们说了，NVDA 怎么看?"
    R->>EC: "均线位置合理，PASS"
    R->>EC: "MACD支持，PASS"
    R->>EC: "RSI 62还行，PASS"
    R->>EC: "布林带位置合适，PASS"
    R->>EC: "没突破，WARN"
    EC->>EC: 跑aggregate-votes.ts看加权
    EC->>EC: "BUY加权4.2 vs HOLD 0.5, 我决定BUY"
    EC->>EX: "买入NVDA 50股"
    EX->>EX: 风控判断→向数据部门提需求
    EX->>EC: "交易完成, trade_id=TRD-001"
    EC->>A: "决策详情发你审计"
    A->>R: "审核TRD-001的交易质量"
    R->>A: "PASS: 均线位置合理"
    R->>A: "WARN: RSI偏高"
    R->>A: "PASS: 布林带支持"
    A->>A: 跑audit-cycle.ts更新排名
    A->>A: "AGT-003 40%胜率了..."
    Note over A: 交易关闭后做人事决策
```

### 5.2 选举加权公式

纯数学公式，在 `aggregate-votes.ts` 中：

```
agent_weight = win_rate × log₂(1 + total_trades)
```

- `win_rate`: 历史胜率（0~1）
- `log₂(1 + total_trades)`: 经验因子，交易越多权重越高
- 初次交易（total_trades=0）: 权重 = 0.5

输出 JSON 示例：
```json
{
  "type": "vote_stats",
  "round_id": "ELEC-20260522-001",
  "symbol": "NVDA.US",
  "total_active_voters": 5,
  "results": {
    "buy":  { "count": 4, "weighted": 3.6 },
    "sell": { "count": 0, "weighted": 0 },
    "hold": { "count": 1, "weighted": 0.5 }
  }
}
```

### 5.3 Agent 生命周期管理

```
                ┌──────────────────┐
                │    ACTIVE        │
                │  (正常交易)       │
                └────────┬─────────┘
                         │ HR 部门判断
                         │ (≥10笔且胜率<50%)
                         ▼
                ┌──────────────────┐
                │    SHADOW        │
                │  (影子期学习)     │
                └────────┬─────────┘
                         │ 完成10笔后评估
                         │
               ┌─────────┴──────────┐
               ▼                     ▼
     ┌──────────────────┐   ┌──────────────────┐
     │    ACTIVE        │   │   TERMINATED     │
     │  (复活,胜率≥50%) │   │  (淘汰,胜率<50%)  │
     └──────────────────┘   └──────────────────┘
```

**关键变化：** 生命周期的判定**不是代码自动执行**的。HR 部门通过 `audit-cycle.ts` 查看排名 JSON 后，**自己判断并通知**相关 Agent。

---

## 6. 脚本矩阵 — 纯数据工具

| 脚本 | 行数 | 职责 | 输入 | 输出 |
|------|------|------|------|------|
| `data-service.ts` | 100+ | 统一行情接口 | `--type quote/kline/account/...` | 行情 JSON |
| `trigger-vote.ts` | 63 | 股池读取 / 创建轮次 | 无参 或 `--symbol X --create-round` | 股池 JSON / round_id |
| `aggregate-votes.ts` | 110 | 加权投票统计 | `--round-id ID` | 加权票数 JSON |
| `execute-decision.ts` | 99 | 纯下单 | `--action BUY --symbol X --qty N` | 交易结果 JSON |
| `audit-cycle.ts` | 50 | 胜率排名统计 | 无参 | 排名 JSON |
| `broadcast-trade.ts` | 64 | 交易详情广播 | `--trade-id ID` | 交易广播 JSON |
| `selector-price.ts` | 99 | 信号提交 | `--symbol --price --change` | 信号确认 JSON |
| `report-win.ts` | — | 胜负上报 | `--trade-id --result` | 更新确认 |
| `review-and-audit.ts` | — | 审核数据获取 | `--trade-id ID` | 交易详情 JSON |
| `persona.ts` | — | 人格管理 | `--agent-id` | 人格数据 JSON |
| `send-notify.ts` | 56 | 对外通知发送 | `--message TEXT` | 通知确认 JSON |
| `onboard-agent.ts` | 300+ | 新 Agent 入职 — 分配工号 + 生成 Profile | `--assign-id / --list` | 工号 + Profile YAML |
| `terminate-agent.ts` | 200+ | Agent 离职/剔除 — 状态更新 + Profile 清理 | `--fire / --list-fired` | 离职确认 |

总计：**所有脚本 ≈ 1000 行 TypeScript，零业务逻辑，只做数据搬运和数学计算。**

---

## 7. Agent 人格系统

### 7.1 人格特征维度

每位 Agent 通过 `agent_traits` 表持久化以下特征：

| 特征键 | 类型 | 说明 | 示例值 |
|--------|------|------|-------|
| `personality` | CATEGORY | 人格标签 | "均线交叉法官" |
| `risk_preference` | CATEGORY | 风险偏好 | "中等" |
| `communication_style` | CATEGORY | 沟通风格 | "技术导向，用数据说话" |
| `typical_confidence` | NUMBER | 典型置信度 | 0.8 |
| `stop_loss_pct` | NUMBER | 止损偏好 | 5 |
| `take_profit_pct` | NUMBER | 止盈偏好 | 15 |
| `strength` | PATTERN | 优势 | "对入场出场时机的判断精准" |
| `weakness` | PATTERN | 劣势 | "震荡市中容易误判" |
| `best_market_condition` | CATEGORY | 最佳市场 | "trending" |
| `worst_market_condition` | CATEGORY | 最差市场 | "sideways" |
| `learned_pitfall` | PATTERN | 学到的教训 | "金叉后需成交量确认" |
| `contrarian_score` | NUMBER | 逆向程度 | 0.3 |
| `preferred_sectors` | HISTORY | 偏好的板块 | [] |
| `self_adjustments` | HISTORY | 自我调整记录 | [] |
| `avg_hold_duration` | NUMBER | 平均持仓时长 | 0 |

### 7.2 人格可迁移

所有人格特征可导出为 `export/agents.json` / `export/agents-baseline.json`，可在系统间迁移：

```json
{
  "agent_id": "RAG-001",
  "agent_name": "均线交叉审核官",
  "profile_name": "review-01",
  "status": "ACTIVE",
  "traits": [ ... ]
}
```

---

## 8. 基础设施

### 8.1 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| **Agent 框架** | Hermes Agent | Kanban 模式编排多 Agent 协作 |
| **运行环境** | Node.js + TypeScript | 所有脚本均用 TS |
| **数据库** | SQLite | 单文件 `data/trading.db`，零运维 |
| **行情数据** | Longbridge API | 港美股实时行情、K线、下单 |
| **通讯** | 自然语言 | Agent 之间直接对话，无需消息队列 |

### 8.2 文件结构

```
hermes-trading-system/
├── profiles/            # Hermes Agent Profile (YAML)
│   ├── data-agent.yaml
│   ├── review-01~05.yaml       # 5位审核官
│   ├── strategy-01~06.yaml     # 6位策略分析师
│   └── ...
├── src/
│   ├── core/           # 基础设施
│   │   ├── db.ts           # SQLite 连接
│   │   ├── types.ts        # 所有类型定义
│   │   └── config.ts       # 配置管理
│   ├── scripts/        # 纯数据工具 (Agent 通过 terminal 调用)
│   │   ├── data-service.ts
│   │   ├── trigger-vote.ts
│   │   ├── aggregate-votes.ts
│   │   ├── execute-decision.ts
│   │   ├── audit-cycle.ts
│   │   ├── broadcast-trade.ts
│   │   ├── selector-price.ts
│   │   ├── review-and-audit.ts
│   │   ├── report-win.ts
│   │   └── ...
│   ├── voting/         # 投票逻辑 (纯数据)
│   ├── trading/        # 交易逻辑 (纯数据)
│   ├── pool/           # 候选股池
│   ├── audit/          # 审计统计 (纯数据)
│   └── backtest/       # 回测框架
├── sql/
│   └── schema.sql
├── export/             # Agent 人格导出
│   ├── agents.json
│   └── agents-baseline.json
├── data/               # SQLite 数据库 (gitignore)
├── skills/             # Hermes Skill 文档
│   └── trading-system.md
└── docs/               # 本文档目录
    └── architecture.md  # ← 你现在在看这个
```

---

## 9. 回测框架

### 9.1 回测位置

回测框架位于 `src/backtest/runner.ts`，是整个系统的质量验证手段。

### 9.2 回测设计原则

```
回测 ≠ 训练数据
    ↓
回测是验证 Agent 决策质量的手段
    ↓
通过历史数据验证：如果当时用这套架构，决策质量如何?
```

- 回测不修改 Agent 人格
- 回测输出 JSON 对比：代码决策 vs Agent 决策
- 回测结果用于改善 Agent prompt 和 profile 设计

---

## 10. 快速开始

### 安装
```bash
cd /home/zys/hermes-trading-system
npm install
cp .env.example .env   # 填入飞书/Longbridge 配置
```

### 初始化数据库
```bash
npx tsx sql/init.ts
npx tsx sql/seeds/seed.ts
```

### 注册 12 个 Agent Profiles
```bash
hermes profile create -f profiles/data-agent.yaml
hermes profile create -f profiles/selector-price.yaml
hermes profile create -f profiles/watch-agent.yaml
hermes profile create -f profiles/election-committee.yaml
hermes profile create -f profiles/execution-agent.yaml
hermes profile create -f profiles/auditor-agent.yaml
hermes profile create -f profiles/review-01.yaml
hermes profile create -f profiles/review-02.yaml
hermes profile create -f profiles/review-03.yaml
hermes profile create -f profiles/review-04.yaml
hermes profile create -f profiles/review-05.yaml
```

### 运行盯盘（主循环入口）
```bash
npx tsx src/scripts/trigger-vote.ts
```

### 测试
```bash
npm test
```

---

## 11. Phase 规划

| Phase | Agent 数 | 新功能 | 状态 |
|-------|---------|--------|------|
| **Phase 1** | 15 | 最小闭环：策略分析→投票→执行→审计→审核 | ✅ 编码完成 |
| **Phase 2** | 20-25 | 舆情/社媒选股、WebSocket 实时行情、港股支持 | 📋 规划中 |
| **Phase 3** | 54 | 多平台信号、部分加仓、动态调参、自动招聘 | 🗓️ 未来 |

### Phase 1 MVP 完成清单

- [x] 6 部门 15 Agent 架构（选股+盯盘合并为策略部门）
- [x] 所有业务决策从代码迁移到 Agent 自然语言
- [x] 数据部门作为统一行情入口
- [x] 策略→审核部门重构（事前预测 → 事后审核）
- [x] Agent 人格系统 + 持久化 + 可迁移
- [x] 选股信号 → 股池 → 投票轮次完整闭环
- [x] 执行 + 风控 + 持仓监控
- [x] HR 部门人事管理 + 组织架构知识库
- [x] 交易后审核报告
- [x] 回测框架
- [x] 广告部门作为统一对外通知出口

---

> **GitHub**: https://github.com/fantian007/hermes-trading-system
> **飞书文档**: https://bytedance.feishu.cn/docx/G4qmdQeuKo2hSXxMbk4c2jRsn3c
