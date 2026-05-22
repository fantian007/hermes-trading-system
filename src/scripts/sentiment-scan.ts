/**
 * 舆情部门 — 市场扫描工具
 *
 * 职责（仅此一项）：
 *   输出当前值得关注的候选标的列表（热门/异动）。
 *   不做任何业务判断——Agent 自己决定哪些值得加入股池。
 *
 * 第一版使用预设候选列表，后续可接入真实新闻/爬虫数据源。
 *
 * 用法：
 *   npx tsx src/scripts/sentiment-scan.ts
 *   npx tsx src/scripts/sentiment-scan.ts --hot
 *   npx tsx src/scripts/sentiment-scan.ts --movers
 *   npx tsx src/scripts/sentiment-scan.ts --all
 */

interface StockCandidate {
  symbol: string;
  name: string;
  reason: string;
  category: 'hot' | 'mover' | 'sector';
}

// 预设热门科技/AI 股池（后续可替换为真实 API）
const HOT_STOCKS: StockCandidate[] = [
  { symbol: 'NVDA.US', name: 'NVIDIA', reason: 'AI芯片龙头，市场关注度高', category: 'hot' },
  { symbol: 'AAPL.US', name: 'Apple', reason: '消费电子龙头，财报季关注', category: 'hot' },
  { symbol: 'MSFT.US', name: 'Microsoft', reason: 'AI+云计算双驱动', category: 'hot' },
  { symbol: 'GOOGL.US', name: 'Alphabet', reason: 'AI搜索+广告业务', category: 'hot' },
  { symbol: 'AMZN.US', name: 'Amazon', reason: '电商+AWS云计算', category: 'hot' },
  { symbol: 'META.US', name: 'Meta', reason: '社交+AI布局', category: 'hot' },
  { symbol: 'TSLA.US', name: 'Tesla', reason: '电动车+机器人概念，波动大', category: 'mover' },
  { symbol: 'AMD.US', name: 'AMD', reason: 'GPU竞争格局变化', category: 'mover' },
  { symbol: 'TSM.US', name: 'TSMC', reason: '芯片制造龙头，地缘政治敏感', category: 'mover' },
  { symbol: 'AVGO.US', name: 'Broadcom', reason: 'AI网络芯片需求强劲', category: 'mover' },
  { symbol: 'PLTR.US', name: 'Palantir', reason: 'AI数据分析，近期活跃', category: 'mover' },
  { symbol: 'SMCI.US', name: 'Super Micro', reason: 'AI服务器概念，高波动', category: 'mover' },
];

const MOVERS: StockCandidate[] = [
  { symbol: 'COIN.US', name: 'Coinbase', reason: '加密货币概念，政策驱动', category: 'mover' },
  { symbol: 'RDDT.US', name: 'Reddit', reason: '社交新股，用户增长', category: 'mover' },
  { symbol: 'ARM.US', name: 'ARM', reason: '芯片架构IP，AI终端概念', category: 'mover' },
  { symbol: 'SNAP.US', name: 'Snap', reason: '社交广告，AI滤镜', category: 'mover' },
  { symbol: 'UBER.US', name: 'Uber', reason: '出行+外卖，盈利改善', category: 'mover' },
  { symbol: 'DASH.US', name: 'DoorDash', reason: '外卖配送，市场份额增长', category: 'mover' },
];

const SECTOR_STOCKS: StockCandidate[] = [
  { symbol: 'QQQ.US', name: 'QQQ', reason: '纳斯达克100 ETF，大盘风向标', category: 'sector' },
  { symbol: 'SPY.US', name: 'SPY', reason: '标普500 ETF', category: 'sector' },
  { symbol: 'IWM.US', name: 'IWM', reason: '罗素2000小盘股ETF', category: 'sector' },
  { symbol: 'XLK.US', name: 'XLK', reason: '科技板块ETF', category: 'sector' },
  { symbol: 'SOXX.US', name: 'SOXX', reason: '半导体板块ETF', category: 'sector' },
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    showHot:    args.includes('--hot') || args.includes('--all') || args.length === 0,
    showMovers: args.includes('--movers') || args.includes('--all') || args.length === 0,
    showSector: args.includes('--sector') || args.includes('--all') || args.length === 0,
  };
}

function main() {
  const { showHot, showMovers, showSector } = parseArgs();

  const results: StockCandidate[] = [];
  if (showHot) results.push(...HOT_STOCKS);
  if (showMovers) results.push(...MOVERS);
  if (showSector) results.push(...SECTOR_STOCKS);

  console.log(JSON.stringify({
    type: 'market_scan',
    timestamp: new Date().toISOString(),
    count: results.length,
    candidates: results.map(r => ({
      symbol: r.symbol,
      name: r.name,
      reason: r.reason,
    })),
    note: '这是预设候选列表。Agent 自行判断哪些值得加入股池，用 sentiment-add.ts 写入。',
  }));
}

main();
