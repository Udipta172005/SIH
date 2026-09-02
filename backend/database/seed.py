"""
AquaGNN - Database Initialization & Seed Script
Seeds the database with the full pilot-network topology from graph_builder.py
(28 nodes, 37 edges) and demo alerts. Safe to run multiple times (idempotent).
"""

from ..database.db import SessionLocal, init_db
from ..models.node import Node
from ..models.edge import Edge
from ..models.alert import Alert


# ── Node definitions: exactly matching graph_builder.py topology ──────────────
SEED_NODES = [
    # Upland Ridge Nodes
    {"id": "ND-01", "name": "North Ridge Heights",        "latitude": 37.7885, "longitude": -122.4280, "elevation_m": 32.5, "node_type": "intersection",  "critical_tag": "Highland Junction",       "catchment_area_m2": 22000, "runoff_coeff": 0.82, "surface_ponding_area_m2": 2800, "max_capacity_m3": 240},
    {"id": "ND-02", "name": "Panoramic Crest",            "latitude": 37.7865, "longitude": -122.4210, "elevation_m": 29.8, "node_type": "intersection",  "critical_tag": "Residential Hub",         "catchment_area_m2": 18000, "runoff_coeff": 0.80, "surface_ponding_area_m2": 2200, "max_capacity_m3": 200},
    {"id": "ND-03", "name": "Summit Hill Way",             "latitude": 37.7840, "longitude": -122.4330, "elevation_m": 34.1, "node_type": "intersection",  "critical_tag": "Primary Arterial",        "catchment_area_m2": 26000, "runoff_coeff": 0.85, "surface_ponding_area_m2": 3100, "max_capacity_m3": 280},
    {"id": "ND-04", "name": "Skyline Overlook",            "latitude": 37.7820, "longitude": -122.4260, "elevation_m": 27.4, "node_type": "manhole",       "critical_tag": "Secondary Storm Hub",     "catchment_area_m2": 20000, "runoff_coeff": 0.81, "surface_ponding_area_m2": 2500, "max_capacity_m3": 220},
    # Midtown Terraces
    {"id": "ND-05", "name": "Midtown Commercial Blvd",     "latitude": 37.7795, "longitude": -122.4230, "elevation_m": 21.2, "node_type": "intersection",  "critical_tag": "Commercial Corridor",     "catchment_area_m2": 34000, "runoff_coeff": 0.88, "surface_ponding_area_m2": 3800, "max_capacity_m3": 420},
    {"id": "ND-06", "name": "University Gateway",          "latitude": 37.7780, "longitude": -122.4300, "elevation_m": 23.6, "node_type": "intersection",  "critical_tag": "Campus Transit Hub",      "catchment_area_m2": 29000, "runoff_coeff": 0.84, "surface_ponding_area_m2": 3400, "max_capacity_m3": 360},
    {"id": "ND-07", "name": "Civic Center North",          "latitude": 37.7765, "longitude": -122.4170, "elevation_m": 18.9, "node_type": "intersection",  "critical_tag": "Civic Center",            "catchment_area_m2": 41000, "runoff_coeff": 0.90, "surface_ponding_area_m2": 4600, "max_capacity_m3": 520},
    {"id": "ND-08", "name": "Parkside Terrace",            "latitude": 37.7750, "longitude": -122.4280, "elevation_m": 19.5, "node_type": "manhole",       "critical_tag": "Park Overflow",           "catchment_area_m2": 25000, "runoff_coeff": 0.65, "surface_ponding_area_m2": 3000, "max_capacity_m3": 300},
    {"id": "ND-09", "name": "Tech District Junction",      "latitude": 37.7735, "longitude": -122.4120, "elevation_m": 16.4, "node_type": "intersection",  "critical_tag": "Tech Quarter",            "catchment_area_m2": 38000, "runoff_coeff": 0.89, "surface_ponding_area_m2": 4200, "max_capacity_m3": 480},
    # Depressed Underpasses & High Risk Sump Nodes
    {"id": "ND-UP01", "name": "Grand Underpass Expressway",       "latitude": 37.7710, "longitude": -122.4220, "elevation_m": 5.2,  "node_type": "underpass",     "critical_tag": "Critical Arterial Underpass", "catchment_area_m2": 46000, "runoff_coeff": 0.92, "surface_ponding_area_m2": 5400, "max_capacity_m3": 350},
    {"id": "ND-UP02", "name": "Metro Rail Depressed Plaza",      "latitude": 37.7690, "longitude": -122.4150, "elevation_m": 4.8,  "node_type": "underpass",     "critical_tag": "Metro Station Portal",        "catchment_area_m2": 39000, "runoff_coeff": 0.91, "surface_ponding_area_m2": 4800, "max_capacity_m3": 320},
    {"id": "ND-H01",  "name": "St. Jude General Hospital Access", "latitude": 37.7680, "longitude": -122.4270, "elevation_m": 8.4, "node_type": "intersection",  "critical_tag": "Emergency Hospital Zone",     "catchment_area_m2": 32000, "runoff_coeff": 0.86, "surface_ponding_area_m2": 3600, "max_capacity_m3": 450},
    {"id": "ND-10",   "name": "Market & 5th Gateway",             "latitude": 37.7670, "longitude": -122.4080, "elevation_m": 11.2, "node_type": "intersection", "critical_tag": "Downtown Interchange",        "catchment_area_m2": 36000, "runoff_coeff": 0.88, "surface_ponding_area_m2": 4000, "max_capacity_m3": 400},
    {"id": "ND-11",   "name": "Industrial Spur Junction",         "latitude": 37.7650, "longitude": -122.4200, "elevation_m": 7.6,  "node_type": "manhole",      "critical_tag": "Freight Depot",               "catchment_area_m2": 28000, "runoff_coeff": 0.85, "surface_ponding_area_m2": 3200, "max_capacity_m3": 380},
    # Lowland Basins & Canal District
    {"id": "ND-12",   "name": "South Canal Promenade",     "latitude": 37.7630, "longitude": -122.4130, "elevation_m": 3.4,  "node_type": "intersection",  "critical_tag": "Canal District",          "catchment_area_m2": 44000, "runoff_coeff": 0.89, "surface_ponding_area_m2": 5800, "max_capacity_m3": 600},
    {"id": "ND-13",   "name": "Harbor View Crossway",      "latitude": 37.7615, "longitude": -122.4050, "elevation_m": 4.2,  "node_type": "intersection",  "critical_tag": "Port Access",             "catchment_area_m2": 33000, "runoff_coeff": 0.87, "surface_ponding_area_m2": 3900, "max_capacity_m3": 420},
    {"id": "ND-BS01", "name": "Regional Stormwater Retention Basin A", "latitude": 37.7595, "longitude": -122.4180, "elevation_m": 2.3, "node_type": "basin", "critical_tag": "Detention Basin North",    "catchment_area_m2": 52000, "runoff_coeff": 0.45, "surface_ponding_area_m2": 9500, "max_capacity_m3": 1800},
    {"id": "ND-BS02", "name": "Canal Bypass Detention Basin B",        "latitude": 37.7570, "longitude": -122.4100, "elevation_m": 2.1, "node_type": "basin", "critical_tag": "Detention Basin South",    "catchment_area_m2": 48000, "runoff_coeff": 0.40, "surface_ponding_area_m2": 8800, "max_capacity_m3": 1600},
    {"id": "ND-PS01", "name": "Terminal Stormwater Pumping Station",   "latitude": 37.7550, "longitude": -122.4140, "elevation_m": 2.6, "node_type": "pump_station", "critical_tag": "Municipal Dewatering Plant", "catchment_area_m2": 31000, "runoff_coeff": 0.82, "surface_ponding_area_m2": 3500, "max_capacity_m3": 900},
    # Coastal & Riverine Outfalls
    {"id": "ND-OF01", "name": "Bay Gravity Outfall Gate 1",         "latitude": 37.7525, "longitude": -122.4080, "elevation_m": 1.2, "node_type": "outfall", "critical_tag": "Tidal Outfall Alpha", "catchment_area_m2": 12000, "runoff_coeff": 0.70, "surface_ponding_area_m2": 2000, "max_capacity_m3": 1200},
    {"id": "ND-OF02", "name": "Estuary Deepwater Outfall Gate 2",   "latitude": 37.7510, "longitude": -122.4160, "elevation_m": 0.9, "node_type": "outfall", "critical_tag": "Tidal Outfall Beta",  "catchment_area_m2": 14000, "runoff_coeff": 0.70, "surface_ponding_area_m2": 2200, "max_capacity_m3": 1400},
    # Additional Grid Connectors
    {"id": "ND-14", "name": "West Ridge Concourse",        "latitude": 37.7850, "longitude": -122.4380, "elevation_m": 31.0, "node_type": "intersection",  "critical_tag": "Western Approach",        "catchment_area_m2": 21000, "runoff_coeff": 0.80, "surface_ponding_area_m2": 2600, "max_capacity_m3": 230},
    {"id": "ND-15", "name": "Sunset Terrace Corner",       "latitude": 37.7800, "longitude": -122.4360, "elevation_m": 25.4, "node_type": "intersection",  "critical_tag": "Midtown West",            "catchment_area_m2": 23000, "runoff_coeff": 0.82, "surface_ponding_area_m2": 2700, "max_capacity_m3": 250},
    {"id": "ND-16", "name": "Mission Crossroad 8th",       "latitude": 37.7720, "longitude": -122.4310, "elevation_m": 14.8, "node_type": "intersection",  "critical_tag": "Arterial Spine",          "catchment_area_m2": 27000, "runoff_coeff": 0.86, "surface_ponding_area_m2": 3300, "max_capacity_m3": 340},
    {"id": "ND-17", "name": "Southbank Industrial Park",   "latitude": 37.7660, "longitude": -122.4340, "elevation_m": 9.8,  "node_type": "manhole",       "critical_tag": "Warehouse District",      "catchment_area_m2": 30000, "runoff_coeff": 0.88, "surface_ponding_area_m2": 3700, "max_capacity_m3": 410},
    {"id": "ND-18", "name": "Fishermans Wharves Access",   "latitude": 37.7640, "longitude": -122.3990, "elevation_m": 3.8,  "node_type": "intersection",  "critical_tag": "Waterfront Boulevard",    "catchment_area_m2": 29000, "runoff_coeff": 0.86, "surface_ponding_area_m2": 3500, "max_capacity_m3": 380},
    {"id": "ND-19", "name": "Bayside Logistics Lane",      "latitude": 37.7580, "longitude": -122.4020, "elevation_m": 2.9,  "node_type": "intersection",  "critical_tag": "Logistics Hub",           "catchment_area_m2": 32000, "runoff_coeff": 0.87, "surface_ponding_area_m2": 4000, "max_capacity_m3": 440},
    {"id": "ND-20", "name": "Canal South Interchange",     "latitude": 37.7540, "longitude": -122.4220, "elevation_m": 3.6,  "node_type": "intersection",  "critical_tag": "Interstate Bypass",       "catchment_area_m2": 35000, "runoff_coeff": 0.88, "surface_ponding_area_m2": 4300, "max_capacity_m3": 490},
]


# ── Edge definitions: exactly matching graph_builder.py topology ──────────────
SEED_EDGES = [
    # Upland conduits
    {"id": "ED-01", "source_node_id": "ND-03", "target_node_id": "ND-01", "street_name": "Skyline Blvd North",          "conduit_type": "box_drain",         "length_m": 380, "diameter_or_width_m": 1.4, "roughness_coeff": 0.014},
    {"id": "ED-02", "source_node_id": "ND-01", "target_node_id": "ND-02", "street_name": "Ridge Crest Way",             "conduit_type": "culvert_pipe",      "length_m": 420, "diameter_or_width_m": 1.2, "roughness_coeff": 0.013},
    {"id": "ED-03", "source_node_id": "ND-03", "target_node_id": "ND-14", "street_name": "Highland West Ring",           "conduit_type": "surface_gutter",    "length_m": 360, "diameter_or_width_m": 1.0, "roughness_coeff": 0.017},
    {"id": "ED-04", "source_node_id": "ND-14", "target_node_id": "ND-15", "street_name": "Sunset Arterial",              "conduit_type": "culvert_pipe",      "length_m": 450, "diameter_or_width_m": 1.2, "roughness_coeff": 0.013},
    {"id": "ED-05", "source_node_id": "ND-01", "target_node_id": "ND-04", "street_name": "Hillside Culvert A",           "conduit_type": "culvert_pipe",      "length_m": 390, "diameter_or_width_m": 1.3, "roughness_coeff": 0.013},
    {"id": "ED-06", "source_node_id": "ND-02", "target_node_id": "ND-04", "street_name": "Crestline Drain",              "conduit_type": "culvert_pipe",      "length_m": 340, "diameter_or_width_m": 1.1, "roughness_coeff": 0.013},
    {"id": "ED-07", "source_node_id": "ND-04", "target_node_id": "ND-05", "street_name": "Midtown Trunk Conduit 1",      "conduit_type": "major_interceptor", "length_m": 480, "diameter_or_width_m": 1.8, "roughness_coeff": 0.012},
    {"id": "ED-08", "source_node_id": "ND-15", "target_node_id": "ND-06", "street_name": "Campus Descent Line",          "conduit_type": "culvert_pipe",      "length_m": 410, "diameter_or_width_m": 1.3, "roughness_coeff": 0.013},
    # Midtown interconnections
    {"id": "ED-09", "source_node_id": "ND-06", "target_node_id": "ND-08", "street_name": "Parkside Drainway",            "conduit_type": "box_drain",         "length_m": 370, "diameter_or_width_m": 1.5, "roughness_coeff": 0.014},
    {"id": "ED-10", "source_node_id": "ND-05", "target_node_id": "ND-07", "street_name": "Civic Center Spine",           "conduit_type": "major_interceptor", "length_m": 460, "diameter_or_width_m": 2.0, "roughness_coeff": 0.012},
    {"id": "ED-11", "source_node_id": "ND-07", "target_node_id": "ND-09", "street_name": "Market East Expressway",       "conduit_type": "major_interceptor", "length_m": 430, "diameter_or_width_m": 2.2, "roughness_coeff": 0.012},
    {"id": "ED-12", "source_node_id": "ND-08", "target_node_id": "ND-16", "street_name": "Mission Valley Conduit",       "conduit_type": "culvert_pipe",      "length_m": 400, "diameter_or_width_m": 1.4, "roughness_coeff": 0.013},
    {"id": "ED-13", "source_node_id": "ND-05", "target_node_id": "ND-UP01", "street_name": "Grand Avenue Steep Incline", "conduit_type": "box_drain",         "length_m": 520, "diameter_or_width_m": 1.6, "roughness_coeff": 0.014},
    {"id": "ED-14", "source_node_id": "ND-07", "target_node_id": "ND-UP02", "street_name": "Civic Transit Drain",        "conduit_type": "major_interceptor", "length_m": 470, "diameter_or_width_m": 1.8, "roughness_coeff": 0.013},
    {"id": "ED-15", "source_node_id": "ND-09", "target_node_id": "ND-10", "street_name": "Tech Corridor Trunk",          "conduit_type": "major_interceptor", "length_m": 390, "diameter_or_width_m": 2.0, "roughness_coeff": 0.012},
    # Sump and Underpass feed into Lowlands
    {"id": "ED-16", "source_node_id": "ND-16",   "target_node_id": "ND-H01", "street_name": "Hospital Access Highway",     "conduit_type": "box_drain",         "length_m": 410, "diameter_or_width_m": 1.6, "roughness_coeff": 0.014},
    {"id": "ED-17", "source_node_id": "ND-H01",  "target_node_id": "ND-11",  "street_name": "Medical Emergency Drain",     "conduit_type": "box_drain",         "length_m": 380, "diameter_or_width_m": 1.5, "roughness_coeff": 0.014},
    {"id": "ED-18", "source_node_id": "ND-UP01", "target_node_id": "ND-11",  "street_name": "Underpass Surcharge Siphon",  "conduit_type": "culvert_pipe",      "length_m": 390, "diameter_or_width_m": 1.5, "roughness_coeff": 0.013},
    {"id": "ED-19", "source_node_id": "ND-UP02", "target_node_id": "ND-12",  "street_name": "Metro Sump Discharge Pipe",   "conduit_type": "major_interceptor", "length_m": 440, "diameter_or_width_m": 1.9, "roughness_coeff": 0.013},
    {"id": "ED-20", "source_node_id": "ND-10",   "target_node_id": "ND-13",  "street_name": "Downtown Bay Approach",       "conduit_type": "major_interceptor", "length_m": 460, "diameter_or_width_m": 2.2, "roughness_coeff": 0.012},
    {"id": "ED-21", "source_node_id": "ND-16",   "target_node_id": "ND-17",  "street_name": "Industrial Way South",        "conduit_type": "culvert_pipe",      "length_m": 430, "diameter_or_width_m": 1.3, "roughness_coeff": 0.014},
    {"id": "ED-22", "source_node_id": "ND-17",   "target_node_id": "ND-20",  "street_name": "West Bypass Canal",           "conduit_type": "box_drain",         "length_m": 490, "diameter_or_width_m": 1.6, "roughness_coeff": 0.014},
    # Lowland Basins & Pumping Station
    {"id": "ED-23", "source_node_id": "ND-11",   "target_node_id": "ND-BS01", "street_name": "North Basin Inflow Channel",  "conduit_type": "relief_channel",    "length_m": 410, "diameter_or_width_m": 2.5, "roughness_coeff": 0.020},
    {"id": "ED-24", "source_node_id": "ND-12",   "target_node_id": "ND-BS02", "street_name": "South Canal Inflow Feeder",   "conduit_type": "relief_channel",    "length_m": 450, "diameter_or_width_m": 2.4, "roughness_coeff": 0.020},
    {"id": "ED-25", "source_node_id": "ND-13",   "target_node_id": "ND-18",   "street_name": "Harbor Boulevard Drain",      "conduit_type": "culvert_pipe",      "length_m": 380, "diameter_or_width_m": 1.6, "roughness_coeff": 0.013},
    {"id": "ED-26", "source_node_id": "ND-18",   "target_node_id": "ND-19",   "street_name": "Waterfront Parkway",          "conduit_type": "box_drain",         "length_m": 440, "diameter_or_width_m": 1.8, "roughness_coeff": 0.014},
    {"id": "ED-27", "source_node_id": "ND-BS01", "target_node_id": "ND-PS01", "street_name": "Basin 1 Pump Feed Siphon",    "conduit_type": "major_interceptor", "length_m": 360, "diameter_or_width_m": 2.6, "roughness_coeff": 0.012},
    {"id": "ED-28", "source_node_id": "ND-BS02", "target_node_id": "ND-PS01", "street_name": "Basin 2 Pump Feed Siphon",    "conduit_type": "major_interceptor", "length_m": 380, "diameter_or_width_m": 2.6, "roughness_coeff": 0.012},
    {"id": "ED-29", "source_node_id": "ND-20",   "target_node_id": "ND-BS01", "street_name": "Southwest Overland Relief",   "conduit_type": "relief_channel",    "length_m": 420, "diameter_or_width_m": 2.2, "roughness_coeff": 0.018},
    {"id": "ED-30", "source_node_id": "ND-19",   "target_node_id": "ND-OF01", "street_name": "Outfall Gate Alpha Channel",  "conduit_type": "major_interceptor", "length_m": 410, "diameter_or_width_m": 2.8, "roughness_coeff": 0.012},
    {"id": "ED-31", "source_node_id": "ND-PS01", "target_node_id": "ND-OF02", "street_name": "Pump Station Force Main Pipe","conduit_type": "major_interceptor", "length_m": 480, "diameter_or_width_m": 3.0, "roughness_coeff": 0.011},
    {"id": "ED-32", "source_node_id": "ND-BS02", "target_node_id": "ND-OF01", "street_name": "Canal Tidal Overflow Siphon", "conduit_type": "relief_channel",    "length_m": 430, "diameter_or_width_m": 2.4, "roughness_coeff": 0.018},
    # Overland Street Spillway links
    {"id": "ED-33", "source_node_id": "ND-UP01", "target_node_id": "ND-12",   "street_name": "Grand Ave Surface Overflow",  "conduit_type": "surface_gutter",    "length_m": 530, "diameter_or_width_m": 2.0, "roughness_coeff": 0.019},
    {"id": "ED-34", "source_node_id": "ND-UP02", "target_node_id": "ND-13",   "street_name": "4th St Overland Spillway",    "conduit_type": "surface_gutter",    "length_m": 510, "diameter_or_width_m": 2.2, "roughness_coeff": 0.019},
    {"id": "ED-35", "source_node_id": "ND-H01",  "target_node_id": "ND-BS01", "street_name": "Hospital Park Runoff Channel","conduit_type": "surface_gutter",    "length_m": 470, "diameter_or_width_m": 1.8, "roughness_coeff": 0.018},
    {"id": "ED-36", "source_node_id": "ND-10",   "target_node_id": "ND-19",   "street_name": "5th St Surface Channel",     "conduit_type": "surface_gutter",    "length_m": 580, "diameter_or_width_m": 2.0, "roughness_coeff": 0.020},
    {"id": "ED-37", "source_node_id": "ND-20",   "target_node_id": "ND-PS01", "street_name": "Levee Interceptor Gutter",    "conduit_type": "surface_gutter",    "length_m": 490, "diameter_or_width_m": 2.1, "roughness_coeff": 0.019},
]


# ── Demo alerts for high-risk nodes ──────────────────────────────────────────
SEED_ALERTS = [
    {"node_id": "ND-UP01", "alert_type": "flood_depth",  "severity": "danger",   "message": "Grand Underpass Expressway: Critical arterial underpass at 5.2m elevation — extreme inundation risk during cloudburst events"},
    {"node_id": "ND-UP02", "alert_type": "flood_depth",  "severity": "danger",   "message": "Metro Rail Depressed Plaza: Metro station portal at 4.8m elevation — severe flood accumulation expected"},
    {"node_id": "ND-H01",  "alert_type": "flood_depth",  "severity": "critical", "message": "St. Jude Hospital Access: Emergency hospital zone road access at risk of inundation"},
    {"node_id": "ND-12",   "alert_type": "surcharge",    "severity": "critical", "message": "South Canal Promenade: Canal district lowland node approaching drainage surcharge capacity"},
    {"node_id": "ND-07",   "alert_type": "flood_depth",  "severity": "warning",  "message": "Civic Center North: High runoff coefficient (0.90) with large catchment — monitor during heavy rainfall"},
    {"node_id": "ND-11",   "alert_type": "surcharge",    "severity": "warning",  "message": "Industrial Spur Junction: Freight depot sump node approaching capacity during sustained rainfall"},
]


def seed_database():
    """
    Initialize tables and seed demo topology data.
    Idempotent: skips seeding if nodes already exist.
    """
    init_db()

    db = SessionLocal()
    try:
        # Seed telemetry history if needed
        from .telemetry_store import seed_telemetry_history
        seed_telemetry_history()

        # Check if already seeded
        existing_count = db.query(Node).count()
        if existing_count > 0:
            print(f"[seed] Database already contains {existing_count} nodes — skipping seed.")
            return

        # Seed nodes
        for node_data in SEED_NODES:
            db.add(Node(**node_data))

        # Seed edges
        for edge_data in SEED_EDGES:
            db.add(Edge(**edge_data))

        # Seed alerts
        for alert_data in SEED_ALERTS:
            db.add(Alert(**alert_data))

        db.commit()
        print(f"[seed] Seeded {len(SEED_NODES)} nodes, {len(SEED_EDGES)} edges, {len(SEED_ALERTS)} alerts.")

    except Exception as e:
        db.rollback()
        print(f"[seed] Error during seeding: {e}")
        raise
    finally:
        db.close()
