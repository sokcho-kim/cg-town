import asyncio
import json
import logging
import os
import random
from fastapi import WebSocket
import httpx

logger = logging.getLogger(__name__)

TILE_SIZE = 64  # pixels per tile
GRID_WIDTH = 24  # number of tiles horizontally
GRID_HEIGHT = 12  # number of tiles vertically


class ConnectionManager:
    def __init__(self):
        # {user_id: {"ws": WebSocket, "user_info": {...}, "token": str}}
        self.active_connections: dict[str, dict] = {}
        # {user_id: {"gridX": int, "gridY": int, "direction": str}}
        self.positions: dict[str, dict] = {}

    def _find_spawn_position(self) -> dict:
        """Find a random non-overlapping spawn tile."""
        occupied = {
            (pos["gridX"], pos["gridY"]) for pos in self.positions.values()
        }
        for _ in range(200):
            gx = random.randint(1, GRID_WIDTH - 2)
            gy = random.randint(1, GRID_HEIGHT - 2)
            if (gx, gy) not in occupied:
                return {"gridX": gx, "gridY": gy, "direction": "down"}
        # Fallback: scan for any free tile
        for gx in range(1, GRID_WIDTH - 1):
            for gy in range(1, GRID_HEIGHT - 1):
                if (gx, gy) not in occupied:
                    return {"gridX": gx, "gridY": gy, "direction": "down"}
        return {"gridX": 1, "gridY": 1, "direction": "down"}

    async def connect(
        self,
        user_id: str,
        user_info: dict,
        websocket: WebSocket,
        token: str,
        saved_position: dict | None = None,
    ):
        # 같은 user_id로 이미 연결되어 있으면 기존 연결 끊기 (중복 연결 방지)
        if user_id in self.active_connections:
            old_conn = self.active_connections[user_id]
            old_ws = old_conn.get("ws")
            logger.info(f"Closing existing connection for {user_id} (duplicate connect)")
            try:
                await old_ws.close(code=4002, reason="duplicate_connection")
            except Exception:
                pass
            # 기존 위치는 유지 (saved_position으로 사용)
            if user_id in self.positions and saved_position is None:
                saved_position = self.positions[user_id]
            # 기존 연결 정보 제거 (위치는 유지)
            self.active_connections.pop(user_id, None)

        await websocket.accept()
        self.active_connections[user_id] = {
            "ws": websocket,
            "user_info": user_info,
            "token": token,
        }
        # Use saved position if available and not occupied, else random spawn
        spawn = None
        if saved_position:
            gx = saved_position.get("gridX", saved_position.get("x"))
            gy = saved_position.get("gridY", saved_position.get("y"))
            if gx is not None and gy is not None:
                occupied = {
                    (pos["gridX"], pos["gridY"]) for pos in self.positions.values()
                }
                if (gx, gy) not in occupied:
                    spawn = {
                        "gridX": gx,
                        "gridY": gy,
                        "direction": saved_position.get("direction", "down"),
                    }
                    logger.info(f"Restored position for {user_id}: ({gx}, {gy})")
        if spawn is None:
            spawn = self._find_spawn_position()
            logger.info(f"Random spawn for {user_id}: ({spawn['gridX']}, {spawn['gridY']})")
        self.positions[user_id] = spawn
        # Send current state to new player
        await websocket.send_json({
            "type": "init",
            "your_position": spawn,
            "your_email_prefix": user_info.get("email_prefix", ""),
            "your_status_message": user_info.get("status_message", ""),
            "players": {
                uid: {
                    "position": self.positions[uid],
                    "user_info": conn["user_info"],
                }
                for uid, conn in self.active_connections.items()
                if uid != user_id
            },
        })
        # Notify others about new player
        await self.broadcast(
            json.dumps({
                "type": "player_joined",
                "user_id": user_id,
                "user_info": user_info,
                "position": spawn,
            }),
            exclude=user_id,
        )

    async def save_position(self, user_id: str):
        """Save user's current position to Supabase user_metadata."""
        conn = self.active_connections.get(user_id)
        pos = self.positions.get(user_id)
        if not conn or not pos:
            return

        token = conn.get("token")
        if not token:
            return

        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY")
        if not supabase_url or not supabase_key:
            return

        try:
            async with httpx.AsyncClient() as client:
                response = await client.put(
                    f"{supabase_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": supabase_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "data": {
                            "last_position": {
                                "gridX": pos["gridX"],
                                "gridY": pos["gridY"],
                                "direction": pos.get("direction", "down"),
                            }
                        }
                    },
                    timeout=5.0,
                )
                if response.status_code == 200:
                    logger.info(f"Saved position for {user_id}: ({pos['gridX']}, {pos['gridY']})")
                else:
                    logger.warning(f"Failed to save position for {user_id}: {response.status_code}")
        except Exception as e:
            logger.error(f"Error saving position for {user_id}: {e}")

    async def disconnect(self, user_id: str):
        await self.save_position(user_id)
        self.active_connections.pop(user_id, None)
        self.positions.pop(user_id, None)

    async def broadcast_disconnect(self, user_id: str):
        await self.broadcast(
            json.dumps({
                "type": "player_left",
                "user_id": user_id,
            })
        )

    async def broadcast(self, message: str, exclude: str = None):
        disconnected = []
        for uid, conn in self.active_connections.items():
            if uid == exclude:
                continue
            try:
                await conn["ws"].send_text(message)
            except Exception:
                disconnected.append(uid)
        for uid in disconnected:
            await self.disconnect(uid)

    async def handle_move(self, user_id: str, data: dict):
        grid_x = data.get("gridX", 0)
        grid_y = data.get("gridY", 0)
        direction = data.get("direction", "down")

        # Validate bounds
        if not (0 <= grid_x <= GRID_WIDTH - 1):
            return
        if not (0 <= grid_y <= GRID_HEIGHT - 1):
            return

        # Collision check: reject move if tile is occupied by another player
        for uid, pos in self.positions.items():
            if uid != user_id and pos["gridX"] == grid_x and pos["gridY"] == grid_y:
                return

        position = {"gridX": grid_x, "gridY": grid_y, "direction": direction}
        self.positions[user_id] = position
        await self.broadcast(
            json.dumps({
                "type": "player_moved",
                "user_id": user_id,
                "position": position,
            }),
            exclude=user_id,
        )


manager = ConnectionManager()
