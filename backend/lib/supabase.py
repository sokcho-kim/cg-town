import os
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Supabase 클라이언트 (anon key) - 인증/읽기용"""
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY environment variables must be set"
        )

    return create_client(supabase_url, supabase_key)


def get_supabase_admin() -> Client:
    """Supabase 관리자 클라이언트 (service role key) - RLS 우회, 쓰기용"""
    supabase_url = os.environ.get("SUPABASE_URL")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY")

    if not supabase_url or not secret_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SECRET_KEY environment variables must be set"
        )

    return create_client(supabase_url, secret_key)
