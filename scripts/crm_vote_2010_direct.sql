INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by, status, created_at)
VALUES ('ELEC-20260526-2010-CRM', 'CRM.US', 'LONG', 180.07, 0, 'ELEC-20260526-2010', 'CANCELLED', datetime('now'));

INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, voted_at)
VALUES ('VOTE-ELEC-20260526-2010-AGT-002', 'ELEC-20260526-2010-CRM', 'AGT-002', 'BUY', 'HOLD', 0.70, 'MACD多头但靠近零轴，SMA20死叉SMA50形成中期压制，价格在两均线间方向不明。', datetime('now'));

INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, voted_at)
VALUES ('VOTE-ELEC-20260526-2010-AGT-004', 'ELEC-20260526-2010-CRM', 'AGT-004', 'BUY', 'HOLD', 0.65, '布林带中轨附近55-60%位置，带宽正常无极端信号。', datetime('now'));

INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, voted_at)
VALUES ('VOTE-ELEC-20260526-2010-AGT-005', 'ELEC-20260526-2010-CRM', 'AGT-005', 'BUY', 'HOLD', 0.60, '未突破20日唐奇安通道，盘中冲高遇SMA50阻力回落。', datetime('now'));

INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, voted_at)
VALUES ('VOTE-ELEC-20260526-2010-AGT-007', 'ELEC-20260526-2010-CRM', 'AGT-007', 'BUY', 'HOLD', 0.55, 'MA5/20金叉刚形成但冲高回落成交量未确认。', datetime('now'));

INSERT INTO agent_votes (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning, voted_at)
VALUES ('VOTE-ELEC-20260526-2010-AGT-008', 'ELEC-20260526-2010-CRM', 'AGT-008', 'BUY', 'HOLD', 0.70, 'RSI(14)~43-45中性区，无超买无超卖无背离。', datetime('now'));

UPDATE election_rounds SET total_voters=5, buy_votes=0, sell_votes=0, hold_votes=5, final_decision='HOLD', decision_confidence=0.64, resulted_trade_id='ELEC-20260526-2010-CRM', executed_at=datetime('now') WHERE round_id='ELEC-20260526-2010';
