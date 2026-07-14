import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
// @ts-ignore
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { X, Route } from 'lucide-react';
import { useFMStore, type FMRoute } from '../../store/fmStore';
import { useFleetStore } from '../../store/fleetStore';
import { useThemeStore } from '../../store/themeStore';
import { inp, lbl, sel, C } from '../fm/FMShared';

const PRESET_COLORS = ['var(--acc)', '#22c55e', '#ef4444', '#f59e0b', '#a78bfa', '#fb923c', '#ec4899'];

interface Props {
  routeToEdit?: FMRoute | null;
  onClose: () => void;
}

export default function RouteDrawModal({ routeToEdit, onClose }: Props) {
  const { colors } = useThemeStore();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<any>(null);
  const { mapViewState } = useFleetStore();
  const { createRoute, updateRoute } = useFMStore();

  const isEdit = !!routeToEdit;
  const [hasLine, setHasLine] = useState(isEdit);
  const [drawnFeatureId, setDrawnFeatureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: routeToEdit?.name || '',
    description: routeToEdit?.description || '',
    color: routeToEdit?.color || 'var(--acc)',
    duration_min: routeToEdit?.duration_min?.toString() || '',
  });

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: colors.mapStyle,
      center: [mapViewState.longitude, mapViewState.latitude],
      zoom: mapViewState.zoom,
      accessToken: MAPBOX_TOKEN,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { line_string: true, trash: true },
      defaultMode: isEdit ? 'simple_select' : 'draw_line_string',
      styles: [
        { 'id': 'gl-draw-line', 'type': 'line', 'filter': ['all', ['==', '$type', 'LineString']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': form.color, 'line-width': 3, 'line-dasharray': [2, 2] } },
        { 'id': 'gl-draw-line-active', 'type': 'line', 'filter': ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': 'var(--acc)', 'line-width': 4 } },
        { 'id': 'gl-draw-point', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], 'paint': { 'circle-radius': 5, 'circle-color': '#fff' } },
      ],
    });

    map.addControl(draw as any);
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      if (isEdit && routeToEdit?.path_geojson) {
        try {
          const added = draw.add({
            type: 'Feature',
            properties: {},
            geometry: routeToEdit.path_geojson,
          } as GeoJSON.Feature);
          if (added && added[0]) {
            setDrawnFeatureId(added[0]);
            const coords = (routeToEdit.path_geojson as GeoJSON.LineString).coordinates as [number, number][];
            if (coords.length >= 2) {
              const bounds = coords.reduce(
                (b, c) => b.extend(c),
                new mapboxgl.LngLatBounds(coords[0], coords[0])
              );
              map.fitBounds(bounds, { padding: 80, duration: 600 });
            }
          }
        } catch {}
      }
    });

    map.on('draw.create', (e: any) => {
      setHasLine(true);
      if (e.features?.[0]?.id) setDrawnFeatureId(e.features[0].id);
    });
    map.on('draw.delete', () => {
      setHasLine(isEdit);
      setDrawnFeatureId(null);
    });
    map.on('draw.update', (e: any) => {
      if (e.features?.[0]?.id) setDrawnFeatureId(e.features[0].id);
    });

    mapRef.current = map;
    drawRef.current = draw;

    return () => { try { map.remove(); } catch {} };
  }, []);

  const handleSave = async () => {
    const draw = drawRef.current;
    if (!draw) return;
    if (!isEdit && (!hasLine || !drawnFeatureId)) {
      setError('Please draw a route on the map first');
      return;
    }
    if (!form.name.trim()) {
      setError('Route name is required');
      return;
    }

    let coords: number[][] | null = null;
    const allFeatures = draw.getAll() as GeoJSON.FeatureCollection;
    const feature = allFeatures.features.find((f: any) => f.id === drawnFeatureId);

    if (feature && feature.geometry.type === 'LineString') {
      coords = (feature.geometry as GeoJSON.LineString).coordinates;
    } else if (isEdit && !feature) {
      // No new drawing for edit — coords will be skipped
    } else if (!isEdit) {
      setError('Invalid route geometry. Please draw a line on the map.');
      return;
    }

    if (coords && coords.length < 2) {
      setError('Route must have at least 2 points');
      return;
    }

    setSaving(true);
    setError('');

    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      duration_min: form.duration_min ? Number(form.duration_min) : null,
      is_active: true,
    };
    if (coords) payload.coordinates = coords;

    const result = isEdit && routeToEdit
      ? await updateRoute(routeToEdit.id, payload)
      : await createRoute(payload);

    setSaving(false);
    if (!result.ok) {
      setError(result.error || 'Failed to save route');
    } else {
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
      {/* Map */}
      <div ref={mapContainer} style={{ flex: 1, height: '100%' }} />

      {/* Right panel */}
      <div style={{
        width: 320, background: C.surface, borderLeft: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid var(--bdr-07)`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Route size={16} style={{ color: C.cyan }} />
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: C.text }}>
                {isEdit ? 'Edit Route' : 'Draw Route'}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {isEdit ? 'Edit the route path and details' : 'Click on the map to draw a route line. Double-click to finish.'}
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!isEdit && (
            <div style={{ padding: '10px 14px', borderRadius: 7, background: hasLine ? 'rgba(34,197,94,.08)' : 'var(--acc-06)', border: `1px solid ${hasLine ? 'rgba(34,197,94,.2)' : C.border}`, fontSize: 12, color: hasLine ? C.green : C.cyan }}>
              {hasLine ? '✓ Route drawn — fill in the details below' : '🗺 Click on map to place route waypoints. Double-click to finish.'}
            </div>
          )}

          <div>
            <label style={lbl}>Route Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="Canal Road Route" />
          </div>

          <div>
            <label style={lbl}>Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} placeholder="Optional description" />
          </div>

          <div>
            <label style={lbl}>Estimated Duration (min)</label>
            <input type="number" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} style={inp} placeholder="e.g. 45" min={1} />
          </div>

          <div>
            <label style={lbl}>Route Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {PRESET_COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #fff' : '2px solid transparent', boxSizing: 'border-box', transition: 'border .1s' }}
                />
              ))}
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 24, height: 24, border: 'none', padding: 0, cursor: 'pointer', background: 'none', borderRadius: '50%' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid var(--bdr-07)`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'var(--fill-04)', border: `1px solid var(--bdr-07)`, color: 'var(--txt-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || (!isEdit && !hasLine)}
            style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: (saving || (!isEdit && !hasLine)) ? 'var(--acc-35)' : C.cyan, color: C.bg, cursor: (saving || (!isEdit && !hasLine)) ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14 }}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Route'}
          </button>
        </div>
      </div>
    </div>
  );
}
