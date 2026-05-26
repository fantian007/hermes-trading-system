"""
WebTools — network tools for web searches and news retrieval.
"""

import json
import urllib.parse
import urllib.request

try:
    import requests as _requests

    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


class WebTools:
    """Web search and news retrieval tools."""

    @staticmethod
    def search_news(query: str, max_results: int = 10) -> list[dict]:
        """Search for news articles related to a query.

        Uses DuckDuckGo's instant answer API (free, no API key needed).

        Returns a list of dicts with keys like 'title', 'url', 'snippet', 'source'.
        """
        try:
            encoded_query = urllib.parse.quote(query)
            url = f"https://api.duckduckgo.com/?q={encoded_query}&format=json&no_html=1&skip_disambig=1"

            if HAS_REQUESTS:
                resp = _requests.get(url, timeout=15)
                resp.raise_for_status()
                data = resp.json()
            else:
                req = urllib.request.Request(
                    url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                            "AppleWebKit/537.36 (KHTML, like Gecko) "
                            "Chrome/120.0.0.0 Safari/537.36"
                        )
                    },
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

            results = []
            abstract = data.get("AbstractText", "")
            abstract_source = data.get("AbstractSource", "")
            abstract_url = data.get("AbstractURL", "")
            if abstract:
                results.append(
                    {
                        "title": abstract_source or query,
                        "url": abstract_url,
                        "snippet": abstract,
                        "source": abstract_source,
                    }
                )

            related = data.get("RelatedTopics", [])
            for topic in related:
                if "Text" in topic and "FirstURL" in topic:
                    results.append(
                        {
                            "title": topic.get("Text", "").split(" - ")[0],
                            "url": topic.get("FirstURL", ""),
                            "snippet": topic.get("Text", ""),
                            "source": topic.get("Result", ""),
                        }
                    )
                if "Topics" in topic:
                    for sub in topic["Topics"]:
                        if "Text" in sub and "FirstURL" in sub:
                            results.append(
                                {
                                    "title": sub.get("Text", "").split(" - ")[0],
                                    "url": sub.get("FirstURL", ""),
                                    "snippet": sub.get("Text", ""),
                                    "source": sub.get("Result", ""),
                                }
                            )

            results_data = data.get("Results", [])
            for r in results_data:
                results.append(
                    {
                        "title": r.get("Text", "").split(" - ")[0],
                        "url": r.get("FirstURL", ""),
                        "snippet": r.get("Text", ""),
                        "source": r.get("Result", ""),
                    }
                )

            if not results:
                results.append(
                    {
                        "title": f"No results for '{query}'",
                        "url": "",
                        "snippet": "DuckDuckGo returned no results.",
                        "source": "",
                    }
                )

            return results[:max_results]

        except Exception as exc:
            return [{"error": str(exc)}]
