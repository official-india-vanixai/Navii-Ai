"""
Usage & Cost Control Monitoring Service for N.A.V.I.I.
Tracks AI tokens, execution counts, and operational resource usage.
"""

from typing import Dict, Any, List
from collections import defaultdict
from datetime import datetime

from app.models.schemas import UsageSummaryResponse
from app.core.config import settings
from app.core.rate_limit import rate_limiter


class UsageMonitoringService:
    def __init__(self):
        # In-memory store: user_id -> operational stats (synced to Supabase usage_records in Phase 6)
        self.user_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {
            "total_requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        })
        self.operation_log: List[Dict[str, Any]] = []

    def record_usage(
        self,
        user_id: str,
        operation_type: str,
        model: str,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> Dict[str, Any]:
        """
        Records an operation's token and cost impact.
        """
        total = prompt_tokens + completion_tokens
        stats = self.user_stats[user_id]
        stats["total_requests"] += 1
        stats["prompt_tokens"] += prompt_tokens
        stats["completion_tokens"] += completion_tokens
        stats["total_tokens"] += total

        entry = {
            "user_id": user_id,
            "operation_type": operation_type,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.operation_log.append(entry)
        return entry

    def get_user_summary(self, user_id: str) -> UsageSummaryResponse:
        """
        Returns the user's current token usage and remaining daily quota.
        """
        stats = self.user_stats[user_id]
        remaining = rate_limiter.get_remaining_daily(user_id)

        return UsageSummaryResponse(
            user_id=user_id,
            total_requests=stats["total_requests"],
            total_prompt_tokens=stats["prompt_tokens"],
            total_completion_tokens=stats["completion_tokens"],
            total_tokens=stats["total_tokens"],
            daily_requests_remaining=remaining,
            daily_limit=settings.MAX_DAILY_REQUESTS_PER_USER,
            max_prompt_tokens=settings.MAX_PROMPT_TOKENS
        )


usage_service = UsageMonitoringService()
