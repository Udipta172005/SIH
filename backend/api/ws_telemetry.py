"""
AquaGNN - Real-Time Telemetry WebSocket & Background Generator
Maintains WebSocket client connections and broadcasts real-time sensor
depth telemetry for drainage network nodes at ~3 second intervals.
"""

import asyncio
import logging
import random
from typing import Dict, List, Set, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("aquagnn.telemetry_ws")


class ConnectionManager:
    """
    Manages active WebSocket client connections, disconnections, and broadcasts.
    """

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        if not self.active_connections:
            return

        dead_connections: List[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.debug(f"Failed to send to client ({e}); marking for removal.")
                dead_connections.append(connection)

        for dead_conn in dead_connections:
            self.active_connections.discard(dead_conn)


class TelemetryBroadcaster:
    """
    Background worker that continuously generates realistic sensor depth changes
    for existing drainage nodes and broadcasts updates every 3 seconds.
    """

    def __init__(self, connection_manager: ConnectionManager):
        self.manager = connection_manager
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._node_depths: Dict[str, float] = {}

    def get_existing_node_ids(self) -> List[str]:
        """
        Retrieves node IDs from the existing topology graph or falls back to known pilot nodes.
        """
        try:
            from ..engine.graph_builder import topology_builder
            nodes = list(topology_builder.graph.nodes())
            if nodes:
                return nodes
        except Exception:
            pass

        return [
            "ND-01", "ND-02", "ND-03", "ND-04", "ND-05", "ND-06", "ND-07", "ND-08", "ND-09",
            "ND-UP01", "ND-UP02", "ND-H01", "ND-10", "ND-11", "ND-12", "ND-13",
            "ND-BS01", "ND-BS02", "ND-PS01", "ND-OF01", "ND-OF02",
            "ND-14", "ND-15", "ND-16", "ND-17", "ND-18", "ND-19", "ND-20"
        ]

    def _init_node_depths(self, node_ids: List[str]):
        """
        Sets realistic initial water depth for each node based on its type / location.
        """
        for n_id in node_ids:
            if n_id not in self._node_depths:
                if "UP" in n_id or n_id in ["ND-11", "ND-12"]:
                    # Underpasses and low-lying junctions
                    self._node_depths[n_id] = round(random.uniform(0.30, 0.70), 2)
                elif "BS" in n_id or "PS" in n_id:
                    # Retention basins / pump stations
                    self._node_depths[n_id] = round(random.uniform(0.15, 0.45), 2)
                elif "OF" in n_id:
                    # Outfalls
                    self._node_depths[n_id] = round(random.uniform(0.10, 0.30), 2)
                else:
                    # General intersections and manholes
                    self._node_depths[n_id] = round(random.uniform(0.04, 0.20), 2)

    async def start(self):
        """
        Starts the continuous telemetry generation loop.
        """
        if self._running:
            return
        self._running = True
        node_ids = self.get_existing_node_ids()
        self._init_node_depths(node_ids)

        logger.info(f"Telemetry broadcaster started for {len(node_ids)} nodes.")

        while self._running:
            try:
                await asyncio.sleep(3)
                if not self._running:
                    break

                # Pick 1 to 3 existing nodes to update each tick
                sample_size = min(len(node_ids), random.randint(1, 3))
                selected_nodes = random.sample(node_ids, k=sample_size)

                for node_id in selected_nodes:
                    current_depth = self._node_depths.get(node_id, 0.15)
                    # Apply realistic random-walk fluctuation (-0.06m to +0.07m)
                    delta = random.uniform(-0.06, 0.07)
                    new_depth = max(0.02, min(1.85, current_depth + delta))
                    new_depth = round(new_depth, 2)
                    self._node_depths[node_id] = new_depth

                    telemetry_payload = {
                        "node_id": node_id,
                        "depth_m": new_depth
                    }
                    await self.manager.broadcast(telemetry_payload)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in telemetry loop: {e}", exc_info=True)
                await asyncio.sleep(1)

    async def stop(self):
        """
        Stops the telemetry loop cleanly.
        """
        self._running = False
        logger.info("Telemetry broadcaster stopped.")


# Global instances
connection_manager = ConnectionManager()
telemetry_broadcaster = TelemetryBroadcaster(connection_manager)

# WebSocket Router
ws_router = APIRouter(prefix="/api/v1")


@ws_router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    WebSocket endpoint for real-time drainage sensor telemetry:
    ws://127.0.0.1:8000/api/v1/ws/telemetry
    """
    await connection_manager.connect(websocket)
    try:
        while True:
            # Keep the socket open and receive any incoming messages/pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    except Exception as e:
        logger.debug(f"WebSocket client disconnected or errored: {e}")
        connection_manager.disconnect(websocket)
