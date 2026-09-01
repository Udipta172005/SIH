import React from 'react';
import { CloudRain, Activity, ShieldAlert, Cpu, Layers, RefreshCw, Zap } from 'lucide-react';

export default function TopNav({
  presets = [],
  selectedPreset,
  onSelectPreset,
  onResetSimulation,
  loading
}) {
  return (
    <header className="h-16 bg-[#090d16]/90 backdrop-blur-md border-b border-cyber-border/70 px-5 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Title */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 text-cyan-400 glow-cyan">
          <CloudRain className="w-5 h-5 animate-pulse" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-wider text-white flex items-center gap-1.5 font-mono">
              <span className="text-cyan-400">AQUA</span>GNN
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 rounded-full font-mono">
              SURROGATE V1.0
            </span>
          </div>
          <p className="text-xs text-slate-400 tracking-tight">
            AI-Driven Urban Flood Nowcasting & Stormwater Inundation Engine • District 7 Watershed
          </p>
        </div>
      </div>

      {/* Preset Scenario Quick Selectors */}
      <div className="hidden lg:flex items-center gap-2 bg-[#0b1220] p-1 rounded-xl border border-slate-800">
        <span className="text-xs text-slate-400 px-2 font-mono flex items-center gap-1">
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Presets:
        </span>
        {presets.map((preset) => {
          const isActive = selectedPreset === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <span>{preset.name.split(' (')[0]}</span>
              <span className="text-[10px] font-mono opacity-70">
                {preset.intensity_mm_hr}mm/h
              </span>
            </button>
          );
        })}
      </div>

      {/* Status Badges & Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>GNN Engine Ready</span>
        </div>

        <button
          onClick={onResetSimulation}
          disabled={loading}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5 text-xs"
          title="Reset Simulation to Initial State"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span className="hidden sm:inline font-mono">Reset</span>
        </button>
      </div>
    </header>
  );
}
