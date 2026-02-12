"""KST 타임존 유틸리티"""
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))


def now_kst() -> datetime:
    """한국 표준시 기준 현재 datetime 반환"""
    return datetime.now(KST)


def today_kst():
    """한국 표준시 기준 오늘 날짜 반환"""
    return datetime.now(KST).date()
