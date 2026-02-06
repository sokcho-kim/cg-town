import asyncio
import json
import random
from fastapi import WebSocket

TILE_SIZE = 64  # pixels per tile
GRID_WIDTH = 24  # number of tiles horizontally
GRID_HEIGHT = 12  # number of tiles vertically


class ConnectionManager:
    def __init__(self):
        # {user_id: {"ws": WebSocket, "user_info": {...}}}
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

    async def connect(self, user_id: str, user_info: dict, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = {
            "ws": websocket,
            "user_info": user_info,
        }
        # Assign a random non-overlapping spawn position
        spawn = self._find_spawn_position()
        self.positions[user_id] = spawn
        # Send current state to new player
        await websocket.send_json({
            "type": "init",
            "your_position": spawn,
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

    def disconnect(self, user_id: str):
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
            self.disconnect(uid)

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
