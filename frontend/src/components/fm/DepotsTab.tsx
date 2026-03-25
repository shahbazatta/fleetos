import React, { useState } from 'react';
import { Warehouse, Plus, Search } from 'lucide-react';
import { useFMStore, type Depot } from '../../store/fmStore';
import { useAuthStore } from '../../store/authStore';
import { Modal, ConfirmDelete, ErrorBanner, FormRow, FormField, SaveButton, CancelButton, Table, TR, TD, ActionButtons, inp, lbl, C } from './FMShared';

function DepotForm({ depot, onSave, onClose }: {
  depot: Depot | null;
  onSave: (p: any) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isEdit = !!depot;
  const [form, setForm] = useState({
    name:     depot?.name    || '',
    address:  depot?.address || '',
    city:     depot?.city    || '',
    lat:      depot?.lat     || '',
    lng:      depot?.lng     || '',
    capacity: depot?.capacity || 50,
    manager:  depot?.manager || '',
    phone:    depot?.phone   || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    if (!isEdit && (!form.lat || !form.lng)) { setError('Latitude and longitude are required'); setSaving(false); return; }
    const payload = {
      ...form,
      lat:      form.lat ? parseFloat(String(form.lat)) : undefined,
      lng:      form.lng ? parseFloat(String(form.lng)) : undefined,
      capacity: parseInt(String(form.capacity)),
    };
    const result = await onSave(payload);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit Depot' : 'Add Depot'} subtitle={isEdit ? depot?.name : 'Register a new depot or base location'} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <FormRow>
          <FormField label="Depot Name *"><input value={form.name} onChange={set('name')} style={inp} required placeholder="Raiwind Road Depot" /></FormField>
          <FormField label="Capacity (vehicles)"><input type="number" value={form.capacity} onChange={set('capacity')} style={inp} min={1} /></FormField>
        </FormRow>
        <FormField label="Address">
          <input value={form.address} onChange={set('address')} style={inp} placeholder="Full street address" />
        </FormField>
        <FormRow>
          <FormField label="City"><input value={form.city} onChange={set('city')} style={inp} placeholder="Lahore" /></FormField>
          <FormField label="Phone"><input value={form.phone} onChange={set('phone')} style={inp} placeholder="+92-42-..." /></FormField>
        </FormRow>
        <FormField label="Manager Name">
          <input value={form.manager} onChange={set('manager')} style={inp} placeholder="Depot manager name" />
        </FormField>
        <div>
          <label style={lbl}>Location (GPS Coordinates) {!isEdit && '*'}</label>
          <FormRow>
            <FormField label="Latitude">
              <input type="number" step="any" value={form.lat} onChange={set('lat')} style={inp} placeholder="31.4800" required={!isEdit} />
            </FormField>
            <FormField label="Longitude">
              <input type="number" step="any" value={form.lng} onChange={set('lng')} style={inp} placeholder="74.3200" required={!isEdit} />
            </FormField>
          </FormRow>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>
            Tip: right-click any location in Google Maps → "What's here?" to get coordinates.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={isEdit ? 'Save Changes' : 'Add Depot'} />
        </div>
      </form>
    </Modal>
  );
}

// Assign vehicles/drivers to depot dialog
function AssignToDepotModal({ depot, onClose }: { depot: Depot; onClose: () => void }) {
  const { vehicles, drivers, updateVehicle, updateDriver } = useFMStore();
  const [tab,       setTab]       = useState<'vehicles' | 'drivers'>('vehicles');
  const [saving,    setSaving]    = useState<string | null>(null);
  const [error,     setError]     = useState('');

  const depotVehicles = vehicles.filter(v => v.depot_id === depot.id);
  const depotDrivers  = drivers.filter(d => d.depot_id === depot.id);
  const otherVehicles = vehicles.filter(v => v.depot_id !== depot.id);
  const otherDrivers  = drivers.filter(d => d.depot_id !== depot.id && d.status === 'active');

  const assignVehicle = async (vehicleId: string, assign: boolean) => {
    setSaving(vehicleId);
    await updateVehicle(vehicleId, { depot_id: assign ? depot.id : null });
    setSaving(null);
  };

  const assignDriver = async (driverId: string, assign: boolean) => {
    setSaving(driverId);
    await updateDriver(driverId, { depot_id: assign ? depot.id : null });
    setSaving(null);
  };

  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.borderW}`, fontSize: 13 };

  return (
    <Modal title={`Manage Assignments — ${depot.name}`} subtitle={`Assign vehicles and drivers to this depot`} onClose={onClose} width={520}>
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.borderW}`, marginBottom: 16 }}>
        {(['vehicles', 'drivers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t ? `2px solid ${C.cyan}` : '2px solid transparent', color: tab === t ? C.cyan : C.muted, fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, textTransform: 'capitalize' }}>
            {t} ({tab === 'vehicles' ? (t === 'vehicles' ? depotVehicles.length : depotDrivers.length) : (t === 'vehicles' ? depotVehicles.length : depotDrivers.length)})
          </button>
        ))}
      </div>

      {tab === 'vehicles' && (
        <div>
          {depotVehicles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>In this depot</div>
              {depotVehicles.map(v => (
                <div key={v.id} style={rowStyle}>
                  <span><span style={{ fontFamily: 'JetBrains Mono, monospace', color: C.cyan }}>{v.registration}</span> <span style={{ color: C.muted, fontSize: 11 }}>{v.make} {v.model}</span></span>
                  <button onClick={() => assignVehicle(v.id, false)} disabled={saving === v.id} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: C.red, cursor: 'pointer', fontSize: 11 }}>Remove</button>
                </div>
              ))}
            </div>
          )}
          {otherVehicles.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Available to assign</div>
              {otherVehicles.map(v => (
                <div key={v.id} style={rowStyle}>
                  <span><span style={{ fontFamily: 'JetBrains Mono, monospace', color: C.text }}>{v.registration}</span> <span style={{ color: C.muted, fontSize: 11 }}>{v.make} {v.model} · {v.depot_name || 'no depot'}</span></span>
                  <button onClick={() => assignVehicle(v.id, true)} disabled={saving === v.id} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'rgba(0,212,232,.08)', color: C.cyan, cursor: 'pointer', fontSize: 11 }}>
                    {saving === v.id ? '...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'drivers' && (
        <div>
          {depotDrivers.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>In this depot</div>
              {depotDrivers.map(d => (
                <div key={d.id} style={rowStyle}>
                  <span style={{ color: C.text }}>{d.full_name} <span style={{ color: C.muted, fontSize: 11 }}>({d.employee_id})</span></span>
                  <button onClick={() => assignDriver(d.id, false)} disabled={saving === d.id} style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: C.red, cursor: 'pointer', fontSize: 11 }}>Remove</button>
                </div>
              ))}
            </div>
          )}
          {otherDrivers.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Available to assign</div>
              {otherDrivers.map(d => (
                <div key={d.id} style={rowStyle}>
                  <span style={{ color: C.text }}>{d.full_name} <span style={{ color: C.muted, fontSize: 11 }}>{d.depot_name ? `· ${d.depot_name}` : '· no depot'}</span></span>
                  <button onClick={() => assignDriver(d.id, true)} disabled={saving === d.id} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'rgba(0,212,232,.08)', color: C.cyan, cursor: 'pointer', fontSize: 11 }}>
                    {saving === d.id ? '...' : 'Assign'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function DepotsTab() {
  const { depots, createDepot, updateDepot, deleteDepot } = useFMStore();
  const { user } = useAuthStore();
  const canManage = ['admin', 'superadmin'].includes(user?.role || '');
  const canAssign = ['admin', 'superadmin', 'operator'].includes(user?.role || '');

  const [search,      setSearch]      = useState('');
  const [editDepot,   setEditDepot]   = useState<Depot | null | undefined>(undefined);
  const [assignDepot, setAssignDepot] = useState<Depot | null>(null);
//  const [deleteDepot, setDeleteDepot] = useState<Depot | null>(null);
  const [error,       setError]       = useState('');

  const filtered = depots.filter(d => {
    const q = search.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || (d.city || '').toLowerCase().includes(q);
  });

  const handleDelete = async () => {
    if (!deleteDepot) return;
    const result = await (useFMStore.getState()).deleteDepot(deleteDepot.id);
    if (!result.ok) setError(result.error || 'Delete failed');
    setDeleteDepot(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search depots..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        {canManage && (
          <button onClick={() => setEditDepot(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.cyan, color: C.bg, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Warehouse size={14} /> Add Depot
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: C.muted, padding: '40px 0', fontFamily: 'DM Sans, sans-serif' }}>No depots found</div>
        )}
        {filtered.map(d => (
          <div key={d.id} style={{ background: C.surface, border: `1px solid ${d.is_active ? C.border : 'rgba(239,68,68,.15)'}`, borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: 'rgba(0,212,232,.1)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Warehouse size={18} style={{ color: C.cyan }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: 'DM Sans, sans-serif' }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{d.city || d.address || '—'}</div>
                </div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: d.is_active ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: d.is_active ? C.green : C.red }}>
                {d.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Capacity', value: d.capacity },
                { label: 'Vehicles', value: d.vehicle_count ?? 0 },
                { label: 'Drivers',  value: d.driver_count  ?? 0 },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 6, padding: '7px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {(d.manager || d.phone) && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
                {d.manager && <div>👤 {d.manager}</div>}
                {d.phone   && <div>📞 {d.phone}</div>}
                {(d.lat && d.lng) && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.dim }}>{Number(d.lat).toFixed(4)}, {Number(d.lng).toFixed(4)}</div>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: `1px solid ${C.borderW}` }}>
              {canAssign && <button onClick={() => setAssignDepot(d)} style={{ flex: 1, padding: '7px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'rgba(0,212,232,.08)', color: C.cyan, cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Manage Assignments</button>}
              {canManage && <button onClick={() => setEditDepot(d)} style={{ padding: '7px 10px', borderRadius: 7, border: `1px solid ${C.borderW}`, background: 'rgba(255,255,255,.04)', color: '#8da4c2', cursor: 'pointer', fontSize: 12 }}>Edit</button>}
              {canManage && <button onClick={() => setDeleteDepot(d)} style={{ padding: '7px 8px', borderRadius: 7, border: '1px solid rgba(239,68,68,.2)', background: 'rgba(239,68,68,.08)', color: C.red, cursor: 'pointer' }}><span style={{ fontSize: 12 }}>✕</span></button>}
            </div>
          </div>
        ))}
      </div>

      {editDepot !== undefined && <DepotForm depot={editDepot} onSave={editDepot ? (p) => updateDepot(editDepot.id, p) : createDepot} onClose={() => setEditDepot(undefined)} />}
      {assignDepot && <AssignToDepotModal depot={assignDepot} onClose={() => setAssignDepot(null)} />}
      {deleteDepot && <ConfirmDelete name={deleteDepot.name} entity="depot" onConfirm={handleDelete} onCancel={() => setDeleteDepot(null)} />}
    </div>
  );
}
