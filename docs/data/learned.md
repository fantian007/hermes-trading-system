# Data Department Learning Log (data-agent DAT-001)

记录学到的系统知识和运维技巧。

---

## 2026-05-26 — 首次启动常驻模式

- data-agent 支持三种请求类型：data query、trade execution
- 数据请求接口: data-service.ts (quote/kline/positions/account)
- 交易执行接口: execute-decision.ts
- 通知接口: send-notify.ts（通知 advertising-agent 发飞书）
- 所有 Agent 动态都必须走 advertising-agent 发出
- cronjob 轮询模式适合常驻守护任务

## 2026-05-26 — 学习进化: 订单簿数据处理前沿研究

### 知识点 1：LOB (Limit Order Book) 深度学习方法

近期研究（2024-2025）揭示 LOB 预测的关键发现：

**核心洞察：**
- LOB 的 ask 和 bid 两侧具有固有对称性，ask-bid 差值比原始数据更稳定、复杂度更低。利用 Siamese 架构（共享参数的对称模块分别处理 ask/bid）可显著提升现有模型性能（arXiv:2505.22678）
- Order Flow Imbalance (OFI) 是 LOB 预测中最重要的特征之一，被广泛用作输入
- Multi-Head Attention + LSTM 的混合架构在短期预测上有优势

**关键发现（arXiv:2403.09267, Deep LOB Forecasting）：**
- 股票微观结构特征深刻影响深度学习方法的有效性
- 高预测准确率 ≠ 可交易信号——传统 ML 指标无法充分评估 LOB 预测质量
- 提出基于"完整交易准确预测概率"的运营评估框架，更贴近实际交易场景
- 开源了 `LOBFrame` 代码库用于高效处理大规模 LOB 数据

**LSTM vs Transformer 对比（arXiv:2309.11400）：**
- Transformer 仅在绝对价格序列预测上有有限优势
- LSTM 在差值序列预测（价格差、价格运动方向）上表现更稳健
- 对于我们的投票系统（买卖方向判定），LSTM 架构仍是更可靠的选择

### 知识点 2：高频交易数据异常检测

**Staged Sliding Window Transformer（arXiv:2504.00287, 2025）：**
- 用于外汇市场微观结构异常检测，基于分阶段滑动窗口 Transformer
- 输入特征：order book depth（深度）、spread（价差）、trading volume（成交量）
- 精度 0.93, F1 0.91, AUC-ROC 0.95 — 显著优于传统 ML (DT, RF) 和 DL (MLP, CNN, RNN, LSTM)
- 通过 self-attention + weighted attention 捕获全局和局部依赖关系
- 对 data-agent 的启示：使用长桥 API 获取的 tick 级数据可设计轻量级异常检测

### 知识点 3：GPU 加速 LOB 模拟器 — JAX-LOB

**架构启示（arXiv:2308.13289）：**
- 首个 GPU 端 LOB 模拟器，支持数千本书并行处理
- 基于 JAX 生态构建，可端到端在 GPU 上训练 RL 交易策略
- 虽然我们的系统是 Longbridge API 驱动的实盘/模拟盘，但 JAX-LOB 的思路提示：
  - 并行数据管道处理多标的 tick 数据
  - JAX 的 `vmap` / `pmap` 机制可用于批量化归一化操作
  - 对数据部门来说，多标的并行报价请求可考虑无依赖异步批处理

### 数据清洗与处理最佳实践（综合整理）

对于长桥 API 数据日常使用的清理原则：
1. **Tick 级数据对齐**: 不同标的 tick 时间戳天然不同步，使用 5s/15s/1min 的重采样窗口对齐
2. **Order Flow Imbalance (OFI)**: 最简单的微观结构特征，计算方式 = (买方主动成交量 - 卖方主动成交量) / 总成交量
3. **价差过滤**: 极宽价差时段（如盘前盘后）的数据应标记或剔除
4. **成交量异常检测**: 单笔成交量超过 3σ 的 tick 应标记为潜在异常事件
5. **多源对齐**: 不同数据源（如 quote vs kline）的时间戳应先归一化到同一时区基准
6. **缺失值处理**: 非交易时间戳的缺失视为正常，交易时间内的缺失使用前值填充（last-observation-carried-forward）
