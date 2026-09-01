"""
AquaGNN - Alert & Mitigation Database Store
SQLite persistence layer for Danger Alerts and Mitigation Records.
"""

import sqlite3
import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "aquagnn.db"))


def get_db_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str = DB_PATH) -> None:
    """Initialize database tables for alerts and mitigations."""
    conn = get_db_connection(db_path)
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                node_id TEXT NOT NULL,
                location_name TEXT,
                severity TEXT NOT NULL,
                depth_m REAL NOT NULL,
                threshold_m REAL DEFAULT 0.6,
                status TEXT DEFAULT 'active',
                action_required TEXT,
                created_at TEXT NOT NULL,
                resolved_at TEXT
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_alerts_node_status 
            ON alerts (node_id, status)
        """)
    conn.close()


def save_danger_alert(
    node_id: str,
    location_name: str,
    depth_m: float,
    threshold_m: float = 0.6,
    action_required: Optional[str] = None,
    db_path: str = DB_PATH
) -> Dict[str, Any]:
    """
    Saves or updates an active 'Danger' alert for a node exceeding threshold (0.6m).
    """
    init_db(db_path)
    conn = get_db_connection(db_path)
    now_iso = datetime.now(timezone.utc).isoformat()
    action = action_required or "Immediate arterial closure & dispatch heavy dewatering pump unit (-2.5 m³/s)"
    
    with conn:
        cursor = conn.execute(
            "SELECT * FROM alerts WHERE node_id = ? AND status = 'active'",
            (node_id,)
        )
        existing = cursor.fetchone()
        
        if existing:
            alert_id = existing["id"]
            conn.execute("""
                UPDATE alerts
                SET depth_m = ?, location_name = ?, action_required = ?, created_at = ?
                WHERE id = ?
            """, (depth_m, location_name, action, now_iso, alert_id))
        else:
            alert_id = f"ALERT-DANGER-{node_id}-{uuid.uuid4().hex[:6].upper()}"
            conn.execute("""
                INSERT INTO alerts (
                    id, node_id, location_name, severity, depth_m, 
                    threshold_m, status, action_required, created_at
                ) VALUES (?, ?, ?, 'Danger', ?, ?, 'active', ?, ?)
            """, (alert_id, node_id, location_name, depth_m, threshold_m, action, now_iso))
            
    conn.close()
    return get_alert_by_id(alert_id, db_path)


def get_alert_by_id(alert_id: str, db_path: str = DB_PATH) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    conn = get_db_connection(db_path)
    cursor = conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_active_alerts(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieves all currently active alerts."""
    init_db(db_path)
    conn = get_db_connection(db_path)
    cursor = conn.execute("SELECT * FROM alerts WHERE status = 'active' ORDER BY depth_m DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_all_alerts(db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """Retrieves all alerts."""
    init_db(db_path)
    conn = get_db_connection(db_path)
    cursor = conn.execute("SELECT * FROM alerts ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_or_resolve_alert_by_node(node_id: str, db_path: str = DB_PATH) -> List[Dict[str, Any]]:
    """
    Deletes the active alert for a node from the database when pump is deployed.
    Returns the deleted alert records.
    """
    init_db(db_path)
    conn = get_db_connection(db_path)
    
    with conn:
        cursor = conn.execute(
            "SELECT * FROM alerts WHERE node_id = ?",
            (node_id,)
        )
        alerts_to_delete = [dict(r) for r in cursor.fetchall()]
        
        if alerts_to_delete:
            conn.execute(
                "DELETE FROM alerts WHERE node_id = ?",
                (node_id,)
            )
            
    conn.close()
    return alerts_to_delete


def clear_all_alerts(db_path: str = DB_PATH) -> int:
    """Removes all alerts (for test suites)."""
    init_db(db_path)
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.execute("DELETE FROM alerts")
        count = cursor.rowcount
    conn.close()
    return count


init_db()
