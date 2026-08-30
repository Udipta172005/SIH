import React from 'react';
import { X, MapPin, Gauge, Droplets, Zap, ShieldAlert, ArrowUpRight, Compass, Navigation } from 'lucide-react';

export default function NodeInspectorModal({
  selectedNode,
  selectedEdge,
  onClose,
  onDeployPump,
  onSetRoutingOrigin,
  onSetRoutingDestination,
  activePumps = []
}) {
  if (!selectedNode && !selectedEdge) return null;

  if (selectedNode) {
    const props = selectedNode.properties;
    const state = selectedNode.dynamicState || {};
    const depth = state.depth_m || 0;
    const vol = state.volume_m3 || 0;
    const hasPump = activePumps.some((p) => p.node_id === props.node_id);

    return (
      <div className="absolute bottom-6 left-6 z-30 w-96 bg-[#0c1220]/95 backdrop-blur-md rounded-2xl border border-cyber-border/90 shadow-2xl p-4 text-xs font-mono">
        {/* Header */}
        <div className="flex items-start justify-between pb-2 mb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="font-bold text-sm text-white">{props.name}</span>
            </div>
            <div className="text-[11px] text-cyan-400 mt-0.5">
              Node ID: {props.node_id} • {props.node_type?.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic State Banner */}
        <div
          className={`p-3 rounded-xl mb-3 flex items-center justify-between border ${
            depth >= 0.6
              ? 'bg-red-950/60 border-red-500/40 text-red-300'
              : depth >= 0.3
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              : depth >= 0.1
              ? 'bg-yellow-950/60 border-yellow-500/40 text-yellow-300'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div>
            <span className="text-[10px] uppercase text-slate-400 block">Current Flood Depth</span>
            <span className="text-xl font-black font-mono">{depth.toFixed(2)} m</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase text-slate-400 block">Ponding Volume</span>
            <span className="text-sm font-bold font-mono text-cyan-300">{vol.toLocaleString()} m³</span>
          </div>
        </div>

        {/* Static Hydrological Properties Grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px] mb-3 bg-[#080d17] p-2.5 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-slate-500 block text-[10px]">DEM Elevation</span>
            <span className="text-slate-200 font-bold">{props.elevation_m} m</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Runoff Coeff (C)</span>
            <span className="text-slate-200 font-bold">{props.runoff_coeff}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Catchment Area</span>
            <span className="text-slate-200 font-bold">{props.catchment_area_m2?.toLocaleString()} m²</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Subsurface Storage</span>
            <span className="text-slate-200 font-bold">{props.max_capacity_m3} m³</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-1.5 pt-1">
          <button
            onClick={() => onDeployPump(props.node_id, 1.5)}
            className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
              hasPump
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black shadow-md'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{hasPump ? 'Pump Unit Active (1.5 m³/s)' : 'Deploy Mobile Dewatering Unit'}</span>
          </button>
        </div>
      </div>
    );
  }

  if (selectedEdge) {
    const props = selectedEdge.properties;
    const state = selectedEdge.dynamicState || {};
    const flow = state.flow_m3s || 0;
    const util = state.utilization_pct || 0;
    const avgDepth = state.avg_depth_m || 0;

    return (
      <div className="absolute bottom-6 left-6 z-30 w-96 bg-[#0c1220]/95 backdrop-blur-md rounded-2xl border border-cyber-border/90 shadow-2xl p-4 text-xs font-mono">
        {/* Header */}
        <div className="flex items-start justify-between pb-2 mb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="font-bold text-sm text-white">{props.street_name}</span>
            </div>
            <div className="text-[11px] text-cyan-400 mt-0.5">
              Conduit: {props.edge_id} • {props.conduit_type}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Hydraulic State */}
        <div
          className={`p-3 rounded-xl mb-3 flex items-center justify-between border ${
            util >= 90
              ? 'bg-red-950/60 border-red-500/40 text-red-300'
              : util >= 70
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
          }`}
        >
          <div>
            <span className="text-[10px] uppercase text-slate-400 block">Hydraulic Utilization</span>
            <span className="text-xl font-black font-mono">{util.toFixed(1)} %</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase text-slate-400 block">Current Flow Rate</span>
            <span className="text-sm font-bold font-mono">{flow.toFixed(2)} m³/s</span>
          </div>
        </div>

        {/* Hydraulic Parameters */}
        <div className="grid grid-cols-2 gap-2 text-[11px] mb-2 bg-[#080d17] p-2.5 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-slate-500 block text-[10px]">Conduit Length</span>
            <span className="text-slate-200 font-bold">{props.length_m} m</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Hydraulic Slope (S)</span>
            <span className="text-slate-200 font-bold">{props.slope}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Diameter / Width</span>
            <span className="text-slate-200 font-bold">{props.diameter_or_width_m} m</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Manning's n</span>
            <span className="text-slate-200 font-bold">{props.roughness_coeff}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Max Conveyance Q_max</span>
            <span className="text-cyan-400 font-bold">{props.max_flow_rate_m3s} m³/s</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Street Water Depth</span>
            <span className="text-amber-400 font-bold">{avgDepth.toFixed(2)} m</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
