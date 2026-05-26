"""
MarketTools — market data tools wrapping the longbridge CLI.

Provides functions to fetch quotes, kline data, positions, account info,
and place/cancel orders via the longbridge CLI with --format json output.
"""

import json
import subprocess
from typing import Optional


def _run_longbridge(args: list[str], timeout: int = 30) -> dict | list:
    """Run a longbridge CLI command and parse JSON output.

    Returns a dict (single object) or list (multiple objects).
    On error returns {"error": "..."}.
    """
    try:
        cmd = ["longbridge", "--format", "json"] + args
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            return {"error": stderr or f"longbridge exited with code {result.returncode}"}
        out = result.stdout.strip()
        if not out:
            return {"error": "empty response from longbridge"}
        parsed = json.loads(out)
        return parsed
    except json.JSONDecodeError as exc:
        return {"error": f"failed to parse longbridge JSON: {exc}"}
    except subprocess.TimeoutExpired:
        return {"error": "longbridge command timed out"}
    except FileNotFoundError:
        return {"error": "longbridge CLI not found — is it installed?"}
    except Exception as exc:
        return {"error": str(exc)}


class MarketTools:
    """Market data and trading tools via longbridge CLI."""

    @staticmethod
    def get_quote(symbol: str) -> dict:
        """Fetch real-time quote for a symbol.

        Example symbol: TSLA.US, 700.HK, BTCUSD.HAS
        """
        result = _run_longbridge(["quote", symbol])
        if isinstance(result, list):
            return result[0] if result else {"error": "no quote data"}
        return result

    @staticmethod
    def get_kline(symbol: str, days: int = 30) -> list[dict]:
        """Fetch OHLCV candlestick data for the last N days."""
        result = _run_longbridge(["kline", symbol, "--count", str(days)])
        if isinstance(result, dict) and "error" in result:
            return [result]
        if isinstance(result, list):
            return result
        return [{"error": "unexpected response format"}]

    @staticmethod
    def get_positions() -> list[dict]:
        """Fetch current stock positions."""
        result = _run_longbridge(["positions"])
        if isinstance(result, dict) and "error" in result:
            return [result]
        if isinstance(result, list):
            return result
        return [{"error": "unexpected response format"}]

    @staticmethod
    def get_account() -> dict:
        """Fetch account asset overview (net assets, cash, buy power)."""
        result = _run_longbridge(["assets"])
        if isinstance(result, list):
            return result[0] if result else {"error": "no account data"}
        return result

    @staticmethod
    def list_orders() -> list[dict]:
        """List today's orders."""
        result = _run_longbridge(["order"])
        if isinstance(result, dict) and "error" in result:
            return [result]
        if isinstance(result, list):
            return result
        return [{"error": "unexpected response format"}]

    @staticmethod
    def place_order(
        symbol: str,
        side: str,
        quantity: int,
        order_type: str = "MO",
        price: Optional[float] = None,
    ) -> dict:
        """Submit a buy or sell order.

        Args:
            symbol: e.g. TSLA.US
            side: 'buy' or 'sell'
            quantity: number of shares
            order_type: 'MO' (market order, default), 'LO' (limit order)
            price: required for limit orders (LO)
        """
        if side.lower() not in ("buy", "sell"):
            return {"error": f"invalid side '{side}'; must be 'buy' or 'sell'"}

        sub_cmd = side.lower()
        args = ["order", sub_cmd, symbol, str(quantity)]
        if order_type.upper() == "LO":
            if price is None:
                return {"error": "price is required for limit orders (LO)"}
            args.extend(["--price", str(price)])

        # longbridge prompts for confirmation, bypass with --yes flag if available
        args.append("--yes")

        return _run_longbridge(args)

    @staticmethod
    def cancel_order(order_id: str) -> dict:
        """Cancel a pending order by ID."""
        result = _run_longbridge(["order", "cancel", order_id])
        if isinstance(result, list):
            return result[0] if result else {"error": f"failed to cancel order {order_id}"}
        return result
