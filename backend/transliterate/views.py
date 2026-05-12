"""
English → Hindi transliteration proxy.

Calls Google Input Tools (undocumented but stable public endpoint) so the
React client never needs to touch a third-party origin from the browser —
avoids CORS, keeps the network surface inside our nginx, and lets us cache
hot tokens in Redis.

Endpoint shape:
  GET /api/transliterate/?q=namaste
  →   { "suggestions": ["नमस्ते", "नमस्तेय", "नमस्थे", ...] }

Cache: 24h per (script, token) in Django's default cache (Redis in prod).
Tokens are short and bounded; this hits the wire on cold lookups only.
"""

from __future__ import annotations

import logging

import requests
from django.core.cache import cache
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

GOOGLE_ENDPOINT  = 'https://inputtools.google.com/request'
DEFAULT_LANG_PAIR = 'hi-t-i0-und'   # English (Latin) → Hindi (Devanagari)
MAX_SUGGESTIONS  = 5
CACHE_TTL_SEC    = 60 * 60 * 24     # 24 hours
MAX_TOKEN_LEN    = 64
REQUEST_TIMEOUT  = 3.0              # seconds — fail fast on network hiccups


class TransliterateView(APIView):
    """Single GET endpoint — token in, ranked suggestion list out."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        token = (request.query_params.get('q') or '').strip()
        if not token:
            return Response({'suggestions': []})

        if len(token) > MAX_TOKEN_LEN:
            return Response({'suggestions': []})

        cache_key = f'translit:hi:{token.lower()}'
        cached = cache.get(cache_key)
        if cached is not None:
            return Response({'suggestions': cached, 'cached': True})

        suggestions = self._fetch(token)
        cache.set(cache_key, suggestions, CACHE_TTL_SEC)
        return Response({'suggestions': suggestions, 'cached': False})

    @staticmethod
    def _fetch(token: str) -> list[str]:
        params = {
            'text': token,
            'itc':  DEFAULT_LANG_PAIR,
            'num':  MAX_SUGGESTIONS,
            'cp':   0,
            'cs':   1,
            'ie':   'utf-8',
            'oe':   'utf-8',
        }
        try:
            resp = requests.get(GOOGLE_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException:
            logger.warning('Transliterate upstream failed for token=%r', token, exc_info=True)
            return []
        except ValueError:
            logger.warning('Transliterate upstream returned non-JSON for token=%r', token)
            return []

        # Response shape: ["SUCCESS", [[<src>, [<sugg1>, <sugg2>, ...], ...]], ...]
        if not isinstance(data, list) or len(data) < 2 or data[0] != 'SUCCESS':
            return []
        try:
            return list(data[1][0][1])[:MAX_SUGGESTIONS]
        except (IndexError, TypeError):
            return []
