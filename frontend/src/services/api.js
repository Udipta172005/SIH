/**
 * AquaGNN API Client Services
 */

const API_BASE = '/api/v1';

export async function fetchTopology() {
  const response = await fetch(`${API_BASE}/network/topology`);
  if (!response.ok) {
    throw new Error(`Failed to load network topology: ${response.statusText}`);
  }
  return response.json();
}

export async function runSimulation({ intensity_mm_hr = 65, duration_hrs = 2.0, pattern = 'cloudburst', pumps = [] }) {
  const response = await fetch(`${API_BASE}/simulation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intensity_mm_hr: Number(intensity_mm_hr),
      duration_hrs: Number(duration_hrs),
      pattern,
      pumps
    })
  });
  if (!response.ok) {
    throw new Error(`Simulation run failed: ${response.statusText}`);
  }
  return response.json();
}

export async function recomputeSimulation({ precipitation_rate_mm_hr = 35, preset_id = null, active_pumps = [], pattern = null, duration_hrs = null }) {
  const response = await fetch(`${API_BASE}/simulation/recompute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      precipitation_rate_mm_hr: Number(precipitation_rate_mm_hr),
      preset_id,
      active_pumps,
      pattern,
      duration_hrs: duration_hrs ? Number(duration_hrs) : null
    })
  });
  if (!response.ok) {
    throw new Error(`Simulation recompute failed: ${response.statusText}`);
  }
  return response.json();
}


export async function fetchHotspotAlerts(intensity = 65, pattern = 'cloudburst') {
  const response = await fetch(`${API_BASE}/alerts/hotspots?intensity_mm_hr=${intensity}&pattern=${pattern}`);
  if (!response.ok) {
    throw new Error(`Failed to load hotspot alerts: ${response.statusText}`);
  }
  return response.json();
}

export async function deployPumpMitigation({ node_id, capacity_m3s = 1.2, intensity_mm_hr = 70, duration_hrs = 2.0, pattern = 'cloudburst', existing_pumps = [] }) {
  const response = await fetch(`${API_BASE}/mitigation/deploy-pump`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      node_id,
      capacity_m3s: Number(capacity_m3s),
      intensity_mm_hr: Number(intensity_mm_hr),
      duration_hrs: Number(duration_hrs),
      pattern,
      existing_pumps
    })
  });
  if (!response.ok) {
    throw new Error(`Pump deployment simulation failed: ${response.statusText}`);
  }
  return response.json();
}

export async function computeSafeRoute({ origin_node, destination_node, time_min = 60, intensity_mm_hr = 70, pattern = 'cloudburst' }) {
  const response = await fetch(`${API_BASE}/routing/safe-route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin_node,
      destination_node,
      time_min,
      intensity_mm_hr,
      pattern
    })
  });
  if (!response.ok) {
    throw new Error(`Emergency routing failed: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchScenarioPresets() {
  const response = await fetch(`${API_BASE}/scenarios/presets`);
  if (!response.ok) {
    throw new Error(`Failed to load scenario presets: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTelemetryHistory(node_id, hours = 24) {
  const response = await fetch(`${API_BASE}/telemetry/history/${node_id}?hours=${hours}`);
  if (!response.ok) {
    throw new Error(`Failed to load telemetry history: ${response.statusText}`);
  }
  return response.json();
}

export async function applyScenario({ scenario_name }) {
  const response = await fetch(`${API_BASE}/scenarios/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_name })
  });
  if (!response.ok) {
    throw new Error(`Failed to apply scenario '${scenario_name}': ${response.statusText}`);
  }
  return response.json();
}

