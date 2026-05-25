/**
 * 舆情部门 — 新闻搜集脚本
 *
 * 职责（仅此一项）：
 *   搜集近期（24h内）热门股票的利好/利空新闻，输出新闻摘要。
 *   不做任何业务判断——Agent 自己决定哪些新闻值得处理、是否更新股池。
 *
 * 用法：
 *   npx tsx src/scripts/sentiment-news.ts
 *   npx tsx src/scripts/sentiment-news.ts --symbols NVDA.US,AAPL.US,MSFT.US
 *   npx tsx src/scripts/sentiment-news.ts --hours 48
 *   npx tsx src/scripts/sentiment-news.ts --help
 */

interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  symbols: string[];
  time: string;  // ISO timestamp
}

interface Args {
  symbols: string[];
  hours: number;
  showHelp: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  if (args.includes('--help')) return { symbols: [], hours: 24, showHelp: true };

  const get = (key: string, defaultVal: string) => {
    const idx = args.indexOf(`--${key}`);
    return idx >= 0 ? args[idx + 1] || defaultVal : defaultVal;
  };

  return {
    symbols: get('symbols', '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    hours: parseInt(get('hours', '24'), 10) || 24,
    showHelp: false,
  };
}

// 预设重点关注股票列表（与 sentiment-scan.ts 的 HOT_STOCKS/MOVERS 保持一致）
const DEFAULT_SYMBOLS = [
  'NVDA.US', 'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US',
  'META.US', 'TSLA.US', 'AMD.US', 'TSM.US', 'AVGO.US',
  'PLTR.US', 'SMCI.US', 'COIN.US', 'RDDT.US', 'ARM.US',
  'SNAP.US', 'UBER.US', 'DASH.US',
];

const SYMBOL_TO_NAME: Record<string, string> = {
  'NVDA.US': 'NVIDIA', 'AAPL.US': 'Apple', 'MSFT.US': 'Microsoft',
  'GOOGL.US': 'Alphabet', 'AMZN.US': 'Amazon', 'META.US': 'Meta',
  'TSLA.US': 'Tesla', 'AMD.US': 'AMD', 'TSM.US': 'TSMC',
  'AVGO.US': 'Broadcom', 'PLTR.US': 'Palantir', 'SMCI.US': 'Super Micro',
  'COIN.US': 'Coinbase', 'RDDT.US': 'Reddit', 'ARM.US': 'ARM',
  'SNAP.US': 'Snap', 'UBER.US': 'Uber', 'DASH.US': 'DoorDash',
};

function getSymbolNames(symbols: string[]): string[] {
  return symbols.map(s => SYMBOL_TO_NAME[s] || s.replace('.US', ''));
}

function getSearchQueries(symbolNames: string[]): string[] {
  const queries: string[] = [];
  for (const name of symbolNames) {
    queries.push(`${name} stock news today`);
    queries.push(`${name} earnings analyst rating`);
  }
  return queries;
}

function printHelp(): void {
  console.log(JSON.stringify({
    help: `sentiment-news.ts — 搜集近期利好/利空新闻

用法:
  npx tsx src/scripts/sentiment-news.ts
    搜集预设热门股最近24h的新闻

  npx tsx src/scripts/sentiment-news.ts --symbols NVDA.US,AAPL.US
    指定股票列表

  npx tsx src/scripts/sentiment-news.ts --hours 48
    回溯48小时

输出格式:
  JSON 格式的新闻列表，每条包含 title/summary/url/source/sentiment/symbols/time

Agent 使用示例:
  const result = JSON.parse(stdout);
  for (const news of result.news) {
    if (news.sentiment === 'BULLISH') {
      // 考虑加入股池
    }
  }
`,
    type: 'help',
  }));
}

async function main() {
  const args = parseArgs();

  if (args.showHelp) {
    printHelp();
    return;
  }

  const symbols = args.symbols.length > 0 ? args.symbols : DEFAULT_SYMBOLS;
  const symbolNames = getSymbolNames(symbols);
  const untilTime = new Date(Date.now() - args.hours * 60 * 60 * 1000).toISOString();

  const allNews: NewsItem[] = [];

  // 分批查询以避免请求太快
  const BATCH_SIZE = 5;
  for (let i = 0; i < symbolNames.length; i += BATCH_SIZE) {
    const batch = symbolNames.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (name, idx) => {
        const originalSymbol = symbols[i + idx];
        const queries = getSearchQueries([name]);

        const items: NewsItem[] = [];

        for (const query of queries) {
          try {
            const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&from=${encodeURIComponent(untilTime.slice(0, 10))}&sortBy=publishedAt&pageSize=3&language=en&apiKey=demo`;
            const resp = await fetch(url);
            if (!resp.ok) continue;

            const data = await resp.json() as any;
            if (!data.articles?.length) continue;

            for (const article of data.articles.slice(0, 3)) {
              // 简单情绪判断：标题含关键词
              const title = (article.title || '').toLowerCase();
              const desc = (article.description || '').toLowerCase();
              const text = title + ' ' + desc;

              let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
              const bullishWords = ['surge', 'jump', 'rally', 'upgrade', 'beat', 'growth', 'bullish', 'positive', 'outperform', 'buy', 'strong'];
              const bearishWords = ['plunge', 'drop', 'decline', 'downgrade', 'miss', 'loss', 'bearish', 'negative', 'sell', 'weak', 'cut', 'crash'];

              const bullishScore = bullishWords.filter(w => text.includes(w)).length;
              const bearishScore = bearishWords.filter(w => text.includes(w)).length;

              if (bullishScore > bearishScore) sentiment = 'BULLISH';
              else if (bearishScore > bullishScore) sentiment = 'BEARISH';

              items.push({
                title: article.title || '(no title)',
                summary: article.description || '',
                url: article.url || '',
                source: article.source?.name || 'unknown',
                sentiment,
                symbols: [originalSymbol],
                time: article.publishedAt || new Date().toISOString(),
              });
            }
          } catch {
            // 单个查询失败不中断整体
          }
        }

        return { name, originalSymbol, items };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allNews.push(...result.value.items);
      }
    }

    if (i + BATCH_SIZE < symbolNames.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 输出结果
  const bullish = allNews.filter(n => n.sentiment === 'BULLISH');
  const bearish = allNews.filter(n => n.sentiment === 'BEARISH');
  const neutral = allNews.filter(n => n.sentiment === 'NEUTRAL');

  console.log(JSON.stringify({
    type: 'news_collection',
    timestamp: new Date().toISOString(),
    collect_hours: args.hours,
    symbols_scanned: symbols.length,
    total_news: allNews.length,
    summary: {
      bullish: bullish.length,
      bearish: bearish.length,
      neutral: neutral.length,
    },
    news: {
      bullish: bullish.slice(0, 15).map(n => ({
        title: n.title,
        summary: n.summary.slice(0, 200),
        source: n.source,
        sentiment: n.sentiment,
        symbols: n.symbols,
        time: n.time,
        url: n.url,
      })),
      bearish: bearish.slice(0, 10).map(n => ({
        title: n.title,
        summary: n.summary.slice(0, 200),
        source: n.source,
        sentiment: n.sentiment,
        symbols: n.symbols,
        time: n.time,
        url: n.url,
      })),
    },
    note: '这是基于网络新闻API的原始数据。Agent 自行判断哪些新闻值得处理、是否更新股池。',
  }));
}

main().catch(err => {
  console.error(JSON.stringify({
    type: 'error',
    error: err.message,
  }));
  process.exit(1);
});
