import React, { useState } from 'react';
import { Navigation, ShieldCheck, AlertTriangle, ArrowRight, CornerDownRight, CheckCircle } from 'lucide-react';

export default function EvacuationRouter({
  topologyNodes = [],
  onComputeRoute,
  routeResult,
  loading,
  currentTimeMin = 60
}) {
  const [origin, setOrigin] = useState('ND-01');
  const [destination, setDestination] = useState('ND-OF01');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!origin || !destination) return;
    onComputeRoute(origin, destination);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b101c] border-l border-cyber-border/70 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-cyber-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white font-mono">EVACUATION ROUTER</h2>
            <p className="text-[11px] text-slate-400">Flood-Aware Shortest Path Routing</p>
          </div>
        </div>
      </div>

      {/* Origin / Destination Selector */}
      <form onSubmit={handleSubmit} className="bg-[#0f172a] p-3.5 rounded-xl border border-slate-800 mb-4 space-y-3">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">Origin Node (Evacuation Point)</label>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full bg-[#090d16] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-none"
          >
            {topologyNodes.map((n) => (
              <option key={n.properties.node_id} value={n.properties.node_id}>
                {n.properties.node_id}: {n.properties.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">Destination Node (Safe Zone / Shelter)</label>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-[#090d16] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-none"
          >
            {topologyNodes.map((n) => (
              <option key={n.properties.node_id} value={n.properties.node_id}>
                {n.properties.node_id}: {n.properties.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs rounded-lg transition font-mono flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{loading ? 'CALCULATING SAFE PATH...' : `COMPUTE SAFE ROUTE (T+${currentTimeMin}M)`}</span>
        </button>
      </form>

      {/* Routing Results */}
      {routeResult && (
        <div className="flex-1 space-y-3">
          {routeResult.success ? (
            <div className="p-3.5 rounded-xl bg-[#0e1526] border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
                    routeResult.is_route_safe
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                      : 'bg-amber-950/80 text-amber-400 border-amber-500/40'
                  }`}
                >
                  {routeResult.is_route_safe ? (
                    <>
                      <ShieldCheck className="w-3 h-3" /> SAFE PASSAGE
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> CAUTION // WATER ON PATH
                    </>
                  )}
                </span>

                <span className="text-xs font-mono text-cyan-400 font-bold">
                  {routeResult.total_distance_km} km
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 bg-[#090d16] p-2 rounded-lg border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">Max Flood Depth</span>
                  <span
                    className={`font-bold ${
                      routeResult.max_flood_depth_on_route_m >= 0.3 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {routeResult.max_flood_depth_on_route_m} m
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Waypoints</span>
                  <span className="text-slate-200 font-bold">{routeResult.path_nodes?.length || 0} nodes</span>
                </div>
              </div>

              {/* Turn by turn segments */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Corridor Segments:
                </span>
                {routeResult.segments?.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-[#090e1a] border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <CornerDownRight className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="text-slate-200 truncate">{seg.street_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400">{seg.length_m}m</span>
                      <span
                        className={`text-[10px] px-1 rounded ${
                          seg.water_depth_m >= 0.3
                            ? 'text-red-400 bg-red-950 font-bold'
                            : seg.water_depth_m >= 0.1
                            ? 'text-amber-400 bg-amber-950'
                            : 'text-emerald-400 bg-emerald-950'
                        }`}
                      >
                        {seg.water_depth_m.toFixed(2)}m
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-400 text-xs font-mono flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{routeResult.error || 'Unable to find safe route.'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
