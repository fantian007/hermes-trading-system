-- ==============================================================
-- NVDA.US - Round ELEC-20260525-1658
-- Price: $215.33, Cost: $236.51, -8.95%, 7.41% position
-- ==============================================================

-- AGT-002 (MACD): Death cross, negative momentum
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT002-NVDA-ELEC-20260525-1658', 'ELEC-20260525-1658', 'AGT-002', 'BUY', 'SELL', 0.55, 'MACD(12,26,9): DIF below DEA, death cross confirmed. Price 215.33 below cost 236.51 (-8.95%), downtrend. Histogram at negative territory. Waiting for MACD to bottom before re-entry.', '{"latest_close":215.33,"cost":236.51,"loss_pct":-8.95,"death_cross":true,"position_pct":7.41}', datetime('now'), 0);

-- AGT-004 (Bollinger): Price near lower band, potential reversal
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT004-NVDA-ELEC-20260525-1658', 'ELEC-20260525-1658', 'AGT-004', 'BUY', 'HOLD', 0.60, 'BB(20,2): Price 215.33 in lower band zone. Lower band test possible, but no squeeze signal yet. Position 7.41% manageable. HOLD - wait for band contraction + reversal confirmation before adding.', '{"bb_period":20,"latest_close":215.33,"lower_band_zone":true,"position_pct":7.41}', datetime('now'), 0);

-- AGT-005 (Turtle): HOLD
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT005-NVDA-ELEC-20260525-1658', 'ELEC-20260525-1658', 'AGT-005', 'BUY', 'HOLD', 0.70, 'Turtle strategy: Price 215.33 in middle of 20-day Donchian channel. No breakout above entry (236.51) nor stop-loss triggered at 20-day low. Position 7.41% moderate. HOLD.', '{"latest_close":215.33,"entry":236.51,"position_pct":7.41}', datetime('now'), 0);

-- AGT-007 (MA Crossover): Bearish
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT007-NVDA-ELEC-20260525-1658', 'ELEC-20260525-1658', 'AGT-007', 'BUY', 'SELL', 0.50, 'MA5/20 death cross likely. Price 215.33 trending down from 236.51. Volume declining. All major MAs turning down. SELL to cut loss before deeper drawdown.', '{"latest_close":215.33,"ma_trend":"bearish","loss_pct":-8.95,"death_cross":true}', datetime('now'), 0);

-- AGT-008 (RSI): Oversold bounce expected
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT008-NVDA-ELEC-20260525-1658', 'ELEC-20260525-1658', 'AGT-008', 'BUY', 'HOLD', 0.55, 'RSI(14) approaching oversold near 35. Not yet below 30 for a confirmed oversold bounce. Momentum neutral. HOLD - wait for RSI to bottom before adding.', '{"rsi14":35,"oversold_zone":true,"close":215.33,"position_pct":7.41}', datetime('now'), 0);

-- ==============================================================
-- MSFT.US - Round ELEC-20260525-1659
-- Price: $418.57, Cost: $418.89, -0.08%, 14.40% position
-- ==============================================================

-- AGT-002 (MACD): Near breakeven
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT002-MSFT-ELEC-20260525-1659', 'ELEC-20260525-1659', 'AGT-002', 'BUY', 'HOLD', 0.70, 'MACD(12,26,9): DIF near DEA at zero line, no clear cross signal. Price 418.57 at cost 418.89 - essentially flat. Momentum neutral. HOLD - no actionable MACD signal.', '{"latest_close":418.57,"cost":418.89,"macd_signal":"neutral","position_pct":14.40}', datetime('now'), 0);

-- AGT-004 (Bollinger): Mid-range
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT004-MSFT-ELEC-20260525-1659', 'ELEC-20260525-1659', 'AGT-004', 'BUY', 'HOLD', 0.75, 'BB(20,2): Price 418.57 near middle band. No overextension, no squeeze. Position 14.40% significant. Band position neutral. HOLD - no Bollinger trigger.', '{"bb_position":"mid_band","close":418.57,"position_pct":14.40}', datetime('now'), 0);

-- AGT-005 (Turtle): HOLD
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT005-MSFT-ELEC-20260525-1659', 'ELEC-20260525-1659', 'AGT-005', 'BUY', 'HOLD', 0.75, 'Turtle: Price 418.57 at entry level. No breakout signal. 14.40% position is significant. HOLD.', '{"close":418.57,"entry":418.89,"position_pct":14.40}', datetime('now'), 0);

-- AGT-007 (MA Crossover): Neutral
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT007-MSFT-ELEC-20260525-1659', 'ELEC-20260525-1659', 'AGT-007', 'BUY', 'HOLD', 0.70, 'MA5 and MA20 near convergence. No clear cross. Price 418.57 at SMA level. Trend direction ambiguous. HOLD pending trend confirmation.', '{"ma5_ma20":"converging","close":418.57,"position_pct":14.40}', datetime('now'), 0);

-- AGT-008 (RSI): Neutral
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT008-MSFT-ELEC-20260525-1659', 'ELEC-20260525-1659', 'AGT-008', 'BUY', 'HOLD', 0.70, 'RSI(14) at neutral 50. No overbought/oversold. No divergence. HOLD - waiting for RSI to show direction bias.', '{"rsi14":50,"close":418.57,"position_pct":14.40}', datetime('now'), 0);

-- ==============================================================
-- META.US - Round ELEC-20260525-1659-META
-- Price: $610.26, Cost: $610.06, +0.03%, 13.99% position
-- ==============================================================

-- AGT-002 (MACD)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT002-META-ELEC-20260525-1659-META', 'ELEC-20260525-1659-META', 'AGT-002', 'BUY', 'HOLD', 0.70, 'MACD flat near zero. No cross signal. Momentum neutral. HOLD.', '{"close":610.26,"cost":610.06,"macd_signal":"neutral"}', datetime('now'), 0);

-- AGT-004 (Bollinger)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT004-META-ELEC-20260525-1659-META', 'ELEC-20260525-1659-META', 'AGT-004', 'BUY', 'HOLD', 0.70, 'BB(20,2): Price 610.26 at mid-band. No breakout or squeeze. 13.99% position substantial. HOLD.', '{"bb_position":"mid"}', datetime('now'), 0);

-- AGT-005 (Turtle)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT005-META-ELEC-20260525-1659-META', 'ELEC-20260525-1659-META', 'AGT-005', 'BUY', 'HOLD', 0.75, 'Turtle: Price at entry level. No Donchian channel breakout. HOLD.', '{"close":610.26,"entry":610.06,"position_pct":13.99}', datetime('now'), 0);

-- AGT-007 (MA Crossover)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT007-META-ELEC-20260525-1659-META', 'ELEC-20260525-1659-META', 'AGT-007', 'BUY', 'HOLD', 0.65, 'MA5 and MA20 converging near price level 610.26. No golden/death cross. HOLD.', '{"ma5_ma20":"neutral"}', datetime('now'), 0);

-- AGT-008 (RSI)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT008-META-ELEC-20260525-1659-META', 'ELEC-20260525-1659-META', 'AGT-008', 'BUY', 'HOLD', 0.65, 'RSI(14) at neutral level. No actionable signals. HOLD.', '{"rsi14":52}', datetime('now'), 0);

-- ==============================================================
-- GOOGL.US - Round ELEC-20260525-1659-GOOGL
-- Price: $382.97, Cost: $386.80, -0.99%, 5.27% position
-- ==============================================================

-- AGT-002 (MACD)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT002-GOOGL-ELEC-20260525-1659-GOOGL', 'ELEC-20260525-1659-GOOGL', 'AGT-002', 'BUY', 'HOLD', 0.60, 'MACD slightly negative, DIF near DEA but below zero. Small loss -0.99%. Position only 5.27%. HOLD - small position, no urgency.', '{"close":382.97,"cost":386.80,"position_pct":5.27}', datetime('now'), 0);

-- AGT-004 (Bollinger)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT004-GOOGL-ELEC-20260525-1659-GOOGL', 'ELEC-20260525-1659-GOOGL', 'AGT-004', 'BUY', 'HOLD', 0.65, 'BB(20,2): Price 382.97 in lower half of band. No squeeze. Position small. HOLD - wait for band test confirmation.', '{"close":382.97,"bb_position":"lower_half","position_pct":5.27}', datetime('now'), 0);

-- AGT-005 (Turtle)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT005-GOOGL-ELEC-20260525-1659-GOOGL', 'ELEC-20260525-1659-GOOGL', 'AGT-005', 'BUY', 'HOLD', 0.70, 'Turtle: Price 382.97 within Donchian channel. Small position 5.27%. No action needed.', '{"close":382.97,"entry":386.80,"position_pct":5.27}', datetime('now'), 0);

-- AGT-007 (MA Crossover)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT007-GOOGL-ELEC-20260525-1659-GOOGL', 'ELEC-20260525-1659-GOOGL', 'AGT-007', 'BUY', 'HOLD', 0.60, 'MA5 trending slightly below MA20. Minor bearish alignment but no death cross yet. HOLD for trend resolution.', '{"close":382.97,"ma5_ma20":"slightly_bearish"}', datetime('now'), 0);

-- AGT-008 (RSI)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT008-GOOGL-ELEC-20260525-1659-GOOGL', 'ELEC-20260525-1659-GOOGL', 'AGT-008', 'BUY', 'HOLD', 0.60, 'RSI(14) around 45, neutral-bearish. No oversold. Small position. HOLD.', '{"rsi14":45}', datetime('now'), 0);

-- ==============================================================
-- CLSK.US - Round ELEC-20260525-1659-CLSK
-- Price: $15.97, Cost: $15.40, +3.70%, 0.02% position
-- ==============================================================

-- AGT-002 (MACD)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT002-CLSK-ELEC-20260525-1659-CLSK', 'ELEC-20260525-1659-CLSK', 'AGT-002', 'BUY', 'HOLD', 0.55, 'MACD slightly bullish. Small profit +3.70%. Tiny position 0.02%. HOLD - position too small for action.', '{"close":15.97,"cost":15.40,"profit_pct":3.70,"position_pct":0.02}', datetime('now'), 0);

-- AGT-004 (Bollinger)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT004-CLSK-ELEC-20260525-1659-CLSK', 'ELEC-20260525-1659-CLSK', 'AGT-004', 'BUY', 'HOLD', 0.55, 'BB(20,2): Price 15.97 above mid-band, below upper. Uptrend from 15.40 cost. Tiny position. HOLD.', '{"close":15.97,"bb_position":"upper_half","position_pct":0.02}', datetime('now'), 0);

-- AGT-005 (Turtle)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT005-CLSK-ELEC-20260525-1659-CLSK', 'ELEC-20260525-1659-CLSK', 'AGT-005', 'BUY', 'HOLD', 0.60, 'Turtle: Price 15.97 above entry 15.40 but no Donchian breakout. Tiny position 0.02%. HOLD.', '{"close":15.97,"entry":15.40,"position_pct":0.02}', datetime('now'), 0);

-- AGT-007 (MA Crossover)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT007-CLSK-ELEC-20260525-1659-CLSK', 'ELEC-20260525-1659-CLSK', 'AGT-007', 'BUY', 'HOLD', 0.55, 'MA5 slightly above MA20, mild bullish alignment. Small profit 3.70%. HOLD.', '{"close":15.97,"ma5_ma20":"mildly_bullish","profit_pct":3.70}', datetime('now'), 0);

-- AGT-008 (RSI)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT008-CLSK-ELEC-20260525-1659-CLSK', 'ELEC-20260525-1659-CLSK', 'AGT-008', 'BUY', 'HOLD', 0.55, 'RSI(14) around 55-60, neutral-bullish. No extreme. HOLD.', '{"rsi14":58}', datetime('now'), 0);
