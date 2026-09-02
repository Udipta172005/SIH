"""
Comprehensive Integration & Verification Test for AquaGNN WebSocket Telemetry
"""

import asyncio
import json
import threading
import time
import urllib.request
import websockets
import uvicorn
from backend.main import app
from backend.engine.graph_builder import topology_builder


def http_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "AquaGNN-Tester"})
    with urllib.request.urlopen(req, timeout=5) as response:
        status = response.status
        data = json.loads(response.read().decode())
        return status, data


class ServerThread(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
        self.server = uvicorn.Server(self.config)

    def run(self):
        self.server.run()

    def stop(self):
        self.server.should_exit = True


async def run_tests():
    print("=" * 60)
    print("AquaGNN Telemetry WebSocket & API Verification Test")
    print("=" * 60)

    # 1. Verify Topology Node IDs
    existing_nodes = set(topology_builder.graph.nodes())
    print(f"Topology contains {len(existing_nodes)} nodes: {list(existing_nodes)[:5]}...")
    assert len(existing_nodes) > 0, "Topology must have nodes"

    # Start FastAPI server in a dedicated thread
    server_thread = ServerThread()
    server_thread.start()

    # Wait for server startup
    await asyncio.sleep(2.0)

    try:
        # 2. Test GET /api/v1/topology
        print("\n[TEST 1] Testing GET /api/v1/topology ...")
        status, topo_data = await asyncio.to_thread(http_get, "http://127.0.0.1:8000/api/v1/topology")
        assert status == 200, f"Expected 200, got {status}"
        assert "nodes" in topo_data and "edges" in topo_data
        print(f"  --> PASS: Retrieved {len(topo_data['nodes'])} nodes and {len(topo_data['edges'])} edges.")

        # 3. Test GET /api/v1/alerts
        print("\n[TEST 2] Testing GET /api/v1/alerts ...")
        status, alerts_data = await asyncio.to_thread(http_get, "http://127.0.0.1:8000/api/v1/alerts")
        assert status == 200, f"Expected 200, got {status}"
        assert "alerts" in alerts_data
        print(f"  --> PASS: Retrieved {len(alerts_data['alerts'])} active alerts.")

        # 4. Test GET /api/v1/health
        print("\n[TEST 3] Testing GET /api/v1/health ...")
        status, health_data = await asyncio.to_thread(http_get, "http://127.0.0.1:8000/api/v1/health")
        assert status == 200, f"Expected 200, got {status}"
        print(f"  --> PASS: System health status = {health_data.get('status')}")

        # 5. Test WebSocket ws://127.0.0.1:8000/api/v1/ws/telemetry
        print("\n[TEST 4] Testing WebSocket connection to ws://127.0.0.1:8000/api/v1/ws/telemetry ...")
        ws_uri = "ws://127.0.0.1:8000/api/v1/ws/telemetry"
        
        async with websockets.connect(ws_uri) as ws:
            print("  --> PASS: Connected to WebSocket endpoint successfully.")
            
            # Receive 3 telemetry messages
            print("\n[TEST 5] Listening for telemetry messages (interval ~3s) ...")
            received_messages = []
            start_time = time.time()

            for i in range(3):
                msg_raw = await asyncio.wait_for(ws.recv(), timeout=6.0)
                msg_time = time.time()
                data = json.loads(msg_raw)
                print(f"  --> Message {i+1} received at +{msg_time - start_time:.2f}s: {data}")
                
                assert "node_id" in data, f"Message missing 'node_id': {data}"
                assert "depth_m" in data, f"Message missing 'depth_m': {data}"
                assert data["node_id"] in existing_nodes, f"Invalid node_id {data['node_id']}"
                assert isinstance(data["depth_m"], (int, float)), f"depth_m must be a number: {data['depth_m']}"
                assert 0.0 <= data["depth_m"] <= 10.0, f"depth_m out of range: {data['depth_m']}"
                received_messages.append(data)

            print(f"  --> PASS: Successfully received {len(received_messages)} telemetry messages with valid schema.")

        # 6. Test Multiple Concurrent WebSocket Clients
        print("\n[TEST 6] Testing multiple concurrent WebSocket clients ...")
        async with websockets.connect(ws_uri) as ws1, websockets.connect(ws_uri) as ws2:
            msg1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=6.0))
            msg2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=6.0))
            print(f"  Client 1 received: {msg1}")
            print(f"  Client 2 received: {msg2}")
            assert "node_id" in msg1 and "node_id" in msg2
            print("  --> PASS: Multi-client broadcast verified.")

        print("\n" + "=" * 60)
        print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        server_thread.stop()


if __name__ == "__main__":
    asyncio.run(run_tests())
