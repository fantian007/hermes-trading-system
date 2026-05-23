PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Fix 1: RAG-0001 role correction
UPDATE agents SET 
  agent_name = 'Review Leader',
  strategy_source = '',
  strategy_summary = 'Review department leader. Coordinates reviewer work, aggregates reports, and interfaces with HR. Does not participate in specific strategy reviews.',
  indicators = NULL
WHERE agent_id = 'RAG-0001';

-- Fix 2: RAG-006 to RAG-0006 (standardize ID format)
UPDATE agent_traits SET agent_id = 'RAG-0006' WHERE agent_id = 'RAG-006';
UPDATE agents SET 
  agent_id = 'RAG-0006',
  strategy_source = 'Technical Analysis of Stock Trends',
  strategy_summary = 'Review framework: MA crossover audit. Validates MA5/MA20 position relationship at trade timepoints to determine if entry/exit timing matches technical signals.',
  indicators = '["ma"]'
WHERE agent_id = 'RAG-006';

COMMIT;
PRAGMA foreign_keys = ON;
