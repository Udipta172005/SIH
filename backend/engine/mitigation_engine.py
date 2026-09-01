"""
AquaGNN - Mitigation & Alerting Engine
Background task evaluation for danger thresholds (>0.6m), automated alert generation,
pump deployment with negative flow offset, alert resolution, and GNN flood recomputation.
"""

from typing import Dict, List, Any, Optional
import math
from ..database import save_danger_alert, delete_or_resolve_alert_by_node, get_active_alerts
from .flood_engine import flood_engine


class MitigationAndAlertEngine:
    """
    Manages automated background evaluation of GNN flood predictions,
    danger alert persistence, and negative flow pump deployment mitigation.
    """

    def __init__(self, engine=None):
        self.flood_engine = engine or flood_engine
        # In-memory registry of persistently deployed mitigation pumps
        self.active_deployed_pumps: Dict[str, float] = {}

    def reset_deployments(self) -> None:
        """Resets active pump deployments."""
        self.active_deployed_pumps.clear()

    def evaluate_and_store_danger_alerts(
        self,
        simulation_result: Optional[Dict[str, Any]] = None,
        depth_threshold_m: float = 0.6,
        intensity_mm_hr: float = 75.0,
        pattern: str = "cloudburst"
    ) -> List[Dict[str, Any]]:
        """
        Background task: Evaluates GNN/hydrodynamic predicted water depths.
        If any unmitigated node's peak depth exceeds depth_threshold_m (0.6m), automatically
        generates a 'Danger' Alert object and saves it to the database.
        """
        if not simulation_result:
            simulation_result = self.flood_engine.run_simulation(
                intensity_mm_hr=intensity_mm_hr,
                pattern=pattern
            )

        g = self.flood_engine.base_graph
        peak_frame = max(
            simulation_result["frames"],
            key=lambda f: f["summary"]["total_flooded_volume_m3"]
        )
        nodes_state = peak_frame["nodes"]

        created_alerts: List[Dict[str, Any]] = []

        for node_id, node_info in nodes_state.items():
            # If node is actively mitigated by pump deployment, do not generate active alert
            if node_id in self.active_deployed_pumps:
                continue

            depth = node_info["depth_m"]
            if depth >= depth_threshold_m:
                node_name = node_info.get("name", g.nodes[node_id].get("name", node_id))
                action = (
                    f"CRITICAL OVERFLOW: Depth {depth:.2f}m >= {depth_threshold_m:.2f}m. "
                    f"Immediate closure & deploy high-capacity pump (-2.5 m³/s)."
                )
                alert = save_danger_alert(
                    node_id=node_id,
                    location_name=node_name,
                    depth_m=depth,
                    threshold_m=depth_threshold_m,
                    action_required=action
                )
                created_alerts.append(alert)

        return created_alerts

    def deploy_pump(
        self,
        node_id: str,
        flow_offset_m3s: float = -2.5,
        intensity_mm_hr: float = 75.0,
        duration_hrs: float = 2.0,
        pattern: str = "cloudburst"
    ) -> Dict[str, Any]:
        """
        Deploys a mobile dewatering pump with a negative flow offset (e.g. -2.5 m³/s).
        1. Deletes/resolves active Danger alert for node_id from the database.
        2. Records pump capacity in active deployments.
        3. Triggers GNN recomputation to show water receding.
        4. Returns telemetry, baseline comparison, and updated simulation frames.
        """
        g = self.flood_engine.base_graph
        if node_id not in g:
            raise ValueError(f"Node ID '{node_id}' does not exist in spatial topology.")

        # Extraction capacity is positive magnitude of negative flow offset
        extraction_rate = abs(flow_offset_m3s)
        if extraction_rate == 0.0:
            extraction_rate = 2.5

        # 1. Baseline simulation (prior to new deployment)
        baseline_pumps = [
            {"node_id": n, "capacity_m3s": cap}
            for n, cap in self.active_deployed_pumps.items()
        ]
        baseline_sim = self.flood_engine.run_simulation(
            intensity_mm_hr=intensity_mm_hr,
            duration_hrs=duration_hrs,
            pattern=pattern,
            pumps=baseline_pumps
        )

        # 2. Register pump deployment
        self.active_deployed_pumps[node_id] = self.active_deployed_pumps.get(node_id, 0.0) + extraction_rate

        # 3. Delete active alert from database
        deleted_alerts = delete_or_resolve_alert_by_node(node_id)

        # 4. Trigger GNN recomputation with all active pumps
        mitigated_pumps = [
            {"node_id": n, "capacity_m3s": cap}
            for n, cap in self.active_deployed_pumps.items()
        ]
        mitigated_sim = self.flood_engine.run_simulation(
            intensity_mm_hr=intensity_mm_hr,
            duration_hrs=duration_hrs,
            pattern=pattern,
            pumps=mitigated_pumps
        )

        # 5. Background check: Evaluate any remaining danger alerts in recomputed state
        self.evaluate_and_store_danger_alerts(mitigated_sim, depth_threshold_m=0.6)

        # 6. Calculate peak metrics
        base_peak = max(baseline_sim["frames"], key=lambda f: f["summary"]["total_flooded_volume_m3"])
        mit_peak = max(mitigated_sim["frames"], key=lambda f: f["summary"]["total_flooded_volume_m3"])

        base_depth = base_peak["nodes"][node_id]["depth_m"]
        mit_depth = mit_peak["nodes"][node_id]["depth_m"]
        depth_drop_m = max(0.0, base_depth - mit_depth)
        depth_drop_pct = (depth_drop_m / max(0.01, base_depth)) * 100.0

        vol_prevented = base_peak["summary"]["total_flooded_volume_m3"] - mit_peak["summary"]["total_flooded_volume_m3"]
        road_km_cleared = base_peak["summary"]["flooded_road_length_km"] - mit_peak["summary"]["flooded_road_length_km"]

        return {
            "success": True,
            "node_id": node_id,
            "node_name": g.nodes[node_id]["name"],
            "flow_offset_m3s": -extraction_rate,
            "pump_capacity_m3s": extraction_rate,
            "deleted_alerts": deleted_alerts,
            "alerts_resolved_count": len(deleted_alerts),
            "target_node_metrics": {
                "baseline_peak_depth_m": base_depth,
                "mitigated_peak_depth_m": mit_depth,
                "depth_reduction_m": round(depth_drop_m, 3),
                "depth_reduction_pct": round(depth_drop_pct, 1),
                "water_receded": depth_drop_m > 0.0
            },
            "system_delta": {
                "flooded_volume_prevented_m3": round(max(0.0, vol_prevented), 1),
                "flooded_road_km_cleared": round(max(0.0, road_km_cleared), 2),
                "baseline_danger_nodes": base_peak["summary"]["danger_nodes"],
                "mitigated_danger_nodes": mit_peak["summary"]["danger_nodes"],
                "danger_nodes_prevented": max(0, base_peak["summary"]["danger_nodes"] - mit_peak["summary"]["danger_nodes"])
            },
            "recomputed_simulation": mitigated_sim
        }


mitigation_engine = MitigationAndAlertEngine()
