"""
Test script for Redis and RapidAPI client setup.
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

from app.core.redis import get_redis, cache_set, cache_get, close_redis
from app.external_apis.rapidapi_client import RapidAPIClient
from app.core.config import settings


def test_redis():
    """Test Redis connection and caching."""
    print("\n" + "=" * 60)
    print("🔴 TESTING REDIS")
    print("=" * 60)
    
    try:
        redis = get_redis()
        print(f"✅ Redis connected: {settings.REDIS_URL}")
        
        # Test cache operations
        test_data = {"sport": "football", "league_id": 39}
        
        cache_set("test_key", test_data, ttl_seconds=60)
        print("✅ Cache set: test_key")
        
        retrieved = cache_get("test_key")
        print(f"✅ Cache get: {retrieved}")
        
        assert retrieved == test_data, "Cached data mismatch!"
        print("✅ Cache verification passed")
        
    except Exception as e:
        print(f"❌ Redis test failed: {e}")
        return False
    
    return True


def test_rapidapi_client():
    """Test RapidAPI client initialization."""
    print("\n" + "=" * 60)
    print("🌐 TESTING RAPIDAPI CLIENT")
    print("=" * 60)
    
    try:
        # Create a client instance
        client = RapidAPIClient(
            api_key=settings.RAPIDAPI_FOOTBALL_KEY,
            api_host=settings.RAPIDAPI_FOOTBALL_HOST,
            timeout=10,
            cache_ttl=300,
        )
        print(f"✅ RapidAPI client initialized")
        print(f"   - Host: {client.api_host}")
        print(f"   - Cache TTL: {client.cache_ttl}s")
        print(f"   - Timeout: {client.timeout}s")
        
        # Verify headers are set
        assert "X-RapidAPI-Key" in client._client.headers
        assert "X-RapidAPI-Host" in client._client.headers
        print("✅ Headers configured correctly")
        
        client.close()
        print("✅ Client closed")
        
    except Exception as e:
        print(f"❌ RapidAPI client test failed: {e}")
        return False
    
    return True


def main():
    """Run all tests."""
    print("\n🚀 TESTING REDIS + RAPIDAPI CLIENT SETUP\n")
    
    tests = [
        ("Redis", test_redis),
        ("RapidAPI Client", test_rapidapi_client),
    ]
    
    results = {}
    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print(f"❌ Unexpected error in {name}: {e}")
            results[name] = False
    
    # Close Redis connection
    close_redis()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    for name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{name}: {status}")
    
    all_passed = all(results.values())
    print("=" * 60)
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED!\n")
        return 0
    else:
        print("\n❌ SOME TESTS FAILED\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
