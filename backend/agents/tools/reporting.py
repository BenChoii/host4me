"""
Reporting tools — query stats, response times, sentiment analysis.

Returns mock data for now. In production, queries PostgreSQL.
"""

from datetime import datetime, timezone


def query_message_stats(pm_id: str, days: int = 7) -> dict:
    """Query message statistics for a PM over a time period.

    Args:
        pm_id: The property manager's ID.
        days: Number of days to look back (default 7).

    Returns:
        Dict with message counts by platform and status.
    """
    # Production: SELECT count(*) FROM messages WHERE pm_id = ? AND created_at > ?
    return {
        "pm_id": pm_id,
        "period_days": days,
        "total_received": 0,
        "total_replied": 0,
        "total_escalated": 0,
        "by_platform": {"airbnb": 0, "vrbo": 0},
        "note": "No data yet — stats populate once guest messages start flowing.",
    }


def query_booking_stats(pm_id: str, days: int = 30) -> dict:
    """Query booking statistics for a PM.

    Args:
        pm_id: The property manager's ID.
        days: Number of days to look back (default 30).

    Returns:
        Dict with booking counts, occupancy, and revenue.
    """
    return {
        "pm_id": pm_id,
        "period_days": days,
        "new_bookings": 0,
        "check_ins_today": 0,
        "check_outs_today": 0,
        "occupancy_rate": 0,
        "revenue_30d": 0,
        "note": "No data yet — booking stats populate once platforms are connected.",
    }


def calculate_response_times(pm_id: str, days: int = 7) -> dict:
    """Calculate response time metrics.

    Args:
        pm_id: The property manager's ID.
        days: Number of days to analyze (default 7).

    Returns:
        Dict with avg/median/p95 response times.
    """
    return {
        "pm_id": pm_id,
        "period_days": days,
        "avg_minutes": 0,
        "median_minutes": 0,
        "p95_minutes": 0,
        "note": "No data yet.",
    }


def analyze_guest_sentiment(pm_id: str, days: int = 7) -> dict:
    """Analyze guest message sentiment over a time period.

    Args:
        pm_id: The property manager's ID.
        days: Number of days to analyze (default 7).

    Returns:
        Dict with sentiment breakdown.
    """
    return {
        "pm_id": pm_id,
        "period_days": days,
        "positive_pct": 0,
        "neutral_pct": 0,
        "negative_pct": 0,
        "total_messages_analyzed": 0,
        "note": "No data yet.",
    }
