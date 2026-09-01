"""
AquaGNN - Pydantic Schemas for Topology API responses
"""

from typing import List, Optional
from pydantic import BaseModel


class NodeSchema(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    elevation_m: float
    node_type: str
    critical_tag: Optional[str] = None
    catchment_area_m2: float
    runoff_coeff: float
    surface_ponding_area_m2: float
    max_capacity_m3: float

    model_config = {"from_attributes": True}


class EdgeSchema(BaseModel):
    id: str
    source: str
    target: str
    street_name: Optional[str] = None
    conduit_type: str
    length_m: float
    diameter_or_width_m: float
    roughness_coeff: float

    model_config = {"from_attributes": True}


class TopologyResponse(BaseModel):
    nodes: List[NodeSchema]
    edges: List[EdgeSchema]
