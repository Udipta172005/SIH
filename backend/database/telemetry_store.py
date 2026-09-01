"""
AquaGNN - Telemetry History Store
SQLite persistence layer for historical sensor telemetry readings.
"""

import sqlite3
import os
import math
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "aquagnn.db"))


def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_telemetry_table(db_path: str = DB_PATH) -> None:
    """Create the telemetry_history table if it doesn't exist."""
    conn = get_db_connection(db_path)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS telemetry_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                node_id TEXT NOT NULL,
                water_level_m REAL NOT NULL,
                precipitation_mm_hr REAL,
                timestamp TEXT NOT NULL
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_node_time
            ON telemetry_history (node_id, timestamp)
        """)
    conn.close()


def save_telemetry_readings(
    readings: List[Dict[str, Any]],
    precipitation_mm_hr: float = 0.0,
    db_path: str = DB_PATH
) -> int:
    """
    Persist a batch of telemetry readings to SQLite.
    Returns the number of rows inserted.
    """
    init_telemetry_table(db_path)
    conn = get_db_connection(db_path)
    count = 0
    with conn:
        for r in readings:
            conn.execute(
                "INSERT INTO telemetry_history (node_id, water_level_m, precipitation_mm_hr, timestamp) VALUES (?, ?, ?, ?)",
                (r["node_id"], r["water_level_m"], precipitation_mm_hr, r["timestamp"])
            )
            count += 1
    conn.close()
    return count


def get_telemetry_history(
    node_id: str,
    hours: float = 24.0,
    db_path: str = DB_PATH
) -> List[Dict[str, Any]]:
    """
    Retrieve telemetry readings for a specific node within the last `hours` hours.
    Returns list of dicts with timestamp, water_level_m, precipitation_mm_hr.
    """
    init_telemetry_table(db_path)
    conn = get_db_connection(db_path)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    cursor = conn.execute(
        "SELECT timestamp, water_level_m, precipitation_mm_hr FROM telemetry_history WHERE node_id = ? AND timestamp >= ? ORDER BY timestamp ASC",
        (node_id, cutoff)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def seed_telemetry_history(db_path: str = DB_PATH) -> int:
    """
    Generate 24 hours of simulated historical telemetry data for
    the 9 demo UI nodes. Safe to call multiple times; skips if data exists.
    """
    init_telemetry_table(db_path)
    conn = get_db_connection(db_path)

    # Check if we already have data
    cursor = conn.execute("SELECT COUNT(*) as cnt FROM telemetry_history")
    existing = cursor.fetchone()["cnt"]
    if existing > 100:
        conn.close()
        return 0  # Already seeded

    demo_nodes = ["ND-04", "ND-08", "ND-11", "ND-12", "ND-16", "ND-19", "ND-22", "ND-24", "ND-27"]
    base_depths = {
        "ND-04": 0.05, "ND-08": 0.12, "ND-11": 0.18, "ND-12": 0.15,
        "ND-16": 0.08, "ND-19": 0.03, "ND-22": 0.06, "ND-24": 0.04, "ND-27": 0.03
    }

    now = datetime.now(timezone.utc)
    total_points = 480  # 24 hours at 3-minute intervals
    count = 0

    with conn:
        for i in range(total_points):
            t = now - timedelta(minutes=(total_points - i) * 3)
            ts = t.isoformat()

            # Simulate a storm cycle: calm -> rising -> peak -> receding
            progress = i / total_points
            # Two storm pulses over 24h
            storm1 = max(0, math.sin(progress * math.pi * 2 - 0.5)) * 0.8
            storm2 = max(0, math.sin(progress * math.pi * 4 - 1.0)) * 0.4
            storm_factor = storm1 + storm2

            precip = 5.0 + storm_factor * 75.0 + random.gauss(0, 2.0)
            precip = max(0.0, min(160.0, precip))

            for node_id in demo_nodes:
                base = base_depths[node_id]
                susceptibility = 0.5 + (hash(node_id) % 100) / 100.0
                depth = base + storm_factor * susceptibility * 2.0
                depth += random.gauss(0, 0.02)
                depth = max(0.0, min(5.0, round(depth, 3)))

                conn.execute(
                    "INSERT INTO telemetry_history (node_id, water_level_m, precipitation_mm_hr, timestamp) VALUES (?, ?, ?, ?)",
                    (node_id, depth, round(precip, 2), ts)
                )
                count += 1

    conn.close()
    return count


# Auto-initialize table on import
init_telemetry_table()
