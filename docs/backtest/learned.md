# Backtest Research Learnings

> Last updated: 2026-05-24

## 1. Backtest Overfitting Avoidance

### Walk-Forward Analysis

Instead of a static train/test split, use sequential rolling windows: train on period [T-n, T-1], test on T, shift forward, repeat. This simulates how the strategy would perform in production as time progresses.

- Source: López de Prado, *Advances in Financial Machine Learning* (2018)

### Combinatorial Purged Cross-Validation (CPCV)

Cross-validation on financial time series must purge overlapping data between train and test sets to avoid leakage. CPCV creates N!/(N-k)!k! combinatorial splits and purges test-set-adjacent observations from training. This gives a more realistic out-of-sample performance distribution than single-split testing.

- Source: López de Prado, *Advances in Financial Machine Learning* (2018)

### Deflated Sharpe Ratio (DSR)

Standard Sharpe Ratio does not account for multiple testing across many strategy variants. The Deflated Sharpe Ratio corrects for:

```
DSR = Φ⁻¹( (SR × √(N-1) − E[max_SR]) / σ[max_SR] )
```

Where E[max_SR] is the expected maximum Sharpe across all trials, and σ[max_SR] is its standard deviation. A strategy only passes if its DSR is statistically significant despite the number of attempts.

- Source: Bailey et al., "The Probability of Backtest Overfitting", arXiv:1507.02617

---

## 2. Performance Metrics

### Sortino Ratio

Penalizes only downside volatility, unlike Sharpe which penalizes total volatility:

```
Sortino = (R_p − R_f) / DownsideDeviation
DownsideDeviation = √(1/N × Σ max(R_t − R_target, 0)²)
```

- Source: Sortino, *The Sortino Framework for Constructing Portfolios* (1999)

### Calmar Ratio

Measures return relative to maximum drawdown:

```
Calmar = CAGR / |MaxDrawdown|
```

Where CAGR = (End/Start)^(252/days) − 1, and MaxDrawdown is the peak-to-trough decline over the period.

- Source: Young, "Portfolio Performance Measures", *Journal of Portfolio Management* (1991)

### Maximum Drawdown (MDD)

The largest peak-to-trough decline in equity:

```
MDD = minₜ( V(t) / max_{s≤t} V(s) − 1 )
```

- Source: Bacon, *Practical Portfolio Performance Measurement and Attribution* (2020)

### Other Key Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| Profit Factor | Gross Profit / Gross Loss | Win vs loss magnitude |
| Ulcer Index | √(1/N × Σ (D_i)²) where D_i = (peak−value)/peak | Drawdown depth × duration |

- Source: Bacon (2020), Martin McCrorie (Ulcer Index)

---

## 3. Survivorship & Look-Ahead Bias

### Survivorship Bias

Backtests using current constituents (e.g. S&P 500 today) exclude delisted stocks — most of which underperform. This inflates returns. Mitigation:

- Use point-in-time datasets (e.g. Compustat, CRSP with delisted securities)
- Include CRSP DLRET (delisting return) — stocks often drop 15-30% on delisting day

- Sources: Elton et al., "Survivorship Bias", *Review of Financial Studies* (1996); QuantConnect documentation

### Look-Ahead Bias

Using data that wasn't available at trade time (e.g. revised GDP figures, restated earnings). Mitigation:

- Fundamental data must be lagged 1-3 months (the reporting delay)
- Never use fiscal-year-end data before the actual filing date
- Never map current index constituents onto historical dates

- Source: QuantConnect documentation

---

## 4. Slippage & Transaction Costs

### Fixed Percentage Slippage

Simplest model: apply a fixed slippage rate (e.g. 0.1%) to each fill. Suitable for liquid large-caps.

### Commission Modeling

Two common conventions:

- Per-trade: fixed $1–$10 per order
- Per-share: ~$0.005 per share (more precise for varying position sizes)

### Almgren-Chriss Market Impact Model

A two-part market impact decomposition:

| Component | Description |
|-----------|-------------|
| **Permanent Impact** | Long-term price shift from the trade — scales with Q/V |
| **Temporary Impact** | Short-term liquidity cost — mean-reverts after the trade |

```
Temporary Impact = η × σ × (Q/V)^κ
```

Where Q = order size, V = volume, σ = volatility, η/κ = calibration parameters.

- Source: Almgren & Chriss, "Optimal Execution of Portfolio Transactions", *Journal of Risk* (2001); QuantConnect documentation

### Spread Costs

Half the bid-ask spread per share on each side (entry and exit). For liquid US equities with spreads < $0.02, this is typically $0.01/share per trade.

### VWAP Fill Assumptions

Realistic volume-weighted fill assumption: the order executes at VWAP over a time window rather than the first print. Avoid assuming fills at best price — use conservative fill prices.

- Source: QuantConnect documentation

---

## 5. Strategy Decay Detection (NEW: 2026-05-24)

### Problem
Strategies that backtest well often degrade or stop working due to regime change, crowding, or alpha decay.

### Chow Structural Break Test (Chow, 1960)
Split the P&L series at a candidate breakpoint `t`. Fit the same return model on the first and second segments:

```
Chow = ((RSS_pooled - RSS₁ - RSS₂) / k) / ((RSS₁ + RSS₂) / (T - 2k))
```

Where `RSS` = residual sum of squares, `k` = number of parameters. Follows F(k, T-2k). Significant F → strategy behavior changed.

### Supremum ADF (Phillips-Wu-Yu, 2011)
For detecting explosive decay in cumulative equity curves:
1. Run rolling ADF tests on expanding windows from start → each point
2. Take `sup{ADF_t}` across all windows
3. If SADF exceeds 95% critical value → explosive behavior followed by collapse

### Practical Implementation
- Compute rolling 6-month Sharpe on each stock
- Flag decay when 2H/1H Sharpe < 0.5, or drops by >3σ from trailing mean
- Run Chow test quarterly on 60-day segments

- Sources: Chow (1960), Econometrica; Phillips, Wu & Yu (2011), JFE; Harvey, Liu & Zhu (2016), RFS

---

## 6. Diebold-Mariano OOS Testing (NEW: 2026-05-24)

### Problem
Single OOS periods can be cherry-picked. Need multiple OOS periods with proper significance.

### Diebold-Mariano (1995) with HLN Correction
1. Build multiple OOS periods via rolling windows (train N months, test M months, advance)
2. Compute OOS t-stat: `t_OOS = mean(r_OOS) / (std(r_OOS) / √N_OOS)`
3. DM statistic:
```
DM = mean(d) / √( (1/T) × [γ₀ + 2 × Σᵢ₌₁ʰ⁻¹ γᵢ] )
```
Where `d_t = L(ε_t^A) - L(ε_t^B)` (loss differential) and `γᵢ` = autocovariances
4. HLN correction for small samples: multiply DM by `√((T+1-2h+h(h-1)/T)/T)`, compare against t(T-1)

### White's Reality Check (2000) / Hansen (2005)
When testing multiple strategies, adjust p-values for data snooping via bootstrapped max performance distribution.

### Practical Implementation
- Use rolling 2-year train / 6-month test windows, advance 3 months → 8 OOS periods over 4 years
- Report DM p-value alongside raw OOS returns

- Sources: Diebold & Mariano (1995) JBES; Harvey, Leybourne & Newbold (1997) IJF; White (2000) Econometrica; Hansen (2005)

---

## 7. Bootstrap Confidence Intervals (NEW: 2026-05-24)

### Problem
A single point estimate (e.g. Sharpe = 1.2) tells nothing about its uncertainty.

### Stationary Bootstrap (Politis & Romano, 1994)
Resamples in blocks of geometrically distributed random length:
1. Choose optimal mean block length ℓ ≈ T^(1/3) for daily returns
2. Draw blocks of length Geometric(p) where p = 1/ℓ
3. Concatenate until length ≥ T
4. Compute Sharpe on resampled series
5. Repeat B = 10,000 times → 95% CI from percentiles

### Lo's Parametric SE (Lo, 2002)
For i.i.d. normal returns:
```
SE(Sharpe) = √((1 + 0.5 × Sharpe²) / T)
```

### Mertens' Correction (2002) for Fat Tails
```
SE(Sharpe) ≈ √((1 + 0.5 × Sharpe² + (μ₄ - 3)/4 × Sharpe) / T)
```
Where μ₄ = excess kurtosis.

### Key Insight
For daily returns (~1250 obs / 5 years), stationary bootstrap yields 95% CIs 2-3x wider than naive SE due to autocorrelation and volatility clustering.

- Sources: Politis & Romano (1994) JASA; Lo (2002) FAJ; Mertens (2002) working paper

---

## Sources Summary

| Source | Relevance |
|--------|-----------|
| López de Prado, *Advances in Financial ML* (2018) | Overfitting, CPCV, DSR |
| Bailey et al., arXiv:1507.02617 | Probability of Backtest Overfitting |
| Sortino (1999) | Sortino Ratio, downside risk framework |
| Bacon (2020) | Performance measurement and attribution |
| Young (1991), JPM | Calmar Ratio, portfolio performance |
| Almgren & Chriss (2001), JoR | Market impact, optimal execution |
| Elton et al. (1996), RFS | Survivorship bias in databases |
| QuantConnect docs | Practical backtest implementation |
| Chow (1960), Econometrica | Structural break (Chow test) |
| Phillips, Wu & Yu (2011), JFE | Supremum ADF, explosive decay |
| Diebold & Mariano (1995), JBES | OOS forecast comparison |
| Harvey, Leybourne & Newbold (1997), IJF | Small-sample DM correction |
| White (2000), Econometrica | Reality Check (data snooping) |
| Politis & Romano (1994), JASA | Stationary bootstrap |
| Lo (2002), FAJ | Sharpe ratio standard error |
| Mertens (2002) | Fat-tail correction for Sharpe SE |
