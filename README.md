# AquaGNN: AI-Driven Urban Flood Nowcasting & Inundation Prediction System

AquaGNN couples rainfall nowcasts with urban spatial topology (digital elevation model topography + stormwater drainage network) to predict street-level flood depths, identify drainage bottlenecks, and provide decision support for municipal emergency response across 1 to 3-hour forecast horizons.

---

## 1. System Architecture

```
                                  ┌────────────────────────┐
                                  │   Rainfall Nowcasts    │
                                  │ (Intensity & Patterns) │
                                  └───────────┬────────────┘
                                              │
                                              ▼
┌─────────────────────────┐       ┌────────────────────────┐
│  Urban Spatial Topology │──────▶│ Hydrodynamic Surrogate │
│ (DEM Nodes + Conduits)  │       │  & Graph AI Engine     │
└─────────────────────────┘       └───────────┬────────────┘
                                              │
                   ┌──────────────────────────┴──────────────────────────┐
                   ▼                                                     ▼
┌───────────────────────────────────────┐             ┌───────────────────────────────────────┐
│         FastAPI Backend API           │             │       Emergency Decision Support      │
│  - Topology GeoJSON FeatureCollection │             │  - Choke Point Identification         │
│  - Multi-Horizon Time-Series Forecast │             │  - Mobile Pump Mitigation Sandbox     │
│  - Hotspot Risk Scoring & Ranking     │             │  - Safe Evacuation Route Engine       │
└──────────────────┬────────────────────┘             └───────────────────┬───────────────────┘
                   │                                                      │
                   └──────────────────────────┬───────────────────────────┘
                                              │
                                              ▼
                              ┌────────────────────────────────┐
                              │    Frontend GIS Dashboard      │
                              │  - Leaflet.js Dark Spatial Map │
                              │  - Dynamic Flood Inundation    │
                              │  - Time Scrubber & Controls    │
                              │  - Node/Conduit Telemetry      │
                              │  - Mitigation Pump Sandbox     │
                              │  - Safe Evacuation Rerouting   │
                              └────────────────────────────────┘
```

---

## 2. Mathematical Formulation & Hydrodynamic Surrogate Engine

### A. Catchment Runoff Generation (Rational Method Hyetograph)
For each node $i$ with catchment area $A_i$ and runoff coefficient $C_i$:
$$Q_{\text{rain}, i}(t) = C_i \cdot \frac{I(t) \times 10^{-3}}{3600} \cdot A_i \quad [\text{m}^3/\text{s}]$$
where $I(t)$ is the temporal rainfall intensity in $\text{mm/hr}$.

### B. Conduit Hydraulic Conveyance (Manning's Equation)
Conduit flow capacity $Q_{\text{max}, ij}$ along link $(i, j)$ of length $L$, slope $S = \max(0.0015, \frac{z_i - z_j}{L})$, and Manning roughness $n$:
$$Q_{\text{max}, ij} = \frac{1}{n} \cdot A_{\text{flow}} \cdot R_h^{2/3} \cdot S^{1/2} \quad [\text{m}^3/\text{s}]$$

### C. Subsurface Reservoir Mass Balance & Surcharge
Underground storage chamber volume evolves as:
$$V_{\text{sub}, i}(t + \Delta t) = V_{\text{sub}, i}(t) + \left(Q_{\text{rain}, i} + \sum_{k \in \text{In}(i)} Q_{ki} - \sum_{j \in \text{Out}(i)} Q_{ij}\right) \Delta t$$
When $V_{\text{sub}, i} > V_{\text{cap}, i}$, excess water surcharges onto the surface:
$$Q_{\text{surcharge}, i} = \max\left(0, \frac{V_{\text{sub}, i} - V_{\text{cap}, i}}{\Delta t}\right)$$

### D. Street-Level Inundation Depth & Overland Routing
Surface flood volume balance:
$$V_{\text{surf}, i}(t + \Delta t) = \max\left(0, V_{\text{surf}, i}(t) + (Q_{\text{surcharge}, i} + Q_{\text{overland\_in}, i} - Q_{\text{outfall}, i} - Q_{\text{pump}, i} - Q_{\text{overland\_out}, i}) \Delta t\right)$$
Dynamic flood depth:
$$\text{Flood Depth}_i(t) = \frac{V_{\text{surf}, i}(t)}{A_{\text{ponding}, i}} \quad [\text{meters}]$$

### E. Flood-Weighted Evacuation Routing (Modified Dijkstra)
Edge impedance cost incorporates road length and inundation depth penalties:
$$\text{Cost}(e) = \text{Length}_e \times \left(1.0 + 35.0 \cdot \bar{d}_e^2 + 60.0 \cdot (\bar{d}_e - 0.2)\cdot \mathbb{I}_{\bar{d}_e \ge 0.3} + 600.0 \cdot \mathbb{I}_{\bar{d}_e \ge 0.6}\right)$$

---

## 3. Quickstart & Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### Step 1: Install Python Backend Dependencies
```bash
cd backend
python -m pip install -r requirements.txt
```

### Step 2: Install and Build Frontend SPA
```bash
cd ../frontend
npm install
npm run build
```

### Step 3: Launch the Full-Stack Server
From the project root:
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Open **`http://127.0.0.1:8000`** in your browser to access the live GIS Command Dashboard.

### Step 4 (Optional): Run Frontend in Vite Development Mode
```bash
cd frontend
npm run dev
```
Access the hot-reloading dev server at `http://127.0.0.1:5173`.

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health status and topology graph metrics |
| `GET` | `/api/v1/network/topology` | GeoJSON FeatureCollection of drainage network (Points & LineStrings) |
| `POST` | `/api/v1/simulation/run` | Executes hydrodynamic surrogate simulation across 1-3 hour horizons |
| `GET` | `/api/v1/alerts/hotspots` | Ranked high-risk choke points and flooded road corridors |
| `POST` | `/api/v1/mitigation/deploy-pump` | Evaluates mobile dewatering pump mitigation delta impact |
| `POST` | `/api/v1/routing/safe-route` | Computes flood-resilient emergency evacuation route |
| `GET` | `/api/v1/scenarios/presets` | Meteorological presets (Cloudburst, Monsoon Surge, 100-Yr Storm) |
| `GET` | `/docs` | Interactive Swagger / OpenAPI documentation |
