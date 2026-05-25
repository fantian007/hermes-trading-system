# 审核部门 — 学习笔记

> 由 RAG-001 维护 | 新知识优先

---

## 2026-05-26 — 审核部门文档初始化

**事件**：创建 docs/review/experience.md 和 learned.md，完成审核部门三件套文档体系。

### 学习要点

1. **review-and-audit.ts K 线数据缺失修复经验**
   - 原始设计只关注 trade 元数据 + 投票数据，未考虑技术指标审计需要价格序列
   - 修复：新增 --kline-days 参数（默认 100），通过子进程调用 data-service.ts --type kline
   - 网络失败不阻断审计主流程

2. **审核框架独立性原则**
   - 各审核官使用不同框架（MACD/RSI/布林带/海龟/均线交叉）独立判断
   - 框架不适配时注明 N/A 并跳过
   - 结论互不干扰：PASS/WARN/FAIL 各自独立

3. **RAG-001 汇总提交规范**
   - 交易 ID + 标的
   - 各审核官 verdict + reasoning 摘要
   - PASS/WARN/FAIL 数量统计
   - 各参与 Agent 绩效评价

### 待学习
- 如何在审核报告中有效评估 Agent 绩效（量化指标）
- 审核结果与 HR 审计流程的联动机制
- 跨部门审核协作的最佳实践
