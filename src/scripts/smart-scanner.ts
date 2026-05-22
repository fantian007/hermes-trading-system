/**
 * 智能扫描引擎 — 基于 triggers.yaml 的可定制触发系统
 *
 * 用法：
 *   npx tsx src/scripts/smart-scanner.ts
 *
 * 读取 config/triggers.yaml，根据多种规则检测交易信号，
 * 将符合条件的信号写入候选股池。
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../config/triggers.yaml');

// ===== 配置加载 =====
interface TriggerRule {
  id: string; name: string; enabled: boolean; type: string;
  params: Record<string, any>; vote_node: string; only_with_position?: boolean;
  strength?: number;
}
interface GlobalConfig {
  watchlist: string[]; cooldown_seconds: number;
  stop_loss_pct: number; take_profit_pct: number;
  kline_days: number; us_market_open: string; us_market_close: string;
}
interface TriggerConfig { triggers: TriggerRule[]; global: GlobalConfig; }

function loadConfig(): TriggerConfig {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  // Simple YAML parser for our known structure
  const config: TriggerConfig = { triggers: [], global: {} as GlobalConfig };
  let section = '';
  let currentTrigger: any = null;
  
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    if (trimmed === 'triggers:') { section = 'triggers'; continue; }
    if (trimmed === 'global:') { section = 'global'; continue; }
    
    if (section === 'triggers') {
      if (trimmed.startsWith('- id:')) {
        if (currentTrigger) config.triggers.push(currentTrigger);
        currentTrigger = { id: trimmed.slice(5).trim() };
      } else if (currentTrigger) {
        const m = trimmed.match(/^(\w+):\s*(.+)$/);
        if (m) {
          const [, k, v] = m;
          if (k === 'params') { currentTrigger.params = {}; currentTrigger._inParams = true; }
          else if (currentTrigger._inParams && k !== 'vote_node' && k !== 'only_with_position' && k !== 'strength') {
            currentTrigger.params[k] = parseVal(v);
          } else {
            if (k === 'enabled') currentTrigger[k] = v === 'true';
            else if (k === 'only_with_position') currentTrigger[k] = v === 'true';
            else if (k === 'strength') currentTrigger[k] = parseInt(v);
            else if (k === 'vote_node') currentTrigger[k] = v.replace(/"/g, '');
            else if (k === 'type' || k === 'name') currentTrigger[k] = v.replace(/"/g, '');
            if (k === 'vote_node') currentTrigger._inParams = false;
          }
        }
      }
    } else if (section === 'global') {
      const m = trimmed.match(/^(\w+):\s*(.+)$/);
      if (m) config.global[m[1] as keyof GlobalConfig] = parseVal(m[2]) as any;
    }
  }
  if (currentTrigger) config.triggers.push(currentTrigger);
  return config;
}

function parseVal(v: string): any {
  v = v.trim();
  if (v.startsWith('[')) return JSON.parse(v.replace(/'/g, '"'));
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = parseFloat(v);
  if (!isNaN(n)) return n;
  return v.replace(/"/g, '');
}

// ===== CLI helpers =====
function lb(args: string): any {
  try {
    const out = execSync(`longbridge ${args} --format json`, { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 }).toString().trim();
    return out ? JSON.parse(out) : [];
  } catch { return []; }
}

// ===== Trigger checkers =====
function checkPriceChange(quote: any, params: any): boolean {
  const changePct = parseFloat(quote.change_percentage || '0');
  if (params.min_change_pct > 0) return changePct >= params.min_change_pct;
  return changePct <= params.min_change_pct;
}

function checkVolumeSpike(quote: any, klines: any[], params: any): boolean {
  const avgVol = klines.slice(-params.avg_periods - 1, -1).reduce((s: number, k: any) => s + (k.volume || 0), 0) / params.avg_periods;
  return avgVol > 0 && (quote.volume || 0) > avgVol * params.ratio;
}

function checkMaCross(klines: any[], params: any): boolean {
  if (klines.length < params.slow_period + 1) return false;
  const closes = klines.map((k: any) => k.close);
  const maF = (p: number, i: number) => closes.slice(i - p + 1, i + 1).reduce((s: number, c: number) => s + c, 0) / p;
  const cur = klines.length - 1;
  const prev = cur - 1;
  const curFast = maF(params.fast_period, cur), prevFast = maF(params.fast_period, prev);
  const curSlow = maF(params.slow_period, cur), prevSlow = maF(params.slow_period, prev);
  if (params.direction === 'golden') return prevFast <= prevSlow && curFast > curSlow;
  return prevFast >= prevSlow && curFast < curSlow;
}

function checkRsiLevel(klines: any[], params: any): boolean {
  if (klines.length < params.period + 1) return false;
  const closes = klines.map((k: any) => k.close);
  const deltas = closes.slice(1).map((c: number, i: number) => c - closes[i]);
  const gains = deltas.map((d: number) => d > 0 ? d : 0);
  const losses = deltas.map((d: number) => d < 0 ? -d : 0);
  const avgGain = gains.slice(-params.period).reduce((s: number, g: number) => s + g, 0) / params.period;
  const avgLoss = losses.slice(-params.period).reduce((s: number, l: number) => s + l, 0) / params.period;
  if (avgLoss === 0) return params.threshold >= 70; // RSI=100
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return params.threshold < 50 ? rsi < params.threshold : rsi > params.threshold;
}

function checkBollingerTouch(klines: any[], params: any): boolean {
  if (klines.length < params.period) return false;
  const closes = klines.map((k: any) => k.close);
  const cur = closes[closes.length - 1];
  const recent = closes.slice(-params.period);
  const ma = recent.reduce((s: number, c: number) => s + c, 0) / params.period;
  const std = Math.sqrt(recent.reduce((s: number, c: number) => s + (c - ma) ** 2, 0) / params.period);
  const upper = ma + params.std_dev * std;
  const lower = ma - params.std_dev * std;
  if (params.band === 'lower') return cur <= lower * 1.01;
  if (params.band === 'upper') return cur >= upper * 0.99;
  return Math.abs(cur - ma) < std * 0.1; // middle
}

function checkStopLoss(symbol: string, positions: any[], globalConfig: GlobalConfig): {triggered: boolean, reason: string} | null {
  const pos = positions.find((p: any) => p.symbol === symbol);
  if (!pos || !pos.cost_price) return null;
  const quote = lb(`quote ${symbol}`);
  if (!quote[0]) return null;
  const currentPrice = quote[0].last;
  const pnlPct = (currentPrice - pos.cost_price) / pos.cost_price * 100;
  if (pnlPct <= globalConfig.stop_loss_pct) return { triggered: true, reason: `止损: 浮亏 ${pnlPct.toFixed(1)}% <= ${globalConfig.stop_loss_pct}%` };
  if (pnlPct >= globalConfig.take_profit_pct) return { triggered: true, reason: `止盈: 浮盈 ${pnlPct.toFixed(1)}% >= ${globalConfig.take_profit_pct}%` };
  return null;
}

// ===== Main =====
async function main() {
  const config = loadConfig();
  const { watchlist, cooldown_seconds } = config.global;
  console.log(`[scanner] Loaded ${config.triggers.filter(t => t.enabled).length}/${config.triggers.length} active triggers`);

  // Get positions for stop-loss / take-profit checks
  const posData = lb('positions');
  const positions = Array.isArray(posData) ? posData : (posData?.channels?.[0]?.positions || []);

  // Process each symbol
  for (const symbol of watchlist) {
    // Cooldown check
    const cooldownOut = execSync(`node -e "
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync('./data/trading.db');
      const r = db.prepare(\"SELECT added_at FROM stock_pool WHERE symbol=? AND status='ACTIVE' ORDER BY added_at DESC LIMIT 1\").get('${symbol}');
      if (r) console.log(r.added_at);
      db.close();
    "`, { timeout: 5000 }).toString().trim();

    if (cooldownOut) {
      const lastSignal = new Date(cooldownOut).getTime();
      if (Date.now() - lastSignal < cooldown_seconds * 1000) {
        console.log(`[scanner] ${symbol} — cooldown (${Math.round((Date.now() - lastSignal) / 1000)}s ago)`);
        continue;
      }
    }

    // Stop-loss / take-profit (always check, no cooldown)
    const slTp = checkStopLoss(symbol, positions, config.global);
    if (slTp?.triggered) {
      submitSignal(symbol, 'BULLISH', 5, 'STOP_LOSS_TAKE_PROFIT', slTp.reason, 'BUY');
      console.log(`[scanner] ${symbol} — ${slTp.reason}`);
      continue;
    }

    // Get quote and klines for trigger evaluation
    const quote = lb(`quote ${symbol}`)[0];
    if (!quote) continue;
    const klines = lb(`kline history ${symbol} --count ${config.global.kline_days + 10} --period day`);

    // Evaluate enabled triggers
    for (const trigger of config.triggers) {
      if (!trigger.enabled) continue;
      if (trigger.only_with_position && !positions.find((p: any) => p.symbol === symbol)) continue;

      let matched = false;
      switch (trigger.type) {
        case 'price_change': matched = checkPriceChange(quote, trigger.params); break;
        case 'volume_spike': matched = checkVolumeSpike(quote, klines, trigger.params); break;
        case 'ma_cross': matched = checkMaCross(klines, trigger.params); break;
        case 'rsi_level': matched = checkRsiLevel(klines, trigger.params); break;
        case 'bollinger_touch': matched = checkBollingerTouch(klines, trigger.params); break;
      }

      if (matched) {
        const signalType = trigger.vote_node === 'BUY' ? 'BULLISH' : 'BEARISH';
        submitSignal(symbol, signalType, trigger.strength || paramsStrength(trigger), trigger.id.toUpperCase(), trigger.name, trigger.vote_node);
        console.log(`[scanner] ${symbol} — ${trigger.name} (${trigger.type}) → ${trigger.vote_node}`);
        break; // One signal per symbol per scan
      }
    }
  }
  console.log('[scanner] Done');
}

function paramsStrength(t: TriggerRule): number { return t.params?.strength || 3; }

function submitSignal(symbol: string, type: string, strength: number, source: string, reason: string, voteNode: string) {
  execSync(`npx tsx src/scripts/submit-signal.ts --symbol ${symbol} --type ${type} --strength ${strength} --source ${source} --reason "${reason}" --agent-id AGT-SEL-01`, {
    cwd: resolve(__dirname, '../..'), timeout: 10_000,
  });
}

main().catch(console.error);
