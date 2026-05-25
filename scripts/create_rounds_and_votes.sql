-- ============================================================
-- Batch: Create election rounds + votes for MSFT, META, GOOGL
-- Date: 2026-05-26
-- Trigger: Daily position review (仓位审查)
-- ============================================================

-- ============ MSFT.US ============
-- Round: ELEC-20260526-0104-MSFT
-- Current: $418.57, 30 shares, -0.08%, 14.40% portfolio

INSERT INTO election_rounds (round_id, symbol, total_voters, buy_votes, sell_votes, hold_votes, final_decision, decision_confidence, resulted_trade_id, created_at)
SELECT 'ELEC-20260526-0104-MSFT', 'MSFT.US', 0, 0, 0, 0, 'HOLD', 0.0, NULL, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM election_rounds WHERE round_id = 'ELEC-20260526-0104-MSFT');

-- AGT-004 (BB): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-MSFT-AGT004-0104', 'ELEC-20260526-0104-MSFT', 'AGT-004', 'BUY', 'HOLD', 0.65,
'BB(20,2): MSFT @ $418.57. %B neutral zone analysis - need price data. Position 14.40% within limits. No extreme band touch. HOLD: neutral zone, maintain position.',
'{"strategy":"BollingerBands","symbol":"MSFT.US","price":418.57,"vote":"HOLD","confidence":0.65,"position_pct":14.40,"reason":"position_review_no_signal"}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-MSFT-AGT004-0104');

-- AGT-005 (Turtle): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-MSFT-AGT005-0104', 'ELEC-20260526-0104-MSFT', 'AGT-005', 'BUY', 'HOLD', 0.6,
'Turtle: MSFT @ $418.57. No Donchian breakout signal. Position 30 shares @ $418.89, -0.08% breakeven. 14.40% portfolio weight moderate. No exit trigger. HOLD maintain.',
'{"strategy":"Turtle","symbol":"MSFT.US","price":418.57,"cost":418.89,"vote":"HOLD","confidence":0.6,"position_pct":14.40,"pnl_pct":-0.08}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-MSFT-AGT005-0104');

-- AGT-007 (MA Crossover): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-MSFT-AGT007-0104', 'ELEC-20260526-0104-MSFT', 'AGT-007', 'BUY', 'HOLD', 0.65,
'MA Crossover: MSFT @ $418.57 near cost basis $418.89. No golden/death cross signal. Mid-term trend neutral. 14.40% portfolio weight moderate. HOLD maintain.',
'{"strategy":"MACrossover","symbol":"MSFT.US","price":418.57,"cost":418.89,"vote":"HOLD","confidence":0.65,"position_pct":14.40,"pnl_pct":-0.08}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-MSFT-AGT007-0104');

-- strategy-01 (Lead): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-MSFT-STRATEGY01-0104', 'ELEC-20260526-0104-MSFT', 'strategy-01', 'BUY', 'HOLD', 0.6,
'Strategy Lead: MSFT $418.57 breakeven. No divergence among strategies (all HOLD). 14.40% portfolio weight within 20% limit. Maintain position.',
'{"role":"strategy_lead","symbol":"MSFT.US","price":418.57,"vote":"HOLD","confidence":0.6,"position_pct":14.40,"consensus":"unanimous_HOLD"}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-MSFT-STRATEGY01-0104');

-- Update MSFT round counts
UPDATE election_rounds SET
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-MSFT'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-MSFT' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-MSFT' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-MSFT' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260526-0104-MSFT';


-- ============ META.US ============
-- Round: ELEC-20260526-0104-META
-- Current: $610.26, 20 shares, +0.03%, 13.99% portfolio

INSERT INTO election_rounds (round_id, symbol, total_voters, buy_votes, sell_votes, hold_votes, final_decision, decision_confidence, resulted_trade_id, created_at)
SELECT 'ELEC-20260526-0104-META', 'META.US', 0, 0, 0, 0, 'HOLD', 0.0, NULL, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM election_rounds WHERE round_id = 'ELEC-20260526-0104-META');

-- AGT-004 (BB): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-META-AGT004-0104', 'ELEC-20260526-0104-META', 'AGT-004', 'BUY', 'HOLD', 0.65,
'BB(20,2): META @ $610.26 breakeven. No band touch or squeeze signal. 13.99% portfolio moderate. HOLD maintain.',
'{"strategy":"BollingerBands","symbol":"META.US","price":610.26,"vote":"HOLD","confidence":0.65,"position_pct":13.99,"reason":"position_review_no_signal"}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-META-AGT004-0104');

-- AGT-005 (Turtle): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-META-AGT005-0104', 'ELEC-20260526-0104-META', 'AGT-005', 'BUY', 'HOLD', 0.6,
'Turtle: META @ $610.26 breakeven. No Donchian breakout. 20 shares @ $610.06, +0.03%. 13.99% weight moderate. HOLD maintain.',
'{"strategy":"Turtle","symbol":"META.US","price":610.26,"cost":610.06,"vote":"HOLD","confidence":0.6,"position_pct":13.99,"pnl_pct":0.03}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-META-AGT005-0104');

-- AGT-007 (MA Crossover): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-META-AGT007-0104', 'ELEC-20260526-0104-META', 'AGT-007', 'BUY', 'HOLD', 0.65,
'MA Crossover: META @ $610.26 breakeven. No crossover signal. 13.99% weight moderate. HOLD maintain.',
'{"strategy":"MACrossover","symbol":"META.US","price":610.26,"cost":610.06,"vote":"HOLD","confidence":0.65,"position_pct":13.99,"pnl_pct":0.03}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-META-AGT007-0104');

-- strategy-01 (Lead): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-META-STRATEGY01-0104', 'ELEC-20260526-0104-META', 'strategy-01', 'BUY', 'HOLD', 0.6,
'Strategy Lead: META $610.26 breakeven, all strategies HOLD. 13.99% weight within limits. Maintain.',
'{"role":"strategy_lead","symbol":"META.US","price":610.26,"vote":"HOLD","confidence":0.6,"position_pct":13.99,"consensus":"unanimous_HOLD"}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-META-STRATEGY01-0104');

-- Update META round counts
UPDATE election_rounds SET
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-META'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-META' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-META' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-META' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260526-0104-META';


-- ============ GOOGL.US ============
-- Round: ELEC-20260526-0104-GOOGL
-- Current: $382.97, 12 shares, -0.99%, 5.27% portfolio

INSERT INTO election_rounds (round_id, symbol, total_voters, buy_votes, sell_votes, hold_votes, final_decision, decision_confidence, resulted_trade_id, created_at)
SELECT 'ELEC-20260526-0104-GOOGL', 'GOOGL.US', 0, 0, 0, 0, 'HOLD', 0.0, NULL, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM election_rounds WHERE round_id = 'ELEC-20260526-0104-GOOGL');

-- AGT-004 (BB): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-GOOGL-AGT004-0104', 'ELEC-20260526-0104-GOOGL', 'AGT-004', 'BUY', 'HOLD', 0.7,
'BB(20,2): GOOGL @ $382.97, -0.99% minor loss. 5.27% low weight. No band signal. HOLD maintain.',
'{"strategy":"BollingerBands","symbol":"GOOGL.US","price":382.97,"vote":"HOLD","confidence":0.7,"position_pct":5.27,"reason":"position_review_no_signal"}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-GOOGL-AGT004-0104');

-- AGT-005 (Turtle): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-GOOGL-AGT005-0104', 'ELEC-20260526-0104-GOOGL', 'AGT-005', 'BUY', 'HOLD', 0.65,
'Turtle: GOOGL @ $382.97, 12 shares @ $386.80, -0.99%. No breakout. 5.27% low weight. HOLD maintain.',
'{"strategy":"Turtle","symbol":"GOOGL.US","price":382.97,"cost":386.80,"vote":"HOLD","confidence":0.65,"position_pct":5.27,"pnl_pct":-0.99}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-GOOGL-AGT005-0104');

-- AGT-007 (MA Crossover): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-GOOGL-AGT007-0104', 'ELEC-20260526-0104-GOOGL', 'AGT-007', 'BUY', 'HOLD', 0.7,
'MA Crossover: GOOGL @ $382.97, -0.99% minor. No crossover signal. 5.27% low weight. HOLD maintain.',
'{"strategy":"MACrossover","symbol":"GOOGL.US","price":382.97,"cost":386.80,"vote":"HOLD","confidence":0.7,"position_pct":5.27,"pnl_pct":-0.99}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-GOOGL-AGT007-0104');

-- strategy-01 (Lead): HOLD
INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, raw_analysis, voted_at, is_shadow)
SELECT 'VOTE-GOOGL-STRATEGY01-0104', 'ELEC-20260526-0104-GOOGL', 'strategy-01', 'BUY', 'HOLD', 0.65,
'Strategy Lead: GOOGL $382.97, -0.99% minor loss. All strategies HOLD. 5.27% low weight. Maintain.',
'{"role":"strategy_lead","symbol":"GOOGL.US","price":382.97,"vote":"HOLD","confidence":0.65,"position_pct":5.27,"consensus":"unanimous_HOLD"}',
datetime('now'), 0
WHERE NOT EXISTS (SELECT 1 FROM agent_votes WHERE vote_id = 'VOTE-GOOGL-STRATEGY01-0104');

-- Update GOOGL round counts
UPDATE election_rounds SET
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-GOOGL'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-GOOGL' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-GOOGL' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260526-0104-GOOGL' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260526-0104-GOOGL';
