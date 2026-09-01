import React, { useState, useEffect, useRef } from 'react';
import TopNav from './components/TopNav';
import SystemTelemetry from './components/SystemTelemetry';
import SimulationControls from './components/SimulationControls';
import MapDashboard from './components/MapDashboard';
import HotspotAlertFeed from './components/HotspotAlertFeed';
import MitigationSandbox from './components/MitigationSandbox';
import EvacuationRouter from './components/EvacuationRouter';
import HydrographChart from './components/HydrographChart';
import NodeInspectorModal from './components/NodeInspectorModal';
import {
  fetchTopology,
  runSimulation,
  fetchHotspotAlerts,
  deployPumpMitigation,
  computeSafeRoute,
  fetchScenarioPresets
} from './services/api';
import { ShieldAlert, Zap, Navigation, Activity, BarChart2 } from 'lucide-react';

export default function App() {
  // Application State
  const [topology, setTopology] = useState(null);
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('cloudburst-flash');

  // Simulation Parameters
  const [intensity, setIntensity] = useState(75);
  const [duration, setDuration] = useState(2.0);
  const [pattern, setPattern] = useState('cloudburst');
  const [activePumps, setActivePumps] = useState([]);

  // Simulation Results
  const [simulationData, setSimulationData] = useState(null);
  const [currentTimeMin, setCurrentTimeMin] = useState(45);
  const [hotspots, setHotspots] = useState([]);
  const [mitigationResult, setMitigationResult] = useState(null);
  const [evacuationRoute, setEvacuationRoute] = useState(null);

  // UI & Playback Controls
  const [activeTab, setActiveTab] = useState('alerts'); // 'alerts' | 'mitigation' | 'routing' | 'hydrograph'
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const timeSteps = [0, 15, 30, 45, 60, 75, 90, 120, 180];

  // 1. Initial Load: Topology, Presets, Simulation
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [topoData, presetsData] = await Promise.all([
          fetchTopology(),
          fetchScenarioPresets()
        ]);
        setTopology(topoData);
        setPresets(presetsData);

        // Run initial simulation
        const sim = await runSimulation({
          intensity_mm_hr: 75,
          duration_hrs: 2.0,
          pattern: 'cloudburst',
          pumps: []
        });
        setSimulationData(sim);

        const alertsData = await fetchHotspotAlerts(75, 'cloudburst');
        setHotspots(alertsData.hotspots || []);
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // 2. Playback Timer Loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = Math.max(500, 2000 / playbackSpeed);
    const timer = setInterval(() => {
      setCurrentTimeMin((prev) => {
        const currentIdx = timeSteps.indexOf(prev);
        if (currentIdx === -1 || currentIdx >= timeSteps.length - 1) {
          return timeSteps[0];
        }
        return timeSteps[currentIdx + 1];
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, timeSteps]);

  // 3. Recompute Simulation Handler
  const handleRunSimulation = async (customPumps = activePumps) => {
    try {
      setLoading(true);
      const sim = await runSimulation({
        intensity_mm_hr: intensity,
        duration_hrs: duration,
        pattern,
        pumps: customPumps
      });
      setSimulationData(sim);

      const alertsData = await fetchHotspotAlerts(intensity, pattern);
      setHotspots(alertsData.hotspots || []);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 4. Select Preset Storm Scenario
  const handleSelectPreset = (preset) => {
    setSelectedPresetId(preset.id);
    setIntensity(preset.intensity_mm_hr);
    setDuration(preset.duration_hrs);
    setPattern(preset.pattern);

    // Trigger run with preset values
    setLoading(true);
    runSimulation({
      intensity_mm_hr: preset.intensity_mm_hr,
      duration_hrs: preset.duration_hrs,
      pattern: preset.pattern,
      pumps: activePumps
    })
      .then((sim) => {
        setSimulationData(sim);
        return fetchHotspotAlerts(preset.intensity_mm_hr, preset.pattern);
      })
      .then((alertsData) => {
        setHotspots(alertsData.hotspots || []);
      })
      .catch((err) => console.error('Preset load error:', err))
      .finally(() => setLoading(false));
  };

  // 5. Deploy Pump Mitigation Action
  const handleDeployPump = async (nodeId, capacity = 1.5) => {
    try {
      setLoading(true);
      const res = await deployPumpMitigation({
        node_id: nodeId,
        capacity_m3s: capacity,
        intensity_mm_hr: intensity,
        duration_hrs: duration,
        pattern,
        existing_pumps: activePumps
      });

      setMitigationResult(res);
      setSimulationData(res.simulation);

      // Add to active pumps if not present
      if (!activePumps.some((p) => p.node_id === nodeId)) {
        const updated = [...activePumps, { node_id: nodeId, capacity_m3s: capacity }];
        setActivePumps(updated);
      }

      // Update hotspots
      const alertsData = await fetchHotspotAlerts(intensity, pattern);
      setHotspots(alertsData.hotspots || []);
      setActiveTab('mitigation');
    } catch (err) {
      console.error('Pump deployment error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 6. Remove Pump Action
  const handleRemovePump = async (nodeId) => {
    const updated = activePumps.filter((p) => p.node_id !== nodeId);
    setActivePumps(updated);
    handleRunSimulation(updated);
  };

  // 7. Compute Safe Evacuation Route
  const handleComputeSafeRoute = async (origin, dest) => {
    try {
      setLoading(true);
      const res = await computeSafeRoute({
        origin_node: origin,
        destination_node: dest,
        time_min: currentTimeMin,
        intensity_mm_hr: intensity,
        pattern
      });
      setEvacuationRoute(res);
      setActiveTab('routing');
    } catch (err) {
      console.error('Route calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 8. Focus Node by ID
  const handleSelectNodeById = (nodeId) => {
    if (!topology || !topology.features) return;
    const nodeFeature = topology.features.find(
      (f) => f.properties.feature_type === 'node' && f.properties.node_id === nodeId
    );
    if (nodeFeature) {
      const nodeState = currentFrame?.nodes?.[nodeId] || {};
      setSelectedNode({ ...nodeFeature, dynamicState: nodeState });
      setSelectedEdge(null);
    }
  };

  // Current Frame extraction
  const currentFrame = simulationData?.frames?.find(
    (f) => f.time_min === currentTimeMin
  ) || simulationData?.frames?.[0];

  const topologyNodes = (topology?.features || []).filter(
    (f) => f.properties.feature_type === 'node'
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#06090e] font-sans">
      {/* 1. Top Navigation Bar */}
      <TopNav
        presets={presets}
        selectedPreset={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        onResetSimulation={() => {
          setActivePumps([]);
          setMitigationResult(null);
          setEvacuationRoute(null);
          handleRunSimulation([]);
        }}
        loading={loading}
      />

      {/* 2. System Telemetry Bar */}
      <SystemTelemetry
        summary={currentFrame?.summary}
        timeMin={currentTimeMin}
        activePumps={activePumps}
      />

      {/* 3. Simulation Dials & Horizon Scrubber */}
      <SimulationControls
        intensity={intensity}
        onIntensityChange={(val) => {
          setIntensity(val);
          setSelectedPresetId(null);
        }}
        pattern={pattern}
        onPatternChange={(p) => {
          setPattern(p);
          setSelectedPresetId(null);
        }}
        currentTimeMin={currentTimeMin}
        onTimeChange={setCurrentTimeMin}
        timeSteps={timeSteps}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        playbackSpeed={playbackSpeed}
        onSpeedChange={setPlaybackSpeed}
        onRunSimulation={() => handleRunSimulation(activePumps)}
        loading={loading}
        hyetograph={simulationData?.hyetograph}
      />

      {/* 4. Main Workspace (GIS Map + Command Center Sidebar) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left / Center: Interactive Leaflet Map */}
        <div className="flex-1 relative flex flex-col">
          <MapDashboard
            topology={topology}
            currentFrame={currentFrame}
            selectedNode={selectedNode}
            onSelectNode={(node) => {
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            selectedEdge={selectedEdge}
            onSelectEdge={(edge) => {
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
            evacuationRoute={evacuationRoute}
            activePumps={activePumps}
            onDeployPumpAtNode={handleDeployPump}
          />

          {/* Bottom Floating Telemetry Inspector / Hydrograph Preview */}
          <NodeInspectorModal
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            onClose={() => {
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
            onDeployPump={handleDeployPump}
            activePumps={activePumps}
          />
        </div>

        {/* Right Sidebar: Command Center (Tabs for Alerts, Mitigation, Evac Routing, Hydrograph) */}
        <div className="w-96 lg:w-[420px] flex flex-col bg-[#0b101c] border-l border-cyber-border/70 z-20 shrink-0">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-cyber-border/60 bg-[#080d17] p-1.5">
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 py-2 rounded-lg text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'alerts'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Alerts ({hotspots.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('mitigation')}
              className={`flex-1 py-2 rounded-lg text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'mitigation'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Pumps ({activePumps.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('routing')}
              className={`flex-1 py-2 rounded-lg text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'routing'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Routing</span>
            </button>

            <button
              onClick={() => setActiveTab('hydrograph')}
              className={`flex-1 py-2 rounded-lg text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'hydrograph'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Curves</span>
            </button>
          </div>

          {/* Active Tab Body */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'alerts' && (
              <HotspotAlertFeed
                hotspots={hotspots}
                selectedNode={selectedNode}
                onSelectNodeById={handleSelectNodeById}
                onDeployPump={handleDeployPump}
                activePumps={activePumps}
              />
            )}

            {activeTab === 'mitigation' && (
              <MitigationSandbox
                activePumps={activePumps}
                onDeployPump={handleDeployPump}
                onRemovePump={handleRemovePump}
                mitigationResult={mitigationResult}
                topologyNodes={topologyNodes}
                loading={loading}
              />
            )}

            {activeTab === 'routing' && (
              <EvacuationRouter
                topologyNodes={topologyNodes}
                onComputeRoute={handleComputeSafeRoute}
                routeResult={evacuationRoute}
                loading={loading}
                currentTimeMin={currentTimeMin}
              />
            )}

            {activeTab === 'hydrograph' && (
              <div className="p-4 h-full overflow-y-auto space-y-4">
                <HydrographChart
                  simulationData={simulationData}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  currentTimeMin={currentTimeMin}
                />

                {/* Watershed Hydrologic Summary Card */}
                <div className="bg-[#0e1526] p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>SURROGATE CONVERGENCE METRICS</span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    Hydrodynamic surrogate integrates 1-minute discrete conservation of mass ΔV = (Q_in - Q_out)Δt coupled with full Manning conduit flow conveyance Q_max = (1/n) · A · Rh^(2/3) · S^(1/2).
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Total Area Drained</span>
                      <span className="text-slate-200 font-bold">11.8 km²</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Peak Discharge Horizon</span>
                      <span className="text-cyan-400 font-bold">t+{simulationData?.overall_summary?.peak_time_min || 45} min</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
