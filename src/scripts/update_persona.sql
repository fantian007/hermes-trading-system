-- Update AGT-004 persona
INSERT OR REPLACE INTO agent_traits (agent_id, trait_key, trait_value, trait_type, confidence, sample_count)
VALUES ('AGT-004', 'learned_pitfall', 'SMCI: 前次HOLD票错判价格高于上轨。实际35.58低于37.09上轨,BBpct=87.4percent,挤压突破+持续扩张是强BUY信号。必须精确计算不轻信感觉。', 'PATTERN', 0.7, 2);
