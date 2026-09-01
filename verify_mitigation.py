import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def get(path):
    req = urllib.request.urlopen(f"{BASE_URL}{path}")
    return json.loads(req.read().decode('utf-8'))

def post(path, payload):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode('utf-8'))

print("=== STARTING TASK 5 MITIGATION & ALERT ENGINE TEST SUITE ===")

# 1. Trigger simulation with heavy storm
print("\n[Step 1] Triggering 85 mm/hr cloudburst simulation...")
sim = post("/api/v1/simulation/run", {
    "intensity_mm_hr": 85.0,
    "duration_hrs": 2.0,
    "pattern": "cloudburst",
    "pumps": []
})
print("Simulation completed. Frames count:", len(sim["frames"]))

# Give background task a moment to persist alerts
time.sleep(1)

# 2. Check Database Active Alerts (>0.6m threshold)
print("\n[Step 2] Checking SQLite Database Active Alerts...")
active_alerts_resp = get("/api/v1/alerts/active")
alerts = active_alerts_resp["alerts"]
print(f"Total Active Danger Alerts in Database: {len(alerts)}")
for a in alerts:
    print(f"  - {a['id']}: Node {a['node_id']} ({a['location_name']}) | Depth: {a['depth_m']}m | Severity: {a['severity']}")

assert len(alerts) > 0, "Expected at least 1 danger alert generated for >0.6m depths"
assert any(a["node_id"] == "ND-UP01" for a in alerts), "Expected danger alert for underpass ND-UP01"

# 3. Deploy Mitigation Pump (-2.5 m3/s offset) at ND-UP01
print("\n[Step 3] Calling POST /api/v1/mitigation/deploy on ND-UP01 with -2.5 m³/s offset...")
deploy_res = post("/api/v1/mitigation/deploy", {
    "node_id": "ND-UP01",
    "flow_offset_m3s": -2.5,
    "intensity_mm_hr": 85.0,
    "duration_hrs": 2.0,
    "pattern": "cloudburst"
})

print("Deployment Success:", deploy_res["success"])
print("Flow Offset Applied:", deploy_res["flow_offset_m3s"], "m³/s")
print("Pump Capacity:", deploy_res["pump_capacity_m3s"], "m³/s")
print("Deleted/Resolved Alerts Count:", deploy_res["alerts_resolved_count"])
print("Target Node Metrics:", deploy_res["target_node_metrics"])
print("Flooded Volume Prevented:", deploy_res["system_delta"]["flooded_volume_prevented_m3"], "m³")

assert deploy_res["success"] is True
assert deploy_res["flow_offset_m3s"] == -2.5
assert deploy_res["target_node_metrics"]["water_receded"] is True
assert deploy_res["target_node_metrics"]["depth_reduction_m"] > 0

# 4. Verify Active Alert for ND-UP01 is resolved/removed from active query
print("\n[Step 4] Verifying ND-UP01 is no longer in active alerts...")
active_after = get("/api/v1/alerts/active")["alerts"]
active_nodes = [a["node_id"] for a in active_after]
print("Remaining Active Alert Nodes:", active_nodes)
assert "ND-UP01" not in active_nodes, "ND-UP01 active alert should have been resolved/cleared"

print("\n>>> ALL TASK 5 MITIGATION & ALERT ENGINE REQUIREMENTS VERIFIED 100% OPERATIONAL! <<<")
