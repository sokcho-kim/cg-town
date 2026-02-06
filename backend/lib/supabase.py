import os
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Supabase 클라이언트 인스턴스를 생성하여 반환합니다."""
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY environment variables must be set"
        )

    return create_client(supabase_url, supabase_key)
