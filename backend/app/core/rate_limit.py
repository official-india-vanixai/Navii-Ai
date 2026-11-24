"""
Rate Limiting & Cost Control Safeguards for N.A.V.I.I Backend.
Protects AI budgets and backend infrastructure against runaway requests.
"""

import time
from typing import Dict, Tuple
from fastapi import HTTPException, status
from app.core.config import settings


class RateLimiter:
    """
    Sliding window & daily request counter for user rate limiting.
    """
    def __init__(self, requests_per_minute: int = 60, daily_limit: int = 200):
        self.requests_per_minute = requests_per_minute
        self.daily_limit = daily_limit
        # user_id -> list of timestamps within last minute
        self.minute_records: Dict[str, list] = {}
        # user_id -> (day_start_timestamp, count)
        self.daily_records: Dict[str, Tuple[float, int]] = {}

    def check_rate_limit(self, user_id: str):
        now = time.time()

        # 1. Check Minute Window
        if user_id not in self.minute_records:
            self.minute_records[user_id] = []
        
        # Filter timestamps older than 60 seconds
        self.minute_records[user_id] = [
            ts for ts in self.minute_records[user_id] if now - ts < 60
        ]

        if len(self.minute_records[user_id]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please wait a moment before sending more queries."
            )

        # 2. Check Daily Limit
        if user_id not in self.daily_records:
            self.daily_records[user_id] = (now, 0)

        day_start, daily_count = self.daily_records[user_id]
        if now - day_start >= 86400:  # 24 hours elapsed -> reset
            self.daily_records[user_id] = (now, 1)
        else:
            if daily_count >= self.daily_limit:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Daily request quota ({self.daily_limit} requests) reached. Quota resets in {int((86400 - (now - day_start)) / 3600)}h."
                )
            self.daily_records[user_id] = (day_start, daily_count + 1)

        self.minute_records[user_id].append(now)

    def get_remaining_daily(self, user_id: str) -> int:
        now = time.time()
        if user_id not in self.daily_records:
            return self.daily_limit

        day_start, count = self.daily_records[user_id]
        if now - day_start >= 86400:
            return self.daily_limit
        return max(0, self.daily_limit - count)

    def validate_prompt_tokens(self, estimated_tokens: int):
        if estimated_tokens > settings.MAX_PROMPT_TOKENS:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Prompt exceeds maximum allowable token limit ({estimated_tokens} > {settings.MAX_PROMPT_TOKENS})."
            )


rate_limiter = RateLimiter(
    requests_per_minute=60,
    daily_limit=settings.MAX_DAILY_REQUESTS_PER_USER
)
