import { useCallback, useEffect, useMemo, useState } from 'react';
import Map, { NavigationControl } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, IconLayer, PathLayer, TextLayer } from '@deck.gl/layers';
import { PolygonLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { useFleetStore } from '../../store/fleetStore';
import { useFMStore } from '../../store/fmStore';
import { useThemeStore } from '../../store/themeStore';
import type { Vehicle, Geofence } from '../../types';
import { statusColor } from '../../utils/colors';
import api from '../../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslation } from 'react-i18next';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const VEHICLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 26,28 16,22 6,28" fill="white"/></svg>`;
const VEHICLE_ICON_URL = `data:image/svg+xml;base64,${btoa(VEHICLE_ICON_SVG)}`;

interface TrailData { vehicleId: string; path: [number, number][]; color: [number,number,number,number]; }

interface GeofencePopup {
  geofence: Geofence;
  x: number;
  y: number;
}

interface Props {
  onDrawGeofence?: () => void;
  onEditGeofence?: (g: Geofence) => void;
}

export default function FleetMap({ onEditGeofence }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeStore();
  const {
    vehicles, selectedVehicleId, geofences,
    mapViewState, setMapViewState,
    showGeofences, showHeatmap, showTrails,
    selectVehicle, fetchGeofences,
  } = useFleetStore();

  const { layers: fmLayers, deleteGeofence: deleteFMGeofence } = useFMStore();

  const [trails, setTrails]           = useState<TrailData[]>([]);
  const [heatmapData, setHeatmapData] = useState<{ lng: number; lat: number; weight: number }[]>([]);
  const [geofencePopup, setGeofencePopup] = useState<GeofencePopup | null>(null);
  const [deletingGeofence, setDeletingGeofence] = useState<Geofence | null>(null);

  // Compute visible geofences based on fmLayers
  const visibleGeofences = useMemo(() => {
    if (!fmLayers || fmLayers.length === 0) return geofences;
    const idsInLayers = new Set(fmLayers.flatMap(l => l.geofence_ids));
    const hiddenIds = new Set(
      fmLayers.filter(l => !l.is_visible).flatMap(l => l.geofence_ids)
    );
    return geofences.filter(g => {
      if (!idsInLayers.has(g.id)) return true; // not in any layer → always show
      return !hiddenIds.has(g.id);
    });
  }, [geofences, fmLayers]);

  useEffect(() => {
    if (!selectedVehicleId || !showTrails) { setTrails([]); return; }
    api.get(`/vehicles/${selectedVehicleId}/telemetry?limit=200`).then(({ data }) => {
      const path = data.telemetry
        .filter((t: any) => t.lng != null && t.lat != null)
        .map((t: any) => [parseFloat(t.lng), parseFloat(t.lat)] as [number, number]);
      if (path.length >= 2) setTrails([{ vehicleId: selectedVehicleId, path, color: [0, 212, 232, 180] }]);
    }).catch(() => {});
  }, [selectedVehicleId, showTrails]);

  useEffect(() => {
    if (!showHeatmap) { setHeatmapData([]); return; }
    api.get('/analytics/alert-heatmap').then(({ data }) => {
      setHeatmapData(data.points.map((p: any) => ({
        lng: parseFloat(p.lng), lat: parseFloat(p.lat), weight: parseInt(p.count),
      })));
    }).catch(() => {});
  }, [showHeatmap]);

  const layers = useMemo(() => {
    const out: any[] = [];

    if (showGeofences && visibleGeofences.length > 0) {
      out.push(new PolygonLayer({
        id: 'geofences-fill',
        data: visibleGeofences.filter(g => g.is_active && g.boundary?.coordinates),
        getPolygon: (g: Geofence) => g.boundary.coordinates[0] as [number,number][],
        getFillColor: (g: Geofence) => {
          const [r, gg, b] = hexToRgb(g.color || '#00d4e8');
          return [r, gg, b, 25] as [number,number,number,number];
        },
        getLineColor: (g: Geofence) => {
          const [r, gg, b] = hexToRgb(g.color || '#00d4e8');
          return [r, gg, b, 200] as [number,number,number,number];
        },
        lineWidthMinPixels: 2,
        filled: true,
        stroked: true,
        pickable: true,
        onClick: ({ object, x, y }: { object?: Geofence; x: number; y: number }) => {
          if (object) {
            setGeofencePopup({ geofence: object, x, y });
            return true;
          }
        },
      }));
    }

    if (showTrails && trails.length > 0) {
      out.push(new PathLayer({
        id: 'vehicle-trails',
        data: trails,
        getPath:  (d: TrailData) => d.path,
        getColor: (d: TrailData) => d.color,
        getWidth: 3,
        widthMinPixels: 2,
        capRounded: true,
        jointRounded: true,
      }));
    }

    if (showHeatmap && heatmapData.length > 0) {
      out.push(new HeatmapLayer({
        id: 'alert-heatmap',
        data: heatmapData,
        getPosition: (d: any) => [d.lng, d.lat],
        getWeight:   (d: any) => d.weight,
        radiusPixels: 40,
        intensity: 1,
        threshold: 0.05,
        colorRange: [
          [0,212,232,0],   [0,212,232,128], [163,230,53,200],
          [245,158,11,220],[239,68,68,240],  [185,28,28,255],
        ] as [number,number,number,number][],
      }));
    }

    out.push(new ScatterplotLayer({
      id: 'vehicle-pulse',
      data: vehicles.filter(v => v.status === 'active' || v.status === 'alert'),
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getRadius: 18,
      radiusMinPixels: 14,
      radiusMaxPixels: 28,
      getFillColor: (v: Vehicle) => { const c = statusColor(v.status); return [c[0],c[1],c[2],40] as [number,number,number,number]; },
      stroked: false,
      pickable: false,
    }));

    out.push(new ScatterplotLayer({
      id: 'vehicle-outer',
      data: vehicles,
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getRadius: 12,
      radiusMinPixels: 10,
      radiusMaxPixels: 20,
      getFillColor: (v: Vehicle) => { const c = statusColor(v.status); return [c[0],c[1],c[2],60] as [number,number,number,number]; },
      getLineColor: (v: Vehicle) => statusColor(v.status),
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: false,
    }));

    out.push(new IconLayer({
      id: 'vehicle-arrows',
      data: vehicles.filter(v => v.current_speed > 2),
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getIcon: () => ({ url: VEHICLE_ICON_URL, width: 32, height: 32, anchorY: 16 }),
      getSize: 28,
      sizeMinPixels: 18,
      sizeMaxPixels: 36,
      getAngle: (v: Vehicle) => -v.current_heading,
      getColor: (v: Vehicle) => statusColor(v.status),
      pickable: false,
    }));

    out.push(new ScatterplotLayer({
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
      onClick: ({ object }: { object?: Vehicle }) => {
        if (object) { selectVehicle(object.id); setGeofencePopup(null); }
      },
    }));

    if (selectedVehicleId) {
      const sel = vehicles.find(v => v.id === selectedVehicleId);
      if (sel) {
        out.push(new ScatterplotLayer({
          id: 'vehicle-selected',
          data: [sel],
          getPosition: (v: Vehicle) => [v.lng, v.lat],
          getRadius: 20,
          radiusMinPixels: 18,
          getFillColor: [0, 212, 232, 0],
          getLineColor: [0, 212, 232, 255],
          lineWidthMinPixels: 3,
          stroked: true,
          filled: true,
          pickable: false,
        }));
      }
    }

    if (mapViewState.zoom > 13) {
      out.push(new TextLayer({
        id: 'vehicle-labels',
        data: vehicles.filter(v => v.current_speed > 5),
        getPosition: (v: Vehicle) => [v.lng, v.lat],
        getText: (v: Vehicle) => `${Math.round(v.current_speed)}`,
        getSize: 11,
        getColor: [255, 255, 255, 220],
        getPixelOffset: [0, -22],
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700 as any,
        background: true,
        getBackgroundColor: [0, 0, 0, 160],
        backgroundPadding: [3, 2, 3, 2],
        pickable: false,
      }));
    }

    return out;
  }, [vehicles, visibleGeofences, trails, heatmapData, selectedVehicleId,
      showGeofences, showTrails, showHeatmap, mapViewState.zoom, selectVehicle]);

  const onViewStateChange = useCallback(({ viewState }: any) => {
    setMapViewState(viewState);
  }, [setMapViewState]);

  const getTooltip = useCallback(({ object }: any) => {
    if (!object) return null;
    if (object.registration) {
      const v = object as Vehicle;
      return {
        html: `
          <div style="background:#0a1828;border:1px solid rgba(0,212,232,.3);padding:10px 14px;border-radius:8px;font-size:12px;color:#e8eaf0;min-width:180px;font-family:'DM Sans',sans-serif">
            <div style="font-weight:700;font-size:13px;color:#00d4e8;margin-bottom:6px">${v.registration}</div>
            <div style="color:#8da4c2">${v.make} ${v.model}</div>
            ${v.driver_name ? `<div style="margin-top:4px">&#128100; ${v.driver_name}</div>` : ''}
            <div style="margin-top:6px;display:flex;gap:12px">
              <span>&#127950; ${Math.round(v.current_speed)} km/h</span>
              <span>&#9981; ${Math.round(v.current_fuel)}%</span>
            </div>
          </div>`,
        style: {},
      };
    }
    return null;
  }, []);

  const handleDeleteGeofence = async () => {
    if (!deletingGeofence) return;
    await deleteFMGeofence(deletingGeofence.id);
    fetchGeofences();
    setDeletingGeofence(null);
    setGeofencePopup(null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={(e) => {
        // Close popup on background click
        if ((e.target as HTMLElement).closest('[data-geofence-popup]')) return;
        setGeofencePopup(null);
      }}
    >
      <DeckGL
        viewState={mapViewState}
        onViewStateChange={onViewStateChange}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        getTooltip={getTooltip}
        style={{ position: 'absolute', inset: '0' }}
      >
        <Map
          reuseMaps
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={colors.mapStyle}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" showCompass />
        </Map>
      </DeckGL>

      {/* Geofence popup */}
      {geofencePopup && (
        <div
          data-geofence-popup="1"
          style={{
            position: 'absolute',
            left: Math.min(geofencePopup.x + 8, window.innerWidth - 220),
            top: Math.min(geofencePopup.y + 8, window.innerHeight - 120),
            background: '#0a1828',
            border: '1px solid rgba(0,212,232,.3)',
            borderRadius: 10,
            padding: '12px 14px',
            zIndex: 50,
            minWidth: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: geofencePopup.geofence.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#e8eaf0', fontFamily: 'Syne, sans-serif', flex: 1 }}>{geofencePopup.geofence.name}</span>
            <button onClick={() => setGeofencePopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5d7a9a', display: 'flex', padding: 0 }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: '#5d7a9a', marginBottom: 10, textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif' }}>
            {geofencePopup.geofence.zone_type} zone
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onEditGeofence && (
              <button
                onClick={() => { onEditGeofence(geofencePopup.geofence); setGeofencePopup(null); }}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(0,212,232,.3)', background: 'rgba(0,212,232,.08)', color: '#00d4e8', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
              >
                {t('geofence_popup.edit')}
              </button>
            )}
            <button
              onClick={() => { setDeletingGeofence(geofencePopup.geofence); }}
              style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: '#ef4444', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}
            >
              {t('geofence_popup.delete')}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingGeofence && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0a1828', border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: 28, maxWidth: 360, width: '90%' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#e8eaf0', marginBottom: 8 }}>Delete Geofence?</div>
            <div style={{ fontSize: 13, color: '#8da4c2', marginBottom: 20, lineHeight: 1.6 }}>
              <strong style={{ color: '#e8eaf0' }}>{deletingGeofence.name}</strong> will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeletingGeofence(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Cancel</button>
              <button onClick={handleDeleteGeofence} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}
