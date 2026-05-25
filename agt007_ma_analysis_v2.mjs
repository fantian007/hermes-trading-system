#!/usr/bin/env node
/**
 * AGT-007 MA Crossover Strategy Analysis - CRM/CLSK/SNAP
 */
import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';

const DB_PATH = '/Users/zys/workspace/hermes-trading-system/data/trading.db';
const db = new DatabaseSync(DB_PATH);

const symbols = ['CRM.US', 'CLSK.US', 'SNAP.US'];

console.log('=== AGT-007 均线交叉策略分析 ===');
console.log(`分析时间: ${new Date().toISOString()}\n`);

// Get real-time prices and compute MAs
for (const sym of symbols) {
  console.log(`\n========== ${sym} ==========`);
  
  // Check open trade
  const trade = db.prepare("SELECT * FROM trades WHERE symbol = ? AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1").get(sym);
  if (trade) {
    console.log(`持仓: 开仓 $${trade.buy_price}, 开仓时间: ${trade.buy_time}`);
  } else {
    console.log('持仓: 无');
  }
  
  // Check pool status
  const pool = db.prepare("SELECT * FROM stock_pool WHERE symbol = ? ORDER BY added_at DESC LIMIT 1").get(sym);
  if (pool) {
    console.log(`股池: ${pool.signal_type} 强度${pool.strength}, 状态: ${pool.status}, 理由: ${pool.reason || 'N/A'}`);
  } else {
    console.log('股池: 不存在');
  }
  
  // Check if there's a previous AGT-007 vote for this symbol
  const prevVote = db.prepare("SELECT vote_direction, confidence, reasoning, voted_at FROM agent_votes WHERE agent_id='AGT-007' AND trade_id LIKE ? ORDER BY voted_at DESC LIMIT 1").get(`%${sym.replace('.US', '')}%`);
  if (prevVote) {
    console.log(`上次投票: ${prevVote.vote_direction} (置信度: ${prevVote.confidence}), 时间: ${prevVote.voted_at}`);
    console.log(`上次分析: ${prevVote.reasoning}`);
  }
  
  // Try to get fresh kline data
  let price = null, ma5 = null, ma10 = null, ma20 = null, ma50 = null;
  let dataSource = 'N/A';
  
  try {
    const lbCheck = execSync('which longbridge 2>/dev/null || echo ""', { encoding: 'utf-8' });
    if (lbCheck.trim()) {
      const klines = execSync(`longbridge kline history ${sym} --period day --format json 2>/dev/null`, {
        timeout: 20000,
        encoding: 'utf-8',
        env: { ...process.env, HOME: '/Users/zys' }
      });
      if (klines && klines.trim().length > 10) {
        // Find JSON array in output
        const lines = klines.trim().split('\n');
        let jsonText = '';
        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('[') || t.startsWith('{')) jsonText += t;
        }
        if (jsonText) {
          const data = JSON.parse(jsonText);
          const klineArr = Array.isArray(data) ? data : (data.data || data.klines || [data]);
          if (klineArr.length >= 20) {
            const closes = klineArr.map(k => parseFloat(k.close || k.c || 0));
            price = closes[closes.length - 1];
            const recent20 = closes.slice(-20);
            ma5 = recent20.slice(-5).reduce((a,b) => a+b, 0) / 5;
            ma10 = recent20.slice(-10).reduce((a,b) => a+b, 0) / 10;
            ma20 = recent20.reduce((a,b) => a+b, 0) / 20;
            if (closes.length >= 50) {
              ma50 = closes.slice(-50).reduce((a,b) => a+b, 0) / 50;
            }
            dataSource = 'longbridge live';
          }
        }
      }
    }
  } catch(e) {
    // longbridge unavailable, fall through
  }

  // If longbridge failed, try yahoo finance web API
  if (!price) {
    try {
      const curl = execSync(`curl -s "https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=2mo&interval=1d" 2>/dev/null`, {
        timeout: 15000,
        encoding: 'utf-8'
      });
      const data = JSON.parse(curl);
      const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];
      const timestamps = data?.chart?.result?.[0]?.timestamp;
      if (quotes?.close && timestamps?.length >= 20) {
        const closes = quotes.close.filter(c => c !== null);
        if (closes.length >= 20) {
          price = closes[closes.length - 1];
          ma5 = closes.slice(-5).reduce((a,b) => a+b, 0) / 5;
          ma10 = closes.slice(-10).reduce((a,b) => a+b, 0) / 10;
          ma20 = closes.slice(-20).reduce((a,b) => a+b, 0) / 20;
          if (closes.length >= 50) {
            ma50 = closes.slice(-50).reduce((a,b) => a+b, 0) / 50;
          }
          dataSource = 'Yahoo Finance';
        }
      }
    } catch(e2) {
      dataSource = 'unavailable';
    }
  }

  console.log(`当前价: ${price !== null ? '$' + price.toFixed(2) : 'N/A'}`);
  console.log(`数据源: ${dataSource}`);

  if (price !== null && ma5 !== null && ma10 !== null && ma20 !== null) {
    console.log(`MA5: $${ma5.toFixed(2)}`);
    console.log(`MA10: $${ma10.toFixed(2)}`);
    console.log(`MA20: $${ma20.toFixed(2)}`);
    if (ma50) console.log(`MA50: $${ma50.toFixed(2)}`);
    
    // Determine signals
    const allBull = ma5 > ma10 && ma10 > ma20 && (ma50 === null || ma20 > ma50);
    const allBear = ma5 < ma10 && ma10 < ma20 && (ma50 === null || ma20 < ma50);
    const goldenCross = ma5 > ma20 && ma10 > ma20 && price > ma20;
    const deathCross = ma5 < ma20 && ma10 < ma20 && price < ma20;
    
    let signal, confidence, reasoning;
    
    if (allBull) {
      if (price > ma5) {
        signal = 'BUY';
        confidence = 0.75;
        reasoning = `完全多头排列: MA5($${ma5.toFixed(2)}) > MA10($${ma10.toFixed(2)}) > MA20($${ma20.toFixed(2)})` + 
          (ma50 ? ` > MA50($${ma50.toFixed(2)})` : '') + 
          `，价格$${price.toFixed(2)}站在所有均线上方。均线金叉多头形态强势，建议BUY。`;
      } else {
        signal = 'HOLD';
        confidence = 0.55;
        reasoning = `均线多头排列但价格回调至MA5($${ma5.toFixed(2)})下方($${price.toFixed(2)})，短期回调。中长期趋势仍偏多，建议HOLD等待企稳。`;
      }
    } else if (allBear) {
      if (price < ma5) {
        signal = 'SELL';
        confidence = 0.70;
        reasoning = `完全空头排列: MA5($${ma5.toFixed(2)}) < MA10($${ma10.toFixed(2)}) < MA20($${ma20.toFixed(2)})` +
          (ma50 ? ` < MA50($${ma50.toFixed(2)})` : '') +
          `，价格$${price.toFixed(2)}在所有均线下方。死叉形态确认，建议SELL。`;
      } else {
        signal = 'HOLD';
        confidence = 0.50;
        reasoning = `均线空头排列但价格反弹至MA5上方($${price.toFixed(2)} > $${ma5.toFixed(2)})，短期反弹。趋势仍偏空，建议HOLD观察。`;
      }
    } else if (goldenCross && !deathCross) {
      signal = 'BUY';
      confidence = 0.60;
      reasoning = `金叉信号: 短期均线上穿长期均线，价格$${price.toFixed(2)}>MA20($${ma20.toFixed(2)})。上升趋势初现，建议BUY。均线排列: MA5=$${ma5.toFixed(2)} MA10=$${ma10.toFixed(2)} MA20=$${ma20.toFixed(2)}。`;
    } else if (deathCross && !goldenCross) {
      signal = 'SELL';
      confidence = 0.60;
      reasoning = `死叉信号: 短期均线下穿长期均线，价格$${price.toFixed(2)}<MA20($${ma20.toFixed(2)})。下跌趋势初现，建议SELL。均线排列: MA5=$${ma5.toFixed(2)} MA10=$${ma10.toFixed(2)} MA20=$${ma20.toFixed(2)}。`;
    } else if (ma5 > ma10 && ma10 < ma20) {
      signal = 'HOLD';
      confidence = 0.45;
      reasoning = `均线缠绕: MA5($${ma5.toFixed(2)}) > MA10($${ma10.toFixed(2)}) 但 MA10 < MA20($${ma20.toFixed(2)})。短期走强但中期压力仍在，方向不明确，建议HOLD。`;
    } else if (ma5 < ma10 && ma10 > ma20) {
      signal = 'HOLD';
      confidence = 0.45;
      reasoning = `均线缠绕: MA5($${ma5.toFixed(2)}) < MA10($${ma10.toFixed(2)}) 但 MA10 > MA20($${ma20.toFixed(2)})。短期走弱但中期趋势尚可，方向不明确，建议HOLD。`;
    } else {
      signal = 'HOLD';
      confidence = 0.40;
      reasoning = `均线无明显方向: MA5=$${ma5.toFixed(2)} MA10=$${ma10.toFixed(2)} MA20=$${ma20.toFixed(2)}，价格$${price.toFixed(2)}。缺乏明确信号，建议HOLD。`;
    }
    
    console.log(`\n--- 分析结论 ---`);
    console.log(`信号: ${signal}`);
    console.log(`置信度: ${confidence.toFixed(2)}`);
    console.log(`推理: ${reasoning}`);
    
    results[sym] = { price, ma5, ma10, ma20, ma50, signal, confidence, reasoning };
  } else {
    console.log('\n--- 分析结论: 无法获取数据 ---');
    results[sym] = { error: 'price data unavailable' };
  }
}

console.log('\n\n========== 分析汇总 ==========');
for (const [sym, res] of Object.entries(results)) {
  if (res.error) {
    console.log(`${sym}: ${res.error}`);
  } else {
    console.log(`${sym}: ${res.signal} (${(res.confidence*100).toFixed(0)}%) — 现价$${res.price.toFixed(2)}, MA5=$${res.ma5.toFixed(2)}, MA10=$${res.ma10.toFixed(2)}, MA20=$${res.ma20.toFixed(2)}`);
  }
}

db.close();
console.log('\n=== 分析完成 ===');
