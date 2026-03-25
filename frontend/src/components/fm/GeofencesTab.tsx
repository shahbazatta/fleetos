import React, { useState } from 'react';
import { MapPin, Plus, Eye, EyeOff, Layers, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useFMStore, type FMGeofence, type GeofenceLayer } from '../../store/fmStore';
import { useAuthStore } from '../../store/authStore';
import { Modal, ConfirmDelete, ErrorBanner, FormRow, FormField, SaveButton, CancelButton, Table, TR, TD, ActionButtons, inp, lbl, sel, C } from './FMShared';

const ZONE_TYPES = ['delivery', 'restricted', 'depot', 'customer', 'route', 'other'];
const PRESET_COLORS = ['#00d4e8', '#22c55e', '#ef4444', '#f59e0b', '#a78bfa', '#fb923c', '#ec4899', '#06b6d4'];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
      {PRESET_COLORS.map(c => (
        <div key={c} onClick={() => onChange(c)} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: value === c ? '3px solid #fff' : '2px solid transparent', boxSizing: 'border-box', transition: 'border .1s' }} />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'none' }} title="Custom color" />
    </div>
  );
}

function GeofenceForm({ geofence, onSave, onClose }: {
  geofence: FMGeofence | null;
  onSave: (p: any) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isEdit = !!geofence;
  const [form, setForm] = useState({
    name:           geofence?.name             || '',
    description:    geofence?.description      || '',
    color:          geofence?.color            || '#00d4e8',
    zone_type:      geofence?.zone_type        || 'delivery',
    speed_limit:    geofence?.speed_limit      || '',
    alert_on_enter: geofence?.alert_on_enter   ?? true,
    alert_on_exit:  geofence?.alert_on_exit    ?? true,
    is_active:      geofence?.is_active        ?? true,
    coordinates:    '',  // WKT-like input: "lng1 lat1, lng2 lat2, ..."
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  // Parse coordinate string: "74.38 31.45, 74.45 31.45, ..." → [[74.38,31.45],...]
  const parseCoords = (raw: string): number[][] | null => {
    try {
      const pairs = raw.trim().split(/[,\n]+/).map(p => p.trim().split(/\s+/).map(Number));
      if (pairs.some(p => p.length !== 2 || p.some(isNaN))) return null;
      // Close ring if not closed
      const first = pairs[0], last = pairs[pairs.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) pairs.push(first);
      return pairs;
    } catch { return null; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    const payload: any = {
      name: form.name, description: form.description || null,
      color: form.color, zone_type: form.zone_type,
      speed_limit: form.speed_limit || null,
      alert_on_enter: form.alert_on_enter,
      alert_on_exit: form.alert_on_exit,
      is_active: form.is_active,
    };
    if (!isEdit || form.coordinates) {
      if (!form.coordinates && !isEdit) { setError('Coordinates are required for new geofences'); setSaving(false); return; }
      if (form.coordinates) {
        const coords = parseCoords(form.coordinates);
        if (!coords || coords.length < 4) { setError('Invalid coordinates. Need at least 3 corner points: "lng lat, lng lat, ..."'); setSaving(false); return; }
        payload.coordinates = coords;
      }
    }
    const result = await onSave(payload);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit Geofence' : 'Create Geofence'} subtitle={isEdit ? geofence?.name : 'Define a geographic zone for your fleet'} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <FormRow>
          <FormField label="Name *"><input value={form.name} onChange={set('name')} style={inp} required placeholder="DHA Delivery Zone" /></FormField>
          <FormField label="Zone Type">
            <select value={form.zone_type} onChange={set('zone_type')} style={sel}>
              {ZONE_TYPES.map(z => <option key={z} value={z} style={{ textTransform: 'capitalize' }}>{z}</option>)}
            </select>
          </FormField>
        </FormRow>
        <FormField label="Description">
          <textarea value={form.description} onChange={set('description')} style={{ ...inp, height: 60, resize: 'vertical' }} placeholder="Optional description..." />
        </FormField>
        <FormRow>
          <FormField label="Speed Limit (km/h)"><input type="number" value={form.speed_limit} onChange={set('speed_limit')} style={inp} placeholder="Optional" min={0} /></FormField>
          <FormField label="Status">
            <select value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))} style={sel}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        </FormRow>
        <FormField label="Color">
          <ColorPicker value={form.color} onChange={c => setForm(f => ({ ...f, color: c }))} />
        </FormField>
        <div style={{ display: 'flex', gap: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>
            <input type="checkbox" checked={form.alert_on_enter} onChange={set('alert_on_enter')} style={{ accentColor: C.cyan }} />
            Alert on enter
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>
            <input type="checkbox" checked={form.alert_on_exit} onChange={set('alert_on_exit')} style={{ accentColor: C.cyan }} />
            Alert on exit
          </label>
        </div>
        <FormField label={isEdit ? 'Update Boundary (optional — leave blank to keep existing)' : 'Boundary Coordinates *'}>
          <textarea
            value={form.coordinates}
            onChange={set('coordinates')}
            style={{ ...inp, height: 80, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            placeholder={'Longitude Latitude pairs, one per line or comma-separated:\n74.38 31.45\n74.45 31.45\n74.45 31.50\n74.38 31.50'}
            required={!isEdit}
          />
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            Format: <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 3 }}>longitude latitude</code> — one per line or comma separated. Min 3 points.
          </div>
        </FormField>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={isEdit ? 'Save Changes' : 'Create Geofence'} />
        </div>
      </form>
    </Modal>
  );
}

// ── Layers Panel ─────────────────────────────────────────────────────────────

function LayerRow({ layer, geofences }: { layer: GeofenceLayer; geofences: FMGeofence[] }) {
  const { toggleLayerVisibility, updateLayer, deleteLayer, addGeofenceToLayer, removeGeofenceFromLayer } = useFMStore();
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(layer.name);
  const [color,    setColor]    = useState(layer.color);
  const [addingGf, setAddingGf] = useState(false);
  const [selectedGf, setSelectedGf] = useState('');

  const layerGeofences = geofences.filter(g => layer.geofence_ids.includes(g.id));
  const unaddedGeofences = geofences.filter(g => !layer.geofence_ids.includes(g.id));

  return (
    <div style={{ border: `1px solid ${C.borderW}`, borderRadius: 9, marginBottom: 8, overflow: 'hidden' }}>
      {/* Layer header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.02)' }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: layer.color, flexShrink: 0 }} />
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <input value={name} onChange={e => setName(e.target.value)} style={{ ...inp, padding: '4px 8px', fontSize: 13 }} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 26, height: 26, border: 'none', padding: 0, cursor: 'pointer', background: 'none', borderRadius: 4 }} />
            <button onClick={() => { updateLayer(layer.id, { name, color }); setEditing(false); }} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: C.cyan, color: C.bg, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${C.borderW}`, background: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
          </div>
        ) : (
          <>
            <button onClick={() => setExpanded(e => !e)} style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, background: 'none', border: 'none', cursor: 'pointer', color: C.text, fontSize: 13, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, padding: 0 }}>
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              {layer.name}
              <span style={{ fontSize: 10, color: C.muted, fontWeight: 400 }}>({layerGeofences.length})</span>
            </button>
            <button onClick={() => toggleLayerVisibility(layer.id)} title={layer.is_visible ? 'Hide layer' : 'Show layer'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.is_visible ? C.cyan : C.muted, display: 'flex', padding: 3 }}>
              {layer.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 11, fontFamily: 'DM Sans, sans-serif', padding: '3px 6px' }}>Rename</button>
            <button onClick={() => deleteLayer(layer.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.red, display: 'flex', padding: 3 }}><X size={12} /></button>
          </>
        )}
      </div>

      {/* Geofences in this layer */}
      {expanded && (
        <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.borderW}` }}>
          {layerGeofences.length === 0 && <div style={{ fontSize: 12, color: C.dim, fontStyle: 'italic', marginBottom: 8 }}>No geofences in this layer yet</div>}
          {layerGeofences.map(g => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 5, marginBottom: 2, background: 'rgba(255,255,255,.02)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, color: C.text }}>{g.name}</span>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'capitalize' }}>{g.zone_type}</span>
              <button onClick={() => removeGeofenceFromLayer(layer.id, g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 2 }}><X size={11} /></button>
            </div>
          ))}
          {/* Add geofence */}
          {unaddedGeofences.length > 0 && (
            addingGf ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <select value={selectedGf} onChange={e => setSelectedGf(e.target.value)} style={{ ...sel, flex: 1, fontSize: 12, padding: '5px 8px' }}>
                  <option value="">— Select geofence —</option>
                  {unaddedGeofences.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button onClick={() => { if (selectedGf) { addGeofenceToLayer(layer.id, selectedGf); setSelectedGf(''); setAddingGf(false); } }} style={{ padding: '5px 10px', borderRadius: 5, border: 'none', background: C.cyan, color: C.bg, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Add</button>
                <button onClick={() => { setAddingGf(false); setSelectedGf(''); }} style={{ padding: '5px 8px', borderRadius: 5, border: `1px solid ${C.borderW}`, background: 'none', color: C.muted, fontSize: 11, cursor: 'pointer' }}>Cancel</button>
              </div>
            ) : (
              <button onClick={() => setAddingGf(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '5px 8px', borderRadius: 5, border: `1px dashed ${C.borderW}`, background: 'none', color: C.muted, cursor: 'pointer', fontSize: 11, width: '100%' }}>
                <Plus size={11} /> Add geofence to layer
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function LayersPanel({ geofences }: { geofences: FMGeofence[] }) {
  const { layers, createLayer } = useFMStore();
  const [newName,  setNewName]  = useState('');
  const [newColor, setNewColor] = useState('#00d4e8');
  const [creating, setCreating] = useState(false);

  return (
    <div style={{ background: 'rgba(255,255,255,.02)', border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: C.cyan }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>Geofence Layers</span>
          <span style={{ fontSize: 11, color: C.muted }}>({layers.length} layers)</span>
        </div>
        <button onClick={() => setCreating(c => !c)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.borderW}`, background: 'rgba(255,255,255,.04)', color: C.muted, cursor: 'pointer', fontSize: 11 }}>
          <Plus size={12} /> New Layer
        </button>
      </div>

      {creating && (
        <div style={{ padding: '12px', borderRadius: 8, background: 'rgba(0,212,232,.05)', border: `1px solid ${C.border}`, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Layer name..." style={{ ...inp, flex: 1, padding: '7px 10px' }} />
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', background: 'none', borderRadius: 4 }} />
          <button onClick={() => { if (newName.trim()) { createLayer(newName.trim(), newColor); setNewName(''); setCreating(false); } }} style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: C.cyan, color: C.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Create</button>
          <button onClick={() => { setCreating(false); setNewName(''); }} style={{ padding: '7px 8px', borderRadius: 6, border: `1px solid ${C.borderW}`, background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        </div>
      )}

      {layers.length === 0 && !creating && (
        <div style={{ textAlign: 'center', color: C.dim, fontSize: 13, padding: '24px 0', fontStyle: 'italic' }}>
          No layers yet. Create a layer to group geofences.
        </div>
      )}

      {layers.map(layer => <LayerRow key={layer.id} layer={layer} geofences={geofences} />)}
    </div>
  );
}

export default function GeofencesTab() {
  const { geofences, createGeofence, updateGeofence, deleteGeofence } = useFMStore();
  const { user } = useAuthStore();
  const canManage = ['admin', 'superadmin'].includes(user?.role || '');

  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [editGf,      setEditGf]      = useState<FMGeofence | null | undefined>(undefined);
  const [deleteGf,    setDeleteGf]    = useState<FMGeofence | null>(null);
  const [error,       setError]       = useState('');

  const filtered = geofences.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !q || g.name.toLowerCase().includes(q);
    const matchType   = typeFilter === 'all' || g.zone_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleDelete = async () => {
    if (!deleteGf) return;
    const result = await deleteGeofence(deleteGf.id);
    if (!result.ok) setError(result.error || 'Delete failed');
    setDeleteGf(null);
  };

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Main table — left 65% */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search geofences..." style={{ ...inp, paddingLeft: 30 }} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', ...ZONE_TYPES].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', background: typeFilter === t ? 'rgba(0,212,232,.2)' : 'rgba(255,255,255,.04)', color: typeFilter === t ? C.cyan : C.muted, textTransform: 'capitalize' }}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          {canManage && (
            <button onClick={() => setEditGf(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.cyan, color: C.bg, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Add Geofence
            </button>
          )}
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

        <Table headers={['Name', 'Type', 'Color', 'Area', 'Speed Limit', 'Alerts', 'Status', '']}>
          {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: '40px 12px', textAlign: 'center', color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>No geofences found</td></tr>}
          {filtered.map(g => (
            <TR key={g.id}>
              <TD>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, color: C.text }}>{g.name}</span>
                </div>
                {g.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, paddingLeft: 18 }}>{g.description}</div>}
              </TD>
              <TD><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.06)', color: C.muted, textTransform: 'capitalize' }}>{g.zone_type}</span></TD>
              <TD><div style={{ width: 20, height: 20, borderRadius: 4, background: g.color }} /></TD>
              <TD muted>{g.area_sqm ? `${(g.area_sqm / 1_000_000).toFixed(2)} km²` : '—'}</TD>
              <TD muted>{g.speed_limit ? `${g.speed_limit} km/h` : '—'}</TD>
              <TD>
                <div style={{ display: 'flex', gap: 4 }}>
                  {g.alert_on_enter && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,212,232,.1)', color: C.cyan }}>Enter</span>}
                  {g.alert_on_exit  && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(245,158,11,.1)', color: C.amber }}>Exit</span>}
                </div>
              </TD>
              <TD><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: g.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', color: g.is_active ? C.green : C.muted }}>{g.is_active ? 'Active' : 'Inactive'}</span></TD>
              <TD right>
                <ActionButtons
                  onEdit={canManage ? () => setEditGf(g) : undefined}
                  onDelete={canManage ? () => setDeleteGf(g) : undefined}
                />
              </TD>
            </TR>
          ))}
        </Table>
      </div>

      {/* Layers panel — right side */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <LayersPanel geofences={geofences} />
      </div>

      {editGf !== undefined && <GeofenceForm geofence={editGf} onSave={editGf ? (p) => updateGeofence(editGf.id, p) : createGeofence} onClose={() => setEditGf(undefined)} />}
      {deleteGf && <ConfirmDelete name={deleteGf.name} entity="geofence" onConfirm={handleDelete} onCancel={() => setDeleteGf(null)} />}
    </div>
  );
}
