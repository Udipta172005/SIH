import urllib.request
import json

BASE_URL = "http://127.0.0.1:8000"

def post(path, payload):
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode('utf-8'))

print("=== STARTING TASK 5 WEATHER PRESET INTEGRATION TEST SUITE ===")

# Test 1: Flash Cloudburst
print("\n[Test 1] Applying 'Flash Cloudburst' preset...")
res1 = post("/api/v1/scenarios/apply", {"scenario_name": "Flash Cloudburst"})
print("Response:", res1)
assert res1["status"] == "success"
assert res1["precipitation_intensity_mm_hr"] == 80.0
assert res1["preset_id"] == "cloudburst-flash"
assert res1["pattern"] == "cloudburst"

# Test 2: Monsoon Atmospheric River / Monsoon Surge
print("\n[Test 2] Applying 'Monsoon Atmospheric River' preset...")
res2 = post("/api/v1/scenarios/apply", {"scenario_name": "Monsoon Atmospheric River"})
print("Response:", res2)
assert res2["status"] == "success"
assert res2["precipitation_intensity_mm_hr"] == 110.0
assert res2["preset_id"] == "monsoon-surge"
assert res2["pattern"] == "monsoon_surge"

# Test 3: 100-Year Design Storm / 100-Year Storm
print("\n[Test 3] Applying '100-Year Storm' preset...")
res3 = post("/api/v1/scenarios/apply", {"scenario_name": "100-Year Storm"})
print("Response:", res3)
assert res3["status"] == "success"
assert res3["precipitation_intensity_mm_hr"] == 140.0
assert res3["preset_id"] == "extreme-100yr"
assert res3["pattern"] == "extreme_100yr"

# Test 4: Moderate Steady / Steady Rain
print("\n[Test 4] Applying 'Moderate Steady' preset...")
res4 = post("/api/v1/scenarios/apply", {"scenario_name": "Moderate Steady"})
print("Response:", res4)
assert res4["status"] == "success"
assert res4["precipitation_intensity_mm_hr"] == 35.0
assert res4["preset_id"] == "moderate-rain"
assert res4["pattern"] == "uniform"

# Test 5: GNN Recompute after preset apply
print("\n[Test 5] Triggering GNN Recompute with 140 mm/hr (100-Year Storm)...")
recomp = post("/api/v1/simulation/recompute", {
    "precipitation_rate_mm_hr": 140.0,
    "preset_id": "extreme-100yr",
    "pattern": "extreme_100yr"
})
print("Recompute Scenario:", recomp["scenario"])
assert recomp["scenario"]["precipitation_rate_mm_hr"] == 140.0
assert len(recomp["frames"]) == 9
assert "gnn_forecast" in recomp
print("GNN Forecast Horizons Count:", len(recomp["gnn_forecast"]))

print("\n>>> ALL TASK 5 WEATHER PRESET INTEGRATION TESTS PASSED 100%! <<<")
