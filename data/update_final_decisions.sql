-- Update final decisions based on weighted voting algorithm
-- All rounds: HOLD ratio > 0.50 holdRatioMax → HOLD

UPDATE election_rounds SET final_decision = 'HOLD', decision_confidence = 0.60 WHERE round_id = 'ELEC-20260525-1648';
UPDATE election_rounds SET final_decision = 'HOLD', decision_confidence = 0.60 WHERE round_id = 'ELEC-20260525-1658';
UPDATE election_rounds SET final_decision = 'HOLD', decision_confidence = 1.00 WHERE round_id = 'ELEC-20260525-1659';
UPDATE election_rounds SET final_decision = 'HOLD', decision_confidence = 1.00 WHERE round_id = 'ELEC-20260525-1659-META';
UPDATE election_rounds SET final_decision = 'HOLD', decision_confidence = 1.00 WHERE round_id = 'ELEC-20260525-1659-GOOGL';
UPDATE election_rounds SET final_decision = 'HOLD', decision_confidence = 1.00 WHERE round_id = 'ELEC-20260525-1659-CLSK';

SELECT round_id, symbol, total_voters, buy_votes, sell_votes, hold_votes, final_decision, decision_confidence FROM election_rounds WHERE round_id IN ('ELEC-20260525-1648','ELEC-20260525-1658','ELEC-20260525-1659','ELEC-20260525-1659-META','ELEC-20260525-1659-GOOGL','ELEC-20260525-1659-CLSK') ORDER BY round_id;
