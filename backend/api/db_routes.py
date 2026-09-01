"""
AquaGNN - Database-backed Topology & Alerts API Routes
Adds GET /api/v1/topology and GET /api/v1/alerts reading from SQLite.
"""

from typing import Dict, List, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..models.node import Node
from ..models.edge import Edge
from ..models.alert import Alert
from ..schemas.topology import NodeSchema, EdgeSchema, TopologyResponse
from ..schemas.alerts import AlertSchema, AlertsResponse

db_router = APIRouter(prefix="/api/v1")


@db_router.get("/topology", summary="Get Drainage Topology from Database", response_model=TopologyResponse)
def get_topology(db: Session = Depends(get_db)):
    """
    Returns the full drainage network topology (nodes + edges) stored in the database.
    """
    nodes = db.query(Node).all()
    edges = db.query(Edge).all()

    node_schemas = [
        NodeSchema(
            id=n.id,
            name=n.name,
            latitude=n.latitude,
            longitude=n.longitude,
            elevation_m=n.elevation_m,
            node_type=n.node_type,
            critical_tag=n.critical_tag,
            catchment_area_m2=n.catchment_area_m2,
            runoff_coeff=n.runoff_coeff,
            surface_ponding_area_m2=n.surface_ponding_area_m2,
            max_capacity_m3=n.max_capacity_m3,
        )
        for n in nodes
    ]

    edge_schemas = [
        EdgeSchema(
            id=e.id,
            source=e.source_node_id,
            target=e.target_node_id,
            street_name=e.street_name,
            conduit_type=e.conduit_type,
            length_m=e.length_m,
            diameter_or_width_m=e.diameter_or_width_m,
            roughness_coeff=e.roughness_coeff,
        )
        for e in edges
    ]

    return TopologyResponse(nodes=node_schemas, edges=edge_schemas)


@db_router.get("/alerts", summary="Get Active Alerts from Database", response_model=AlertsResponse)
def get_alerts(
    active_only: bool = Query(True, description="Return only active alerts"),
    db: Session = Depends(get_db),
):
    """
    Returns alerts stored in the database.
    By default, returns only active alerts.
    """
    query = db.query(Alert)
    if active_only:
        query = query.filter(Alert.active == True)  # noqa: E712
    alerts = query.order_by(Alert.created_at.desc()).all()

    alert_schemas = [
        AlertSchema(
            id=a.id,
            node_id=a.node_id,
            alert_type=a.alert_type,
            severity=a.severity,
            message=a.message,
            active=a.active,
            created_at=a.created_at,
        )
        for a in alerts
    ]

    return AlertsResponse(alerts=alert_schemas)
