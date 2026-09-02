import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowDownToLine, BarChart3, BatteryCharging,
  Check, ChevronDown, CloudRain, Droplets, Gauge, Layers3, MapPin, Menu,
  Navigation, Pause, Play, Radio, RotateCcw, Settings2, ShieldAlert,
  SlidersHorizontal, Waves, Zap, Fan, Volume2, VolumeX, ArrowRight, CheckCircle2, ShieldCheck, Map, LogOut
} from 'lucide-react';
import { fetchTopology, recomputeSimulation, fetchHotspotAlerts, deployPumpMitigation, computeSafeRoute, fetchTelemetryHistory, applyScenario } from './services/api';
import NetworkBackground from './components/NetworkBackground';
import LoginBackground from './components/LoginBackground';
import Login from './components/Login';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { rainAudio } from './utils/rainAudio';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);


// Use a deterministic seed for demo UI elements
type Severity = 'danger' | 'critical' | 'warning';
type AlertItem = {
  id: string; name: string; area: string; depth: string; risk: string;
  volume: string; severity: Severity; response: string; color: string;
};

const presetMap: Record<string, { preset_id: string; pattern: string; defaultIntensity: number }> = {
  'Flash Cloudburst': { preset_id: 'cloudburst-flash', pattern: 'cloudburst', defaultIntensity: 80 },
  'Monsoon Atmospheric River': { preset_id: 'monsoon-surge', pattern: 'monsoon_surge', defaultIntensity: 110 },
  'Monsoon Surge': { preset_id: 'monsoon-surge', pattern: 'monsoon_surge', defaultIntensity: 110 },
  '100-Year Design Storm': { preset_id: 'extreme-100yr', pattern: 'extreme_100yr', defaultIntensity: 140 },
  '100-Yr Extreme': { preset_id: 'extreme-100yr', pattern: 'extreme_100yr', defaultIntensity: 140 },
  'Steady Rain': { preset_id: 'moderate-rain', pattern: 'uniform', defaultIntensity: 35 },
  'Moderate Steady': { preset_id: 'moderate-rain', pattern: 'uniform', defaultIntensity: 35 },
};







const formatMinutes = (value: number) => `T + ${String(value).padStart(3, '0')} MIN`;


const stats = [
  { label: 'Forecast horizon', value: '06:00', detail: 'hours ahead', icon: CloudRain },
  { label: 'Model confidence', value: '94.8%', detail: 'live accuracy', icon: CheckCircle2 },
  { label: 'Cities connected', value: '128', detail: 'active networks', icon: MapPin },
];

const hazards = [
  { name: 'Normal flow', range: '< 0.10m', tone: 'normal', detail: 'Stable drainage capacity' },
  { name: 'Waterlogged warning', range: '0.10 \u2013 0.30m', tone: 'warning', detail: 'Monitor surface ponding' },
  { name: 'Critical surcharge', range: '0.30 \u2013 0.60m', tone: 'critical', detail: 'Conduits nearing capacity' },
  { name: 'Danger / submerged', range: '> 0.60m', tone: 'danger', detail: 'Immediate response required' },
];

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[10px] tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-pretty leading-7 text-muted-foreground">{copy}</p>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [precipitation, setPrecipitation] = useState(35);
  const [horizon, setHorizon] = useState(45);
  const [scenario, setScenario] = useState('Steady Rain');
  const [pattern, setPattern] = useState('uniform');
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>('moderate-rain');
  const [simulationData, setSimulationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('Alerts');
  const [isPlaying, setIsPlaying] = useState(false);
  const [evacuationRoute, setEvacuationRoute] = useState<any[] | null>(null);

  
  const [mapNodes, setMapNodes] = useState<any[]>([]);
  const [mapEdges, setMapEdges] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetch Topology
        const topData = await fetchTopology();
        const features = topData.features || [];
        const nodes = features.filter(f => f.geometry.type === 'Point');
        
        if (nodes.length > 0) {
          const lons = nodes.map(n => n.geometry.coordinates[0]);
          const lats = nodes.map(n => n.geometry.coordinates[1]);
          const minLon = Math.min(...lons);
          const maxLon = Math.max(...lons);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);

          const scaleLon = (lon) => ((lon - minLon) / (maxLon - minLon)) * 90 + 5;
          const scaleLat = (lat) => (1 - (lat - minLat) / (maxLat - minLat)) * 90 + 5; // Invert Y

          const parsedNodes = nodes.map(n => ({
            x: scaleLon(n.geometry.coordinates[0]),
            y: scaleLat(n.geometry.coordinates[1]),
            label: n.properties.node_id,
            depth_m: 0.05,
            level: 'normal'
          }));
          setMapNodes(parsedNodes);

          // We parse edges assuming the backend returns them, or we can just derive edges from nodes if not explicitly provided as LineStrings
          const edges = features.filter(f => f.geometry.type === 'LineString');
          const parsedEdges = edges.map(e => {
            const start = e.geometry.coordinates[0];
            const end = e.geometry.coordinates[e.geometry.coordinates.length - 1];
            return [scaleLon(start[0]), scaleLat(start[1]), scaleLon(end[0]), scaleLat(end[1])];
          });
          setMapEdges(parsedEdges);
        }

        // Fetch Alerts
        const alertData = await fetchHotspotAlerts(precipitation, pattern);
        const mappedAlerts = (alertData.hotspots || []).map(a => ({
            id: a.node_id,
            name: a.location_name,
            area: a.critical_tag,
            depth: `${a.peak_depth_m}m`,
            risk: `${a.risk_score} / 100`,
            volume: `${a.peak_volume_m3} mA3`,
            severity: a.severity,
            response: a.recommended_action,
            color: a.severity === 'danger' ? '#ef4444' : a.severity === 'critical' ? '#f59e0b' : '#fbbf24'
        }));
        setAlerts(mappedAlerts);

      } catch (err) {
        console.error("Failed to fetch initial data", err);
      }
    }
    loadData();
  }, []);

  // Real-time WebSocket Telemetry Connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = (window.location.port === '5173' || window.location.port === '3000')
          ? `${window.location.hostname}:8000`
          : window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/ws/telemetry`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[AquaGNN WS] Connected to telemetry stream:', wsUrl);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const messages = Array.isArray(data) ? data : [data];

            setMapNodes((prevNodes) => {
              if (!prevNodes || prevNodes.length === 0) return prevNodes;
              let hasChanged = false;

              const nextNodes = prevNodes.map((node) => {
                const update = messages.find((msg: any) => {
                  const target = String(msg.node_id);
                  const lbl = String(node.label || '');
                  return (
                    lbl === target ||
                    lbl === `ND-${target.padStart(2, '0')}` ||
                    lbl === `ND-${target}` ||
                    lbl.replace(/^ND-0*/, '') === target.replace(/^ND-0*/, '')
                  );
                });

                if (update && update.depth_m !== undefined) {
                  hasChanged = true;
                  const depth = typeof update.depth_m === 'number' ? update.depth_m : parseFloat(update.depth_m);
                  let level: Severity | 'normal' = 'normal';
                  if (depth >= 0.60) level = 'danger';
                  else if (depth >= 0.30) level = 'critical';
                  else if (depth >= 0.10) level = 'warning';

                  return {
                    ...node,
                    depth_m: depth,
                    level: level
                  };
                }
                return node;
              });

              return hasChanged ? nextNodes : prevNodes;
            });
          } catch (err) {
            console.warn('[AquaGNN WS] Error parsing telemetry payload:', err);
          }
        };

        ws.onerror = (err) => {
          console.warn('[AquaGNN WS] Telemetry WebSocket error:', err);
        };

        ws.onclose = () => {
          if (isMounted) {
            reconnectTimer = setTimeout(connectWebSocket, 3000);
          }
        };
      } catch (err) {
        console.warn('[AquaGNN WS] WebSocket initialization failure:', err);
        if (isMounted) {
          reconnectTimer = setTimeout(connectWebSocket, 5000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const [deployed, setDeployed] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState('ND-11');
  const [showMobileNav, setShowMobileNav] = useState(false);
  
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [recentlyDeployed, setRecentlyDeployed] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState('0 0 100 100');

  // Real-time Ambient Rain Sound Synthesizer
  useEffect(() => {
    if (soundEnabled) {
      rainAudio.play(precipitation);
    } else {
      rainAudio.stop();
    }
    return () => {
      rainAudio.stop();
    };
  }, [soundEnabled, precipitation]);

  const currentFrame = simulationData?.frames_by_horizon?.[String(horizon)];

  useEffect(() => {
    // Keep fixed viewBox to prevent clipping
    setViewBox('0 0 100 100');
  }, [selectedNode]);

  const timeSteps = [0, 15, 30, 45, 60, 75, 90, 120, 180];

  // Scrubber playback timer loop
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setHorizon((prev) => {
        const idx = timeSteps.indexOf(prev);
        if (idx === -1 || idx >= timeSteps.length - 1) return timeSteps[0];
        return timeSteps[idx + 1];
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Member 1 Hydrodynamic GNN Recomputation Handler
  const handleRunSimulation = async (
    customPumps = deployed,
    overridePrecip?: number,
    overridePresetId?: string | null,
    overridePattern?: string
  ) => {
    try {
      setLoading(true);
      const pumpsList = customPumps.map((nodeId) => ({
        node_id: nodeId,
        capacity_m3s: 1.5,
      }));

      const activePrecip = overridePrecip !== undefined ? overridePrecip : precipitation;
      const activePresetId = overridePresetId !== undefined ? overridePresetId : selectedPresetId;
      const activePattern = overridePattern !== undefined ? overridePattern : pattern;

      const sim = await recomputeSimulation({
        precipitation_rate_mm_hr: activePrecip,
        preset_id: activePresetId,
        active_pumps: pumpsList,
        pattern: activePattern,
        duration_hrs: 2.0,
      });
      setSimulationData(sim);
      if (sim?.overall_summary?.peak_time_min !== undefined) {
        setHorizon(sim.overall_summary.peak_time_min);
      }

      const alertsData = await fetchHotspotAlerts(activePrecip, activePattern);
      if (alertsData?.hotspots && alertsData.hotspots.length > 0) {
        // Optionally sync hotspots if available
      }
    } catch (err) {
      console.error('Simulation recomputation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial GNN recomputation load
  useEffect(() => {
    handleRunSimulation([]);
  }, []);

  const handleSelectPreset = async (presetName: string) => {
    try {
      setScenario(presetName);

      // 1. Call backend /scenarios/apply endpoint
      let newIntensity = 35;
      let newPattern = 'uniform';
      let newPresetId = 'moderate-rain';

      try {
        const res = await applyScenario({ scenario_name: presetName });
        if (res && res.precipitation_intensity_mm_hr !== undefined) {
          newIntensity = res.precipitation_intensity_mm_hr;
          newPattern = res.pattern || 'uniform';
          newPresetId = res.preset_id || 'moderate-rain';
        }
      } catch (apiErr) {
        console.warn('Backend scenario apply failed, falling back to local map', apiErr);
        const info = presetMap[presetName];
        if (info) {
          newIntensity = info.defaultIntensity;
          newPattern = info.pattern;
          newPresetId = info.preset_id;
        }
      }

      // 2. Update global precipitation slider and state in React
      setPrecipitation(newIntensity);
      setPattern(newPattern);
      setSelectedPresetId(newPresetId);

      // 3. Automatically trigger fresh GNN Recompute
      await handleRunSimulation(deployed, newIntensity, newPresetId, newPattern);
    } catch (err) {
      console.error('Failed to apply preset scenario:', err);
    }
  };


  const currentSummary = simulationData?.horizon_summaries?.[String(horizon)] ||
    simulationData?.frames_by_horizon?.[String(horizon)]?.summary;

  const surfaceVolume = useMemo(() => {
    if (currentSummary?.surface_ponding_m3 !== undefined) {
      return currentSummary.surface_ponding_m3.toLocaleString();
    }
    return (10630.9 + precipitation * 3.2).toFixed(1);
  }, [currentSummary, precipitation]);

  const floodedRoads = useMemo(() => {
    if (currentSummary?.flooded_road_km !== undefined) {
      return currentSummary.flooded_road_km.toFixed(2);
    }
    return (1.51 + precipitation / 130).toFixed(2);
  }, [currentSummary, precipitation]);

  const activePumps = deployed.length;

  const deployPump = (id: string) => {
    if (deployed.includes(id)) return;
    const newDeployed = [...deployed, id];
    setDeployed(newDeployed);
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    
    setRecentlyDeployed(id);
    setTimeout(() => setRecentlyDeployed(null), 2000);

    // Trigger recompute with updated pump configuration
    handleRunSimulation(newDeployed);
  };

  const resetSimulation = () => {
    setPrecipitation(35);
    setHorizon(45);
    setScenario('Steady Rain');
    setPattern('uniform');
    setSelectedPresetId('moderate-rain');
    setAlerts(alertsSeed);
    setDeployed([]);
    setSelectedNode('ND-11');
    setIsPlaying(false);
    handleRunSimulation([]);
  };

  if (!isAuthenticated) return <Login onLogin={() => setIsAuthenticated(true)} />;

  const pRatio = 1 - (precipitation / 160); // 1 = low rain (lighter), 0 = high rain (darker)
  const cR = Math.floor(8 + pRatio * 24);
  const cG = Math.floor(17 + pRatio * 43);
  const cB = Math.floor(28 + pRatio * 56);
  
  const mR = Math.floor(4 + pRatio * 10);
  const mG = Math.floor(8 + pRatio * 16);
  const mB = Math.floor(15 + pRatio * 25);
  
  const eR = Math.floor(2 + pRatio * 6);
  const eG = Math.floor(5 + pRatio * 10);
  const eB = Math.floor(10 + (horizon / 180) * 30 + pRatio * 15);

    return (
    <div className="full-page-scroller bg-[#0b132b] text-white overflow-x-hidden">
      {/* 1. NEW HERO SECTION */}
      <section className="home-shell relative min-h-screen overflow-hidden">
        {/* Ambient background */}
        <div aria-hidden="true" className="ambient-motion pointer-events-none absolute inset-0">
          <div className="water-glow water-glow-one" /><div className="water-glow water-glow-two" />
          <div className="flow-line flow-line-one" /><div className="flow-line flow-line-two" /><div className="flow-line flow-line-three" /><div className="rain-field" />
        </div>
        <div aria-hidden="true" className="home-grid pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="matrix-field pointer-events-none absolute inset-0">
          {Array.from({ length: 34 }, (_, column) => <span key={column} className={`matrix-column matrix-column-${column + 1}`}>{Array.from({ length: 12 }, (_, row) => <i key={row}>{'0A7F3C9D'} </i>)}</span>)}
        </div>
        <div aria-hidden="true" className="signal-nodes pointer-events-none absolute inset-0">{Array.from({ length: 16 }, (_, index) => <span key={index} className={`signal-node signal-node-${index + 1}`} />)}</div>

        {/* Header */}
        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="signin-mark flex size-10 items-center justify-center"><Waves aria-hidden="true" className="size-5" /></div>
            <div>
              <p className="font-mono text-sm font-extrabold tracking-[0.18em] text-cyan-400">AQUAGNN</p>
              <p className="font-mono text-[9px] tracking-[0.24em] text-muted-foreground">URBAN WATER INTELLIGENCE</p>
            </div>
          </div>
          <nav aria-label="Primary navigation" className="hidden items-center gap-6 font-mono text-[10px] tracking-[0.14em] text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-cyan-400">PLATFORM</a>
            <a href="#dashboard" className="transition-colors hover:text-cyan-400">COMMAND CENTER</a>
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-all ${soundEnabled ? 'border-cyan-500/70 text-cyan-300 bg-cyan-950/60 shadow-[0_0_10px_rgba(18,215,244,0.3)]' : 'border-border/60 hover:border-border text-slate-400 hover:text-slate-200'}`}
              title={soundEnabled ? "Mute ambient rain audio" : "Enable realistic ambient rain audio"}
            >
              {soundEnabled ? <Volume2 size={13} className="text-cyan-400 animate-pulse" /> : <VolumeX size={13} />}
              <span>{soundEnabled ? 'RAIN ON' : 'RAIN OFF'}</span>
            </button>
          </nav>
          <button 
            onClick={() => setIsAuthenticated(false)} 
            className="preset-button font-mono text-[10px] tracking-[0.12em] flex items-center gap-1.5 hover:!border-red-500/60 hover:!text-red-300 hover:!bg-red-950/40 transition-colors cursor-pointer"
            title="Sign out to return to login screen"
          >
            <span>SIGN OUT</span>
            <LogOut className="inline size-3 text-red-400" />
          </button>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-96px)] w-full max-w-7xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pt-0">
          <div className="max-w-2xl">
            <div className="status-badge w-fit"><span className="status-dot" /> LIVE FLOOD INTELLIGENCE NETWORK</div>
            <h1 className="mt-7 text-pretty text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              See the surge <span className="text-cyan-400">before</span> it reaches the street.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              AquaGNN turns live weather, drainage, and terrain signals into clear urban flood forecasts your teams can act on now.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#dashboard" className="signin-submit w-fit rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer px-4 py-3 flex items-center justify-center gap-2"><span>Open command center</span><ArrowRight className="size-3" /></a>
              
            </div>
            <div id="status" className="mt-12 grid max-w-xl grid-cols-1 border-y border-border sm:grid-cols-3">
              {stats.map(({ label, value, detail, icon: Icon }, index) => (
                <div key={label} className={`flex items-center gap-3 py-4 sm:flex-col sm:items-start sm:py-5 ${index !== 0 ? 'sm:border-l sm:border-border sm:pl-5' : ''}`}>
                  <Icon aria-hidden="true" className="size-4 text-cyan-400" />
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-xl font-bold text-white">{value} <span className="text-[9px] font-normal text-muted-foreground">{detail}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Radar Panel */}
          <div className="glass-panel relative min-h-[420px] overflow-hidden p-5 sm:min-h-[500px] sm:p-7">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.16em] text-cyan-400">AQUA / NOWCAST</p>
                <p className="mt-1 text-sm font-medium">Regional inundation overview</p>
              </div>
              <ShieldCheck aria-hidden="true" className="size-5 text-cyan-400" />
            </div>
            <div className="relative flex min-h-[310px] items-center justify-center overflow-hidden">
              <div className="map-radar">
                <div className="radar-sweep" />
                <div className="map-road road-one" />
                <div className="map-road road-two" />
                <div className="map-road road-three" />
                <span className="map-node node-a"><Droplets size={12} aria-hidden="true" /></span>
                <span className="map-node node-b">!</span>
                <span className="map-node node-c">72</span>
              </div>
              <div className="absolute inset-x-0 bottom-4 flex justify-between font-mono text-[9px] tracking-[0.1em] text-muted-foreground">
                <span>LAT 40.7128 N</span><span>LIVE 14:32:08 UTC</span><span>LONG 74.0060 W</span>
              </div>
            </div>
            <div className="flex items-end justify-between border-t border-border pt-4">
              <div>
                <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">PEAK INUNDATION RISK</p>
                <p className="mt-1 text-2xl font-semibold text-amber-200">MODERATE</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground">NEXT UPDATE</p>
                <p className="mt-1 font-mono text-sm text-cyan-400">00:42</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. OLD DASHBOARD WRAPPER */}
      <div id="dashboard" className="relative w-full overflow-hidden">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-10 py-10 pb-0">
          <SectionHeading eyebrow="02 / LIVE COMMAND CENTER" title="Real-time Urban Topography" copy="Monitor live precipitation, adjust forecast horizons, and visualize simulated water flows across critical municipal infrastructure." />
        </div>
        <main className="app-shell" style={{ background: `radial-gradient(circle at 52% 44%, rgba(${cR}, ${cG}, ${cB}, 1) 0%, rgba(${mR}, ${mG}, ${mB}, 1) 42%, rgba(${eR}, ${eG}, ${eB}, 1) 100%)` }}>
      <NetworkBackground />
      <div className="global-rain-overlay" style={{ opacity: precipitation / 160 }} />
      {scenario === 'Flash Cloudburst' && <div className="lightning-ambient-bg" />}
      {isPlaying && <div className="gnn-pulse-overlay" />}

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Waves size={22} /></div>
          <div>
            <div className="brand-name">AQUA <span>GNN</span></div>
            <div className="brand-subtitle">AI-Driven Urban Flood Nowcasting & Stormwater Inundation Engine</div>
          </div>
        </div>
        <button className="mobile-menu" onClick={() => setShowMobileNav((v) => !v)} aria-label="Toggle navigation"><Menu size={19} /></button>
        <div className={`topbar-controls ${showMobileNav ? 'is-open' : ''}`}>
          <div className="preset-label"><Zap size={14} /> Presets:</div>
          {(['Flash Cloudburst', 'Monsoon Atmospheric River', '100-Year Design Storm'] as const).map((preset, i) => (
            <button key={preset} className={`top-preset ${scenario === preset ? 'active' : ''}`} onClick={() => handleSelectPreset(preset)}>
              <span>{preset}</span><small>{i === 0 ? '80mm/h' : i === 1 ? '110mm/h' : '140mm/h'}</small>
            </button>
          ))}
          <button className={`scenario-chip ${scenario === 'Steady Rain' || scenario === 'Moderate Steady' ? 'selected' : ''}`} onClick={() => handleSelectPreset('Steady Rain')}>
            <span>Moderate Steady</span><small>35mm/h</small>
          </button>
          <div className="engine-status"><span className="status-dot" /> GNN Engine <strong>{loading ? 'Recomputing...' : 'Ready'}</strong></div>
          <button 
            className={`reset-button ${soundEnabled ? '!border-cyan-500/70 !text-cyan-300 !bg-cyan-950/60 shadow-[0_0_12px_rgba(18,215,244,0.35)]' : ''}`} 
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute ambient rain audio" : "Enable realistic ambient rain audio"}
            aria-label="Toggle ambient rain audio"
          >
            {soundEnabled ? <Volume2 size={14} className="text-cyan-400 animate-pulse" /> : <VolumeX size={14} />}
            <span className="text-[11px] font-mono">{soundEnabled ? 'RAIN ON' : 'RAIN OFF'}</span>
          </button>
          <button className="reset-button" onClick={resetSimulation}><RotateCcw size={14} /> Reset</button>
        </div>
      </header>

      <section className="telemetry-grid">
        <MetricCard 
          icon={<Droplets size={15} />} 
          label="Peak Flood Depth" 
          value={currentSummary ? currentSummary.peak_flood_depth_m.toFixed(2) : "1.45"} unit="meters" 
          note={currentSummary ? (currentSummary.peak_flood_depth_m >= 0.6 ? "Severe Inundation" : currentSummary.peak_flood_depth_m >= 0.3 ? "Critical Caution" : "Sub-Critical") : "Severe Inundation"} 
          accent="danger" badge={`t+${horizon}m`} 
          animatedBar={true} 
        />
        <MetricCard icon={<Waves size={15} />} label="Surface Ponding" value={surfaceVolume} unit="m³" note="Accumulated surface overflow" accent="cyan" />
        <MetricCard icon={<AlertTriangle size={15} />} label="Flooded Roads" value={floodedRoads} unit="km" note={`${currentSummary?.choke_conduits ?? 0} choked conduits (≥90%)`} accent="amber" />
        <MetricCard 
          icon={<ShieldAlert size={15} />} 
          label="Hazard Nodes" value={currentSummary ? String(currentSummary.hazard_nodes.total) : String(alerts.length)} unit="nodes" 
          note={currentSummary ? `${currentSummary.hazard_nodes.danger} Danger  ${currentSummary.hazard_nodes.critical} Critical` : "1 Danger  2 Critical"} accent="danger" 
          pulsingBadge={alerts.length > 0}
        >
          <div className="flex gap-1 mt-1">
            {alerts.map(a => (
              <span key={a.id} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: a.color }} title={a.id} />
            ))}
          </div>
        </MetricCard>
        <MetricCard 
          icon={<Fan size={15} className={activePumps > 0 ? 'animate-spin-slow' : ''} />} 
          label="Active Pumps" value={String(activePumps)} unit="units" 
          note={`${(activePumps * 2.5).toFixed(1)} m³/s total dewatering`} accent="green" 
        />
      </section>

      <section className="control-deck glass-panel">
        <div className="precip-control">
          <div className="control-heading"><CloudRain size={16} /><span>Precipitation Rate</span><strong>{precipitation} mm/hr</strong></div>
          <input aria-label="Precipitation rate" type="range" min="0" max="160" value={precipitation} onChange={(e) => { setPrecipitation(Number(e.target.value)); setSelectedPresetId(null); }} />
        </div>
        <div className="scenario-tabs">
          {(['Flash Cloudburst', 'Monsoon Surge', '100-Yr Extreme', 'Steady Rain'] as const).map((item) => (
            <button key={item} className={scenario === item ? 'active' : ''} onClick={() => handleSelectPreset(item)}>{item}</button>
          ))}
          <button className="recompute" onClick={() => { setIsPlaying(true); handleRunSimulation(deployed); }} disabled={loading}>
            <SlidersHorizontal size={14} /> {loading ? 'RECOMPUTING...' : 'Recompute GNN'}
          </button>
        </div>
        <div className="horizon-control">
          <div className="horizon-heading"><span><Gauge size={14} /> Horizon Scrubber:</span><strong>{formatMinutes(horizon)}</strong></div>
          <div className="scrubber-row">
            <button className="play-button" onClick={() => setIsPlaying((v) => !v)}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
            <span>1x</span>
            <input aria-label="Time horizon" type="range" min="0" max="180" step="15" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} />
          </div>
          <div className="scrubber-labels"><span>+0m</span><span>+45m</span><span>+90m</span><span>+180m</span></div>
        </div>
      </section>


      <section className="workspace">
        <div className="map-panel glass-panel">
          <div className="tide-mark" style={{ height: `${20 + (alerts.length * 15)}%` }} />
          <div className="map-toolbar">
            <div className="map-mode">
              <button className="active"><Layers3 size={13} /> Conduits</button>
              <button><MapPin size={13} /> Nodes</button>
              <button><Radio size={13} /> Beacons</button>
            </div>
            <div className="zoom-controls"><button>+</button><button>−</button></div>
          </div>
          <div className="map-grid-pattern" />
          <motion.svg className="topology-map" animate={{ viewBox }} transition={{ duration: 1.2, ease: "easeInOut" }} preserveAspectRatio="none" aria-label="Urban drainage topology map" style={{ cursor: 'crosshair' }}>
            <path d="M2 24 C20 31 16 16 37 24 S65 9 98 20 M1 65 C22 54 32 79 54 58 S74 71 99 57 M18 3 C26 19 20 36 41 47 S58 70 51 98 M76 0 C65 17 76 28 63 44 S82 73 70 100" className="road-line" />
            {mapEdges.map(([x1, y1, x2, y2], i) => {
              const speed = (i % 3 === 0) ? 0.8 : (i % 2 === 0) ? 1.5 : 3;
              const colorClass = speed === 3 ? 'stroke-cyan-400' : speed === 1.5 ? 'stroke-amber-400' : 'stroke-red-500';
              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="conduit-line" style={{ stroke: speed === 3 ? '#22d3ee' : speed === 1.5 ? '#fbbf24' : '#ef4444' }} />
                  <circle r="1.5" fill="#fff" opacity="0.8">
                    <animate attributeName="cx" values={`${x1};${x2}`} dur={`${speed}s`} repeatCount="indefinite" />
                    <animate attributeName="cy" values={`${y1};${y2}`} dur={`${speed}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
            {mapNodes.map((node) => {
                const liveLevel = node.level || currentFrame?.nodes?.[node.label]?.status || 'normal';
                const displayDepth = node.depth_m !== undefined ? node.depth_m : currentFrame?.nodes?.[node.label]?.depth_m;
                return (
                <g 
                  key={node.label} 
                  className="node-group" 
                  onClick={() => setSelectedNode(node.label)}
                  onMouseEnter={() => setHoveredNode(node.label)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {liveLevel !== 'normal' && <circle cx={node.x} cy={node.y} r="8" className={`heatmap-bloom ${liveLevel}`} />}
                  {liveLevel === 'danger' && <circle cx={node.x} cy={node.y} r="15" className="inundation-spread" />}
                  <circle cx={node.x} cy={node.y} r={node.label === selectedNode ? 3.3 : 2.2} className={`map-node ${liveLevel} ${node.label === selectedNode ? 'selected' : ''}`} />
                  <circle cx={node.x} cy={node.y} r={node.label === selectedNode ? 6 : 4.5} className={`node-pulse ${liveLevel}`} />
                  {recentlyDeployed === node.label && (
                    <circle cx={node.x} cy={node.y} r="10" className="pump-ripple-anim" />
                  )}
                  <text x={node.x + 3.5} y={node.y - 3} className="node-label">{node.label}</text>
                  
                  {hoveredNode === node.label && (
                    <foreignObject 
                      x={node.x > 75 ? node.x - 44 : node.x + 4} 
                      y={node.y < 20 ? node.y + 4 : node.y - 12} 
                      width="40" height="20" style={{ pointerEvents: 'none' }}
                    >
                      <div className="node-tooltip">
                        <strong>{node.label}</strong>
                        <span>{displayDepth !== undefined ? `${Number(displayDepth).toFixed(2)}m depth` : '0.00m depth'}</span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              )})}
          
            {/* Draw Evacuation Route */}
            {evacuationRoute && evacuationRoute.length > 1 && (
              <g className="evacuation-route">
                <polyline 
                  points={evacuationRoute.map(p => `${p.x},${p.y}`).join(' ')} 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="2" 
                  strokeDasharray="4 2" 
                  className="animate-pulse"
                />
                {evacuationRoute.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="2" fill="#10b981" />
                ))}
              </g>
            )}
            
            {/* Draw Persistent Deployed Pumps */}
            {mapNodes.filter(n => deployed.includes(n.label)).map(node => (
              <g key={`pump-${node.label}`} className="deployed-pump-indicator" style={{ pointerEvents: 'none' }}>
                <rect x={node.x - 3.5} y={node.y - 3.5} width="7" height="7" fill="#0b132b" stroke="#22d3ee" strokeWidth="0.5" rx="1" />
                <circle cx={node.x} cy={node.y} r="1.5" fill="#22d3ee">
                  <animateTransform attributeName="transform" type="rotate" from={`0 ${node.x} ${node.y}`} to={`360 ${node.x} ${node.y}`} dur="1s" repeatCount="indefinite" />
                </circle>
                <text x={node.x - 4} y={node.y + 7} fill="#22d3ee" fontSize="3px" fontWeight="bold">PUMP</text>
              </g>
            ))}
    </motion.svg>
          <div className="map-locations">
            <span>INDUSTRIAL DISTRICT</span><span>CIVIC CENTER</span><span>SOUTH CANAL</span><span>BAYFRONT</span>
          </div>
          <div className="map-status">
            <span className="live-dot" /> LIVE TOPOLOGY <span>•</span> Selected Node: <strong>{selectedNode}</strong>
          </div>
          <HydroLegend />
        </div>

        <aside className="alerts-panel glass-panel">
          <div className="side-tabs">
            <button className={activeTab === 'Alerts' ? 'active' : ''} onClick={() => setActiveTab('Alerts')}><ShieldAlert size={14} /> Alerts ({alerts.length + deployed.length})</button>
            <button className={activeTab === 'Pumps' ? 'active' : ''} onClick={() => setActiveTab('Pumps')}><Zap size={14} /> Pumps ({deployed.length})</button>
            <button className={activeTab === 'Routing' ? 'active' : ''} onClick={() => setActiveTab('Routing')}><Navigation size={14} /> Routing</button>
            <button className={activeTab === 'Curves' ? 'active' : ''} onClick={() => setActiveTab('Curves')}><BarChart3 size={14} /> Curves</button>
          </div>
                    {activeTab === 'Alerts' ? (
            <>
              <div className="alerts-heading">
                <div><span>CHOKE-POINT ALERTS</span><small>Ranked by current hazard severity</small></div>
                <b>{alerts.length} ACTIVE</b>
              </div>
              <div className="alert-list">
                {alerts.length === 0 ? <EmptyState /> : alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onDeploy={deployPump} />)}
              </div>
            </>
          ) : activeTab === 'Routing' ? (
            <RoutingTab nodes={mapNodes} setEvacuationRoute={setEvacuationRoute} />
          ) : activeTab === 'Curves' ? (
            <CurvesTab selectedNode={selectedNode} />
          ) : (
            <TabEmpty tab={activeTab} deployed={deployed.length} />
          )}
        </aside>
      </section>

      <footer className="footer-bar">
        <span><Activity size={13} /> Model status: <strong>Live assimilation</strong></span>
        <div className="footer-ticker">
          <div className="ticker-scroll">
            <span>[SYS] ND-11 assimilation complete</span>
            <span className="text-amber-400">[WARN] Pressure spike detected at South Canal</span>
            <span>[SYS] GNN weights updated</span>
            <span>[OP] Mobile pump team dispatched to ND-12</span>
            <span>[SYS] ND-11 assimilation complete</span>
          </div>
        </div>
        <span><Check size={13} /> Forecast confidence <strong className={isPlaying ? 'rolling-digits' : ''}>{isPlaying ? '99.9%' : '94.8%'}</strong></span>
        <span className="footer-right">District 7 / 12 monitored <ChevronDown size={14} /></span>
      </footer>
    </main>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, note, accent, badge, animatedBar, pulsingBadge, children }: {
  icon: React.ReactNode; label: string; value: string; unit: string; note: string; accent: string; badge?: string; animatedBar?: boolean; pulsingBadge?: boolean; children?: React.ReactNode;
}) {
  // Generate a random sparkline
  const sparklinePts = useMemo(() => {
    return Array.from({length: 10}, (_, i) => `${i * 10},${20 - Math.random() * 15}`).join(' L ');
  }, []);

  return (
    <article className={`metric-card ${accent}`}>
      <svg className="absolute bottom-0 left-0 w-full h-12 opacity-10 pointer-events-none" viewBox="0 0 90 20" preserveAspectRatio="none">
        <path d={`M 0,20 L 0,${20 - Math.random() * 10} L ${sparklinePts} L 90,20 Z`} fill="currentColor" />
        <path d={`M 0,${20 - Math.random() * 10} L ${sparklinePts}`} stroke="currentColor" strokeWidth="1" fill="none" />
      </svg>
      <div className="metric-label">{icon}<span>{label}</span>{badge && <b className={pulsingBadge ? 'animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]' : ''}>{badge}</b>}</div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      <div className="metric-note flex flex-col gap-1.5">
        <span>{note}</span>
        {children}
        {animatedBar && (
          <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-cyan-500 animate-pulse-width" style={{ width: '75%' }} />
          </div>
        )}
      </div>
    </article>
  );
}

function AlertCard({ alert, onDeploy }: { alert: AlertItem; onDeploy: (id: string) => void }) {
  const [countdown, setCountdown] = useState(alert.severity === 'danger' ? 180 + Math.floor(Math.random()*100) : alert.severity === 'critical' ? 360 + Math.floor(Math.random()*200) : 900);
  
  useEffect(() => {
    const int = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(int);
  }, []);
  
  const m = Math.floor(countdown / 60).toString().padStart(2, '0');
  const s = (countdown % 60).toString().padStart(2, '0');
  const riskPct = parseInt(alert.risk);

  return (
    <article className={`alert-card animate-slide-in ${alert.severity} ${alert.severity === 'danger' ? 'animate-tremble' : ''}`}>
      <div className="severity-meter">
        <div className={`severity-fill bg-${alert.severity}`} style={{ width: `${riskPct}%`, backgroundColor: alert.color }} />
      </div>
      <div className="alert-title">
        <div><strong>{alert.name}</strong><span>{alert.area}</span></div>
        <div className="flex flex-col items-end gap-1">
          <b style={{ borderColor: `${alert.color}66`, color: alert.color }}>
            <span /> {alert.severity.toUpperCase()}
          </b>
          <span className="font-mono text-[10px] text-slate-400">T-{m}:{s}</span>
        </div>
      </div>
      <div className="alert-data">
        <span>Peak<strong>{alert.depth}</strong></span>
        <span>Risk Score<strong>{alert.risk}</strong></span>
        <span>Volume<strong>{alert.volume}</strong></span>
      </div>
      <div className="response"><strong>Response:</strong> {alert.response}</div>
      <div className="alert-actions">
        <button><MapPin size={13} /> Focus Map</button>
        <button className="deploy" onClick={() => onDeploy(alert.id)}>
          <ArrowDownToLine size={13} /> Deploy Pump <strong>2.5m³/s</strong>
        </button>
      </div>
    </article>
  );
}

function HydroLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`hydro-legend ${collapsed ? 'is-collapsed' : ''}`}>
      <div 
        className="legend-title flex items-center justify-between cursor-pointer select-none" 
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Click to expand hazard scale" : "Click to collapse hazard scale"}
      >
        <div className="flex items-center gap-2">
          <Waves size={13} className="text-cyan-400" />
          <span>HYDRO HAZARD SCALE</span>
        </div>
        <button 
          type="button" 
          className="text-slate-400 hover:text-cyan-300 ml-2 font-mono text-xs w-4 h-4 flex items-center justify-center rounded hover:bg-slate-800"
          aria-label={collapsed ? "Expand legend" : "Collapse legend"}
        >
          {collapsed ? '+' : '−'}
        </button>
      </div>
      {!collapsed && (
        <>
          <LegendRow color="#10b981" label="Normal Flow" value="&lt; 0.10m" />
          <LegendRow color="#facc15" label="Waterlogged Warning" value="0.10 - 0.30m" />
          <LegendRow color="#f59e0b" label="Critical Surcharge" value="0.30 - 0.60m" />
          <LegendRow color="#ef4444" label="Danger / Submerged" value="&gt; 0.60m" />
          <div className="legend-flow"><span /> High Conduit Flow (≥85%)</div>
        </>
      )}
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="legend-row">
      <i style={{ background: color }} /><span>{label}</span><strong dangerouslySetInnerHTML={{ __html: value }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <Check size={24} /><strong>All choke points mitigated</strong><span>No active intervention required.</span>
    </div>
  );
}

function CurvesTab({ selectedNode }: { selectedNode: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNode) return;
    
    let mounted = true;
    setLoading(true);
    setError(null);
    
    fetchTelemetryHistory(selectedNode, 24)
      .then(res => {
        if (mounted) {
          if (res && res.status === 'ok' && Array.isArray(res.history)) {
            setHistory(res.history);
          } else if (res && Array.isArray(res)) {
            setHistory(res);
          } else {
            setHistory([]);
          }
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          console.warn('[CurvesTab] Fetch warning:', err);
          setError(err?.message || 'Failed to fetch telemetry history');
          setLoading(false);
        }
      });
      
    return () => { mounted = false; };
  }, [selectedNode]);

  if (!selectedNode) {
    return <TabEmpty tab="Curves" deployed={0} />;
  }

  if (loading) {
    return (
      <div className="tab-empty">
        <div className="animate-spin text-cyan-400"><RotateCcw size={25} /></div>
        <strong>Loading telemetry history...</strong>
        <span>Fetching 24-hour hydrograph for {selectedNode}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tab-empty text-red-400">
        <div><ShieldAlert size={25} /></div>
        <strong>Data Load Failed</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="tab-empty">
        <div><BarChart3 size={25} /></div>
        <strong>No Historical Data</strong>
        <span>No telemetry records found for {selectedNode} in the last 24 hours.</span>
      </div>
    );
  }

  const chartData = {
    labels: history.map(h => new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [
      {
        label: 'Water Depth (m)',
        data: history.map(h => h.water_level_m),
        borderColor: 'rgb(34, 211, 238)', // cyan-400
        backgroundColor: 'rgba(34, 211, 238, 0.2)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHitRadius: 10,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10 } }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#94a3b8', maxTicksLimit: 6, font: { size: 9 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#94a3b8', font: { size: 9 } },
        title: { display: true, text: 'Water Depth (m)', color: '#94a3b8', font: { size: 10 } },
        suggestedMin: 0,
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
      <div className="alerts-heading">
        <div><span>24-HOUR HYDROGRAPH</span><small>Historical telemetry for {selectedNode}</small></div>
        <b>{history.length} READINGS</b>
      </div>
      <div className="relative w-full max-w-full min-w-0 h-[380px] p-3 overflow-hidden">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}


function RoutingTab({ nodes, setEvacuationRoute }: { nodes: any[], setEvacuationRoute: (route: any[] | null) => void }) {
  const [computing, setComputing] = useState(false);
  
  const generateRoute = () => {
    setComputing(true);
    // Simulate finding a safe route from a danger node to a safe zone
    setTimeout(() => {
      const dangerNodes = nodes.filter(n => n.level === 'danger' || n.level === 'critical');
      const safeNodes = nodes.filter(n => n.level === 'normal' || !n.level);
      
      if (dangerNodes.length > 0 && safeNodes.length > 0) {
        // Just grab the first danger node and path it to a safe node
        const start = dangerNodes[0];
        const end = safeNodes[safeNodes.length - 1]; // pick one far away
        
        // Mock a route (in a real app this would use a graph pathfinding algorithm over mapEdges)
        // We'll just draw a direct line or a 2-segment line for visual effect
        const midX = (start.x + end.x) / 2;
        const midY = start.y;
        
        setEvacuationRoute([
          {x: start.x, y: start.y, label: start.label},
          {x: midX, y: midY, label: 'WP-1'},
          {x: end.x, y: end.y, label: end.label}
        ]);
      } else {
        setEvacuationRoute([]); // No route needed
      }
      setComputing(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full p-5">
      <div className="alerts-heading mb-4">
        <div><span>EVACUATION ROUTING</span><small>Dynamic safe-path generation</small></div>
      </div>
      <p className="text-xs text-slate-400 mb-6 leading-5">
        Compute safe egress routes away from active inundation zones. The GNN model evaluates conduit surcharge levels to guarantee path viability.
      </p>
      <button 
        onClick={generateRoute}
        disabled={computing}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[10px] tracking-wider py-3 rounded-sm transition-colors flex items-center justify-center gap-2"
      >
        {computing ? <div className="animate-spin"><RotateCcw size={14} /></div> : <Navigation size={14} />}
        {computing ? 'CALCULATING...' : 'COMPUTE SAFE ROUTE'}
      </button>
      
      <button 
        onClick={() => setEvacuationRoute(null)}
        className="w-full mt-3 border border-slate-700 hover:bg-slate-800 text-slate-300 font-mono text-[10px] tracking-wider py-3 rounded-sm transition-colors"
      >
        CLEAR ROUTES
      </button>
    </div>
  );
}

function TabEmpty({ tab, deployed }: { tab: string; deployed: number }) {
  return (
    <div className="tab-empty">
      <div><Settings2 size={25} /></div>
      <strong>{tab} workspace ready</strong>
      <span className="mt-2 text-center text-xs text-slate-400">
        {tab === 'Pumps' ? `${deployed} simulated pump units deployed. Click on a hazard alert to deploy more.` : 
         tab === 'Routing' ? 'Generate evacuation routes away from critical inundation zones.' : 
         tab === 'Curves' ? 'Click on any node on the map (e.g. ND-01) to view its 24-hour hydrograph curve.' : 
         'Select a live telemetry layer to continue.'}
      </span>
    </div>
  );
}

export default App;
