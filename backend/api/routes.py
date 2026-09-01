"""
AquaGNN - FastAPI API Routes
"""

from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from .models import (
    RainfallScenarioRequest,
    PumpDeploymentRequest,
    MitigationDeployRequest,
    EvacuationRouteRequest,
    MitigationImpactResponse,
    PresetScenario,
    AlertModel
)
from ..engine.graph_builder import topology_builder
from ..engine.flood_engine import flood_engine
from ..engine.mitigation_engine import mitigation_engine
from ..database import get_active_alerts, get_all_alerts, clear_all_alerts

router = APIRouter(prefix="/api/v1")


@router.get("/network/topology", summary="Get Spatial Drainage Network & Road Topology")
async def get_network_topology() -> Dict[str, Any]:
    """
    Returns the complete GeoJSON FeatureCollection of the urban drainage network,
    including Point features for nodes and LineString features for stormwater conduits/streets.
    """
    try:
        return topology_builder.get_geojson_topology()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate network topology: {str(e)}")


@router.post("/simulation/run", summary="Run Hydrodynamic Urban Flood Nowcast Simulation")
async def run_simulation(payload: RainfallScenarioRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Executes a discrete-time hydrodynamic surrogate simulation coupling the specified
    rainfall hyetograph with the spatial drainage topology. Returns time-series predictions
    across t+0m to t+180m horizons. Automatically schedules background evaluation of danger
    depths (>0.6m) and persists 'Danger' Alert objects.
    """
    try:
        pumps_list = [{"node_id": p.node_id, "capacity_m3s": p.capacity_m3s} for p in (payload.pumps or [])]
        result = flood_engine.run_simulation(
            intensity_mm_hr=payload.intensity_mm_hr,
            duration_hrs=payload.duration_hrs,
            pattern=payload.pattern,
            pumps=pumps_list
        )
        # Background task: evaluate predictions and save danger alerts (>0.6m)
        background_tasks.add_task(
            mitigation_engine.evaluate_and_store_danger_alerts,
            simulation_result=result,
            depth_threshold_m=0.6,
            intensity_mm_hr=payload.intensity_mm_hr,
            pattern=payload.pattern
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")


@router.get("/alerts/hotspots", summary="Get Critical Choke Points & Flooded Road Corridors")
async def get_alerts_hotspots(
    intensity_mm_hr: float = Query(65.0, ge=0.0, le=250.0, description="Current storm intensity"),
    pattern: str = Query("cloudburst", description="Storm pattern type")
) -> Dict[str, Any]:
    """
    Identifies and ranks high-risk choke points and flooded road segments exceeding
    critical thresholds (>0.3m warning, >0.6m danger), complete with risk scores,
    affected critical infrastructure, and recommended mitigation actions.
    """
    try:
        hotspots = flood_engine.get_hotspot_alerts(
            intensity_mm_hr=intensity_mm_hr,
            pattern=pattern
        )
        return {
            "total_alerts": len(hotspots),
            "danger_count": sum(1 for h in hotspots if h["severity"] == "danger"),
            "critical_count": sum(1 for h in hotspots if h["severity"] == "critical"),
            "warning_count": sum(1 for h in hotspots if h["severity"] == "warning"),
            "hotspots": hotspots
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hotspot alerts: {str(e)}")


@router.get("/alerts/active", summary="Get Active Danger Alerts from Database")
async def get_database_active_alerts() -> Dict[str, Any]:
    """
    Retrieves all active 'Danger' alerts automatically generated when water depth exceeds 0.6m.
    """
    try:
        active_list = get_active_alerts()
        return {
            "count": len(active_list),
            "alerts": active_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query database alerts: {str(e)}")


@router.post("/mitigation/deploy", summary="Deploy Mitigation Pump with Negative Flow Offset & Clear Alert")
async def deploy_mitigation_pump(payload: MitigationDeployRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Deploys a mobile dewatering pump to a target node:
    1. Applies a negative flow offset (e.g. -2.5 m³/s) to that node.
    2. Deletes/resolves the active Danger alert from the database for that node.
    3. Triggers a GNN/hydrodynamic recomputation to show the water receding.
    """
    try:
        result = mitigation_engine.deploy_pump(
            node_id=payload.node_id,
            flow_offset_m3s=payload.flow_offset_m3s,
            intensity_mm_hr=payload.intensity_mm_hr or 75.0,
            duration_hrs=payload.duration_hrs or 2.0,
            pattern=payload.pattern or "cloudburst"
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mitigation deployment failed: {str(e)}")


@router.post("/mitigation/deploy-pump", summary="Deploy Mobile Dewatering Pump Sandbox (Comparison)")
async def deploy_pump_mitigation(payload: PumpDeploymentRequest) -> Dict[str, Any]:
    """
    Simulates deployment of a mobile high-capacity dewatering pump at a designated node.
    Evaluates before vs. after hydrodynamic flood depth reduction in real time.
    """
    try:
        g = flood_engine.base_graph
        if payload.node_id not in g:
            raise HTTPException(status_code=404, detail=f"Node ID '{payload.node_id}' does not exist in spatial topology.")

        # Baseline run (without new pump)
        existing_pumps_list = [{"node_id": p.node_id, "capacity_m3s": p.capacity_m3s} for p in (payload.existing_pumps or [])]
        baseline_sim = flood_engine.run_simulation(
            intensity_mm_hr=payload.intensity_mm_hr,
            duration_hrs=payload.duration_hrs,
            pattern=payload.pattern,
            pumps=existing_pumps_list
        )

        # Mitigated run (with newly deployed pump added)
        mitigated_pumps_list = list(existing_pumps_list)
        found = False
        for p in mitigated_pumps_list:
            if p["node_id"] == payload.node_id:
                p["capacity_m3s"] += payload.capacity_m3s
                found = True
                break
        if not found:
            mitigated_pumps_list.append({"node_id": payload.node_id, "capacity_m3s": payload.capacity_m3s})

        mitigated_sim = flood_engine.run_simulation(
            intensity_mm_hr=payload.intensity_mm_hr,
            duration_hrs=payload.duration_hrs,
            pattern=payload.pattern,
            pumps=mitigated_pumps_list
        )

        # Calculate peak frame differences
        base_peak = max(baseline_sim["frames"], key=lambda f: f["summary"]["total_flooded_volume_m3"])
        mit_peak = max(mitigated_sim["frames"], key=lambda f: f["summary"]["total_flooded_volume_m3"])

        target_node_base_depth = base_peak["nodes"][payload.node_id]["depth_m"]
        target_node_mit_depth = mit_peak["nodes"][payload.node_id]["depth_m"]
        depth_reduction_m = max(0.0, target_node_base_depth - target_node_mit_depth)
        depth_reduction_pct = (depth_reduction_m / max(0.01, target_node_base_depth)) * 100.0

        vol_diff = base_peak["summary"]["total_flooded_volume_m3"] - mit_peak["summary"]["total_flooded_volume_m3"]
        road_km_cleared = base_peak["summary"]["flooded_road_length_km"] - mit_peak["summary"]["flooded_road_length_km"]

        return {
            "success": True,
            "target_node": {
                "node_id": payload.node_id,
                "name": g.nodes[payload.node_id]["name"],
                "pump_capacity_m3s": payload.capacity_m3s,
                "baseline_peak_depth_m": target_node_base_depth,
                "mitigated_peak_depth_m": target_node_mit_depth,
                "depth_reduction_m": round(depth_reduction_m, 3),
                "depth_reduction_pct": round(depth_reduction_pct, 1)
            },
            "system_delta": {
                "flooded_volume_prevented_m3": round(max(0.0, vol_diff), 1),
                "flooded_road_km_cleared": round(max(0.0, road_km_cleared), 2),
                "baseline_danger_nodes": base_peak["summary"]["danger_nodes"],
                "mitigated_danger_nodes": mit_peak["summary"]["danger_nodes"],
                "danger_nodes_prevented": max(0, base_peak["summary"]["danger_nodes"] - mit_peak["summary"]["danger_nodes"])
            },
            "simulation": mitigated_sim
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pump mitigation calculation failed: {str(e)}")


@router.post("/routing/safe-route", summary="Compute Flood-Safe Emergency Transit & Evacuation Route")
async def get_safe_evacuation_route(payload: EvacuationRouteRequest) -> Dict[str, Any]:
    """
    Computes a flood-resilient shortest path route between two nodes on the urban graph.
    Avoids waterlogged and critical danger road links.
    """
    try:
        route = flood_engine.compute_safe_evacuation_route(
            origin_node=payload.origin_node,
            destination_node=payload.destination_node,
            time_min=payload.time_min
        )
        return route
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing computation failed: {str(e)}")


@router.get("/scenarios/presets", summary="Get Standard Storm Scenario Presets")
async def get_scenario_presets() -> List[Dict[str, Any]]:
    """
    Returns curated meteorological storm scenarios for realistic testing and operational drills.
    """
    return [
        {
            "id": "cloudburst-flash",
            "name": "Flash Cloudburst (80 mm/hr)",
            "description": "High-intensity short-duration convective cell with sharp peak at t=35m. Overwhelms underpasses and low-lying arterial corridors.",
            "intensity_mm_hr": 80.0,
            "duration_hrs": 1.5,
            "pattern": "cloudburst",
            "risk_level": "High",
            "historical_reference": "August 2021 Urban Flash Storm"
        },
        {
            "id": "monsoon-surge",
            "name": "Monsoon Atmospheric River (110 mm/hr)",
            "description": "Sustained dual-wave tropical downpour causing widespread drainage saturation and canal backwater.",
            "intensity_mm_hr": 110.0,
            "duration_hrs": 3.0,
            "pattern": "monsoon_surge",
            "risk_level": "Severe",
            "historical_reference": "December Atmospheric River Surge"
        },
        {
            "id": "extreme-100yr",
            "name": "100-Year Design Storm (140 mm/hr)",
            "description": "Catastrophic precipitation event exceeding 100-year municipal drainage return period. Triggers widespread city center inundation.",
            "intensity_mm_hr": 140.0,
            "duration_hrs": 2.5,
            "pattern": "extreme_100yr",
            "risk_level": "Critical",
            "historical_reference": "100-Year NOAA IDF Benchmark"
        },
        {
            "id": "moderate-rain",
            "name": "Moderate Steady Rainfall (35 mm/hr)",
            "description": "Standard continuous precipitation well within primary trunk conduit capacity with minor surface pooling.",
            "intensity_mm_hr": 35.0,
            "duration_hrs": 2.0,
            "pattern": "uniform",
            "risk_level": "Low",
            "historical_reference": "Typical Autumn Frontal System"
        }
    ]


@router.get("/health", summary="System Health & Status")
async def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "AquaGNN Urban Flood Nowcasting API",
        "version": "1.0.0",
        "graph_nodes": topology_builder.graph.number_of_nodes(),
        "graph_edges": topology_builder.graph.number_of_edges()
    }
