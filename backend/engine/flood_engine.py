"""
AquaGNN - Hydrodynamic Inundation Surrogate & Graph AI Engine
Implements discrete-time water balance simulation, Manning conveyance,
surface ponding depth calculations, choke-point detection, mobile pump
mitigation modeling, and flood-aware evacuation routing.
"""

from typing import Dict, List, Any, Optional, Tuple
import math
import copy
import networkx as nx
import numpy as np
from .graph_builder import UrbanTopologyBuilder, topology_builder
from .gnn_inference import gnn_service


class HydrodynamicFloodEngine:
    """
    Simulates rainfall runoff generation, pipe hydraulic flow propagation,
    subsurface vault surcharge, and street-level inundation dynamics.
    """

    def __init__(self, builder: Optional[UrbanTopologyBuilder] = None):
        self.builder = builder or topology_builder
        self.base_graph: nx.DiGraph = self.builder.graph
        self.current_scenario: Dict[str, Any] = {
            "preset_id": "moderate-rain",
            "scenario_name": "Moderate Steady Rainfall",
            "intensity_mm_hr": 35.0,
            "duration_hrs": 2.0,
            "pattern": "uniform",
            "risk_level": "Low"
        }


    def generate_rainfall_hyetograph(
        self,
        intensity_mm_hr: float,
        duration_hrs: float,
        pattern: str = "cloudburst",
        forecast_horizon_hrs: float = 3.0,
        time_step_mins: int = 15
    ) -> Dict[int, float]:
        """
        Generates rainfall intensity (mm/hr) time series across simulation steps.
        """
        total_mins = int(forecast_horizon_hrs * 60)
        time_steps = list(range(0, total_mins + 1, time_step_mins))
        hyetograph: Dict[int, float] = {}

        for t in time_steps:
            t_hr = t / 60.0
            if pattern == "uniform":
                if t_hr <= duration_hrs:
                    val = intensity_mm_hr
                else:
                    val = intensity_mm_hr * math.exp(-(t_hr - duration_hrs) * 1.5)
            elif pattern == "cloudburst":
                peak_time_hr = 0.6
                sigma = 0.28
                gaussian_factor = math.exp(-((t_hr - peak_time_hr) ** 2) / (2 * sigma ** 2))
                val = intensity_mm_hr * (0.2 + 2.2 * gaussian_factor)
                if t_hr > duration_hrs + 0.5:
                    val *= math.exp(-(t_hr - duration_hrs) * 2.0)
            elif pattern == "monsoon_surge":
                pulse1 = math.exp(-((t_hr - 0.75) ** 2) / (2 * 0.35 ** 2))
                pulse2 = 0.75 * math.exp(-((t_hr - 1.85) ** 2) / (2 * 0.30 ** 2))
                val = intensity_mm_hr * (0.35 + 1.6 * pulse1 + 1.2 * pulse2)
            elif pattern == "extreme_100yr":
                peak_factor = 2.6 if t_hr < 1.0 else 1.4
                val = intensity_mm_hr * peak_factor * math.exp(-0.25 * t_hr)
            else:
                val = intensity_mm_hr if t_hr <= duration_hrs else 0.0

            hyetograph[t] = max(0.0, round(val, 2))

        return hyetograph

    def run_simulation(
        self,
        intensity_mm_hr: float = 65.0,
        duration_hrs: float = 2.0,
        pattern: str = "cloudburst",
        pumps: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes hydrodynamic time-marching simulation across forecast horizons:
        t+0m, t+15m, t+30m, t+45m, t+60m, t+75m, t+90m, t+120m, t+180m.
        """
        pumps_map = {p["node_id"]: float(p.get("capacity_m3s", 1.0)) for p in (pumps or [])}
        hyetograph = self.generate_rainfall_hyetograph(
            intensity_mm_hr=intensity_mm_hr,
            duration_hrs=duration_hrs,
            pattern=pattern,
            forecast_horizon_hrs=3.0,
            time_step_mins=15
        )

        dt_sec = 60.0  # 1-minute integration step
        total_mins = 180
        report_intervals = [0, 15, 30, 45, 60, 75, 90, 120, 180]

        g = self.base_graph
        nodes = list(g.nodes())
        edges = list(g.edges())

        node_sub_vol: Dict[str, float] = {n: 0.0 for n in nodes}
        node_surf_vol: Dict[str, float] = {n: 0.0 for n in nodes}
        node_depths_history: Dict[str, Dict[int, float]] = {n: {} for n in nodes}
        edge_flows_history: Dict[str, Dict[int, float]] = {g.edges[e]["edge_id"]: {} for e in edges}
        edge_utilization_history: Dict[str, Dict[int, float]] = {g.edges[e]["edge_id"]: {} for e in edges}

        sorted_nodes = sorted(nodes, key=lambda n: g.nodes[n]["elevation_m"], reverse=True)

        current_minute = 0
        while current_minute <= total_mins:
            t_keys = sorted(hyetograph.keys())
            rain_rate = hyetograph.get(current_minute, 0.0)
            if current_minute not in hyetograph:
                lower_t = max([k for k in t_keys if k <= current_minute])
                upper_t = min([k for k in t_keys if k >= current_minute])
                if lower_t == upper_t:
                    rain_rate = hyetograph[lower_t]
                else:
                    weight = (current_minute - lower_t) / float(upper_t - lower_t)
                    rain_rate = (1.0 - weight) * hyetograph[lower_t] + weight * hyetograph[upper_t]

            # Inflow generation (Q = C * I * A)
            rain_m_s = (rain_rate * 1e-3) / 3600.0

            q_runoff_in: Dict[str, float] = {}
            for n in nodes:
                n_data = g.nodes[n]
                # Depressed underpasses collect higher direct surface runoff from descending road slopes
                conc_factor = 2.2 if n_data.get("node_type") == "underpass" else 1.0
                q_runoff = n_data["runoff_coeff"] * rain_m_s * n_data["catchment_area_m2"] * conc_factor
                q_runoff_in[n] = q_runoff

            # Edge pipe conveyance
            q_edge_flow: Dict[Tuple[str, str], float] = {}
            for u, v in edges:
                e_data = g.edges[u, v]
                c_type = e_data.get("conduit_type", "")
                is_overland = "surface" in c_type or "relief" in c_type

                z_u = g.nodes[u]["elevation_m"] + (node_surf_vol[u] / g.nodes[u]["surface_ponding_area_m2"])
                z_v = g.nodes[v]["elevation_m"] + (node_surf_vol[v] / g.nodes[v]["surface_ponding_area_m2"])
                head_grad = max(0.01, (z_u - z_v) / max(1.0, e_data["length_m"]))

                if not is_overland:
                    # Underground pipe flow
                    q_max = e_data["max_flow_rate_m3s"]
                    # If underpass conduit, gravity outflow is hydraulically constrained
                    if g.nodes[u].get("node_type") == "underpass":
                        q_max = min(1.1, q_max * 0.45)

                    avail_rate = (node_sub_vol[u] / dt_sec) + q_runoff_in[u]
                    desired_flow = min(q_max * math.sqrt(head_grad / max(0.001, e_data["slope"])), avail_rate)
                    q_edge_flow[(u, v)] = max(0.0, min(q_max, desired_flow))
                else:
                    # Overland flow link - only active when surface depth exceeds curb (0.15m)
                    surf_depth_u = node_surf_vol[u] / g.nodes[u]["surface_ponding_area_m2"]
                    if surf_depth_u > 0.15:
                        excess_head = surf_depth_u - 0.15
                        q_overland_cap = e_data["max_flow_rate_m3s"]
                        q_spill = min(q_overland_cap, excess_head * 3.5 * math.sqrt(head_grad))
                        q_edge_flow[(u, v)] = max(0.0, min(q_overland_cap, q_spill))
                    else:
                        q_edge_flow[(u, v)] = 0.0

            # Node updates
            for n in sorted_nodes:
                n_data = g.nodes[n]
                inflow_sub = sum(
                    q_edge_flow.get((pred, n), 0.0)
                    for pred in g.predecessors(n)
                    if "surface" not in g.edges[pred, n].get("conduit_type", "")
                )
                outflow_sub = sum(
                    q_edge_flow.get((n, succ), 0.0)
                    for succ in g.successors(n)
                    if "surface" not in g.edges[n, succ].get("conduit_type", "")
                )

                # Subsurface chamber accumulation
                net_sub_in = (q_runoff_in[n] + inflow_sub - outflow_sub) * dt_sec
                node_sub_vol[n] = max(0.0, node_sub_vol[n] + net_sub_in)

                # Surcharge
                surcharge_vol = 0.0
                if node_sub_vol[n] > n_data["max_capacity_m3"]:
                    surcharge_vol = node_sub_vol[n] - n_data["max_capacity_m3"]
                    node_sub_vol[n] = n_data["max_capacity_m3"]

                # Marine tidal outfall drainage
                outfall_drain_rate = 0.0
                if n_data.get("is_outfall", False):
                    outfall_drain_rate = 22.0  # m3/s free marine discharge

                # Mobile pump
                pump_rate = pumps_map.get(n, 0.0) + n_data.get("deployed_pump_m3s", 0.0)

                # Overland incoming and outgoing
                inflow_overland = sum(
                    q_edge_flow.get((pred, n), 0.0)
                    for pred in g.predecessors(n)
                    if "surface" in g.edges[pred, n].get("conduit_type", "")
                )
                outflow_overland = sum(
                    q_edge_flow.get((n, succ), 0.0)
                    for succ in g.successors(n)
                    if "surface" in g.edges[n, succ].get("conduit_type", "")
                )

                # Net surface balance
                net_surf = (surcharge_vol + inflow_overland * dt_sec) - (outfall_drain_rate + pump_rate + outflow_overland) * dt_sec
                node_surf_vol[n] = max(0.0, node_surf_vol[n] + net_surf)

            # Record history at report intervals
            if current_minute in report_intervals:
                for n in nodes:
                    depth = node_surf_vol[n] / g.nodes[n]["surface_ponding_area_m2"]
                    node_depths_history[n][current_minute] = round(max(0.0, depth), 3)

                for u, v in edges:
                    e_id = g.edges[u, v]["edge_id"]
                    flow = q_edge_flow.get((u, v), 0.0)
                    cap = g.edges[u, v]["max_flow_rate_m3s"]
                    util = (flow / cap) * 100.0 if cap > 0 else 0.0
                    edge_flows_history[e_id][current_minute] = round(flow, 3)
                    edge_utilization_history[e_id][current_minute] = round(min(125.0, util), 1)

            current_minute += 1

        time_series_frames = []
        for t in report_intervals:
            node_results = {}
            warning_count = 0
            critical_count = 0
            danger_count = 0
            total_surf_vol = 0.0

            for n in nodes:
                d = node_depths_history[n][t]
                n_meta = g.nodes[n]
                vol = d * n_meta["surface_ponding_area_m2"]
                total_surf_vol += vol

                if d >= 0.6:
                    status = "danger"
                    danger_count += 1
                elif d >= 0.3:
                    status = "critical"
                    critical_count += 1
                elif d >= 0.1:
                    status = "warning"
                    warning_count += 1
                else:
                    status = "normal"

                node_results[n] = {
                    "node_id": n,
                    "name": n_meta["name"],
                    "depth_m": d,
                    "volume_m3": round(vol, 1),
                    "status": status,
                    "elevation_m": n_meta["elevation_m"],
                    "node_type": n_meta["node_type"],
                    "has_pump": n in pumps_map or n_meta.get("deployed_pump_m3s", 0) > 0,
                    "pump_capacity_m3s": pumps_map.get(n, n_meta.get("deployed_pump_m3s", 0.0))
                }

            edge_results = {}
            choke_count = 0
            flooded_road_length_m = 0.0

            for u, v in edges:
                e_data = g.edges[u, v]
                e_id = e_data["edge_id"]
                flow = edge_flows_history[e_id][t]
                util = edge_utilization_history[e_id][t]

                u_depth = node_depths_history[u][t]
                v_depth = node_depths_history[v][t]
                avg_depth = (u_depth + v_depth) / 2.0
                is_submerged = avg_depth >= 0.3
                is_choked = util >= 80.0

                if is_choked:
                    choke_count += 1
                if is_submerged:
                    flooded_road_length_m += e_data["length_m"]

                edge_results[e_id] = {
                    "edge_id": e_id,
                    "source": u,
                    "target": v,
                    "street_name": e_data["street_name"],
                    "conduit_type": e_data["conduit_type"],
                    "flow_m3s": flow,
                    "utilization_pct": util,
                    "is_choked": is_choked,
                    "avg_depth_m": round(avg_depth, 3),
                    "is_submerged": is_submerged
                }

            time_series_frames.append({
                "time_min": t,
                "rain_intensity_mm_hr": hyetograph.get(t, 0.0),
                "summary": {
                    "peak_flood_depth_m": round(max(node_depths_history[n][t] for n in nodes), 2),
                    "surface_ponding_m3": round(total_surf_vol, 1),
                    "flooded_road_km": round(flooded_road_length_m / 1000.0, 2),
                    "hazard_nodes": {
                        "danger": danger_count,
                        "critical": critical_count,
                        "warning": warning_count,
                        "total": danger_count + critical_count + warning_count
                    },
                    "total_flooded_volume_m3": round(total_surf_vol, 1),
                    "flooded_road_length_km": round(flooded_road_length_m / 1000.0, 2),
                    "danger_nodes": danger_count,
                    "critical_nodes": critical_count,
                    "warning_nodes": warning_count,
                    "choke_conduits": choke_count,
                    "peak_depth_m": round(max(node_depths_history[n][t] for n in nodes), 2)
                },
                "nodes": node_results,
                "edges": edge_results
            })

        all_depths = [node_depths_history[n][t] for n in nodes for t in report_intervals]
        max_overall_depth = max(all_depths) if all_depths else 0.0

        horizon_summaries = {str(f["time_min"]): f["summary"] for f in time_series_frames}
        frames_by_horizon = {str(f["time_min"]): f for f in time_series_frames}

        peak_frame = max(
            time_series_frames,
            key=lambda f: f["summary"]["total_flooded_volume_m3"]
        ) if time_series_frames else None

        return {
            "scenario": {
                "intensity_mm_hr": intensity_mm_hr,
                "duration_hrs": duration_hrs,
                "pattern": pattern,
                "active_pumps_count": len(pumps_map)
            },
            "hyetograph": hyetograph,
            "time_steps_min": report_intervals,
            "horizon_summaries": horizon_summaries,
            "frames_by_horizon": frames_by_horizon,
            "frames": time_series_frames,
            "overall_summary": {
                "max_peak_depth_m": round(max_overall_depth, 2),
                "peak_surface_ponding_m3": peak_frame["summary"]["surface_ponding_m3"] if peak_frame else 0.0,
                "peak_time_min": peak_frame["time_min"] if peak_frame else 60
            }
        }

    def run_recompute_simulation(
        self,
        precipitation_rate_mm_hr: Optional[float] = 35.0,
        preset_id: Optional[str] = None,
        active_pumps: Optional[List[Dict[str, Any]]] = None,
        duration_hrs: Optional[float] = None,
        pattern: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes discrete-time hydrodynamic surrogate recomputation across all 9 forecast horizons
        (t+0m, +15m, +30m, +45m, +60m, +75m, +90m, +120m, +180m).
        """
        presets_map = {
            "cloudburst-flash": {
                "intensity_mm_hr": 80.0,
                "duration_hrs": 1.5,
                "pattern": "cloudburst"
            },
            "monsoon-surge": {
                "intensity_mm_hr": 110.0,
                "duration_hrs": 3.0,
                "pattern": "monsoon_surge"
            },
            "extreme-100yr": {
                "intensity_mm_hr": 140.0,
                "duration_hrs": 2.5,
                "pattern": "extreme_100yr"
            },
            "moderate-rain": {
                "intensity_mm_hr": 35.0,
                "duration_hrs": 2.0,
                "pattern": "uniform"
            }
        }

        intensity = 35.0
        dur = 2.0
        pat = "cloudburst"

        if preset_id and preset_id in presets_map:
            p_config = presets_map[preset_id]
            intensity = p_config["intensity_mm_hr"]
            dur = p_config["duration_hrs"]
            pat = p_config["pattern"]

        if precipitation_rate_mm_hr is not None:
            intensity = float(precipitation_rate_mm_hr)
        if duration_hrs is not None:
            dur = float(duration_hrs)
        if pattern is not None:
            pat = pattern

        res = self.run_simulation(
            intensity_mm_hr=intensity,
            duration_hrs=dur,
            pattern=pat,
            pumps=active_pumps
        )
        
        # --- GNN INFERENCE INTEGRATION ---
        # Run the actual GNN model predictions over the base frame
        base_nodes = res["frames"][0]["nodes"] if res.get("frames") else {}
        gnn_forecast = gnn_service.predict_horizons(
            current_nodes=base_nodes,
            precipitation_mm_hr=intensity,
            pattern=pat
        )
        res["gnn_forecast"] = gnn_forecast
        
        res["scenario"]["preset_id"] = preset_id
        res["scenario"]["precipitation_rate_mm_hr"] = intensity
        return res

    def apply_scenario(self, scenario_name: str) -> Dict[str, Any]:
        """
        Updates the global flood_engine state with the scenario's precipitation intensity,
        duration, and storm pattern based on scenario name or preset id.
        """
        norm_name = scenario_name.strip().lower().replace("_", "-").replace(" ", "-")
        
        presets = {
            "cloudburst-flash": {
                "preset_id": "cloudburst-flash",
                "scenario_name": "Flash Cloudburst",
                "intensity_mm_hr": 80.0,
                "duration_hrs": 1.5,
                "pattern": "cloudburst",
                "risk_level": "High",
                "historical_reference": "August 2021 Urban Flash Storm"
            },
            "monsoon-surge": {
                "preset_id": "monsoon-surge",
                "scenario_name": "Monsoon Atmospheric River",
                "intensity_mm_hr": 110.0,
                "duration_hrs": 3.0,
                "pattern": "monsoon_surge",
                "risk_level": "Severe",
                "historical_reference": "December Atmospheric River Surge"
            },
            "extreme-100yr": {
                "preset_id": "extreme-100yr",
                "scenario_name": "100-Year Design Storm",
                "intensity_mm_hr": 140.0,
                "duration_hrs": 2.5,
                "pattern": "extreme_100yr",
                "risk_level": "Critical",
                "historical_reference": "100-Year NOAA IDF Benchmark"
            },
            "moderate-rain": {
                "preset_id": "moderate-rain",
                "scenario_name": "Moderate Steady Rainfall",
                "intensity_mm_hr": 35.0,
                "duration_hrs": 2.0,
                "pattern": "uniform",
                "risk_level": "Low",
                "historical_reference": "Typical Autumn Frontal System"
            }
        }
        
        matched_key = None
        if "cloudburst" in norm_name or "flash" in norm_name:
            matched_key = "cloudburst-flash"
        elif "monsoon" in norm_name or "river" in norm_name or "surge" in norm_name:
            matched_key = "monsoon-surge"
        elif "100" in norm_name or "extreme" in norm_name or "century" in norm_name:
            matched_key = "extreme-100yr"
        elif "steady" in norm_name or "moderate" in norm_name or "uniform" in norm_name:
            matched_key = "moderate-rain"
        elif norm_name in presets:
            matched_key = norm_name
        else:
            matched_key = "moderate-rain"
            
        selected = copy.deepcopy(presets[matched_key])
        self.current_scenario = selected
        return selected



    def get_hotspot_alerts(
        self,
        simulation_result: Optional[Dict[str, Any]] = None,
        intensity_mm_hr: float = 75.0,
        pattern: str = "cloudburst"
    ) -> List[Dict[str, Any]]:
        """
        Identifies and ranks critical choke points, submerged road corridors,
        and high-risk municipal infrastructure.
        """
        if not simulation_result:
            simulation_result = self.run_simulation(
                intensity_mm_hr=intensity_mm_hr,
                pattern=pattern
            )

        frames = simulation_result["frames"]
        peak_frame = max(frames, key=lambda f: f["summary"]["total_flooded_volume_m3"])
        t_peak = peak_frame["time_min"]
        nodes_state = peak_frame["nodes"]

        hotspots: List[Dict[str, Any]] = []

        for n_id, n_info in nodes_state.items():
            depth = n_info["depth_m"]
            if depth >= 0.12:
                base_score = min(100.0, depth * 80.0)
                n_meta = self.base_graph.nodes[n_id]
                if n_meta["node_type"] == "underpass":
                    base_score = min(100.0, base_score + 25.0)
                if "Hospital" in n_meta["critical_tag"]:
                    base_score = min(100.0, base_score + 30.0)

                severity = "danger" if depth >= 0.6 else ("critical" if depth >= 0.3 else "warning")
                rec_pump_m3s = 0.8 if depth < 0.3 else (1.5 if depth < 0.6 else 2.5)

                hotspots.append({
                    "id": f"ALERT-{n_id}",
                    "node_id": n_id,
                    "location_name": n_info["name"],
                    "critical_tag": n_meta["critical_tag"],
                    "node_type": n_meta["node_type"],
                    "peak_depth_m": depth,
                    "severity": severity,
                    "risk_score": round(base_score, 1),
                    "time_to_peak_min": t_peak,
                    "volume_m3": n_info["volume_m3"],
                    "elevation_m": n_info["elevation_m"],
                    "recommended_pump_m3s": rec_pump_m3s,
                    "lat": n_meta["lat"],
                    "lon": n_meta["lon"],
                    "action_required": (
                        "Immediate arterial closure & dispatch heavy dewatering pump unit"
                        if severity == "danger"
                        else ("Traffic speed reduction & standby mobile pump deployment" if severity == "critical" else "Monitoring stormwater level")
                    )
                })

        hotspots.sort(key=lambda h: h["risk_score"], reverse=True)
        return hotspots

    def compute_safe_evacuation_route(
        self,
        origin_node: str,
        destination_node: str,
        simulation_result: Optional[Dict[str, Any]] = None,
        time_min: int = 60
    ) -> Dict[str, Any]:
        """
        Computes dynamic shortest-path emergency route using flood-weighted Dijkstra.
        """
        g = self.base_graph

        if origin_node not in g or destination_node not in g:
            return {
                "success": False,
                "error": f"Invalid origin '{origin_node}' or destination '{destination_node}'."
            }

        if not simulation_result:
            simulation_result = self.run_simulation(intensity_mm_hr=75.0, pattern="cloudburst")

        target_frame = simulation_result["frames"][0]
        for f in simulation_result["frames"]:
            if f["time_min"] <= time_min:
                target_frame = f

        node_depths = {n: target_frame["nodes"][n]["depth_m"] for n in g.nodes()}
        route_graph = nx.Graph()

        for u, v, data in g.edges(data=True):
            depth_u = node_depths.get(u, 0.0)
            depth_v = node_depths.get(v, 0.0)
            avg_depth = (depth_u + depth_v) / 2.0
            base_len = data["length_m"]

            penalty = 1.0 + 35.0 * (avg_depth ** 2)
            if avg_depth >= 0.3:
                penalty += 60.0 * (avg_depth - 0.2)
            if avg_depth >= 0.6:
                penalty += 600.0

            cost = base_len * penalty
            route_graph.add_edge(
                u,
                v,
                weight=cost,
                base_length_m=base_len,
                avg_depth_m=avg_depth,
                street_name=data["street_name"],
                edge_id=data["edge_id"]
            )

        try:
            path_nodes = nx.shortest_path(route_graph, source=origin_node, target=destination_node, weight="weight")
            total_dist_m = sum(
                route_graph[path_nodes[i]][path_nodes[i + 1]]["base_length_m"]
                for i in range(len(path_nodes) - 1)
            )
            max_depth_on_route = max(node_depths[n] for n in path_nodes)
            route_coords = [[g.nodes[n]["lon"], g.nodes[n]["lat"]] for n in path_nodes]

            path_segments = []
            for i in range(len(path_nodes) - 1):
                u, v = path_nodes[i], path_nodes[i + 1]
                edge_meta = route_graph[u][v]
                path_segments.append({
                    "from_node": u,
                    "to_node": v,
                    "street_name": edge_meta["street_name"],
                    "length_m": edge_meta["base_length_m"],
                    "water_depth_m": round(edge_meta["avg_depth_m"], 3)
                })

            return {
                "success": True,
                "origin": origin_node,
                "destination": destination_node,
                "time_horizon_min": time_min,
                "total_distance_km": round(total_dist_m / 1000.0, 2),
                "max_flood_depth_on_route_m": round(max_depth_on_route, 2),
                "is_route_safe": max_depth_on_route < 0.25,
                "path_nodes": path_nodes,
                "path_coordinates": route_coords,
                "segments": path_segments
            }
        except nx.NetworkXNoPath:
            return {
                "success": False,
                "error": "No safe evacuation route available. Target zone isolated by inundation barriers."
            }


# Singleton flood engine instance
flood_engine = HydrodynamicFloodEngine()
