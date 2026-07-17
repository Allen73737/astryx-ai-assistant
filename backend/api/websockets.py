"""WebSocket Manager — handles bidirectional real-time communication."""

from __future__ import annotations

import json
import time
import uuid
from typing import Any

import structlog
from fastapi import WebSocket, WebSocketDisconnect

logger = structlog.get_logger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._pending_permissions: dict[str, asyncio.Event] = {}
        self._permission_results: dict[str, bool] = {}

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info("ws_connected", total=len(self.active_connections))

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info("ws_disconnected", total=len(self.active_connections))

    async def send_message(
        self,
        msg_type: str,
        payload: dict[str, Any],
        websocket: WebSocket | None = None,
    ) -> None:
        """Send a typed message to one or all connections."""
        message = json.dumps({
            "type": msg_type,
            "payload": payload,
            "timestamp": int(time.time() * 1000),
            "id": str(uuid.uuid4()),
        })

        if websocket:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error("ws_send_error", error=str(e))
        else:
            await self.broadcast(message)

    async def broadcast(self, message: str) -> None:
        """Send a message to all connected clients."""
        disconnected: list[WebSocket] = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_typed(self, msg_type: str, payload: dict[str, Any]) -> None:
        """Broadcast a typed message to all connections."""
        await self.send_message(msg_type, payload)

    async def request_webcam_permission(self) -> bool:
        """Broadcast a webcam permission request to frontend and wait for a response."""
        import asyncio
        session_id = str(uuid.uuid4())
        event = asyncio.Event()
        self._pending_permissions[session_id] = event
        
        # Broadcast request to frontend
        await self.broadcast_typed("webcam_permission_request", {"session_id": session_id})
        
        try:
            # Wait up to 30 seconds for the user to approve
            await asyncio.wait_for(event.wait(), timeout=30.0)
            return self._permission_results.get(session_id, False)
        except asyncio.TimeoutError:
            logger.warning("webcam_permission_timeout", session_id=session_id)
            return False
        finally:
            self._pending_permissions.pop(session_id, None)
            self._permission_results.pop(session_id, None)

    def resolve_permission(self, session_id: str, allowed: bool) -> None:
        """Resolve a pending webcam permission request."""
        if session_id in self._pending_permissions:
            self._permission_results[session_id] = allowed
            self._pending_permissions[session_id].set()


# Singleton
ws_manager = ConnectionManager()
