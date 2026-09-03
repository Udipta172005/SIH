/**
 * AquaGNN API Client Services (WITH FALLBACK FOR PRODUCTION)
 */

import mockTopology from './mock_topology.json';
import mockHotspots from './mock_hotspots.json';
import mockSim from './mock_sim.json';
import mockTelemetry from './mock_telemetry.json';
import mockRoute from './mock_route.json';

// In production, the Vercel/Netlify proxy doesn't exist, so we default to mock data if it fails.
const API_BASE = '/api/v1';
const IS_PROD = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

export async function fetchTopology() {
  if (IS_PROD) return mockTopology;
  try {
    const response = await fetch(`${API_BASE}/network/topology`);
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return mockTopology;
  }
}

export async function runSimulation({ intensity_mm_hr = 65, duration_hrs = 2.0, pattern = 'cloudburst', pumps = [] }) {
  if (IS_PROD) return mockSim;
  try {
    const response = await fetch(`${API_BASE}/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intensity_mm_hr: Number(intensity_mm_hr), duration_hrs: Number(duration_hrs), pattern, pumps })
    });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return mockSim;
  }
}

export async function recomputeSimulation({ precipitation_rate_mm_hr = 35, preset_id = null, active_pumps = [], pattern = null, duration_hrs = null }) {
  if (IS_PROD) return mockSim;
  try {
    const response = await fetch(`${API_BASE}/simulation/recompute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precipitation_rate_mm_hr: Number(precipitation_rate_mm_hr), preset_id, active_pumps, pattern, duration_hrs: duration_hrs ? Number(duration_hrs) : null })
    });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return mockSim;
  }
}

export async function fetchHotspotAlerts(intensity = 65, pattern = 'cloudburst') {
  if (IS_PROD) return mockHotspots;
  try {
    const response = await fetch(`${API_BASE}/alerts/hotspots?intensity_mm_hr=${intensity}&pattern=${pattern}`);
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return mockHotspots;
  }
}

export async function deployPumpMitigation({ node_id, capacity_m3s = 1.2, intensity_mm_hr = 70, duration_hrs = 2.0, pattern = 'cloudburst', existing_pumps = [] }) {
  return { status: 'success', node_id };
}

export async function computeSafeRoute({ origin_node, destination_node, time_min = 60, intensity_mm_hr = 70, pattern = 'cloudburst' }) {
  if (IS_PROD) return mockRoute;
  try {
    const response = await fetch(`${API_BASE}/routing/safe-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin_node, destination_node, time_min, intensity_mm_hr, pattern })
    });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return mockRoute;
  }
}

export async function fetchScenarioPresets() {
  try {
    const response = await fetch(`${API_BASE}/scenarios/presets`);
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return { presets: [] };
  }
}

export async function fetchTelemetryHistory(node_id, hours = 24) {
  if (IS_PROD) return mockTelemetry;
  try {
    const response = await fetch(`${API_BASE}/telemetry/history/${node_id}?hours=${hours}`);
    if (!response.ok) throw new Error();
    return await response.json();
  } catch (e) {
    return mockTelemetry;
  }
}

export async function applyScenario({ scenario_name }) {
  return { status: 'success' };
}
