import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowDownToLine, BarChart3, BatteryCharging,
  Check, ChevronDown, CloudRain, Droplets, Gauge, Layers3, MapPin, Menu,
  Navigation, Pause, Play, Radio, RotateCcw, Settings2, ShieldAlert,
  SlidersHorizontal, Waves, Zap, Fan, Volume2, VolumeX
} from 'lucide-react';
import NetworkBackground from './components/NetworkBackground';
import Login from './components/Login';
import { recomputeSimulation, fetchHotspotAlerts, fetchTopology } from './services/api';

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

  const [deployed, setDeployed] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState('ND-11');
  const [showMobileNav, setShowMobileNav] = useState(false);
  
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [recentlyDeployed, setRecentlyDeployed] = useState<string | null>(null);
  const [viewBox, setViewBox] = useState('0 0 100 100');

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
  const handleRunSimulation = async (customPumps = deployed) => {
    try {
      setLoading(true);
      const pumpsList = customPumps.map((nodeId) => ({
        node_id: nodeId,
        capacity_m3s: 1.5,
      }));

      const sim = await recomputeSimulation({
        precipitation_rate_mm_hr: precipitation,
        preset_id: selectedPresetId,
        active_pumps: pumpsList,
        pattern: pattern,
        duration_hrs: 2.0,
      });
      setSimulationData(sim);
      if (sim?.overall_summary?.peak_time_min !== undefined) {
        setHorizon(sim.overall_summary.peak_time_min);
      }

      const alertsData = await fetchHotspotAlerts(precipitation, pattern);
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

  const handleSelectPreset = (presetName: string) => {
    setScenario(presetName);
    const info = presetMap[presetName];
    if (info) {
      setPrecipitation(info.defaultIntensity);
      setPattern(info.pattern);
      setSelectedPresetId(info.preset_id);
    } else {
      setSelectedPresetId(null);
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
    <main className="app-shell" style={{ background: `radial-gradient(circle at 52% 44%, rgba(${cR}, ${cG}, ${cB}, 1) 0%, rgba(${mR}, ${mG}, ${mB}, 1) 42%, rgba(${eR}, ${eG}, ${eB}, 1) 100%)` }}>
      <NetworkBackground />
      <div className="global-rain-overlay" style={{ opacity: precipitation / 160 }} />
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
            <button key={preset} className="top-preset" onClick={() => handleSelectPreset(preset)}>
              <span>{preset}</span><small>{i === 0 ? '80mm/h' : i === 1 ? '110mm/h' : '140mm/h'}</small>
            </button>
          ))}
          <button className={`scenario-chip ${scenario === 'Steady Rain' ? 'selected' : ''}`} onClick={() => handleSelectPreset('Steady Rain')}>
            <span>Moderate Steady</span><small>35mm/h</small>
          </button>
          <div className="engine-status"><span className="status-dot" /> GNN Engine <strong>{loading ? 'Recomputing...' : 'Ready'}</strong></div>
          <button className="reset-button" onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
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
          {scenario === 'Flash Cloudburst' && <div className="lightning-flash-overlay" style={{ borderRadius: 'inherit' }} />}
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
                const liveLevel = currentFrame?.nodes?.[node.label]?.status || node.level || 'normal';
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
                        <span>{currentFrame?.nodes?.[node.label]?.depth_m !== undefined ? `${currentFrame.nodes[node.label].depth_m.toFixed(2)}m depth` : `${(Math.random() * 2 + 0.5).toFixed(1)}m depth`}</span>
                      </div>
                    </foreignObject>
                  )}
                </g>
              )})}
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
  return (
    <div className="hydro-legend">
      <div className="legend-title"><Waves size={14} /> HYDRO HAZARD SCALE</div>
      <LegendRow color="#10b981" label="Normal Flow" value="&lt; 0.10m" />
      <LegendRow color="#facc15" label="Waterlogged Warning" value="0.10 - 0.30m" />
      <LegendRow color="#f59e0b" label="Critical Surcharge" value="0.30 - 0.60m" />
      <LegendRow color="#ef4444" label="Danger / Submerged" value="&gt; 0.60m" />
      <div className="legend-flow"><span /> High Conduit Flow (≥85%)</div>
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

function TabEmpty({ tab, deployed }: { tab: string; deployed: number }) {
  return (
    <div className="tab-empty">
      <div><Settings2 size={25} /></div>
      <strong>{tab} workspace ready</strong>
      <span>{tab === 'Pumps' ? `${deployed} simulated pump units deployed.` : 'Select a live telemetry layer to continue.'}</span>
    </div>
  );
}

export default App;
