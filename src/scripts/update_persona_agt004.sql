import subprocess, sqlite3, json, os, sys

DB_PATH = "/Users/zys/workspace/hermes-trading-system/trading.db"
AGENT_ID = "AGT-004"

def update_persona(trait_key, trait_value, trait_type, confidence):
    sql = f"""
    INSERT INTO agent_persona (agent_id, trait_key, trait_value, trait_type, confidence, updated_at)
    VALUES ('{AGENT_ID}', '{trait_key}', '{json.dumps(trait_value) if isinstance(trait_value, list) else trait_value}', '{trait_type}', {confidence}, datetime('now'))
    ON CONFLICT(agent_id, trait_key) DO UPDATE SET
        trait_value = excluded.trait_value,
        trait_type = excluded.trait_type,
        confidence = excluded.confidence,
        updated_at = datetime('now');
    """
    conn = sqlite3.connect(DB_PATH)
    conn.execute(sql)
    conn.commit()
    conn.close()
    print(f"OK: {trait_key}")

# Record lessons learned
update_persona("learned_pitfall", "Terminal CWD损坏后所有shell命令不可用，需确保workspace目录存在并重启agent进程；分批分析应改为更小的批次避免单点故障", "PATTERN", 0.7)
update_persona("self_adjustments", json.dumps(["发现股池21只股票远超单次分析能力，需并行委托子agent；terminal损坏后及时上报给组长的升级流程正确"]), "HISTORY", 0.8)
update_persona("strength", "布林带挤压突破+带宽扩张形态识别准确，能从带宽历史趋势判断突破阶段", "PATTERN", 0.75)
