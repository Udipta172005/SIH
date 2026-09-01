"""
AquaGNN — Live IoT Telemetry & Sensor Simulator
=================================================
Member 1 (Data Engineer) — Task 1

Simulates a fleet of 9 IoT water-level sensors monitoring the city's
drainage network. Sends POST requests to /api/v1/telemetry/ingest
every 3 seconds with gradually rising water levels to model a storm event.

Usage:
    python tools/telemetry_simulator.py                # continuous mode
    python tools/telemetry_simulator.py --cycles 3     # limited test mode
"""

import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("ERROR: 'requests' library not installed. Run: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_BASE = "http://127.0.0.1:8000"
INGEST_URL = f"{API_BASE}/api/v1/telemetry/ingest"
INTERVAL_SECONDS = 3

# The 9 demo sensor nodes matching the frontend UI mapNodes
SENSOR_NODES = [
    {"node_id": "ND-04", "name": "Skyline Overlook",           "base_depth": 0.05},
    {"node_id": "ND-08", "name": "Parkside Terrace",           "base_depth": 0.12},
    {"node_id": "ND-11", "name": "Industrial Spur Junction",   "base_depth": 0.18},
    {"node_id": "ND-12", "name": "South Canal Promenade",      "base_depth": 0.15},
    {"node_id": "ND-16", "name": "Mission Crossroad 8th",      "base_depth": 0.08},
    {"node_id": "ND-19", "name": "Bayside Logistics Lane",     "base_depth": 0.03},
    {"node_id": "ND-22", "name": "Sensor Node 22",             "base_depth": 0.06},
    {"node_id": "ND-24", "name": "Sensor Node 24",             "base_depth": 0.04},
    {"node_id": "ND-27", "name": "Sensor Node 27",             "base_depth": 0.03},
]

# Storm profile: precipitation ramps up over ~60 cycles (3 min), peaks, then holds
STORM_RAMP_CYCLES = 60       # cycles to reach peak intensity
PEAK_PRECIPITATION = 80.0    # mm/hr at peak (Flash Cloudburst preset)
BASE_PRECIPITATION = 2.0     # mm/hr at start (light drizzle)


# ---------------------------------------------------------------------------
# Water-level simulation helpers
# ---------------------------------------------------------------------------
def compute_precipitation(cycle: int) -> float:
    """
    Gradually ramp precipitation from BASE to PEAK over STORM_RAMP_CYCLES,
    then hold at peak with minor fluctuation.
    """
    if cycle <= STORM_RAMP_CYCLES:
        # Sinusoidal ease-in ramp
        progress = cycle / STORM_RAMP_CYCLES
        smooth = 0.5 * (1 - math.cos(math.pi * progress))
        precip = BASE_PRECIPITATION + (PEAK_PRECIPITATION - BASE_PRECIPITATION) * smooth
    else:
        precip = PEAK_PRECIPITATION

    # Add small realistic noise (±3 mm/hr)
    noise = random.gauss(0, 1.5)
    return round(max(0.0, min(250.0, precip + noise)), 2)


def compute_water_level(sensor: dict, cycle: int, precipitation: float) -> float:
    """
    Compute a realistic water depth for a sensor node.
    Depth rises gradually with accumulated precipitation and includes sensor noise.
    """
    base = sensor["base_depth"]

    # Accumulated storm contribution: depth increases with cumulative rainfall
    # Each cycle represents 3 seconds; scale so ~60 cycles of 80mm/hr → ~0.5-2m rise
    cumulative_factor = min(cycle, STORM_RAMP_CYCLES * 2) / (STORM_RAMP_CYCLES * 2)
    storm_depth = cumulative_factor * (precipitation / PEAK_PRECIPITATION) * 2.0

    # Node-specific susceptibility multiplier (some nodes flood more)
    susceptibility = 0.5 + (hash(sensor["node_id"]) % 100) / 100.0

    depth = base + storm_depth * susceptibility

    # Add small random noise (±0.02m)
    noise = random.gauss(0, 0.01)
    depth = max(0.0, min(10.0, depth + noise))

    return round(depth, 3)


# ---------------------------------------------------------------------------
# Main simulator loop
# ---------------------------------------------------------------------------
def run_simulator(max_cycles: int = 0):
    """
    Run the telemetry simulator.
    
    Args:
        max_cycles: If > 0, run only this many cycles then exit.
                    If 0, run continuously until Ctrl+C.
    """
    cycle = 0
    continuous = max_cycles == 0

    print("=" * 60)
    print("  AquaGNN Live Telemetry Simulator")
    print(f"  Target: {INGEST_URL}")
    print(f"  Nodes:  {len(SENSOR_NODES)}")
    print(f"  Mode:   {'Continuous (Ctrl+C to stop)' if continuous else f'{max_cycles} cycles'}")
    print("=" * 60)
    print()

    try:
        while True:
            cycle += 1

            if not continuous and cycle > max_cycles:
                print(f"\n[OK] Completed {max_cycles} test cycle(s). Exiting.")
                break

            precipitation = compute_precipitation(cycle)
            timestamp = datetime.now(timezone.utc).isoformat()

            # Build readings for all 9 nodes
            readings = []
            for sensor in SENSOR_NODES:
                level = compute_water_level(sensor, cycle, precipitation)
                readings.append({
                    "node_id": sensor["node_id"],
                    "water_level_m": level,
                    "timestamp": timestamp
                })

            payload = {
                "precipitation_mm_hr": precipitation,
                "readings": readings,
                "cycle": cycle
            }

            # Print cycle summary
            print(f"-- Cycle {cycle} --- precip: {precipitation} mm/hr ---")
            for r in readings:
                print(f"  {r['node_id']}: water level = {r['water_level_m']:.3f} m")

            # Send POST request
            try:
                resp = requests.post(
                    INGEST_URL,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=5
                )
                if resp.status_code == 200:
                    body = resp.json()
                    print(f"  [OK] Telemetry sent successfully (nodes_ingested: {body.get('nodes_ingested', '?')})")
                else:
                    print(f"  [FAIL] HTTP {resp.status_code}: {resp.text[:200]}")
            except requests.ConnectionError:
                print(f"  [FAIL] Connection error -- backend unavailable at {API_BASE}")
            except requests.Timeout:
                print(f"  [FAIL] Request timed out")
            except Exception as e:
                print(f"  [FAIL] Error: {e}")

            print()

            # Wait before next cycle (skip delay on last test cycle)
            if continuous or cycle < max_cycles:
                time.sleep(INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print(f"\n\n[OK] Simulator stopped after {cycle} cycle(s). Goodbye!")
        sys.exit(0)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AquaGNN Live Telemetry Simulator")
    parser.add_argument(
        "--cycles", type=int, default=0,
        help="Number of cycles to run (0 = continuous, default: 0)"
    )
    args = parser.parse_args()
    run_simulator(max_cycles=args.cycles)
