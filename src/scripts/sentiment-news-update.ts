/**
 * 舆情部门 — 每日新闻巡检工具
 *
 * 每天0点执行：搜集近期热门股利好/利空新闻并更新股池。
 *
 * 用法：
 *   npx tsx src/scripts/sentiment-news-update.ts
 *     → 搜集新闻，基于知识分析，输出股池操作建议（Agent自行执行）
 */

// 直接输出空新闻，让Agent用自己的知识+市场判断做决策
// 如果将来接入了新闻API，这里可以获取真实新闻数据

console.log(JSON.stringify({
  type: 'daily_news_patrol',
  timestamp: new Date().toISOString(),
  task: '每日0点新闻巡检',
  instructions: `
【舆情部门每日巡检 — ${new Date().toISOString().slice(0, 10)}】

请执行以下操作：

1️⃣ 用你的知识判断当前市场环境：
   - 美股大盘趋势（S&P 500 / 纳斯达克）
   - AI/半导体行业新闻热点
   - 你的持仓股（NVDA/MSFT/META/GOOGL/CLSK）是否有重大消息
   - 其他热门股（TSLA/AMD/TSM/AVGO/PLTR/SMCI等）是否有异动

2️⃣ 有明确利好的股票 → 用以下命令加入股池：
   npx tsx src/scripts/sentiment-add.ts --symbol SYM.US --signal-type BULLISH --strength N --source "每日新闻巡检" --reason "你的分析理由"

3️⃣ 有明确利空且已在持仓/股池的股票：
   → 用 sentiment-remove.ts 踢出：npx tsx src/scripts/sentiment-remove.ts --symbol SYM.US --reason "利空原因"

4️⃣ 通知广告部门发飞书告知用户今天新闻巡检结果

注意：
- 股池维持约20只活跃候选股
- 不是每条新闻都要加——只加你判断有明确交易机会的
- 诚实守信，不要编造数据或新闻
`,
}));
