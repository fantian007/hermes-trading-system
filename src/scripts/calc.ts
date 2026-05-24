#!/usr/bin/env node
/**
 * 通用公式计算器 — 纯工具，零决策
 * 
 * 用法:
 *   npx tsx src/scripts/calc.ts "max_shares = 88000 * 0.2 / 216.44"
 *   echo "pnl = (198.35 - 174.40) * 10" | npx tsx src/scripts/calc.ts
 * 
 * 支持: + - * / ** Math.sqrt() Math.abs() Math.round()
 */

const formula = process.argv.slice(2).join(' ') || 
  await new Promise<string>(r => { let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>r(d)); });

if (!formula.trim()) { console.error('Usage: calc.ts "a = 1 + 2"'); process.exit(1); }

const ctx: Record<string, number> = {};

function evaluate(expr: string): number {
  // Protect Math.xxx functions before variable replacement
  let safe = expr.replace(/Math\.(\w+)/g, (_, fn) => `__MATH_${fn}__`);
  safe = safe.replace(/([a-zA-Z_]\w*)/g, (m) => {
    if (m.startsWith('__MATH_')) return `Math.${m.slice(7, -2)}`;
    if (m in ctx) return String(ctx[m]);
    if (m === 'true' || m === 'false' || m === 'Infinity') return m;
    throw new Error(`Unknown: ${m}`);
  });
  return Function(`"use strict"; return (${safe})`)();
}

const lines = formula.split('\n').filter(l => l.trim());
const results: string[] = [];

for (const line of lines) {
  try {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const name = line.slice(0, eq).trim();
      const val = evaluate(line.slice(eq + 1).trim());
      ctx[name] = val;
      results.push(`${name} = ${Number.isInteger(val) ? val : val.toFixed(4)}`);
    } else {
      const val = evaluate(line.trim());
      results.push(`${Number.isInteger(val) ? val : val.toFixed(4)}`);
    }
  } catch (e: any) {
    results.push(`ERROR: ${e.message} in "${line.trim()}"`);
  }
}

console.log(JSON.stringify(results));
