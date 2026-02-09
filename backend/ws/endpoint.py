import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from ws.manager import manager
from lib.supabase import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    # Verify JWT token
    try:
        supabase = get_supabase_client()
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        user_id = user.id
        user_metadata = user.user_metadata or {}
        # 이메일 @ 앞부분을 캐릭터 폴더명으로 사용
        email_prefix = user.email.split("@")[0] if user.email else ""

        # profiles 테이블에서 status_message 조회
        status_message = ""
        try:
            profile_result = (
                supabase.table("profiles")
                .select("status_message")
                .eq("id", user.id)
                .single()
                .execute()
            )
            if profile_result.data:
                status_message = profile_result.data.get("status_message", "") or ""
        except Exception as profile_err:
            logger.warning(f"Failed to fetch profile for {user.id}: {profile_err}")

        user_info = {
            "id": user.id,
            "email": user.email,
            "email_prefix": email_prefix,
            "name": user_metadata.get("name", "Unknown"),
            "status_message": status_message,
        }
        saved_position = user_metadata.get("last_position")
        logger.info(f"WS auth OK: {user_id} ({email_prefix}), saved_pos: {saved_position}")
    except Exception as e:
        logger.error(f"WS auth failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return

    await manager.connect(user_id, user_info, websocket, token, saved_position)

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "move":
                await manager.handle_move(user_id, data)
    except WebSocketDisconnect:
        await manager.disconnect(user_id)
        await manager.broadcast_disconnect(user_id)
    except Exception:
        await manager.disconnect(user_id)
        await manager.broadcast_disconnect(user_id)
