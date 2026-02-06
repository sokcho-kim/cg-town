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
        user_info = {
            "id": user.id,
            "email": user.email,
            "name": (
                user.user_metadata.get("name", "Unknown")
                if user.user_metadata
                else "Unknown"
            ),
        }
        logger.info(f"WS auth OK: {user_id} ({user_info['name']})")
    except Exception as e:
        logger.error(f"WS auth failed: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
        return

    await manager.connect(user_id, user_info, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "move":
                await manager.handle_move(user_id, data)
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_disconnect(user_id)
    except Exception:
        manager.disconnect(user_id)
        await manager.broadcast_disconnect(user_id)
