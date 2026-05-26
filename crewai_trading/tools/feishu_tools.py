"""
FeishuTools — Feishu (Lark) notification tools.

Sends messages via the Feishu Open API.
Requires FEISHU_WEBHOOK_URL or app credentials configured via environment variables.
"""

import json
import os
from typing import Optional

try:
    import requests as _requests

    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class FeishuTools:
    """Feishu notification tools for sending messages."""

    @staticmethod
    def send_message(text: str, webhook_url: Optional[str] = None) -> dict:
        """Send a text message to a Feishu webhook or via the Open API.

        Args:
            text: The message content to send.
            webhook_url: Optional webhook URL. Falls back to
                FEISHU_WEBHOOK_URL environment variable.

        Returns:
            dict with status info or error.
        """
        url = webhook_url or os.environ.get("FEISHU_WEBHOOK_URL")
        if not url:
            return {"error": "no webhook URL provided; set FEISHU_WEBHOOK_URL env var or pass webhook_url"}

        if not HAS_REQUESTS:
            return {"error": "requests library is required for feishu notifications"}

        payload = {
            "msg_type": "text",
            "content": {"text": text},
        }

        try:
            resp = _requests.post(
                url,
                json=payload,
                timeout=15,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 0:
                return {
                    "error": f"Feishu API error: {data.get('msg', 'unknown')}",
                    "code": data.get("code"),
                }
            return {
                "status": "ok",
                "message_id": data.get("data", {}).get("message_id"),
            }
        except Exception as exc:
            return {"error": str(exc)}
