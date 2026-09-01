import React from 'react';
import { Droplets, Waves, AlertTriangle, ShieldCheck, Gauge, TrendingUp } from 'lucide-react';

export default function SystemTelemetry({ summary, timeMin = 0, activePumps = [] }) {
  if (!summary) return null;

  const getPeakColor = (depth) => {
    if (depth >= 0.6) return 'text-red-400 border-red-500/40 bg-red-950/30';
    if (depth >= 0.3) return 'text-amber-400 border-amber-500/40 bg-amber-950/30';
    if (depth >= 0.1) return 'text-yellow-400 border-yellow-500/40 bg-yellow-950/30';
    return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30';
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-[#090d16]/80 border-b border-cyber-border/60">
      {/* 1. Peak Inundation Depth */}
      <div className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${getPeakColor(summary.peak_depth_m)}`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Droplets className="w-3.5 h-3.5" /> Peak Flood Depth
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 font-mono">
            t+{timeMin}m
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black font-mono tracking-tight">
            {summary.peak_depth_m.toFixed(2)}
          </span>
          <span className="text-xs font-semibold text-slate-400">meters</span>
        </div>
        <div className="mt-1 text-[11px] opacity-85 font-medium">
          {summary.peak_depth_m >= 0.6 ? 'Severe Inundation' : summary.peak_depth_m >= 0.3 ? 'Critical Caution' : 'Sub-Critical'}
        </div>
      </div>

      {/* 2. Total Flooded Volume */}
      <div className="p-3 rounded-xl border border-slate-800 bg-[#0c1322] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5 text-cyan-400" /> Surface Ponding
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black font-mono tracking-tight text-cyan-300">
            {summary.total_flooded_volume_m3.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-slate-400">m³</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Accumulated surface overflow
        </div>
      </div>

      {/* 3. Submerged Road Length */}
      <div className="p-3 rounded-xl border border-slate-800 bg-[#0c1322] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Flooded Roads
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black font-mono tracking-tight text-amber-300">
            {summary.flooded_road_length_km.toFixed(2)}
          </span>
          <span className="text-xs font-semibold text-slate-400">km</span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          {summary.choke_conduits} choked conduits (≥90%)
        </div>
      </div>

      {/* 4. Critical Hotspot Nodes */}
      <div className="p-3 rounded-xl border border-slate-800 bg-[#0c1322] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-red-400" /> Hazard Nodes
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black font-mono tracking-tight text-red-400">
              {summary.danger_nodes + summary.critical_nodes}
            </span>
            <span className="text-xs text-slate-400">nodes</span>
          </div>
          <div className="flex flex-col text-[10px] font-mono">
            <span className="text-red-400 font-bold">{summary.danger_nodes} Danger</span>
            <span className="text-amber-400">{summary.critical_nodes} Critical</span>
          </div>
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          {summary.warning_nodes} minor warning nodes
        </div>
      </div>

      {/* 5. Mobile Dewatering Mitigation */}
      <div className="p-3 rounded-xl border border-slate-800 bg-[#0c1322] flex flex-col justify-between col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Active Pumps
          </span>
          {activePumps.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono">
              ACTIVE
            </span>
          )}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-black font-mono tracking-tight text-emerald-300">
            {activePumps.length}
          </span>
          <span className="text-xs font-semibold text-slate-400">units</span>
        </div>
        <div className="mt-1 text-[11px] text-emerald-400/90 font-mono">
          {activePumps.reduce((sum, p) => sum + (p.capacity_m3s || 1.2), 0).toFixed(1)} m³/s total dewatering
        </div>
      </div>
    </div>
  );
}
