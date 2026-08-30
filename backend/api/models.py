"""
AquaGNN - Pydantic Data Models & Schemas
"""

from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class PumpConfig(BaseModel):
    node_id: str = Field(..., description="Target node ID for mobile dewatering pump")
    capacity_m3s: float = Field(1.0, ge=0.1, le=10.0, description="Dewatering extraction rate in m3/s")


class RainfallScenarioRequest(BaseModel):
    intensity_mm_hr: float = Field(65.0, ge=0.0, le=250.0, description="Rainfall intensity in mm/hr")
    duration_hrs: float = Field(2.0, ge=0.5, le=12.0, description="Storm duration in hours")
    pattern: str = Field("cloudburst", description="Storm pattern: 'uniform' | 'cloudburst' | 'monsoon_surge' | 'extreme_100yr'")
    pumps: Optional[List[PumpConfig]] = Field(default_factory=list, description="Active mobile dewatering pumps")


class PumpDeploymentRequest(BaseModel):
    node_id: str = Field(..., description="Target node ID for dewatering pump")
    capacity_m3s: float = Field(1.2, ge=0.1, le=10.0, description="Pump capacity in m3/s")
    intensity_mm_hr: float = Field(70.0, ge=0.0, le=250.0)
    duration_hrs: float = Field(2.0, ge=0.5, le=12.0)
    pattern: str = Field("cloudburst")
    existing_pumps: Optional[List[PumpConfig]] = Field(default_factory=list)


class EvacuationRouteRequest(BaseModel):
    origin_node: str = Field("ND-01", description="Origin intersection/manhole node ID")
    destination_node: str = Field("ND-OF01", description="Safe destination node ID (e.g. emergency evacuation shelter/outfall)")
    time_min: int = Field(60, ge=0, le=180, description="Forecast time slice in minutes (0, 30, 60, 90, 120, 180)")
    intensity_mm_hr: float = Field(70.0)
    pattern: str = Field("cloudburst")


class MitigationImpactResponse(BaseModel):
    success: bool
    deployed_pump: PumpConfig
    comparison: Dict[str, Any]
    simulation: Dict[str, Any]


class PresetScenario(BaseModel):
    id: str
    name: str
    description: str
    intensity_mm_hr: float
    duration_hrs: float
    pattern: str
    icon: str
    historical_reference: str
