import React, { useEffect, useState } from 'react';
import { Play, Pause, FastForward, Sliders, CloudLightning, Clock, BarChart3, AlertOctagon } from 'lucide-react';

export default function SimulationControls({
  intensity,
  onIntensityChange,
  pattern,
  onPatternChange,
  currentTimeMin,
  onTimeChange,
  timeSteps = [0, 15, 30, 45, 60, 75, 90, 120, 180],
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
  onRunSimulation,
  loading,
  hyetograph = {}
}) {
  const patterns = [
    { id: 'cloudburst', label: 'Flash Cloudburst', desc: 'Sharp peak at t=35m' },
    { id: 'monsoon_surge', label: 'Monsoon Surge', desc: 'Dual-wave sustained' },
    { id: 'extreme_100yr', label: '100-Yr Extreme', desc: 'Extreme IDF deluge' },
    { id: 'uniform', label: 'Steady Rain', desc: 'Uniform baseline' }
  ];

  return (
    <div className="bg-[#0b101c]/95 border-b border-cyber-border/70 p-4 shadow-xl">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left: Rainfall Intensity & Pattern Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Intensity Slider */}
          <div className="bg-[#0f172a] p-3 rounded-xl border border-slate-800 flex items-center gap-3 min-w-[260px]">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <CloudLightning className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-mono text-slate-300 font-semibold">Precipitation Rate</span>
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                  {intensity} mm/hr
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                step="5"
                value={intensity}
                onChange={(e) => onIntensityChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
          </div>

          {/* Pattern Buttons */}
          <div className="flex items-center gap-1.5 bg-[#0f172a] p-1.5 rounded-xl border border-slate-800">
            {patterns.map((p) => {
              const active = pattern === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onPatternChange(p.id)}
                  title={p.desc}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-cyan-500 text-black font-semibold shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={onRunSimulation}
            disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center gap-2 font-mono disabled:opacity-50"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{loading ? 'SIMULATING...' : 'RECOMPUTE GNN'}</span>
          </button>
        </div>

        {/* Right: Time-Series Scrubber & Playback Controls */}
        <div className="flex items-center gap-3 bg-[#0f172a] p-2.5 rounded-xl border border-slate-800 flex-1 max-w-2xl justify-between">
          {/* Play/Pause & Speed */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onTogglePlay}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold transition shadow-sm"
              title={isPlaying ? 'Pause Timeline' : 'Play Timeline Forecast'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => onSpeedChange(playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 4 : 1)}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold"
              title="Toggle Playback Speed (1x / 2x / 4x)"
            >
              {playbackSpeed}x
            </button>
          </div>

          {/* Time Scrubber */}
          <div className="flex-1 mx-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-cyan-400" /> Horizon Scrubber:
              </span>
              <span className="font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                T + {currentTimeMin} MINS
              </span>
            </div>

            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max={timeSteps.length - 1}
                step="1"
                value={timeSteps.indexOf(currentTimeMin) >= 0 ? timeSteps.indexOf(currentTimeMin) : 0}
                onChange={(e) => onTimeChange(timeSteps[Number(e.target.value)])}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 z-10"
              />
            </div>

            {/* Time markers */}
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
              {timeSteps.map((t) => (
                <span
                  key={t}
                  onClick={() => onTimeChange(t)}
                  className={`cursor-pointer hover:text-cyan-300 transition ${
                    currentTimeMin === t ? 'text-cyan-400 font-bold' : ''
                  }`}
                >
                  +{t}m
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
