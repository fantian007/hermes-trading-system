"""
Base strategy class for all trading strategy perspectives.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any


class BaseStrategy(ABC):
    """Abstract base class for all trading strategies."""

    name: str = "BaseStrategy"
    category: str = "generic"

    def __init__(self):
        if not hasattr(self.__class__, "__abstractmethods__"):
            self.name = getattr(self.__class__, "name", "BaseStrategy")
            self.category = getattr(self.__class__, "category", "generic")

    @abstractmethod
    def execute(self, symbol: str, price_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the strategy and generate a trading signal.

        Args:
            symbol: Trading symbol (e.g., "AAPL", "BTC-USD")
            price_data: Dictionary containing price/time series with keys:
                - "close": list of float closing prices (newest last)
                - "open": list of float opening prices
                - "high": list of float high prices
                - "low": list of float low prices
                - "volume": list of float volumes
                All lists should have the same length, ordered oldest first.

        Returns:
            dict: {
                "direction": "BUY" | "SELL" | "HOLD",
                "confidence": float between 0.0 and 1.0,
                "reasoning": str explaining the signal
            }
        """
        pass
