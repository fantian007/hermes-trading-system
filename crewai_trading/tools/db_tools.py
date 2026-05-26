"""
DbTools — SQLite database tools for the Hermes trading system.

Connects to data/trading.db (WAL mode) and provides CRUD operations
for positions, accounts, stock pool, signals, elections, votes, and trades.
"""

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


DB_PATH = Path(__file__).resolve().parents[2] / "data" / "trading.db"


def _get_db() -> sqlite3.Connection:
    """Open a connection to trading.db with WAL mode enabled."""
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db


def _row_to_dict(row: sqlite3.Row | None) -> dict:
    """Convert a sqlite3.Row to a plain dict, or return an empty dict."""
    if row is None:
        return {}
    return dict(row)


def _rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict]:
    """Convert a list of sqlite3.Row to a list of plain dicts."""
    return [dict(r) for r in rows]


class DbTools:
    """SQLite database tools for reading and writing trading data."""

    # ── Positions ────────────────────────────────────────────────

    @staticmethod
    def get_positions() -> list[dict]:
        """Return all open positions from the trades table."""
        try:
            db = _get_db()
            rows = db.execute(
                """
                SELECT trade_id, symbol, direction, buy_price, quantity,
                       buy_time, status, created_at
                FROM trades
                WHERE status = 'OPEN'
                ORDER BY created_at DESC
                """
            ).fetchall()
            return _rows_to_dicts(rows)
        except Exception as exc:
            return [{"error": str(exc)}]
        finally:
            db.close()

    # ── Account ──────────────────────────────────────────────────

    @staticmethod
    def get_account() -> dict:
        """Return a summary of account assets from daily_ledger (latest entry)."""
        try:
            db = _get_db()
            row = db.execute(
                """
                SELECT date, trade_count, total_pnl, peak_equity,
                       trough_equity, max_drawdown, updated_at
                FROM daily_ledger
                ORDER BY date DESC
                LIMIT 1
                """
            ).fetchone()
            result = _row_to_dict(row)
            if not result:
                return {"error": "no ledger data found"}
            return result
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()

    # ── Stock Pool ───────────────────────────────────────────────

    @staticmethod
    def get_pool(status: str = "ACTIVE") -> list[dict]:
        """Return stock pool entries filtered by status."""
        try:
            db = _get_db()
            rows = db.execute(
                """
                SELECT symbol, signal_type, strength, source, reason,
                       source_url, agent_id, status, added_at, removed_at
                FROM stock_pool
                WHERE status = ?
                ORDER BY added_at DESC
                """,
                (status,),
            ).fetchall()
            return _rows_to_dicts(rows)
        except Exception as exc:
            return [{"error": str(exc)}]
        finally:
            db.close()

    # ── Signals ──────────────────────────────────────────────────

    @staticmethod
    def add_signal(
        symbol: str,
        signal_type: str,
        strength: int,
        source: str,
        reason: str,
        agent_id: str,
    ) -> dict:
        """Insert a new signal into the stock_pool table.

        signal_type must be 'BULLISH' or 'BEARISH'.
        strength must be between 1 and 5.
        """
        signal_type_upper = signal_type.upper()
        if signal_type_upper not in ("BULLISH", "BEARISH"):
            return {"error": f"invalid signal_type '{signal_type}'; must be BULLISH or BEARISH"}
        if not 1 <= strength <= 5:
            return {"error": f"strength {strength} out of range; must be 1-5"}
        try:
            db = _get_db()
            db.execute(
                """
                INSERT INTO stock_pool (symbol, signal_type, strength, source, reason, agent_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (symbol, signal_type_upper, strength, source, reason, agent_id),
            )
            db.commit()
            return {"status": "ok", "symbol": symbol, "signal_type": signal_type_upper}
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()

    @staticmethod
    def remove_signal(symbol: str, reason: str) -> dict:
        """Mark a signal as REMOVED in the stock_pool table."""
        try:
            db = _get_db()
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            db.execute(
                """
                UPDATE stock_pool
                SET status = 'REMOVED', removed_at = ?, reason = ?
                WHERE symbol = ? AND status = 'ACTIVE'
                """,
                (now, reason, symbol),
            )
            db.commit()
            changes = db.total_changes
            if changes == 0:
                return {"error": f"no active signal found for {symbol}"}
            return {"status": "ok", "symbol": symbol, "affected": changes}
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()

    # ── Election / Voting ────────────────────────────────────────

    @staticmethod
    def create_round(symbol: str, total_voters: int) -> str:
        """Create a new election round and return the round_id."""
        round_id = str(uuid.uuid4())
        try:
            db = _get_db()
            db.execute(
                """
                INSERT INTO election_rounds (round_id, symbol, total_voters)
                VALUES (?, ?, ?)
                """,
                (round_id, symbol, total_voters),
            )
            db.commit()
            return round_id
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()

    @staticmethod
    def write_vote(
        round_id: str,
        agent_id: str,
        vote: str,
        confidence: float,
        reasoning: str,
    ) -> dict:
        """Record an agent's vote for a given round."""
        try:
            db = _get_db()

            # Verify round exists
            round_row = db.execute(
                "SELECT round_id, symbol, total_voters FROM election_rounds WHERE round_id = ?",
                (round_id,),
            ).fetchone()
            if not round_row:
                return {"error": f"round {round_id} not found"}

            vote_upper = vote.upper()
            if vote_upper not in ("BUY", "SELL", "HOLD"):
                return {"error": f"invalid vote '{vote}'; must be BUY, SELL, or HOLD"}

            # vote_node is the debate tree node (BUY/SELL side the agent argues for)
            # vote_direction is the actual vote direction
            vote_node = "BUY" if vote_upper in ("BUY", "HOLD") else "SELL"

            # Map vote to election_rounds counter column
            col_map = {"BUY": "buy_votes", "SELL": "sell_votes", "HOLD": "hold_votes"}
            col_name = col_map[vote_upper]

            # Ensure a placeholder trade exists for FK constraint
            round_data = dict(round_row)
            existing_trade = db.execute(
                "SELECT trade_id FROM trades WHERE trade_id = ?", (round_id,)
            ).fetchone()
            if not existing_trade:
                now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                db.execute(
                    """
                    INSERT INTO trades (trade_id, symbol, direction, buy_price, quantity, approved_by, status, created_at)
                    VALUES (?, ?, 'LONG', 0.0, 0, ?, 'CANCELLED', ?)
                    """,
                    (round_id, round_data["symbol"], round_id, now),
                )

            # Insert into agent_votes (trade_id references round_id for voting context)
            vote_id = f"VOTE-{round_id}-{agent_id}"
            db.execute(
                """
                INSERT OR REPLACE INTO agent_votes
                    (vote_id, trade_id, agent_id, vote_node, vote_direction, confidence, reasoning)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (vote_id, round_id, agent_id, vote_node, vote_upper, confidence, reasoning),
            )

            # Update election_rounds counter
            db.execute(
                f"UPDATE election_rounds SET {col_name} = {col_name} + 1 WHERE round_id = ?",
                (round_id,),
            )
            db.commit()
            return {"status": "ok", "vote_id": vote_id}
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()

    @staticmethod
    def aggregate_votes(round_id: str) -> dict:
        """Aggregate votes for a round and compute weighted statistics."""
        try:
            db = _get_db()
            round_row = db.execute(
                "SELECT * FROM election_rounds WHERE round_id = ?",
                (round_id,),
            ).fetchone()
            if not round_row:
                return {"error": f"round {round_id} not found"}
            round_data = dict(round_row)

            votes = db.execute(
                """
                SELECT vote_direction, confidence, reasoning, agent_id
                FROM agent_votes
                WHERE trade_id = ?
                """,
                (round_id,),
            ).fetchall()

            total_voters = round_data["total_voters"]
            buy_votes = round_data["buy_votes"]
            sell_votes = round_data["sell_votes"]
            hold_votes = round_data["hold_votes"]

            # Weighted confidence
            total_confidence = 0.0
            weight_sum = 0.0
            for v in votes:
                row = dict(v)
                total_confidence += row["confidence"]
                weight_sum += 1.0

            avg_confidence = total_confidence / weight_sum if weight_sum > 0 else 0.0

            # Determine final decision by majority
            vote_counts = {"BUY": buy_votes, "SELL": sell_votes, "HOLD": hold_votes}
            max_votes = max(vote_counts.values())
            winners = [k for k, v in vote_counts.items() if v == max_votes]
            final_decision = winners[0] if len(winners) == 1 else "HOLD"

            # Update round with final decision
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            db.execute(
                """
                UPDATE election_rounds
                SET final_decision = ?, decision_confidence = ?, executed_at = ?
                WHERE round_id = ?
                """,
                (final_decision, avg_confidence, now, round_id),
            )
            db.commit()

            return {
                "round_id": round_id,
                "symbol": round_data["symbol"],
                "total_voters": total_voters,
                "buy_votes": buy_votes,
                "sell_votes": sell_votes,
                "hold_votes": hold_votes,
                "final_decision": final_decision,
                "decision_confidence": round(avg_confidence, 4),
                "vote_details": _rows_to_dicts(votes),
            }
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()

    # ── Trades ───────────────────────────────────────────────────

    @staticmethod
    def get_trades(status: Optional[str] = None) -> list[dict]:
        """Return trades, optionally filtered by status (OPEN / CLOSED)."""
        try:
            db = _get_db()
            if status:
                rows = db.execute(
                    """
                    SELECT * FROM trades
                    WHERE status = ?
                    ORDER BY created_at DESC
                    """,
                    (status,),
                ).fetchall()
            else:
                rows = db.execute(
                    """
                    SELECT * FROM trades
                    ORDER BY created_at DESC
                    """
                ).fetchall()
            return _rows_to_dicts(rows)
        except Exception as exc:
            return [{"error": str(exc)}]
        finally:
            db.close()

    @staticmethod
    def write_trade(
        symbol: str,
        direction: str,
        quantity: int,
        price: float,
        round_id: str,
    ) -> str:
        """Create a new trade record and return the trade_id."""
        trade_id = str(uuid.uuid4())
        try:
            db = _get_db()
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            db.execute(
                """
                INSERT INTO trades (trade_id, symbol, direction, quantity, buy_price, approved_by, buy_time, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (trade_id, symbol, direction, quantity, price, round_id, now, now),
            )
            # Link trade back to election round
            db.execute(
                "UPDATE election_rounds SET resulted_trade_id = ? WHERE round_id = ?",
                (trade_id, round_id),
            )
            db.commit()
            return trade_id
        except Exception as exc:
            return {"error": str(exc)}
        finally:
            db.close()
