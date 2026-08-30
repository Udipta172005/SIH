import React from 'react';
import { AlertTriangle, AlertCircle, ShieldAlert, Zap, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';

export default function HotspotAlertFeed({
  hotspots = [],
  selectedNode,
  onSelectNodeById,
  onDeployPump,
  activePumps = []
}) {
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'danger':
        return {
          bg: 'bg-red-950/80 text-red-400 border-red-500/40',
          dot: 'bg-red-500 animate-ping',
          label: 'DANGER >0.6m'
        };
      case 'critical':
        return {
          bg: 'bg-amber-950/80 text-amber-400 border-amber-500/40',
          dot: 'bg-amber-500',
          label: 'CRITICAL >0.3m'
        };
      default:
        return {
          bg: 'bg-yellow-950/80 text-yellow-400 border-yellow-500/40',
          dot: 'bg-yellow-500',
          label: 'WARNING >0.15m'
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b101c] border-l border-cyber-border/70">
      {/* Feed Header */}
      <div className="p-4 border-b border-cyber-border/60 bg-[#090d16] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <h2 className="font-bold text-sm text-white tracking-wide font-mono">
            CHOKE-POINT ALERTS
          </h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-red-950/80 text-red-400 border border-red-500/30">
          {hotspots.length} ACTIVE
        </span>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {hotspots.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            <ShieldCheck className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
            No active critical choke points under current rainfall parameters.
          </div>
        ) : (
          hotspots.map((alert) => {
            const badge = getSeverityBadge(alert.severity);
            const isSelected = selectedNode?.properties?.node_id === alert.node_id;
            const hasPump = activePumps.some((p) => p.node_id === alert.node_id);

            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-cyan-400 bg-[#131c31] shadow-lg shadow-cyan-950/30'
                    : 'border-slate-800 bg-[#0e1526] hover:border-slate-700'
                }`}
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-100">{alert.location_name}</span>
                      <span className="text-[10px] font-mono text-cyan-400">{alert.node_id}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{alert.critical_tag}</div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 ${badge.bg}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                </div>

                {/* Telemetry metrics */}
                <div className="grid grid-cols-3 gap-2 py-2 my-2 border-y border-slate-800/80 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Peak Depth</span>
                    <span className={`font-bold ${alert.peak_depth_m >= 0.6 ? 'text-red-400' : 'text-amber-400'}`}>
                      {alert.peak_depth_m.toFixed(2)}m
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Risk Score</span>
                    <span className="text-slate-200 font-bold">{alert.risk_score} / 100</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Volume</span>
                    <span className="text-cyan-300 font-bold">{alert.volume_m3.toLocaleString()} m³</span>
                  </div>
                </div>

                {/* Recommended Action */}
                <div className="text-[11px] text-slate-300 mb-3 bg-[#0a0f1c] p-2 rounded-lg border border-slate-800/60">
                  <span className="text-amber-400 font-mono font-semibold">Response: </span>
                  {alert.action_required}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectNodeById(alert.node_id)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition flex items-center justify-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span>Focus Map</span>
                  </button>

                  <button
                    onClick={() => onDeployPump(alert.node_id, alert.recommended_pump_m3s)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1 ${
                      hasPump
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                        : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black shadow-sm'
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>{hasPump ? 'Pump Deployed' : `Deploy ${alert.recommended_pump_m3s}m³/s`}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
