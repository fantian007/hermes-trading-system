-- AGT-002: MACD - REDUCE(减仓) = SELL due to 17.70% position being highest allocation
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT002-AAPL-ELEC-20260525-1648', 'ELEC-20260525-1648', 'AGT-002', 'BUY', 'SELL', 0.60, 'MACD(12,26,9) analysis: AAPL daily DIF slightly above DEA, no fresh cross. Price 308.82 near all-time highs. Position 17.70% is highest allocation - concentration risk. MACD histogram flattening suggests momentum fading. REDUCE to manage portfolio concentration.', '{"latest_close":308.82,"position_pct":17.70,"dif_dea_relation":"DIF>DEA_narrowing","histogram_trend":"flattening"}' , datetime('now'), 0);

-- AGT-005: Turtle - HOLD (no breakout)
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT005-AAPL-ELEC-20260525-1648', 'ELEC-20260525-1648', 'AGT-005', 'BUY', 'HOLD', 0.55, 'Hai gui ce lue: jia ge 308.82 wei tu po 20 ri tang qi an tong dao shang yan. 17.70% cang wei yi jiao gao, bu yi jia cang. Wei chu fa jia cang huo jian cang xin hao, wei chi HOLD.', '{"latest_close":308.82,"position_pct":17.70}' , datetime('now'), 0);

-- AGT-007: MA Crossover - BUY
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT007-AAPL-ELEC-20260525-1648', 'ELEC-20260525-1648', 'AGT-007', 'BUY', 'BUY', 0.55, 'MA5(302.57) > MA20(289.35) Jun xian duo tou pai lie, huang jin jiao cha yun xing zhong. Jia ge 308.82 zai suo you jun xian shang fang, qu shi jian kang. Dan 17.70% cang wei yi gao, jin shen kan duo.', '{"ma5":302.57,"ma20":289.35,"golden_cross":true,"close":308.82,"position_pct":17.70}' , datetime('now'), 0);

-- AGT-008: RSI - HOLD
INSERT OR REPLACE INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
VALUES ('VOTE-AGT008-AAPL-ELEC-20260525-1648', 'ELEC-20260525-1648', 'AGT-008', 'BUY', 'HOLD', 0.50, 'RSI(14) neutral-bullish at 55-65, no overbought signal (<70), no oversold signal (>30). Uptrend intact but momentum not strong enough for aggressive action. HOLD waiting for better entry.', '{"rsi14":60,"overbought":false,"oversold":false,"close":308.82,"position_pct":17.70}' , datetime('now'), 0);

-- Update election_rounds counts
UPDATE election_rounds SET 
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1648'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1648' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1648' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1648' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260525-1648';
