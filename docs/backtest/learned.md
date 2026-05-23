# Backtest Research Learnings

> Last updated: 2026-05-24

## 1. Walk-Forward + Cross-Validation Hybrids (DM-CV & MCS)

### Diebold-Mariano Cross-Validation (DM-CV)
Runs DM pairwise comparison across all walk-forward folds (not one holdout) and aggregates p-values via meta-analysis. Reuses existing walk-forward infrastructure. Gives a distribution-based view of OOS outperformance vs a benchmark.

**Implementation** (after computing WF metrics):
1. For each WF window, compute loss differential `d_t = L(error_benchmark) − L(error_strategy)` where L = squared error
2. Pool all `d_t` across windows → DM statistic = mean(d) / heteroskedastic-autocorrelation-adjusted SE
3. Compare against t-distribution with HLN correction

### Model Confidence Set (MCS)
After grid search, instead of picking the single best parameter set, MCS identifies which configurations are *statistically indistinguishable* from the best. Eliminates the rest.

**Procedure**:
1. Run grid search (already implemented in runner.ts)
2. For each candidate parameter set, compute loss across all WF windows
3. Run equivalence test: for each pair (i,j), test `H₀: E[L_i] = E[L_j]`
4. Remove worst-performing candidates, re-test → final "surviving set"
5. Choose the most parsimonious survivor (less complex = more robust)

### Key insight
No single breakthrough replaces CPCV/DSR. The innovation is *composition* — combining existing tests (DM, Chow, MCS) into a pipeline that leverages the walk-forward folds already computed.

- Sources: Diebold & Mariano (1995) JBES; Hansen, Lunde & Nason (2011) Econometrica; QuantConnect OOS validation blog (2024)

---

## 2. Strategy Decay Detection & Online Monitoring

### Chow Structural Break Test
Split the P&L series at a candidate breakpoint `t`. Fit the same return model on first and second segments:
```
Chow = ((RSS_pooled − RSS₁ − RSS₂) / k) / ((RSS₁ + RSS₂) / (T − 2k))
```
Significant F → strategy behavior changed. Run at walk-forward transition points.

### Rolling Sharpe Monitoring
- Compute rolling 6-month Sharpe on each stock
- Flag decay when recent 60 days' Sharpe < 0.3 or drops by >3σ from trailing mean
- Run Chow test quarterly on 90-day segments

### DSR 2.0 (Deflated Sharpe with parameter-count penalty)
Standard DSR corrects for multiple testing across strategy variants. DSR 2.0 adds a parameter-count penalty term: the more parameters (MA windows, RSI thresholds, BB std multiples), the higher the deflation. Useful for multi-indicator strategies like the current MA+RSI+BB+Turtle combo.

### Practical Implementation
- After each backtest run, compute rolling 60-day Sharpe from equity curve
- Flag any stock where recent Sharpe < 0 (decaying) or < 0.3 * historic peak Sharpe (degraded)
- DSR 2.0: `DSR_adj = Φ⁻¹((SR − E[max_SR]) / σ[max_SR]) − λ × ln(N_params)` where λ ≈ 0.1

- Sources: Chow (1960) Econometrica; Harvey, Liu & Zhu (2016) RFS; QuantConnect rolling Sharpe monitoring (2024)

---

## 3. Slippage & Market Impact Realism

### Cost-Impact Feedback Loop
Backtests with fixed slippage assume constant liquidity. In reality, large trades move the market:
- **Almgren-Chriss Model**: `Temporary Impact = η × σ × (Q/V)^κ` where Q=order size, V=volume, σ=volatility
- Liquid large-caps (NVDA, MSFT, AAPL): slippage ~0.05-0.10% — current 0.10% is reasonable
- Growth stocks (PLTR, TSLA, AMD): effective slippage can reach 0.20-0.40%, especially on entries/exits near volatility spikes

### VWAP Fill Assumptions
Avoid assuming fills at best price. Use conservative fill prices — the current `applySlippage` model is adequate for large-caps but understates costs for small/volatile positions.

### Implementation Notes for runner.ts
The current `c` (commission) is subtracted as a flat per-trade cost:
```
const pnl = state.position * (fillPrice - state.entryPrice) - c;
```
This is correct for fixed commission. For per-share costing, `c` should be `commissionPerTrade + qty * commissionPerShare`.

- Sources: Almgren & Chriss (2001) Journal of Risk; QuantConnect documentation; Bacon (2020) Chap 8
