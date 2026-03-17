"""
Shared RapidAPI HTTP client with caching and retry logic.

Provides a unified client for all RapidAPI-based sports APIs:
  - Sets X-RapidAPI-Key and X-RapidAPI-Host headers
  - Handles retries with exponential backoff
  - Caches responses in Redis (configurable TTL)
  - Rate-limit friendly with delays
  - Automatic JSON parsing
"""

import logging
import time
from typing import Optional, Any, Dict
from urllib.parse import urlencode

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from app.core.config import settings
from app.core.redis import cache_get, cache_set

logger = logging.getLogger(__name__)

# Default cache TTL in seconds (5 minutes)
DEFAULT_CACHE_TTL = 300

# Rate limit delay in seconds (between requests)
RATE_LIMIT_DELAY = 0.5


class RapidAPIClient:
    """
    Shared HTTP client for RapidAPI endpoints.
    
    Features:
      - Automatic header injection (X-RapidAPI-Key, X-RapidAPI-Host)
      - Redis-based response caching
      - Retry logic with exponential backoff
      - Rate-limit friendly delays
      - JSON parsing + error handling
    """

    def __init__(
        self,
        api_key: str,
        api_host: str,
        timeout: int = 10,
        cache_ttl: int = DEFAULT_CACHE_TTL,
    ):
        """
        Initialize the RapidAPI client.
        
        Args:
            api_key: RapidAPI key (X-RapidAPI-Key header)
            api_host: RapidAPI host domain (X-RapidAPI-Host header)
            timeout: Request timeout in seconds
            cache_ttl: Cache time-to-live in seconds (0 = no cache)
        """
        self.api_key = api_key
        self.api_host = api_host
        self.timeout = timeout
        self.cache_ttl = cache_ttl
        
        # Shared HTTP client with connection pooling
        self._client = httpx.Client(
            timeout=timeout,
            headers={
                "X-RapidAPI-Key": api_key,
                "X-RapidAPI-Host": api_host,
            },
        )

    def __del__(self):
        """Clean up HTTP client on garbage collection."""
        try:
            self._client.close()
        except Exception:
            pass

    def _generate_cache_key(self, method: str, url: str, params: Optional[Dict] = None) -> str:
        """
        Generate a cache key from request details.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: Request URL
            params: Query parameters dict
            
        Returns:
            Cache key string
        """
        param_str = urlencode(params) if params else ""
        return f"api:{self.api_host}:{method}:{url}?{param_str}"

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        before_sleep=lambda retry_state: logger.warning(
            f"⚠️  Retrying request (attempt {retry_state.attempt_number}/3)..."
        ),
    )
    def _request_with_retry(
        self,
        method: str,
        url: str,
        **kwargs,
    ) -> httpx.Response:
        """
        Make HTTP request with automatic retry logic.
        
        Args:
            method: HTTP method
            url: Full URL
            **kwargs: Additional httpx arguments (params, json, etc.)
            
        Returns:
            httpx.Response object
        """
        response = self._client.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    def get(
        self,
        url: str,
        params: Optional[Dict[str, Any]] = None,
        cache_ttl: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Make a GET request with optional caching.
        
        Args:
            url: Endpoint URL (relative to host or absolute)
            params: Query parameters
            cache_ttl: Override default cache TTL (None = use instance default)
            
        Returns:
            Parsed JSON response as dict
            
        Raises:
            httpx.HTTPError: If request fails after retries
            ValueError: If response is not valid JSON
        """
        # Ensure URL is absolute
        if not url.startswith("http"):
            url = f"https://{self.api_host}{url}"

        # Determine TTL
        ttl = cache_ttl if cache_ttl is not None else self.cache_ttl

        # Try cache first
        if ttl > 0:
            cache_key = self._generate_cache_key("GET", url, params)
            cached = cache_get(cache_key)
            if cached is not None:
                logger.debug(f"✅ Cache hit for {url}")
                return cached

        # Make request
        logger.debug(f"📡 GET {url} (params: {params})")
        time.sleep(RATE_LIMIT_DELAY)  # Be rate-limit friendly
        
        response = self._request_with_retry("GET", url, params=params)
        data = response.json()

        # Cache response
        if ttl > 0:
            cache_set(cache_key, data, ttl)

        return data

    def post(
        self,
        url: str,
        json_data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        cache_ttl: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Make a POST request with optional caching.
        
        Args:
            url: Endpoint URL
            json_data: JSON body
            params: Query parameters
            cache_ttl: Override default cache TTL
            
        Returns:
            Parsed JSON response as dict
        """
        # Ensure URL is absolute
        if not url.startswith("http"):
            url = f"https://{self.api_host}{url}"

        # Try cache first (POST can be cached if idempotent)
        ttl = cache_ttl if cache_ttl is not None else self.cache_ttl
        if ttl > 0:
            cache_key = self._generate_cache_key("POST", url, params)
            cached = cache_get(cache_key)
            if cached is not None:
                logger.debug(f"✅ Cache hit for {url}")
                return cached

        # Make request
        logger.debug(f"📡 POST {url} (body: {json_data})")
        time.sleep(RATE_LIMIT_DELAY)
        
        response = self._request_with_retry(
            "POST", url, json=json_data, params=params
        )
        data = response.json()

        # Cache response
        if ttl > 0:
            cache_set(cache_key, data, ttl)

        return data

    def get_raw(self, url: str, **kwargs) -> httpx.Response:
        """
        Make a raw GET request without caching or JSON parsing.
        
        Args:
            url: Endpoint URL
            **kwargs: Additional httpx arguments
            
        Returns:
            Raw httpx.Response object
        """
        if not url.startswith("http"):
            url = f"https://{self.api_host}{url}"

        logger.debug(f"📡 GET (raw) {url}")
        time.sleep(RATE_LIMIT_DELAY)
        
        return self._request_with_retry("GET", url, **kwargs)

    def close(self):
        """Close the underlying HTTP client."""
        self._client.close()
