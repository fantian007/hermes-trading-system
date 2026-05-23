/**
 * SENT-001 批量添加股池信号
 * 一次性写入 16 只候选股
 */
import { addSignal } from '../pool/stock-pool.js';

const signals: { symbol: string; signal_type: 'BULLISH' | 'BEARISH'; strength: number; source: string; reason: string }[] = [
  { symbol: 'NVDA.US', signal_type: 'BULLISH', strength: 5, source: '市场扫描', reason: 'AI芯片龙头，数据中心收入持续超预期，Blackwell架构放量' },
  { symbol: 'AAPL.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: '消费电子龙头，AI手机换机周期 + 服务收入增长' },
  { symbol: 'MSFT.US', signal_type: 'BULLISH', strength: 5, source: '市场扫描', reason: 'AI+云计算双驱动，Azure AI高速增长，Copilot变现' },
  { symbol: 'GOOGL.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: 'AI搜索+Gemini模型+广告业务稳健，云计算增长' },
  { symbol: 'AMZN.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: 'AWS云计算+电商双龙头，AI助手+广告业务增长' },
  { symbol: 'META.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: '社交+AI布局，广告收入强劲，LLaMA开源生态' },
  { symbol: 'AMD.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: 'GPU竞争格局变化，MI300加速追赶，AI芯片双雄' },
  { symbol: 'AVGO.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: 'AI网络芯片需求强劲，VMware整合推进' },
  { symbol: 'TSM.US', signal_type: 'BULLISH', strength: 4, source: '市场扫描', reason: '芯片制造龙头，AI芯片代工需求旺盛' },
  { symbol: 'PLTR.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: 'AI数据分析平台，政府+企业客户拓展' },
  { symbol: 'SMCI.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: 'AI服务器概念，高波动高弹性' },
  { symbol: 'TSLA.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: '电动车+机器人概念，波动大，话题度高' },
  { symbol: 'COIN.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: '加密货币概念，政策环境改善' },
  { symbol: 'ARM.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: '芯片架构IP，AI终端概念，RISC-V布局' },
  { symbol: 'UBER.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: '出行+外卖双引擎，盈利持续改善' },
  { symbol: 'DASH.US', signal_type: 'BULLISH', strength: 3, source: '市场扫描', reason: '外卖配送龙头，市场份额增长，盈利转正' },
];

for (const s of signals) {
  addSignal({ ...s, source_url: undefined, agent_id: 'SENT-001' });
  console.log(`+ ${s.symbol} (strength ${s.strength})`);
}

console.log(`\nTotal: ${signals.length} signals added`);
