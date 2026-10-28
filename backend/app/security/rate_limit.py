from datetime import datetime, timezone, timedelta
from collections import defaultdict
import threading


class FailedLoginRateLimiter:
    def __init__(self, max_attempts: int = 5, window_seconds: int = 60):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.failures = defaultdict(list)
        self.lock = threading.Lock()

    def check_rate_limit(self, identifier: str) -> bool:
        """Returns True if rate limited (>= max_attempts in window)"""
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=self.window_seconds)
        with self.lock:
            attempts = [t for t in self.failures[identifier] if t > cutoff]
            self.failures[identifier] = attempts
            return len(attempts) >= self.max_attempts

    def record_failure(self, identifier: str):
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=self.window_seconds)
        with self.lock:
            attempts = [t for t in self.failures[identifier] if t > cutoff]
            attempts.append(now)
            self.failures[identifier] = attempts

    def reset(self, identifier: str):
        with self.lock:
            if identifier in self.failures:
                del self.failures[identifier]


login_limiter = FailedLoginRateLimiter(max_attempts=5, window_seconds=60)
