import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { NavigationControl } from "react-map-gl/maplibre";
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
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslation } from 'react-i18next';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const VEHICLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><polygon points="16,2 26,28 16,22 6,28" fill="white"/></svg>`;
const VEHICLE_ICON_URL = `data:image/svg+xml;base64,${btoa(VEHICLE_ICON_SVG)}`;

interface TrailData { vehicleId: string; path: [number, number][]; color: [number,number,number,number]; }
interface CtxMenu { geofence: Geofence; clientX: number; clientY: number; showLayerPicker: boolean; }

interface Props {
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

  const { layers: fmLayers, deleteGeofence: deleteFMGeofence, addGeofenceToLayer, routes: fmRoutes, vehicles: fmVehicles } = useFMStore();

  const containerRef  = useRef<HTMLDivElement>(null);
  const deckRef       = useRef<any>(null);
  const vehiclesRef   = useRef(vehicles);
  useEffect(() => { vehiclesRef.current = vehicles; }, [vehicles]);

  const [trails, setTrails]       = useState<TrailData[]>([]);
  const [heatmapData, setHeat]    = useState<{ lng: number; lat: number; weight: number }[]>([]);
  const [ctxMenu, setCtxMenu]     = useState<CtxMenu | null>(null);
  const [deletingGf, setDeleting] = useState<Geofence | null>(null);

  // Compute visible geofences respecting layer visibility
  const visibleGeofences = useMemo(() => {
    if (!fmLayers?.length) return geofences;
    const idsInLayers = new Set(fmLayers.flatMap(l => l.geofence_ids));
    const hiddenIds   = new Set(fmLayers.filter(l => !l.is_visible).flatMap(l => l.geofence_ids));
    return geofences.filter(g => !idsInLayers.has(g.id) || !hiddenIds.has(g.id));
  }, [geofences, fmLayers]);

  // Fetch trails using the /trail endpoint (ST_MakeLine ORDER BY recorded_at — correct order)
  useEffect(() => {
    if (!showTrails) { setTrails([]); return; }
    const vs = vehiclesRef.current;
    // If a vehicle is selected show its trail; otherwise show up to 10 active/idle vehicles
    const ids = selectedVehicleId
      ? [selectedVehicleId]
      : vs.filter(v => v.status === 'active' || v.status === 'idle').map(v => v.id).slice(0, 10);
    if (ids.length === 0) { setTrails([]); return; }
    Promise.all(
      ids.map(vid =>
        api.get(`/vehicles/${vid}/trail?minutes=60`).then(({ data }) => {
          if (!data?.trail?.coordinates || data.trail.coordinates.length < 2) return null;
          const v = vs.find(vv => vv.id === vid);
          const col = v ? statusColor(v.status) : [0, 212, 232];
          return {
            vehicleId: vid,
            path: data.trail.coordinates as [number, number][],
            color: [col[0], col[1], col[2], 200] as [number, number, number, number],
          };
        }).catch(() => null)
      )
    ).then(results => setTrails(results.filter(Boolean) as TrailData[]));
  }, [showTrails, selectedVehicleId]);

  useEffect(() => {
    if (!showHeatmap) { setHeat([]); return; }
    api.get('/analytics/alert-heatmap').then(({ data }) => {
      setHeat(data.points.map((p: any) => ({ lng: parseFloat(p.lng), lat: parseFloat(p.lat), weight: parseInt(p.count) })));
    }).catch(() => {});
  }, [showHeatmap]);

  // ── Prevent browser context menu + pick geofence on right-click ────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      // Pick the object under the cursor using DeckGL's deck instance
      const deck = deckRef.current?.deck;
      if (!deck) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const info = deck.pickObject({ x, y, radius: 8 });
      if (info?.object?.boundary) {
        setCtxMenu({ geofence: info.object as Geofence, clientX: e.clientX, clientY: e.clientY, showLayerPicker: false });
      } else {
        setCtxMenu(null);
      }
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, []);

  // ── DeckGL layers ──────────────────────────────────────────────────────────
  const layers = useMemo(() => {
    const out: any[] = [];

    if (showGeofences && visibleGeofences.length > 0) {
      out.push(new PolygonLayer({
        id: 'geofences-fill',
        data: visibleGeofences.filter(g => g.is_active && g.boundary?.coordinates),
        getPolygon: (g: Geofence) => g.boundary.coordinates[0] as [number, number][],
        getFillColor: (g: Geofence) => { const [r, gg, b] = hexToRgb(g.color || '#00d4e8'); return [r, gg, b, 25] as [number,number,number,number]; },
        getLineColor: (g: Geofence) => { const [r, gg, b] = hexToRgb(g.color || '#00d4e8'); return [r, gg, b, 200] as [number,number,number,number]; },
        lineWidthMinPixels: 2,
        filled: true, stroked: true, pickable: true,
      }));
    }

    // Planned route paths — shown when trails are on OR a vehicle with a route is selected
    const selectedFmVehicle = fmVehicles.find(v => v.id === selectedVehicleId);
    const selectedRouteId   = selectedFmVehicle?.route_id;
    const activeRoutes = fmRoutes.filter(r => r.is_active && r.path_geojson?.coordinates?.length >= 2);

    if ((showTrails || selectedRouteId) && activeRoutes.length > 0) {
      const routeLayerData = activeRoutes
        .filter(r => showTrails || r.id === selectedRouteId)
        .map(r => ({
          id: r.id,
          path: r.path_geojson!.coordinates as [number, number][],
          color: r.color || '#00d4e8',
          isSelected: r.id === selectedRouteId,
        }));

      if (routeLayerData.length > 0) {
        // Background route lines
        out.push(new PathLayer({
          id: 'route-paths-bg',
          data: routeLayerData.filter(r => !r.isSelected),
          getPath:  (d: any) => d.path,
          getColor: (d: any) => { const [r, g, b] = hexToRgb(d.color); return [r, g, b, 90] as [number,number,number,number]; },
          getWidth: 3, widthMinPixels: 2, widthMaxPixels: 5, capRounded: true, jointRounded: true,
          getDashArray: [6, 4], extensions: [] as any,
        }));
        // Highlighted selected route
        if (selectedRouteId) {
          out.push(new PathLayer({
            id: 'route-path-selected',
            data: routeLayerData.filter(r => r.isSelected),
            getPath:  (d: any) => d.path,
            getColor: (d: any) => { const [r, g, b] = hexToRgb(d.color); return [r, g, b, 255] as [number,number,number,number]; },
            getWidth: 6, widthMinPixels: 4, widthMaxPixels: 10, capRounded: true, jointRounded: true,
          }));
        }
      }
    }

    if (showTrails && trails.length > 0) {
      out.push(new PathLayer({
        id: 'vehicle-trails',
        data: trails,
        getPath:  (d: TrailData) => d.path,
        getColor: (d: TrailData) => d.color,
        getWidth: 3, widthMinPixels: 2, capRounded: true, jointRounded: true,
      }));
    }

    if (showHeatmap && heatmapData.length > 0) {
      out.push(new HeatmapLayer({
        id: 'alert-heatmap',
        data: heatmapData,
        getPosition: (d: any) => [d.lng, d.lat],
        getWeight: (d: any) => d.weight,
        radiusPixels: 40, intensity: 1, threshold: 0.05,
        colorRange: [[0,212,232,0],[0,212,232,128],[163,230,53,200],[245,158,11,220],[239,68,68,240],[185,28,28,255]] as [number,number,number,number][],
      }));
    }

    out.push(new ScatterplotLayer({
      id: 'vehicle-pulse',
      data: vehicles.filter(v => v.status === 'active' || v.status === 'alert'),
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getRadius: 18, radiusMinPixels: 14, radiusMaxPixels: 28,
      getFillColor: (v: Vehicle) => { const c = statusColor(v.status); return [c[0],c[1],c[2],40] as [number,number,number,number]; },
      stroked: false, pickable: false,
    }));

    out.push(new ScatterplotLayer({
      id: 'vehicle-outer',
      data: vehicles,
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getRadius: 12, radiusMinPixels: 10, radiusMaxPixels: 20,
      getFillColor: (v: Vehicle) => { const c = statusColor(v.status); return [c[0],c[1],c[2],60] as [number,number,number,number]; },
      getLineColor: (v: Vehicle) => statusColor(v.status),
      lineWidthMinPixels: 2, stroked: true, filled: true, pickable: false,
    }));

    out.push(new IconLayer({
      id: 'vehicle-arrows',
      data: vehicles.filter(v => v.current_speed > 2),
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getIcon: () => ({ url: VEHICLE_ICON_URL, width: 32, height: 32, anchorY: 16 }),
      getSize: 28, sizeMinPixels: 18, sizeMaxPixels: 36,
      getAngle: (v: Vehicle) => -v.current_heading,
      getColor: (v: Vehicle) => statusColor(v.status), pickable: false,
    }));

    out.push(new ScatterplotLayer({
      id: 'vehicle-core',
      data: vehicles,
      getPosition: (v: Vehicle) => [v.lng, v.lat],
      getRadius: 7, radiusMinPixels: 6, radiusMaxPixels: 14,
      getFillColor: (v: Vehicle) => statusColor(v.status),
      stroked: true, getLineColor: [255, 255, 255, 200], lineWidthMinPixels: 1.5,
      pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 60],
      onClick: ({ object }: { object?: Vehicle }) => {
        if (object) { selectVehicle(object.id); setCtxMenu(null); }
      },
    }));

    if (selectedVehicleId) {
      const sel = vehicles.find(v => v.id === selectedVehicleId);
      if (sel) {
        out.push(new ScatterplotLayer({
          id: 'vehicle-selected',
          data: [sel],
          getPosition: (v: Vehicle) => [v.lng, v.lat],
          getRadius: 20, radiusMinPixels: 18,
          getFillColor: [0, 212, 232, 0],
          getLineColor: [0, 212, 232, 255],
          lineWidthMinPixels: 3, stroked: true, filled: true, pickable: false,
        }));
      }
    }

    if (mapViewState.zoom > 13) {
      out.push(new TextLayer({
        id: 'vehicle-labels',
        data: vehicles.filter(v => v.current_speed > 5),
        getPosition: (v: Vehicle) => [v.lng, v.lat],
        getText: (v: Vehicle) => `${Math.round(v.current_speed)}`,
        getSize: 11, getColor: [255, 255, 255, 220],
        getPixelOffset: [0, -22], fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700 as any, background: true,
        getBackgroundColor: [0, 0, 0, 160], backgroundPadding: [3, 2, 3, 2], pickable: false,
      }));
    }

    return out;
  }, [vehicles, visibleGeofences, trails, heatmapData, selectedVehicleId,
      showGeofences, showTrails, showHeatmap, mapViewState.zoom, selectVehicle,
      fmRoutes, fmVehicles]);

  const onViewStateChange = useCallback(({ viewState }: any) => setMapViewState(viewState), [setMapViewState]);

  const getTooltip = useCallback(({ object }: any) => {
    if (!object?.registration) return null;
    const v = object as Vehicle;
    return {
      html: `<div style="background:#0a1828;border:1px solid rgba(0,212,232,.3);padding:10px 14px;border-radius:8px;font-size:12px;color:#e8eaf0;min-width:180px;font-family:'DM Sans',sans-serif">
        <div style="font-weight:700;font-size:13px;color:#00d4e8;margin-bottom:6px">${v.registration}</div>
        <div style="color:#8da4c2">${v.make} ${v.model}</div>
        ${v.driver_name ? `<div style="margin-top:4px">&#128100; ${v.driver_name}</div>` : ''}
        <div style="margin-top:6px;display:flex;gap:12px"><span>&#127950; ${Math.round(v.current_speed)} km/h</span><span>&#9981; ${Math.round(v.current_fuel)}%</span></div>
      </div>`,
      style: {},
    };
  }, []);

  const handleDeleteGeofence = async () => {
    if (!deletingGf) return;
    await deleteFMGeofence(deletingGf.id);
    fetchGeofences();
    setDeleting(null);
    setCtxMenu(null);
  };

  // Position context menu so it doesn't go off screen
  const menuX = ctxMenu ? Math.min(ctxMenu.clientX, window.innerWidth  - 210) : 0;
  const menuY = ctxMenu ? Math.min(ctxMenu.clientY, window.innerHeight - 240) : 0;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('[data-ctx-menu]')) setCtxMenu(null);
      }}
    >
      <DeckGL
        ref={deckRef}
        viewState={mapViewState}
        onViewStateChange={onViewStateChange}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        getTooltip={getTooltip}
        style={{ position: 'absolute', inset: '0' }}
      >
        <Map
          reuseMaps
          mapStyle={colors.mapStyle}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" showCompass />
        </Map>
      </DeckGL>

      {/* ── Right-click Context Menu ──────────────────────────────────────── */}
      {ctxMenu && (
        <div
          data-ctx-menu="1"
          style={{
            position: 'fixed',
            left: menuX,
            top: menuY,
            background: '#0d1f33',
            border: '1px solid rgba(0,212,232,.2)',
            borderRadius: 10,
            zIndex: 100,
            minWidth: 200,
            boxShadow: '0 12px 40px rgba(0,0,0,.6)',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {/* Header */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ctxMenu.geofence.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#e8eaf0', fontFamily: 'Syne, sans-serif' }}>{ctxMenu.geofence.name}</span>
            </div>
            {ctxMenu.geofence.zone_type && (
              <div style={{ fontSize: 10, color: '#5d7a9a', marginTop: 2, textTransform: 'capitalize', fontFamily: 'DM Sans, sans-serif' }}>
                {ctxMenu.geofence.zone_type} zone
              </div>
            )}
          </div>

          {/* Menu items */}
          <div style={{ padding: '4px 0' }}>
            {/* Edit Shape */}
            {onEditGeofence && (
              <CtxItem
                label={t('geofence_popup.edit')}
                icon="✏️"
                onClick={() => { onEditGeofence(ctxMenu.geofence); setCtxMenu(null); }}
              />
            )}

            {/* Add to Layer */}
            <div style={{ position: 'relative' }}>
              <CtxItem
                label="Add to Layer"
                icon="🗂"
                hasSubmenu
                active={ctxMenu.showLayerPicker}
                onClick={() => setCtxMenu(m => m ? { ...m, showLayerPicker: !m.showLayerPicker } : m)}
              />
              {ctxMenu.showLayerPicker && (
                <div style={{
                  position: 'absolute', left: '100%', top: 0,
                  background: '#0d1f33', border: '1px solid rgba(0,212,232,.2)',
                  borderRadius: 8, minWidth: 180, zIndex: 101,
                  boxShadow: '0 8px 32px rgba(0,0,0,.5)', overflow: 'hidden',
                }}>
                  {fmLayers.length === 0 ? (
                    <div style={{ padding: '10px 14px', fontSize: 12, color: '#5d7a9a', fontFamily: 'DM Sans, sans-serif', fontStyle: 'italic' }}>
                      No layers — create one in the Layers panel
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#3a5070', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>Select Layer</div>
                      {fmLayers.map(layer => {
                        const alreadyIn = layer.geofence_ids.includes(ctxMenu.geofence.id);
                        return (
                          <button
                            key={layer.id}
                            onClick={() => {
                              if (!alreadyIn) addGeofenceToLayer(layer.id, ctxMenu.geofence.id);
                              setCtxMenu(null);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                              cursor: alreadyIn ? 'default' : 'pointer', textAlign: 'left',
                              fontSize: 12, fontFamily: 'DM Sans, sans-serif',
                              color: alreadyIn ? '#3a5070' : '#e8eaf0',
                            }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: layer.color, flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{layer.name}</span>
                            {alreadyIn && <span style={{ fontSize: 10, color: '#3a5070' }}>✓</span>}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ margin: '3px 10px', borderTop: '1px solid rgba(255,255,255,.06)' }} />

            {/* Delete */}
            <CtxItem
              label={t('geofence_popup.delete')}
              icon="🗑"
              danger
              onClick={() => { setDeleting(ctxMenu.geofence); setCtxMenu(null); }}
            />
          </div>
        </div>
      )}

      {/* ── Delete confirm dialog ─────────────────────────────────────────── */}
      {deletingGf && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0a1828', border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: 28, maxWidth: 360, width: '90%' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#e8eaf0', marginBottom: 8 }}>Delete Geofence?</div>
            <div style={{ fontSize: 13, color: '#8da4c2', marginBottom: 20, lineHeight: 1.6 }}>
              <strong style={{ color: '#e8eaf0' }}>{deletingGf.name}</strong> will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleting(null)} style={{ flex: 1, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Cancel</button>
              <button onClick={handleDeleteGeofence} style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Context menu item ──────────────────────────────────────────────────────
function CtxItem({ label, icon, danger, hasSubmenu, active, onClick }: {
  label: string; icon?: string; danger?: boolean; hasSubmenu?: boolean; active?: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '8px 14px', background: hovered || active ? 'rgba(255,255,255,.05)' : 'none',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: 12, fontFamily: 'DM Sans, sans-serif',
        color: danger ? '#ef4444' : '#e8eaf0',
        transition: 'background .1s',
      }}
    >
      {icon && <span style={{ fontSize: 13, width: 16, textAlign: 'center', flexShrink: 0 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {hasSubmenu && <span style={{ color: '#5d7a9a', fontSize: 10 }}>▶</span>}
    </button>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}

