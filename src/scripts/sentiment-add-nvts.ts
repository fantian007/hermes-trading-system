/**
 * 临时脚本：添加 NVTS 到股池
 */
import { addSignal } from '../pool/stock-pool.js';

addSignal({
  symbol: 'NVTS.US',
  signal_type: 'BULLISH',
  strength: 3,
  source: '今日新闻巡检',
  reason: 'GaN功率半导体龙头，+20%创52周新高，AI数据中心电源需求驱动',
  source_url: undefined,
  agent_id: 'SENT-001',
});

console.log(JSON.stringify({
  status: 'added',
  symbol: 'NVTS.US',
  signal_type: 'BULLISH',
  strength: 3,
  source: '今日新闻巡检',
  reason: 'GaN功率半导体龙头，+20%创52周新高，AI数据中心电源需求驱动',
}));
