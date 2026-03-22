import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { NavigationControl } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { IconLayer } from '@deck.gl/layers';
import { PathLayer } from '@deck.gl/layers';
import { PolygonLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { TextLayer } from '@deck.gl/layers';
import { useFleetStore } from '../../store/fleetStore';
import type { Vehicle, Geofence } from '../../types';
import { statusColor } from '../../utils/colors';
import api from '../../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// Vehicle icon SVG as data URL (arrow shape pointing up, rotated by heading)
const VEHICLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <polygon points="16,2 26,28 16,22 6,28" fill="white" stroke="none"/>
</svg>`;
const VEHICLE_ICON_URL = `data:image/svg+xml;base64,${btoa(VEHICLE_ICON_SVG)}`;

interface TrailData { vehicleId: string; path: [number, number][]; color: [number,number,number,number]; }

export default function FleetMap() {
  const {
    vehicles, selectedVehicleId, geofences,
    mapViewState, setMapViewState,
    showGeofences, showHeatmap, showTrails,
    selectVehicle,
  } = useFleetStore();

  const [trails, setTrails] = useState<TrailData[]>([]);
  const [heatmapData, setHeatmapData] = useState<{ lng: number; lat: number; weight: number }[]>([]);

  // Load trail for selected vehicle
  useEffect(() => {
    if (!selectedVehicleId || !showTrails) { setTrails([]); return; }
    api.get(`/vehicles/${selectedVehicleId}/telemetry?limit=200`).then(({ data }) => {
      const path = data.telemetry.map((t: any) => [t.lng, t.lat] as [number,number]);
      if (path.length < 2) return;
      setTrails([{ vehicleId: selectedVehicleId, path, color: [0, 212, 232, 180] }]);
    }).catch(() => {});
  }, [selectedVehicleId, showTrails]);

  // Load heatmap data
  useEffect(() => {
    if (!showHeatmap) { setHeatmapData([]); return; }
    api.get('/analytics/alert-heatmap').then(({ data }) => {
      setHeatmapData(data.points.map((p: any) => ({ lng: p.lng, lat: p.lat, weight: p.count })));
    }).catch(() => {});
  }, [showHeatmap]);

  // ── DeckGL Layers ────────────────────────────────────────────────────────

  const layers = useMemo(() => {
    const layerList: any[] = [];

    // 1. Geofence polygons
    if (showGeofences && geofences.length > 0) {
      const geoData = geofences.filter(g => g.is_active && g.boundary?.coordinates);
      layerList.push(
        new PolygonLayer({
          id: 'geofences-fill',
          data: geoData,
          getPolygon: (g: Geofence) => g.boundary.coordinates[0] as [number,number][],
          getFillColor: (g: Geofence) => {
            const hex = g.color || '#00d4e8';
            const r = parseInt(hex.slice(1,3),16);
            const gg = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return [r, gg, b, 25] as [number,number,number,number];
          },
          getLineColor: (g: Geofence) => {
            const hex = g.color || '#00d4e8';
            const r = parseInt(hex.slice(1,3),16);
            const gg = parseInt(hex.slice(3,5),16);
            const b = parseInt(hex.slice(5,7),16);
            return [r, gg, b, 200] as [number,number,number,number];
          },
          lineWidthMinPixels: 2,
          filled: true,
          stroked: true,
          pickable: true,
        })
      );
    }

    // 2. Vehicle trails (path layer)
    if (showTrails && trails.length > 0) {
      layerList.push(
        new PathLayer({
          id: 'vehicle-trails',
          data: trails,
          getPath: (d: TrailData) => d.path,
          getColor: (d: TrailData) => d.color,
          getWidth: 3,
          widthMinPixels: 2,
          widthMaxPixels: 6,
          capRounded: true,
          jointRounded: true,
        })
      );
    }

    // 3. Alert heatmap
    if (showHeatmap && heatmapData.length > 0) {
      layerList.push(
        new HeatmapLayer({
          id: 'alert-heatmap',
          data: heatmapData,
          getPosition: (d: any) => [d.lng, d.lat],
          getWeight: (d: any) => d.weight,
          radiusPixels: 40,
          intensity: 1,
          threshold: 0.05,
          colorRange: [
            [0,212,232,0], [0,212,232,128], [163,230,53,200],
            [245,158,11,220], [239,68,68,240], [185,28,28,255]
          ],
        })
      );
    }

    // 4. Pulse rings for active/alert vehicles
    const pulseVehicles = vehicles.filter(v => v.status === 'active' || v.status === 'alert');
    layerList.push(
      new ScatterplotLayer({
        id: 'vehicle-pulse',
        data: pulseVehicles,
        getPosition: (v: Vehicle) => [v.lng, v.lat],
        getRadius: 18,
        radiusMinPixels: 14,
        radiusMaxPixels: 28,
        getFillColor: (v: Vehicle) => {
          const c = statusColor(v.status);
          return [c[0], c[1], c[2], 40] as [number,number,number,number];
        },
        stroked: false,
        pickable: false,
      })
    );

    // 5. Vehicle dots (outer ring)
    layerList.push(
      new ScatterplotLayer({
        id: 'vehicle-outer',
        data: vehicles,
        getPosition: (v: Vehicle) => [v.lng, v.lat],
        getRadius: 12,
        radiusMinPixels: 10,
        radiusMaxPixels: 20,
        getFillColor: (v: Vehicle) => {
          const c = statusColor(v.status);
          return [c[0], c[1], c[2], 60] as [number,number,number,number];
        },
        getLineColor: (v: Vehicle) => statusColor(v.status),
        lineWidthMinPixels: 2,
        stroked: true,
        filled: true,
        pickable: false,
      })
    );

    // 6. Vehicle direction arrows (IconLayer)
    const movingVehicles = vehicles.filter(v => v.current_speed > 2);
    layerList.push(
      new IconLayer({
        id: 'vehicle-arrows',
        data: movingVehicles,
        getPosition: (v: Vehicle) => [v.lng, v.lat],
        getIcon: () => ({
          url: VEHICLE_ICON_URL,
          width: 32,
          height: 32,
          anchorY: 16,
        }),
        getSize: 28,
        sizeMinPixels: 18,
        sizeMaxPixels: 36,
        getAngle: (v: Vehicle) => -v.current_heading,
        getColor: (v: Vehicle) => statusColor(v.status),
        pickable: false,
      })
    );

    // 7. Vehicle core dots (main clickable layer)
    layerList.push(
      new ScatterplotLayer({
        id: 'vehicle-core',
        data: vehicles,
        getPosition: (v: Vehicle) => [v.lng, v.lat],
        getRadius: 7,
        radiusMinPixels: 6,
        radiusMaxPixels: 14,
        getFillColor: (v: Vehicle) => statusColor(v.status),
        stroked: true,
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1.5,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        onClick: ({ object }: { object: Vehicle }) => {
          if (object) selectVehicle(object.id);
        },
      })
    );

    // 8. Selected vehicle highlight ring
    if (selectedVehicleId) {
      const sel = vehicles.find(v => v.id === selectedVehicleId);
      if (sel) {
        layerList.push(
          new ScatterplotLayer({
            id: 'vehicle-selected',
            data: [sel],
            getPosition: (v: Vehicle) => [v.lng, v.lat],
            getRadius: 20,
            radiusMinPixels: 18,
            radiusMaxPixels: 36,
            getFillColor: [0, 212, 232, 0],
            getLineColor: [0, 212, 232, 255],
            lineWidthMinPixels: 3,
            stroked: true,
            filled: true,
            pickable: false,
          })
        );
      }
    }

    // 9. Speed labels on active vehicles (at higher zoom)
    if (mapViewState.zoom > 13) {
      const activeVehicles = vehicles.filter(v => v.current_speed > 5);
      layerList.push(
        new TextLayer({
          id: 'vehicle-labels',
          data: activeVehicles,
          getPosition: (v: Vehicle) => [v.lng, v.lat],
          getText: (v: Vehicle) => `${Math.round(v.current_speed)}`,
          getSize: 11,
          getColor: [255, 255, 255, 220],
          getPixelOffset: [0, -22],
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          background: true,
          getBackgroundColor: [0, 0, 0, 160],
          backgroundPadding: [3, 2, 3, 2],
          pickable: false,
        })
      );
    }

    return layerList;
  }, [vehicles, geofences, trails, heatmapData, selectedVehicleId, showGeofences, showTrails, showHeatmap, mapViewState.zoom, selectVehicle]);

  const onViewStateChange = useCallback(({ viewState }: any) => {
    setMapViewState(viewState);
  }, [setMapViewState]);

  const getTooltip = useCallback(({ object }: any) => {
    if (!object) return null;
    // Geofence tooltip
    if (object.name && object.boundary) {
      return { html: `<div style="background:#0f2240;border:1px solid #00d4e8;padding:8px 12px;border-radius:6px;font-size:12px;color:#e8eaf0"><strong>${object.name}</strong></div>`, style: { fontFamily: 'DM Sans, sans-serif' } };
    }
    // Vehicle tooltip
    if (object.registration) {
      const v = object as Vehicle;
      return {
        html: `
          <div style="background:#0a1828;border:1px solid rgba(0,212,232,.3);padding:10px 14px;border-radius:8px;font-size:12px;color:#e8eaf0;min-width:180px;font-family:'DM Sans',sans-serif">
            <div style="font-weight:700;font-size:13px;color:#00d4e8;margin-bottom:6px">${v.registration}</div>
            <div style="color:#8da4c2">${v.make} ${v.model}</div>
            ${v.driver_name ? `<div style="margin-top:4px">👤 ${v.driver_name}</div>` : ''}
            <div style="margin-top:6px;display:flex;gap:12px">
              <span>🏎 ${Math.round(v.current_speed)} km/h</span>
              <span>⛽ ${Math.round(v.current_fuel)}%</span>
            </div>
          </div>
        `,
        style: {},
      };
    }
    return null;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DeckGL
        viewState={mapViewState}
        onViewStateChange={onViewStateChange}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        getTooltip={getTooltip}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Map
          reuseMaps
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" showCompass={true} />
        </Map>
      </DeckGL>
    </div>
  );
}
