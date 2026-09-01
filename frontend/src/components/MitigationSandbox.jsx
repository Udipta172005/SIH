import React, { useState } from 'react';
import { ShieldCheck, Plus, Trash2, Zap, ArrowDown, Activity, CheckCircle2 } from 'lucide-react';

export default function MitigationSandbox({
  activePumps = [],
  onDeployPump,
  onRemovePump,
  mitigationResult,
  topologyNodes = [],
  loading
}) {
  const [selectedNodeId, setSelectedNodeId] = useState(topologyNodes[0]?.properties?.node_id || 'ND-UP01');
  const [pumpCapacity, setPumpCapacity] = useState(1.5);

  const handleManualDeploy = (e) => {
    e.preventDefault();
    if (!selectedNodeId) return;
    onDeployPump(selectedNodeId, Number(pumpCapacity));
  };

  return (
    <div className="flex flex-col h-full bg-[#0b101c] border-l border-cyber-border/70 p-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-cyber-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white font-mono">MITIGATION SANDBOX</h2>
            <p className="text-[11px] text-slate-400">Mobile Dewatering Pump Simulator</p>
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
          {activePumps.length} UNITS
        </span>
      </div>

      {/* Before-and-After Impact Stats if mitigation calculated */}
      {mitigationResult && mitigationResult.system_delta && (
        <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 to-[#0b1b24] border border-emerald-500/40 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> MITIGATION DELTA IMPACT
            </span>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/60 px-1.5 py-0.5 rounded">
              REAL-TIME GNN
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
            <div className="bg-[#09121a]/80 p-2.5 rounded-lg border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block">Flood Volume Saved</span>
              <span className="text-emerald-300 font-bold text-sm">
                -{mitigationResult.system_delta.flooded_volume_prevented_m3.toLocaleString()} m³
              </span>
            </div>

            <div className="bg-[#09121a]/80 p-2.5 rounded-lg border border-emerald-500/20">
              <span className="text-[10px] text-slate-400 block">Road Network Cleared</span>
              <span className="text-emerald-300 font-bold text-sm">
                +{mitigationResult.system_delta.flooded_road_km_cleared} km
              </span>
            </div>
          </div>

          {mitigationResult.target_node && (
            <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-300">
                Depth Drop at <span className="text-cyan-400">{mitigationResult.target_node.node_id}</span>:
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ArrowDown className="w-3 h-3" />
                {mitigationResult.target_node.depth_reduction_m}m (-{mitigationResult.target_node.depth_reduction_pct}%)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Manual Pump Deployment Form */}
      <form onSubmit={handleManualDeploy} className="bg-[#0f172a] p-3.5 rounded-xl border border-slate-800 mb-4">
        <h3 className="text-xs font-bold text-slate-200 font-mono mb-2.5 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5 text-cyan-400" /> Deploy Dewatering Unit
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Target Choke-Point Node</label>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="w-full bg-[#090d16] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 font-mono focus:border-cyan-400 focus:outline-none"
            >
              {topologyNodes.map((n) => (
                <option key={n.properties.node_id} value={n.properties.node_id}>
                  {n.properties.node_id}: {n.properties.name} ({n.properties.node_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>Pump Extraction Rate</span>
              <span className="text-cyan-400 font-bold">{pumpCapacity} m³/s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.5"
              value={pumpCapacity}
              onChange={(e) => setPumpCapacity(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold text-xs rounded-lg transition font-mono flex items-center justify-center gap-1.5 shadow-md"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{loading ? 'CALCULATING DELTA...' : 'DISPATCH PUMP UNIT'}</span>
          </button>
        </div>
      </form>

      {/* Active Fleet List */}
      <div className="flex-1">
        <h3 className="text-xs font-bold text-slate-300 font-mono mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Active Mobile Fleet ({activePumps.length})
        </h3>

        {activePumps.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-xs font-mono bg-[#0e1526] rounded-xl border border-slate-800">
            No active pumps deployed. Deploy units to high-risk sumps or underpasses.
          </div>
        ) : (
          <div className="space-y-2">
            {activePumps.map((pump, idx) => (
              <div
                key={`${pump.node_id}-${idx}`}
                className="p-3 rounded-lg bg-[#0e1526] border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-xs font-mono text-cyan-300">{pump.node_id}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    Discharge: {pump.capacity_m3s || 1.2} m³/s
                  </span>
                </div>

                <button
                  onClick={() => onRemovePump(pump.node_id)}
                  className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/30 transition"
                  title="Demobilize Pump Unit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
