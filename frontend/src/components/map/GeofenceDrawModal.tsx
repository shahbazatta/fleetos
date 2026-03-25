import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
// @ts-ignore
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { X } from 'lucide-react';
import { useFMStore, type FMGeofence } from '../../store/fmStore';
import { useFleetStore } from '../../store/fleetStore';
import { useThemeStore } from '../../store/themeStore';
import { useTranslation } from 'react-i18next';
import { inp, lbl, sel, C } from '../fm/FMShared';

const ZONE_TYPES = ['delivery', 'restricted', 'depot', 'customer', 'route', 'other'];
const PRESET_COLORS = ['#00d4e8', '#22c55e', '#ef4444', '#f59e0b', '#a78bfa', '#fb923c', '#ec4899'];

interface Props {
  geofenceToEdit?: FMGeofence | null;
  onClose: () => void;
}

export default function GeofenceDrawModal({ geofenceToEdit, onClose }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeStore();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<any>(null);
  const { mapViewState, fetchGeofences } = useFleetStore();
  const { createGeofence, updateGeofence } = useFMStore();

  const isEdit = !!geofenceToEdit;
  const [hasShape, setHasShape] = useState(isEdit);
  const [drawnFeatureId, setDrawnFeatureId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: geofenceToEdit?.name || '',
    zone_type: geofenceToEdit?.zone_type || 'delivery',
    color: geofenceToEdit?.color || '#00d4e8',
    speed_limit: geofenceToEdit?.speed_limit?.toString() || '',
    alert_on_enter: geofenceToEdit?.alert_on_enter ?? true,
    alert_on_exit: geofenceToEdit?.alert_on_exit ?? true,
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
      controls: { polygon: true, trash: true },
      defaultMode: isEdit ? 'simple_select' : 'draw_polygon',
    });

    map.addControl(draw as any);
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('load', () => {
      if (isEdit && geofenceToEdit?.boundary) {
        try {
          const added = draw.add({
            type: 'Feature',
            properties: {},
            geometry: geofenceToEdit.boundary,
          } as GeoJSON.Feature);
          if (added && added[0]) {
            setDrawnFeatureId(added[0]);
            const coords = geofenceToEdit.boundary.coordinates[0] as [number, number][];
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
      setHasShape(true);
      if (e.features?.[0]?.id) setDrawnFeatureId(e.features[0].id);
    });
    map.on('draw.delete', () => {
      setHasShape(isEdit);
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

    if (!isEdit && (!hasShape || !drawnFeatureId)) {
      setError(t('geofence_draw.error_no_shape'));
      return;
    }
    if (!form.name.trim()) {
      setError(t('geofence_draw.error_no_name'));
      return;
    }

    let coords: number[][] | null = null;
    const allFeatures = draw.getAll() as GeoJSON.FeatureCollection;
    const feature = allFeatures.features.find((f: any) => f.id === drawnFeatureId);

    if (feature && feature.geometry.type === 'Polygon') {
      coords = (feature.geometry as GeoJSON.Polygon).coordinates[0];
    } else if (isEdit && !feature) {
      // No new drawing for edit — coords will be skipped
    } else {
      setError(t('geofence_draw.error_invalid'));
      return;
    }

    setSaving(true);
    setError('');

    const payload: any = {
      name: form.name.trim(),
      zone_type: form.zone_type,
      color: form.color,
      speed_limit: form.speed_limit ? Number(form.speed_limit) : null,
      alert_on_enter: form.alert_on_enter,
      alert_on_exit: form.alert_on_exit,
      is_active: true,
    };
    if (coords) payload.coordinates = coords;

    const result = isEdit && geofenceToEdit
      ? await updateGeofence(geofenceToEdit.id, payload)
      : await createGeofence(payload);

    setSaving(false);
    if (!result.ok) {
      setError(result.error || 'Failed to save geofence');
    } else {
      fetchGeofences();
      onClose();
    }
  };

  const panelBg = C.surface;
  const panelBorder = C.border;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex' }}>
      {/* Map */}
      <div ref={mapContainer} style={{ flex: 1, height: '100%' }} />

      {/* Right panel */}
      <div style={{
        width: 320, background: panelBg, borderLeft: `1px solid ${panelBorder}`,
        display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.borderW}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: C.text }}>
              {isEdit ? t('geofence_draw.title_edit') : t('geofence_draw.title_draw')}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
            {isEdit ? t('geofence_draw.subtitle_edit') : t('geofence_draw.subtitle_draw')}
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
            <div style={{ padding: '10px 14px', borderRadius: 7, background: hasShape ? 'rgba(34,197,94,.08)' : 'rgba(0,212,232,.06)', border: `1px solid ${hasShape ? 'rgba(34,197,94,.2)' : C.border}`, fontSize: 12, color: hasShape ? C.green : C.cyan }}>
              {hasShape ? t('geofence_draw.hint_done') : t('geofence_draw.hint_draw')}
            </div>
          )}

          <div>
            <label style={lbl}>{t('geofence_draw.name_label')}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder={t('geofence_draw.name_placeholder')} />
          </div>

          <div>
            <label style={lbl}>{t('geofence_draw.zone_type')}</label>
            <select value={form.zone_type} onChange={e => setForm(f => ({ ...f, zone_type: e.target.value }))} style={sel}>
              {ZONE_TYPES.map(z => <option key={z} value={z} style={{ textTransform: 'capitalize' }}>{z}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>{t('geofence_draw.speed_limit')}</label>
            <input type="number" value={form.speed_limit} onChange={e => setForm(f => ({ ...f, speed_limit: e.target.value }))} style={inp} placeholder="Optional" min={0} />
          </div>

          <div>
            <label style={lbl}>{t('geofence_draw.color')}</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>
              <input type="checkbox" checked={form.alert_on_enter} onChange={e => setForm(f => ({ ...f, alert_on_enter: e.target.checked }))} style={{ accentColor: C.cyan }} />
              {t('geofence_draw.alert_enter')}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>
              <input type="checkbox" checked={form.alert_on_exit} onChange={e => setForm(f => ({ ...f, alert_on_exit: e.target.checked }))} style={{ accentColor: C.cyan }} />
              {t('geofence_draw.alert_exit')}
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.borderW}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
            {t('geofence_draw.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving || (!isEdit && !hasShape)}
            style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: (saving || (!isEdit && !hasShape)) ? 'rgba(0,212,232,.35)' : C.cyan, color: C.bg, cursor: (saving || (!isEdit && !hasShape)) ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14 }}>
            {saving ? '...' : isEdit ? t('geofence_draw.save_edit') : t('geofence_draw.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
