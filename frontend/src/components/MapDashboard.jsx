import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Compass, Eye, Shield, AlertTriangle, Navigation, MapPin } from 'lucide-react';

export default function MapDashboard({
  topology,
  currentFrame,
  selectedNode,
  onSelectNode,
  selectedEdge,
  onSelectEdge,
  evacuationRoute,
  activePumps = [],
  onDeployPumpAtNode
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geojsonLayersRef = useRef({
    conduits: null,
    nodes: null,
    evacRoute: null
  });

  const [layersVisible, setLayersVisible] = useState({
    conduits: true,
    nodes: true,
    evacRoute: true,
    beacons: true
  });

  // Helper color functions
  const getNodeColor = (depth) => {
    if (depth >= 0.6) return '#ef4444'; // Red Danger
    if (depth >= 0.3) return '#f59e0b'; // Amber Critical
    if (depth >= 0.1) return '#eab308'; // Yellow Warning
    return '#10b981'; // Green Normal
  };

  const getEdgeColor = (avgDepth, util) => {
    if (avgDepth >= 0.6) return '#b91c1c';
    if (avgDepth >= 0.3) return '#ef4444';
    if (avgDepth >= 0.1) return '#f59e0b';
    if (util >= 85) return '#06b6d4'; // Cyan High Flow
    return '#059669'; // Emerald normal
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [37.768, -122.418],
      zoom: 13.5,
      zoomControl: false,
      attributionControl: false
    });

    // Dark CartoDB Matter tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    // Zoom control on top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Vector Layers on Frame or Selection Change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !topology || !topology.features) return;

    const nodesData = currentFrame?.nodes || {};
    const edgesData = currentFrame?.edges || {};

    // 1. Remove existing layers
    if (geojsonLayersRef.current.conduits) {
      map.removeLayer(geojsonLayersRef.current.conduits);
    }
    if (geojsonLayersRef.current.nodes) {
      map.removeLayer(geojsonLayersRef.current.nodes);
    }
    if (geojsonLayersRef.current.evacRoute) {
      map.removeLayer(geojsonLayersRef.current.evacRoute);
    }

    // 2. Render Conduits / Streets
    if (layersVisible.conduits) {
      const conduitFeatures = topology.features.filter((f) => f.properties.feature_type === 'conduit');

      const conduitLayer = L.geoJSON(
        { type: 'FeatureCollection', features: conduitFeatures },
        {
          style: (feature) => {
            const eId = feature.properties.edge_id;
            const edgeState = edgesData[eId] || {};
            const avgDepth = edgeState.avg_depth_m || 0;
            const util = edgeState.utilization_pct || 0;
            const isSelected = selectedEdge && selectedEdge.properties.edge_id === eId;

            const color = getEdgeColor(avgDepth, util);
            const width = isSelected ? 8 : Math.max(3.5, (feature.properties.diameter_or_width_m || 1.2) * 2.8);

            return {
              color,
              weight: width,
              opacity: isSelected ? 1.0 : (avgDepth >= 0.3 ? 0.95 : 0.8),
              dashArray: util >= 90 ? '8, 8' : undefined,
              className: util >= 90 ? 'pulsing-flow' : ''
            };
          },
          onEachFeature: (feature, layer) => {
            const eId = feature.properties.edge_id;
            const edgeState = edgesData[eId] || {};

            layer.on('click', () => {
              onSelectEdge({ ...feature, dynamicState: edgeState });
            });

            // Hover tooltip
            layer.bindTooltip(
              `
              <div class="font-mono text-xs p-1">
                <div class="font-bold text-cyan-400">${feature.properties.street_name}</div>
                <div class="text-slate-300">Conduit: ${eId} (${feature.properties.conduit_type})</div>
                <div class="text-slate-300">Water Depth: <span class="font-bold text-amber-400">${(edgeState.avg_depth_m || 0).toFixed(2)}m</span></div>
                <div class="text-slate-300">Capacity: <span class="font-bold text-cyan-400">${(edgeState.utilization_pct || 0).toFixed(1)}%</span></div>
              </div>
              `,
              { sticky: true, opacity: 0.95 }
            );
          }
        }
      ).addTo(map);

      geojsonLayersRef.current.conduits = conduitLayer;
    }

    // 3. Render Nodes (Beacons / Circles)
    if (layersVisible.nodes) {
      const nodeFeatures = topology.features.filter((f) => f.properties.feature_type === 'node');

      const nodeLayer = L.geoJSON(
        { type: 'FeatureCollection', features: nodeFeatures },
        {
          pointToLayer: (feature, latlng) => {
            const nId = feature.properties.node_id;
            const nodeState = nodesData[nId] || {};
            const depth = nodeState.depth_m || 0;
            const isSelected = selectedNode && selectedNode.properties.node_id === nId;
            const hasPump = activePumps.some((p) => p.node_id === nId);
            const isOutfall = feature.properties.is_outfall;

            const color = getNodeColor(depth);
            const radius = isSelected ? 12 : Math.max(6, 6 + depth * 8);

            // Custom HTML Icon for beacons
            if (layersVisible.beacons && depth >= 0.3) {
              const pulseClass = depth >= 0.6 ? 'bg-red-500' : 'bg-amber-500';
              const html = `
                <div class="relative flex items-center justify-center w-8 h-8">
                  <div class="absolute w-8 h-8 rounded-full ${pulseClass} opacity-75 radar-beacon"></div>
                  <div class="w-4 h-4 rounded-full border-2 border-white ${pulseClass} shadow-lg flex items-center justify-center text-[8px] font-bold text-black font-mono">
                    ${depth.toFixed(1)}
                  </div>
                </div>
              `;
              return L.marker(latlng, {
                icon: L.divIcon({
                  html,
                  className: 'custom-beacon-marker',
                  iconSize: [32, 32],
                  iconAnchor: [16, 16]
                })
              });
            }

            if (hasPump) {
              const html = `
                <div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-[10px] text-black font-bold">
                  ⚡
                </div>
              `;
              return L.marker(latlng, {
                icon: L.divIcon({
                  html,
                  className: 'custom-pump-marker',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                })
              });
            }

            return L.circleMarker(latlng, {
              radius,
              fillColor: isOutfall ? '#06b6d4' : color,
              color: isSelected ? '#ffffff' : '#0f172a',
              weight: isSelected ? 3 : 1.5,
              opacity: 1,
              fillOpacity: isOutfall ? 0.95 : 0.85
            });
          },
          onEachFeature: (feature, layer) => {
            const nId = feature.properties.node_id;
            const nodeState = nodesData[nId] || {};

            layer.on('click', () => {
              onSelectNode({ ...feature, dynamicState: nodeState });
            });

            layer.bindTooltip(
              `
              <div class="font-mono text-xs p-1">
                <div class="font-bold text-white">${feature.properties.name}</div>
                <div class="text-slate-400">Node: <span class="text-cyan-400">${nId}</span> (${feature.properties.node_type})</div>
                <div class="text-slate-400">Surface Elevation: <span class="text-slate-200">${feature.properties.elevation_m}m</span></div>
                <div class="text-slate-400">Current Flood Depth: <span class="font-bold ${
                  (nodeState.depth_m || 0) >= 0.3 ? 'text-red-400' : 'text-emerald-400'
                }">${(nodeState.depth_m || 0).toFixed(2)}m</span></div>
                <div class="text-slate-400">Ponding Volume: <span class="text-cyan-300">${(nodeState.volume_m3 || 0).toLocaleString()} m³</span></div>
              </div>
              `,
              { sticky: true, opacity: 0.95 }
            );
          }
        }
      ).addTo(map);

      geojsonLayersRef.current.nodes = nodeLayer;
    }

    // 4. Render Evacuation Route Polyline
    if (layersVisible.evacRoute && evacuationRoute && evacuationRoute.path_coordinates) {
      const latlngs = evacuationRoute.path_coordinates.map(([lon, lat]) => [lat, lon]);
      const routeColor = evacuationRoute.is_route_safe ? '#00f0ff' : '#f59e0b';

      const routePolyline = L.polyline(latlngs, {
        color: routeColor,
        weight: 6,
        opacity: 0.9,
        dashArray: '10, 10',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Start & End markers
      const startMarker = L.circleMarker(latlngs[0], {
        radius: 8,
        fillColor: '#10b981',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).bindPopup('<b>Evacuation Origin</b>');

      const endMarker = L.circleMarker(latlngs[latlngs.length - 1], {
        radius: 8,
        fillColor: '#06b6d4',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).bindPopup('<b>Emergency Destination / Safe Outfall</b>');

      const routeGroup = L.featureGroup([routePolyline, startMarker, endMarker]).addTo(map);
      geojsonLayersRef.current.evacRoute = routeGroup;
    }
  }, [topology, currentFrame, selectedNode, selectedEdge, evacuationRoute, activePumps, layersVisible]);

  return (
    <div className="relative w-full h-full flex-1 bg-[#06090e] overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Top Left Floating Legend */}
      <div className="absolute top-4 left-4 z-20 bg-[#090d16]/90 backdrop-blur-md p-3.5 rounded-xl border border-cyber-border/70 shadow-2xl text-xs font-mono text-slate-300 max-w-[240px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <span className="font-bold text-white flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> HYDRO HAZARD SCALE
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span>Normal Flow</span>
            </div>
            <span className="text-[10px] text-slate-400">&lt; 0.10m</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
              <span>Waterlogged Warning</span>
            </div>
            <span className="text-[10px] text-slate-400">0.10 - 0.30m</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span>Critical Surcharge</span>
            </div>
            <span className="text-[10px] text-slate-400">0.30 - 0.60m</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block animate-pulse" />
              <span className="text-red-400 font-semibold">Danger / Submerged</span>
            </div>
            <span className="text-[10px] text-red-400 font-bold">&gt; 0.60m</span>
          </div>
        </div>

        {/* Conduit indicator */}
        <div className="mt-3 pt-2 border-t border-slate-800 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-1 bg-cyan-400 inline-block" />
            <span className="text-[11px] text-slate-400">High Conduit Flow (≥85%)</span>
          </div>
          {evacuationRoute && (
            <div className="flex items-center gap-2">
              <span className="w-4 h-1 border-b-2 border-dashed border-cyan-300 inline-block" />
              <span className="text-[11px] text-cyan-300 font-semibold">Safe Evac Corridor</span>
            </div>
          )}
        </div>
      </div>

      {/* Top Right Map Layer Toggles */}
      <div className="absolute top-4 right-16 z-20 flex items-center gap-2 bg-[#090d16]/90 backdrop-blur-md p-1.5 rounded-xl border border-cyber-border/70 shadow-xl text-xs">
        <button
          onClick={() => setLayersVisible((prev) => ({ ...prev, conduits: !prev.conduits }))}
          className={`px-2.5 py-1 rounded-lg transition font-mono ${
            layersVisible.conduits ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Conduits
        </button>
        <button
          onClick={() => setLayersVisible((prev) => ({ ...prev, nodes: !prev.nodes }))}
          className={`px-2.5 py-1 rounded-lg transition font-mono ${
            layersVisible.nodes ? 'bg-slate-800 text-cyan-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Nodes
        </button>
        <button
          onClick={() => setLayersVisible((prev) => ({ ...prev, beacons: !prev.beacons }))}
          className={`px-2.5 py-1 rounded-lg transition font-mono ${
            layersVisible.beacons ? 'bg-slate-800 text-red-400 border border-slate-700' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Beacons
        </button>
      </div>
    </div>
  );
}
