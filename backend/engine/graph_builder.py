"""
AquaGNN - Urban Spatial Topology & Graph Builder
Constructs directed spatial graph G = (V, E) representing an urban stormwater
and street network with digital elevation model (DEM) attributes, sub-catchment
hydrologic properties, and conduit conveyance parameters.
"""

from typing import Dict, List, Any, Optional
import math
import networkx as nx


class UrbanTopologyBuilder:
    """
    Builds and manages the urban drainage and street graph representation
    with geographic coordinates, elevations, pipe dimensions, and hydrological coefficients.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.graph: nx.DiGraph = nx.DiGraph()
        self._build_pilot_network()

    def _build_pilot_network(self) -> None:
        """
        Instantiates a realistic 12 km² high-risk urban sector:
        'Metropolitan District 7 - Bay & Canal Watershed'
        featuring upland ridges, commercial midtown, depressed underpasses,
        detention basins, and coastal gravity outfalls.
        """
        # Node definitions: (node_id, name, lat, lon, elevation_m, catchment_area_m2, runoff_coeff, ponding_area_m2, subsurface_cap_m3, node_type, critical_tag)
        nodes_data = [
            # Upland Ridge Nodes (Elev: 26m - 34m)
            ("ND-01", "North Ridge Heights", 37.7885, -122.4280, 32.5, 22000, 0.82, 2800, 240, "intersection", "Highland Junction"),
            ("ND-02", "Panoramic Crest", 37.7865, -122.4210, 29.8, 18000, 0.80, 2200, 200, "intersection", "Residential Hub"),
            ("ND-03", "Summit Hill Way", 37.7840, -122.4330, 34.1, 26000, 0.85, 3100, 280, "intersection", "Primary Arterial"),
            ("ND-04", "Skyline Overlook", 37.7820, -122.4260, 27.4, 20000, 0.81, 2500, 220, "manhole", "Secondary Storm Hub"),

            # Midtown Terraces (Elev: 16m - 24m)
            ("ND-05", "Midtown Commercial Blvd", 37.7795, -122.4230, 21.2, 34000, 0.88, 3800, 420, "intersection", "Commercial Corridor"),
            ("ND-06", "University Gateway", 37.7780, -122.4300, 23.6, 29000, 0.84, 3400, 360, "intersection", "Campus Transit Hub"),
            ("ND-07", "Civic Center North", 37.7765, -122.4170, 18.9, 41000, 0.90, 4600, 520, "intersection", "Civic Center"),
            ("ND-08", "Parkside Terrace", 37.7750, -122.4280, 19.5, 25000, 0.65, 3000, 300, "manhole", "Park Overflow"),
            ("ND-09", "Tech District Junction", 37.7735, -122.4120, 16.4, 38000, 0.89, 4200, 480, "intersection", "Tech Quarter"),

            # Depressed Underpasses & High Risk Sump Nodes (Elev: 4.5m - 9.5m)
            ("ND-UP01", "Grand Underpass Expressway", 37.7710, -122.4220, 5.2, 46000, 0.92, 5400, 350, "underpass", "Critical Arterial Underpass"),
            ("ND-UP02", "Metro Rail Depressed Plaza", 37.7690, -122.4150, 4.8, 39000, 0.91, 4800, 320, "underpass", "Metro Station Portal"),
            ("ND-H01", "St. Jude General Hospital Access", 37.7680, -122.4270, 8.4, 32000, 0.86, 3600, 450, "intersection", "Emergency Hospital Zone"),
            ("ND-10", "Market & 5th Gateway", 37.7670, -122.4080, 11.2, 36000, 0.88, 4000, 400, "intersection", "Downtown Interchange"),
            ("ND-11", "Industrial Spur Junction", 37.7650, -122.4200, 7.6, 28000, 0.85, 3200, 380, "manhole", "Freight Depot"),

            # Lowland Basins & Canal District (Elev: 2.1m - 5.0m)
            ("ND-12", "South Canal Promenade", 37.7630, -122.4130, 3.4, 44000, 0.89, 5800, 600, "intersection", "Canal District"),
            ("ND-13", "Harbor View Crossway", 37.7615, -122.4050, 4.2, 33000, 0.87, 3900, 420, "intersection", "Port Access"),
            ("ND-BS01", "Regional Stormwater Retention Basin A", 37.7595, -122.4180, 2.3, 52000, 0.45, 9500, 1800, "basin", "Detention Basin North"),
            ("ND-BS02", "Canal Bypass Detention Basin B", 37.7570, -122.4100, 2.1, 48000, 0.40, 8800, 1600, "basin", "Detention Basin South"),
            ("ND-PS01", "Terminal Stormwater Pumping Station", 37.7550, -122.4140, 2.6, 31000, 0.82, 3500, 900, "pump_station", "Municipal Dewatering Plant"),

            # Coastal & Riverine Outfalls (Elev: 0.8m - 1.5m)
            ("ND-OF01", "Bay Gravity Outfall Gate 1", 37.7525, -122.4080, 1.2, 12000, 0.70, 2000, 1200, "outfall", "Tidal Outfall Alpha"),
            ("ND-OF02", "Estuary Deepwater Outfall Gate 2", 37.7510, -122.4160, 0.9, 14000, 0.70, 2200, 1400, "outfall", "Tidal Outfall Beta"),

            # Additional Grid Connectors to form realistic mesh (Elev: 6m - 28m)
            ("ND-14", "West Ridge Concourse", 37.7850, -122.4380, 31.0, 21000, 0.80, 2600, 230, "intersection", "Western Approach"),
            ("ND-15", "Sunset Terrace Corner", 37.7800, -122.4360, 25.4, 23000, 0.82, 2700, 250, "intersection", "Midtown West"),
            ("ND-16", "Mission Crossroad 8th", 37.7720, -122.4310, 14.8, 27000, 0.86, 3300, 340, "intersection", "Arterial Spine"),
            ("ND-17", "Southbank Industrial Park", 37.7660, -122.4340, 9.8, 30000, 0.88, 3700, 410, "manhole", "Warehouse District"),
            ("ND-18", "Fishermans Wharves Access", 37.7640, -122.3990, 3.8, 29000, 0.86, 3500, 380, "intersection", "Waterfront Boulevard"),
            ("ND-19", "Bayside Logistics Lane", 37.7580, -122.4020, 2.9, 32000, 0.87, 4000, 440, "intersection", "Logistics Hub"),
            ("ND-20", "Canal South Interchange", 37.7540, -122.4220, 3.6, 35000, 0.88, 4300, 490, "intersection", "Interstate Bypass")
        ]

        for n_id, name, lat, lon, elev, catch_area, c_coeff, pond_area, sub_cap, n_type, tag in nodes_data:
            self.graph.add_node(
                n_id,
                node_id=n_id,
                name=name,
                lat=lat,
                lon=lon,
                elevation_m=elev,
                catchment_area_m2=catch_area,
                runoff_coeff=c_coeff,
                surface_ponding_area_m2=pond_area,
                max_capacity_m3=sub_cap,
                node_type=n_type,
                critical_tag=tag,
                is_outfall=(n_type == "outfall"),
                deployed_pump_m3s=0.0
            )

        # Conduits and Street Edges: (edge_id, source, target, street_name, conduit_type, length_m, width_or_dia_m, roughness_n)
        # Flow naturally travels downhill towards lowlands and outfalls
        edges_data = [
            # Upland conduits
            ("ED-01", "ND-03", "ND-01", "Skyline Blvd North", "box_drain", 380, 1.4, 0.014),
            ("ED-02", "ND-01", "ND-02", "Ridge Crest Way", "culvert_pipe", 420, 1.2, 0.013),
            ("ED-03", "ND-03", "ND-14", "Highland West Ring", "surface_gutter", 360, 1.0, 0.017),
            ("ED-04", "ND-14", "ND-15", "Sunset Arterial", "culvert_pipe", 450, 1.2, 0.013),
            ("ED-05", "ND-01", "ND-04", "Hillside Culvert A", "culvert_pipe", 390, 1.3, 0.013),
            ("ED-06", "ND-02", "ND-04", "Crestline Drain", "culvert_pipe", 340, 1.1, 0.013),
            ("ED-07", "ND-04", "ND-05", "Midtown Trunk Conduit 1", "major_interceptor", 480, 1.8, 0.012),
            ("ED-08", "ND-15", "ND-06", "Campus Descent Line", "culvert_pipe", 410, 1.3, 0.013),

            # Midtown interconnections
            ("ED-09", "ND-06", "ND-08", "Parkside Drainway", "box_drain", 370, 1.5, 0.014),
            ("ED-10", "ND-05", "ND-07", "Civic Center Spine", "major_interceptor", 460, 2.0, 0.012),
            ("ED-11", "ND-07", "ND-09", "Market East Expressway", "major_interceptor", 430, 2.2, 0.012),
            ("ED-12", "ND-08", "ND-16", "Mission Valley Conduit", "culvert_pipe", 400, 1.4, 0.013),
            ("ED-13", "ND-05", "ND-UP01", "Grand Avenue Steep Incline", "box_drain", 520, 1.6, 0.014),
            ("ED-14", "ND-07", "ND-UP02", "Civic Transit Drain", "major_interceptor", 470, 1.8, 0.013),
            ("ED-15", "ND-09", "ND-10", "Tech Corridor Trunk", "major_interceptor", 390, 2.0, 0.012),

            # Sump and Underpass feed into Lowlands
            ("ED-16", "ND-16", "ND-H01", "Hospital Access Highway", "box_drain", 410, 1.6, 0.014),
            ("ED-17", "ND-H01", "ND-11", "Medical Emergency Drain", "box_drain", 380, 1.5, 0.014),
            ("ED-18", "ND-UP01", "ND-11", "Underpass Surcharge Siphon", "culvert_pipe", 390, 1.5, 0.013),
            ("ED-19", "ND-UP02", "ND-12", "Metro Sump Discharge Pipe", "major_interceptor", 440, 1.9, 0.013),
            ("ED-20", "ND-10", "ND-13", "Downtown Bay Approach", "major_interceptor", 460, 2.2, 0.012),
            ("ED-21", "ND-16", "ND-17", "Industrial Way South", "culvert_pipe", 430, 1.3, 0.014),
            ("ED-22", "ND-17", "ND-20", "West Bypass Canal", "box_drain", 490, 1.6, 0.014),

            # Lowland Basins & Pumping Station
            ("ED-23", "ND-11", "ND-BS01", "North Basin Inflow Channel", "relief_channel", 410, 2.5, 0.020),
            ("ED-24", "ND-12", "ND-BS02", "South Canal Inflow Feeder", "relief_channel", 450, 2.4, 0.020),
            ("ED-25", "ND-13", "ND-18", "Harbor Boulevard Drain", "culvert_pipe", 380, 1.6, 0.013),
            ("ED-26", "ND-18", "ND-19", "Waterfront Parkway", "box_drain", 440, 1.8, 0.014),
            ("ED-27", "ND-BS01", "ND-PS01", "Basin 1 Pump Feed Siphon", "major_interceptor", 360, 2.6, 0.012),
            ("ED-28", "ND-BS02", "ND-PS01", "Basin 2 Pump Feed Siphon", "major_interceptor", 380, 2.6, 0.012),
            ("ED-29", "ND-20", "ND-BS01", "Southwest Overland Relief", "relief_channel", 420, 2.2, 0.018),
            ("ED-30", "ND-19", "ND-OF01", "Outfall Gate Alpha Channel", "major_interceptor", 410, 2.8, 0.012),
            ("ED-31", "ND-PS01", "ND-OF02", "Pump Station Force Main Pipe", "major_interceptor", 480, 3.0, 0.011),
            ("ED-32", "ND-BS02", "ND-OF01", "Canal Tidal Overflow Siphon", "relief_channel", 430, 2.4, 0.018),

            # Overland Street Spillway links (for surface flood propagation when surcharged)
            ("ED-33", "ND-UP01", "ND-12", "Grand Ave Surface Overflow", "surface_gutter", 530, 2.0, 0.019),
            ("ED-34", "ND-UP02", "ND-13", "4th St Overland Spillway", "surface_gutter", 510, 2.2, 0.019),
            ("ED-35", "ND-H01", "ND-BS01", "Hospital Park Runoff Channel", "surface_gutter", 470, 1.8, 0.018),
            ("ED-36", "ND-10", "ND-19", "5th St Surface Channel", "surface_gutter", 580, 2.0, 0.020),
            ("ED-37", "ND-20", "ND-PS01", "Levee Interceptor Gutter", "surface_gutter", 490, 2.1, 0.019)
        ]

        for e_id, src, tgt, s_name, c_type, length, width, n_coeff in edges_data:
            z_src = self.graph.nodes[src]["elevation_m"]
            z_tgt = self.graph.nodes[tgt]["elevation_m"]
            delta_z = max(0.2, z_src - z_tgt)
            slope = max(0.0015, delta_z / float(length))

            # Manning's calculation for circular pipe / rectangular box
            # For circular pipe D: Area = pi * (D/2)^2, Rh = D / 4
            # Q_max = (1/n) * A * (Rh^(2/3)) * (S^(1/2))
            if "box" in c_type or "channel" in c_type or "surface" in c_type:
                area = width * (width * 0.75)
                wetted_p = width + 2 * (width * 0.75)
                rh = area / max(0.1, wetted_p)
            else:
                d = width
                area = math.pi * ((d / 2.0) ** 2)
                rh = d / 4.0

            q_max = (1.0 / n_coeff) * area * (rh ** (2.0 / 3.0)) * math.sqrt(slope)
            # Add reasonable engineering limits
            q_max = max(0.8, min(45.0, q_max))

            self.graph.add_edge(
                src,
                tgt,
                edge_id=e_id,
                street_name=s_name,
                conduit_type=c_type,
                length_m=length,
                slope=round(slope, 5),
                roughness_coeff=n_coeff,
                diameter_or_width_m=width,
                max_flow_rate_m3s=round(q_max, 3),
                is_blocked=False
            )

    def get_geojson_topology(self) -> Dict[str, Any]:
        """
        Converts the urban network graph into a standardized GeoJSON FeatureCollection
        containing Point features for nodes and LineString features for conduits/streets.
        """
        features: List[Dict[str, Any]] = []

        # 1. Point features for nodes
        for node_id, data in self.graph.nodes(data=True):
            features.append({
                "type": "Feature",
                "id": node_id,
                "geometry": {
                    "type": "Point",
                    "coordinates": [data["lon"], data["lat"]]
                },
                "properties": {
                    "feature_type": "node",
                    "node_id": node_id,
                    "name": data["name"],
                    "node_type": data["node_type"],
                    "elevation_m": data["elevation_m"],
                    "catchment_area_m2": data["catchment_area_m2"],
                    "runoff_coeff": data["runoff_coeff"],
                    "surface_ponding_area_m2": data["surface_ponding_area_m2"],
                    "max_capacity_m3": data["max_capacity_m3"],
                    "critical_tag": data["critical_tag"],
                    "is_outfall": data["is_outfall"],
                    "deployed_pump_m3s": data.get("deployed_pump_m3s", 0.0)
                }
            })

        # 2. LineString features for conduits / streets
        for u, v, data in self.graph.edges(data=True):
            u_node = self.graph.nodes[u]
            v_node = self.graph.nodes[v]
            features.append({
                "type": "Feature",
                "id": data["edge_id"],
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [u_node["lon"], u_node["lat"]],
                        [v_node["lon"], v_node["lat"]]
                    ]
                },
                "properties": {
                    "feature_type": "conduit",
                    "edge_id": data["edge_id"],
                    "source": u,
                    "target": v,
                    "street_name": data["street_name"],
                    "conduit_type": data["conduit_type"],
                    "length_m": data["length_m"],
                    "slope": data["slope"],
                    "roughness_coeff": data["roughness_coeff"],
                    "diameter_or_width_m": data["diameter_or_width_m"],
                    "max_flow_rate_m3s": data["max_flow_rate_m3s"],
                    "is_blocked": data.get("is_blocked", False)
                }
            })

        return {
            "type": "FeatureCollection",
            "metadata": {
                "sector_name": "Metropolitan District 7 - Bay & Canal Watershed",
                "total_nodes": self.graph.number_of_nodes(),
                "total_edges": self.graph.number_of_edges(),
                "elevation_range_m": [0.9, 34.1],
                "bounding_box": [-122.438, 37.751, -122.399, 37.7885]
            },
            "features": features
        }


# Singleton instance of the builder
topology_builder = UrbanTopologyBuilder()
