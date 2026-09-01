import urllib.request
import json

def test_get(url):
    req = urllib.request.urlopen(url)
    data = json.loads(req.read().decode('utf-8'))
    print(f"GET {url} -> status {req.status}")
    return data

def test_post(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode('utf-8'))
    print(f"POST {url} -> status {resp.status}")
    return data

print("=== STARTING AQUAGNN INTEGRATION TEST SUITE ===")

# 1. Health
h = test_get("http://127.0.0.1:8000/api/v1/health")
print("Health Status:", h["status"], "| Nodes:", h["graph_nodes"], "| Edges:", h["graph_edges"])

# 2. Topology
topo = test_get("http://127.0.0.1:8000/api/v1/network/topology")
print("Topology Features Count:", len(topo["features"]))

# 3. Simulation
sim = test_post(
    "http://127.0.0.1:8000/api/v1/simulation/run",
    {"intensity_mm_hr": 80.0, "duration_hrs": 2.0, "pattern": "cloudburst", "pumps": []}
)
print("Simulation Frames Count:", len(sim["frames"]))
print("Peak Overall Depth (m):", sim["overall_summary"]["max_peak_depth_m"])

# 4. Alerts
alerts = test_get("http://127.0.0.1:8000/api/v1/alerts/hotspots?intensity_mm_hr=80&pattern=cloudburst")
print("Total Hotspot Alerts:", alerts["total_alerts"], "| Danger:", alerts["danger_count"])

# 5. Pump Mitigation
mit = test_post(
    "http://127.0.0.1:8000/api/v1/mitigation/deploy-pump",
    {"node_id": "ND-UP01", "capacity_m3s": 2.0, "intensity_mm_hr": 80.0, "duration_hrs": 2.0, "pattern": "cloudburst"}
)
target = mit["target_node"]
print(f"Pump Deployment at {target['node_id']}: Depth Drop = {target['depth_reduction_m']}m (-{target['depth_reduction_pct']}%)")
print(f"Flooded Volume Prevented: {mit['system_delta']['flooded_volume_prevented_m3']} m³")

# 6. Evacuation Routing
route = test_post(
    "http://127.0.0.1:8000/api/v1/routing/safe-route",
    {"origin_node": "ND-01", "destination_node": "ND-OF01", "time_min": 60, "intensity_mm_hr": 80.0, "pattern": "cloudburst"}
)
print(f"Evacuation Route Calculated: Distance = {route['total_distance_km']} km, Path Nodes = {len(route['path_nodes'])}")

# 7. Scenario Presets
presets = test_get("http://127.0.0.1:8000/api/v1/scenarios/presets")
print("Preset Scenarios Count:", len(presets))

# 8. Root Frontend SPA
spa_resp = urllib.request.urlopen("http://127.0.0.1:8000/")
spa_html = spa_resp.read().decode('utf-8')
print("SPA Root HTTP Status:", spa_resp.status, "| HTML Length:", len(spa_html), "bytes")
assert "<div id=\"root\"></div>" in spa_html

print("\n>>> ALL 8 AQUAGNN API ENDPOINTS & SPA SERVING VERIFIED 100% OPERATIONAL! <<<")
