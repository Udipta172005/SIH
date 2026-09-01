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


class SimulationRecomputeRequest(BaseModel):
    precipitation_rate_mm_hr: Optional[float] = Field(None, ge=0.0, le=250.0, description="Precipitation rate in mm/hr")
    preset_id: Optional[str] = Field(None, description="Preset scenario ID (e.g. 'cloudburst-flash', 'monsoon-surge', 'extreme-100yr', 'moderate-rain')")
    active_pumps: Optional[List[PumpConfig]] = Field(default_factory=list, description="Active mobile dewatering pumps")
    duration_hrs: Optional[float] = Field(None, ge=0.5, le=12.0, description="Storm duration in hours")
    pattern: Optional[str] = Field(None, description="Storm pattern override: 'uniform' | 'cloudburst' | 'monsoon_surge' | 'extreme_100yr'")


class TelemetryReading(BaseModel):
    node_id: str = Field(..., description="Sensor node ID (e.g. 'ND-04')")
    water_level_m: float = Field(..., ge=0.0, le=10.0, description="Current water depth in meters")
    timestamp: str = Field(..., description="ISO 8601 timestamp of the reading")


class TelemetryIngestRequest(BaseModel):
    precipitation_mm_hr: float = Field(..., ge=0.0, le=250.0, description="Current precipitation rate in mm/hr")
    readings: List[TelemetryReading] = Field(..., description="List of sensor readings from all monitored nodes")
    cycle: int = Field(..., ge=1, description="Simulator cycle number")


class MitigationDeployRequest(BaseModel):
    node_id: str = Field(..., description="Target node ID for dewatering pump deployment")
    flow_offset_m3s: float = Field(-2.5, description="Negative flow offset / extraction rate in m3/s (e.g. -2.5)")
    intensity_mm_hr: Optional[float] = Field(75.0, ge=0.0, le=250.0, description="Storm intensity for recomputation")
    duration_hrs: Optional[float] = Field(2.0, ge=0.5, le=12.0, description="Storm duration in hours")
    pattern: Optional[str] = Field("cloudburst", description="Storm pattern for recomputation")


class AlertModel(BaseModel):
    id: str
    node_id: str
    location_name: Optional[str] = None
    severity: str = "Danger"
    depth_m: float
    threshold_m: float = 0.6
    status: str = "active"
    action_required: Optional[str] = None
    created_at: str
    resolved_at: Optional[str] = None
