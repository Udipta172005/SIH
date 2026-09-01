import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity, Droplet } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function HydrographChart({
  simulationData,
  selectedNode,
  selectedEdge,
  currentTimeMin
}) {
  if (!simulationData || !simulationData.frames) return null;

  const timeLabels = simulationData.time_steps_min.map((t) => `t+${t}m`);

  // Rainfall hyetograph data
  const rainData = simulationData.time_steps_min.map(
    (t) => simulationData.hyetograph[t] || 0
  );

  // Selected Node Flood Depth
  const nodeId = selectedNode?.properties?.node_id;
  const nodeName = selectedNode?.properties?.name || 'Selected Node';
  const nodeDepths = nodeId
    ? simulationData.frames.map((f) => f.nodes[nodeId]?.depth_m || 0)
    : simulationData.frames.map((f) => f.summary.peak_depth_m);

  // Peak edge flow or selected edge flow
  const edgeId = selectedEdge?.properties?.edge_id;
  const edgeName = selectedEdge?.properties?.street_name || 'Network Flow';
  const edgeFlows = edgeId
    ? simulationData.frames.map((f) => f.edges[edgeId]?.flow_m3s || 0)
    : simulationData.frames.map((f) => f.summary.total_flooded_volume_m3 / 1000.0);

  const chartData = {
    labels: timeLabels,
    datasets: [
      {
        type: 'line',
        label: nodeId ? `${nodeId} Flood Depth (m)` : 'District Peak Depth (m)',
        data: nodeDepths,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        fill: true,
        tension: 0.35,
        yAxisID: 'yDepth',
        pointRadius: 4,
        pointBackgroundColor: '#ef4444'
      },
      {
        type: 'line',
        label: 'Rainfall Intensity (mm/hr)',
        data: rainData,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        borderDash: [5, 5],
        tension: 0.35,
        yAxisID: 'yRain',
        pointRadius: 3,
        pointBackgroundColor: '#06b6d4'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { family: 'JetBrains Mono', size: 10 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#38bdf8',
        bodyColor: '#f1f5f9',
        borderColor: '#334155',
        borderWidth: 1,
        titleFont: { family: 'JetBrains Mono', size: 11 },
        bodyFont: { family: 'JetBrains Mono', size: 10 }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(51, 65, 85, 0.25)' },
        ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } }
      },
      yDepth: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Flood Depth (m)',
          color: '#ef4444',
          font: { family: 'JetBrains Mono', size: 10 }
        },
        grid: { color: 'rgba(51, 65, 85, 0.3)' },
        ticks: { color: '#ef4444', font: { family: 'JetBrains Mono', size: 10 } }
      },
      yRain: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Rain (mm/hr)',
          color: '#06b6d4',
          font: { family: 'JetBrains Mono', size: 10 }
        },
        grid: { drawOnChartArea: false },
        ticks: { color: '#06b6d4', font: { family: 'JetBrains Mono', size: 10 } }
      }
    }
  };

  return (
    <div className="bg-[#0b101c] p-4 rounded-xl border border-cyber-border/70 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-xs text-white font-mono uppercase tracking-wider">
            HYDRODYNAMIC HYETOGRAPH & FLOOD INUNDATION PROFILE
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          Horizon: 0 to 180 min
        </span>
      </div>

      <div className="h-44 w-full">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
