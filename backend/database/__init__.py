"""
AquaGNN Database Package
"""
from .db import engine, SessionLocal, Base, get_db, init_db
from .alert_store import (
    save_danger_alert,
    delete_or_resolve_alert_by_node,
    get_active_alerts,
    get_all_alerts,
    clear_all_alerts,
    get_alert_by_id
)

__all__ = [
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    "init_db",
    "save_danger_alert",
    "delete_or_resolve_alert_by_node",
    "get_active_alerts",
    "get_all_alerts",
    "clear_all_alerts",
    "get_alert_by_id"
]
