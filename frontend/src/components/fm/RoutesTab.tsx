import React, { useState } from 'react';
import { Route, Plus, Search } from 'lucide-react';
import { useFMStore, type FMRoute } from '../../store/fmStore';
import { useAuthStore } from '../../store/authStore';
import { Modal, ConfirmDelete, ErrorBanner, FormRow, FormField, SaveButton, CancelButton, Table, TR, TD, inp, lbl, sel, C } from './FMShared';
import RouteDrawModal from '../map/RouteDrawModal';

const PRESET_COLORS = ['#00d4e8', '#22c55e', '#ef4444', '#f59e0b', '#a78bfa', '#fb923c', '#ec4899'];

function RouteForm({ route, onSave, onClose }: {
  route: FMRoute | null;
  onSave: (p: any) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isEdit = !!route;
  const [form, setForm] = useState({
    name: route?.name || '',
    description: route?.description || '',
    color: route?.color || '#00d4e8',
    duration_min: route?.duration_min?.toString() || '',
    is_active: route?.is_active ?? true,
    coordinates: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const parseCoords = (raw: string): number[][] | null => {
    try {
      const pairs = raw.trim().split(/[,\n]+/).map(p => p.trim().split(/\s+/).map(Number));
      if (pairs.some(p => p.length !== 2 || p.some(isNaN))) return null;
      return pairs;
    } catch { return null; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    const payload: any = {
      name: form.name, description: form.description || null,
      color: form.color,
      duration_min: form.duration_min ? Number(form.duration_min) : null,
      is_active: form.is_active,
    };
    if (!isEdit || form.coordinates) {
      if (!form.coordinates && !isEdit) { setError('Coordinates are required for new routes'); setSaving(false); return; }
      if (form.coordinates) {
        const coords = parseCoords(form.coordinates);
        if (!coords || coords.length < 2) { setError('Invalid coordinates. Need at least 2 points: "lng lat, lng lat, ..."'); setSaving(false); return; }
        payload.coordinates = coords;
      }
    }
    const result = await onSave(payload);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit Route' : 'Create Route'} subtitle={isEdit ? route?.name : 'Define a bus/vehicle route'} onClose={onClose} width={560}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <FormRow>
          <FormField label="Name *"><input value={form.name} onChange={setField('name')} style={inp} required placeholder="Canal Road Route" /></FormField>
          <FormField label="Est. Duration (min)"><input type="number" value={form.duration_min} onChange={setField('duration_min')} style={inp} placeholder="Optional" min={1} /></FormField>
        </FormRow>
        <FormField label="Description">
          <textarea value={form.description} onChange={setField('description')} style={{ ...inp, height: 50, resize: 'vertical' }} placeholder="Optional description..." />
        </FormField>
        <FormRow>
          <FormField label="Status">
            <select value={form.is_active ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))} style={sel}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
          <FormField label="Color">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {PRESET_COLORS.map(c => (
                <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #fff' : '2px solid transparent', boxSizing: 'border-box' }}
                />
              ))}
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: 22, height: 22, border: 'none', padding: 0, cursor: 'pointer', background: 'none', borderRadius: '50%' }} />
            </div>
          </FormField>
        </FormRow>
        <FormField label={isEdit ? 'Update Path Coordinates (optional — leave blank to keep existing)' : 'Path Coordinates *'}>
          <textarea
            value={form.coordinates}
            onChange={setField('coordinates')}
            style={{ ...inp, height: 80, resize: 'vertical', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
            placeholder={'Longitude Latitude pairs, one per line or comma-separated:\n74.38 31.45\n74.45 31.50\n74.52 31.55'}
            required={!isEdit}
          />
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            Format: <code style={{ background: 'rgba(255,255,255,.06)', padding: '1px 5px', borderRadius: 3 }}>longitude latitude</code> — min 2 points. Or use "Draw Route" for interactive drawing.
          </div>
        </FormField>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={isEdit ? 'Save Changes' : 'Create Route'} />
        </div>
      </form>
    </Modal>
  );
}

// Associate Route to Vehicle modal
export function AssignRouteModal({ vehicleId, vehicleReg, currentRouteId, onClose }: {
  vehicleId: string; vehicleReg: string; currentRouteId?: string; onClose: () => void;
}) {
  const { routes, assignVehicleRoute } = useFMStore();
  const [selected, setSelected] = useState(currentRouteId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    setSaving(true);
    const result = await assignVehicleRoute(vehicleId, selected || null);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title="Associate Route" subtitle={`Associate a route to ${vehicleReg}`} onClose={onClose} width={440}>
      <form onSubmit={(e) => { e.preventDefault(); handle(); }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Select Route</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ ...sel, width: '100%' }}>
            <option value="">— No Route —</option>
            {routes.filter(r => r.is_active).map(r => (
              <option key={r.id} value={r.id}>
                {r.name}{r.computed_distance_km ? ` — ${Number(r.computed_distance_km).toFixed(1)} km` : ''}
              </option>
            ))}
          </select>
          {selected && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,212,232,.08)', borderRadius: 7, fontSize: 12 }}>
              <span style={{ color: C.cyan }}>Selected: {routes.find(r => r.id === selected)?.name}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={selected ? 'Associate Route' : 'Remove Route'} />
        </div>
      </form>
    </Modal>
  );
}

export default function RoutesTab() {
  const { routes, createRoute, updateRoute, deleteRoute } = useFMStore();
  const { user } = useAuthStore();
  const canManage = ['admin', 'superadmin'].includes(user?.role || '');

  const [search, setSearch] = useState('');
  const [editRoute, setEditRoute] = useState<FMRoute | null | undefined>(undefined);
  const [drawRoute, setDrawRoute] = useState<FMRoute | null | undefined>(undefined);
  const [deleteRoute_, setDeleteRoute_] = useState<FMRoute | null>(null);
  const [error, setError] = useState('');

  const filtered = routes.filter(r => {
    const q = search.toLowerCase();
    return !q || r.name.toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!deleteRoute_) return;
    const result = await deleteRoute(deleteRoute_.id);
    if (!result.ok) setError(result.error || 'Delete failed');
    setDeleteRoute_(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search routes..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        {canManage && (
          <>
            <button onClick={() => setEditRoute(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: `1px solid rgba(255,255,255,.07)`, background: 'rgba(255,255,255,.04)', color: '#8da4c2', fontFamily: 'DM Sans, sans-serif', fontSize: 13, cursor: 'pointer' }}>
              <Plus size={14} /> Add Route (Text)
            </button>
            <button onClick={() => setDrawRoute(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.cyan, color: C.bg, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Route size={14} /> Draw Route
            </button>
          </>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <Table headers={['Route', 'Color', 'Distance', 'Duration', 'Vehicles', 'Status', '']}>
        {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: '40px 12px', textAlign: 'center', color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>No routes found</td></tr>}
        {filtered.map(r => (
          <TR key={r.id}>
            <TD>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 6, borderRadius: 3, background: r.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: C.text }}>{r.name}</div>
                  {r.description && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{r.description}</div>}
                </div>
              </div>
            </TD>
            <TD><div style={{ width: 20, height: 20, borderRadius: 4, background: r.color }} /></TD>
            <TD muted>{r.computed_distance_km ? `${Number(r.computed_distance_km).toFixed(1)} km` : '—'}</TD>
            <TD muted>{r.duration_min ? `${r.duration_min} min` : '—'}</TD>
            <TD mono><span style={{ color: C.cyan }}>{r.vehicle_count || 0}</span></TD>
            <TD><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: r.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)', color: r.is_active ? C.green : C.muted }}>{r.is_active ? 'Active' : 'Inactive'}</span></TD>
            <TD right>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {canManage && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setDrawRoute(r); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(255,255,255,.07)`, background: 'rgba(255,255,255,.04)', color: '#8da4c2', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      Edit
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteRoute_(r); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(239,68,68,.25)`, background: 'rgba(239,68,68,.08)', color: C.red, cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </Table>

      {editRoute !== undefined && (
        <RouteForm route={editRoute} onSave={editRoute ? (p) => updateRoute(editRoute.id, p) : createRoute} onClose={() => setEditRoute(undefined)} />
      )}
      {drawRoute !== undefined && (
        <RouteDrawModal routeToEdit={drawRoute} onClose={() => setDrawRoute(undefined)} />
      )}
      {deleteRoute_ && <ConfirmDelete name={deleteRoute_.name} entity="route" onConfirm={handleDelete} onCancel={() => setDeleteRoute_(null)} />}
    </div>
  );
}
