-- Update NVDA round counts
UPDATE election_rounds SET 
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1658'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1658' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1658' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1658' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260525-1658';

-- Update MSFT round counts
UPDATE election_rounds SET 
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260525-1659';

-- Update META round counts
UPDATE election_rounds SET 
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-META'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-META' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-META' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-META' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260525-1659-META';

-- Update GOOGL round counts
UPDATE election_rounds SET 
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-GOOGL'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-GOOGL' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-GOOGL' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-GOOGL' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260525-1659-GOOGL';

-- Update CLSK round counts
UPDATE election_rounds SET 
  total_voters = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-CLSK'),
  buy_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-CLSK' AND vote_direction = 'BUY'),
  sell_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-CLSK' AND vote_direction = 'SELL'),
  hold_votes = (SELECT COUNT(*) FROM agent_votes WHERE trade_id = 'ELEC-20260525-1659-CLSK' AND vote_direction = 'HOLD')
WHERE round_id = 'ELEC-20260525-1659-CLSK';
