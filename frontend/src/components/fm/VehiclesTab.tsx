import React, { useState } from 'react';
import { Truck, Search } from 'lucide-react';
import { useFMStore, type FMVehicle } from '../../store/fmStore';
import { useAuthStore } from '../../store/authStore';
import { Modal, ConfirmDelete, ErrorBanner, FormRow, FormField, SaveButton, CancelButton, StatusBadge, Table, TR, TD, inp, lbl, sel, C } from './FMShared';
import { AssignRouteModal } from './RoutesTab';

const V_TYPES  = ['truck', 'van', 'car', 'bus', 'motorcycle', 'heavy'];
const V_STATUS = ['active', 'idle', 'offline', 'maintenance', 'alert'];
const FUEL_TYPES = ['diesel', 'petrol', 'hybrid', 'electric', 'cng'];
const TYPE_EMOJI: Record<string, string> = { truck: '🚛', van: '🚐', car: '🚗', bus: '🚌', motorcycle: '🏍', heavy: '🚜' };

function VehicleForm({ vehicle, onSave, onClose }: {
  vehicle: FMVehicle | null;
  onSave: (p: any) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isEdit = !!vehicle;
  const { depots } = useFMStore();
  const [form, setForm] = useState({
    registration:       vehicle?.registration        || '',
    make:               vehicle?.make                || '',
    model:              vehicle?.model               || '',
    year:               vehicle?.year                || new Date().getFullYear(),
    type:               vehicle?.type                || 'truck',
    color:              vehicle?.color               || '',
    vin:                vehicle?.vin                 || '',
    fuel_capacity:      vehicle?.fuel_capacity       || 60,
    fuel_type:          vehicle?.fuel_type           || 'diesel',
    max_speed:          vehicle?.max_speed           || 120,
    payload_capacity:   vehicle?.payload_capacity    || '',
    seats:              vehicle?.seats               || '',
    depot_id:           vehicle?.depot_id            || '',
    insurance_expiry:   vehicle?.insurance_expiry    || '',
    registration_expiry:vehicle?.registration_expiry || '',
    last_service_date:  vehicle?.last_service_date   || '',
    notes:              vehicle?.notes               || '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSaving(true);
    const result = await onSave({ ...form, depot_id: form.depot_id || null, payload_capacity: form.payload_capacity || null, seats: form.seats || null });
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit Vehicle' : 'Add Vehicle'} subtitle={isEdit ? vehicle?.registration : 'Register a new vehicle to your fleet'} onClose={onClose} width={600}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <FormRow cols={3}>
          <FormField label="Registration *"><input value={form.registration} onChange={set('registration')} style={inp} required placeholder="LHR-001" disabled={isEdit} /></FormField>
          <FormField label="Make *"><input value={form.make} onChange={set('make')} style={inp} required placeholder="Isuzu" /></FormField>
          <FormField label="Model *"><input value={form.model} onChange={set('model')} style={inp} required placeholder="NPR" /></FormField>
        </FormRow>
        <FormRow cols={3}>
          <FormField label="Year *"><input type="number" value={form.year} onChange={set('year')} style={inp} required min={1990} max={2030} /></FormField>
          <FormField label="Type">
            <select value={form.type} onChange={set('type')} style={sel}>
              {V_TYPES.map(t => <option key={t} value={t}>{TYPE_EMOJI[t]} {t}</option>)}
            </select>
          </FormField>
          <FormField label="Color"><input value={form.color} onChange={set('color')} style={inp} placeholder="White" /></FormField>
        </FormRow>
        <FormRow cols={3}>
          <FormField label="Fuel Type">
            <select value={form.fuel_type} onChange={set('fuel_type')} style={sel}>
              {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </FormField>
          <FormField label="Fuel Capacity (L)"><input type="number" value={form.fuel_capacity} onChange={set('fuel_capacity')} style={inp} min={1} /></FormField>
          <FormField label="Max Speed (km/h)"><input type="number" value={form.max_speed} onChange={set('max_speed')} style={inp} min={1} /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Payload (kg)"><input type="number" value={form.payload_capacity} onChange={set('payload_capacity')} style={inp} placeholder="Optional" /></FormField>
          <FormField label="Seats"><input type="number" value={form.seats} onChange={set('seats')} style={inp} placeholder="Optional" /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="VIN"><input value={form.vin} onChange={set('vin')} style={inp} placeholder="Optional" /></FormField>
          <FormField label="Depot">
            <select value={form.depot_id} onChange={set('depot_id')} style={sel}>
              <option value="">— No depot —</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
        </FormRow>
        <FormRow cols={3}>
          <FormField label="Insurance Expiry"><input type="date" value={form.insurance_expiry} onChange={set('insurance_expiry')} style={inp} /></FormField>
          <FormField label="Reg. Expiry"><input type="date" value={form.registration_expiry} onChange={set('registration_expiry')} style={inp} /></FormField>
          <FormField label="Last Service"><input type="date" value={form.last_service_date} onChange={set('last_service_date')} style={inp} /></FormField>
        </FormRow>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={isEdit ? 'Save Changes' : 'Add Vehicle'} />
        </div>
      </form>
    </Modal>
  );
}

function AssignDriverModal({ vehicle, onClose }: { vehicle: FMVehicle; onClose: () => void }) {
  const { drivers, assignVehicleDriver } = useFMStore();
  const [selected, setSelected] = useState(vehicle.driver_id || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const available = drivers.filter(d => d.status === 'active' && (!d.vehicle_id || d.vehicle_id === vehicle.id));

  const handle = async () => {
    setSaving(true);
    const result = await assignVehicleDriver(vehicle.id, selected || null);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title="Assign Driver" subtitle={`Assign a driver to ${vehicle.registration}`} onClose={onClose} width={440}>
      <form onSubmit={(e) => { e.preventDefault(); handle(); }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Select Driver</label>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={{ ...sel, width: '100%' }}>
            <option value="">— Unassign driver —</option>
            {available.map(d => (
              <option key={d.id} value={d.id}>{d.full_name} ({d.employee_id}) — Score: {Math.round(d.safety_score)}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={selected ? 'Assign Driver' : 'Unassign Driver'} />
        </div>
      </form>
    </Modal>
  );
}

function QrCodeModal({ vehicle, onClose }: { vehicle: FMVehicle; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(vehicle.qr_code || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <Modal title="Vehicle QR Code" subtitle={`QR for ${vehicle.registration}`} onClose={onClose} width={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <div style={{ padding: 20, background: 'rgba(0,212,232,.05)', border: `1px solid ${C.border}`, borderRadius: 12, textAlign: 'center', width: '100%' }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>QR Payload</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: C.cyan, wordBreak: 'break-all', padding: '12px 16px', background: 'rgba(0,212,232,.08)', borderRadius: 8, border: `1px solid ${C.border}` }}>
            {vehicle.qr_code || 'No QR code assigned'}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 12, lineHeight: 1.6 }}>
            This payload is encoded in the physical QR code printed on the bus. Driver scans it to pair with this vehicle.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: `1px solid rgba(255,255,255,.07)`, color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Close</button>
          <button onClick={copy} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: copied ? C.green : C.cyan, color: C.bg, cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14 }}>
            {copied ? '✓ Copied!' : 'Copy QR Payload'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function VehiclesTab() {
  const { vehicles, createVehicle, updateVehicle, deleteVehicle } = useFMStore();
  const { user } = useAuthStore();
  const canEdit = ['admin', 'superadmin', 'operator'].includes(user?.role || '');
  const canManage = ['admin', 'superadmin'].includes(user?.role || '');

  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editVeh,    setEditVeh]    = useState<FMVehicle | null | undefined>(undefined);
  const [assignVeh,  setAssignVeh]  = useState<FMVehicle | null>(null);
  const [routeVeh,   setRouteVeh]   = useState<FMVehicle | null>(null);
  const [qrVeh,      setQrVeh]      = useState<FMVehicle | null>(null);
  const [deleteVeh,  setDeleteVeh]  = useState<FMVehicle | null>(null);
  const [error,      setError]      = useState('');

  const filtered = vehicles.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.registration.toLowerCase().includes(q) || `${v.make} ${v.model}`.toLowerCase().includes(q);
    const matchType   = typeFilter === 'all' || v.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleDelete = async () => {
    if (!deleteVeh) return;
    const result = await deleteVehicle(deleteVeh.id);
    if (!result.ok) setError(result.error || 'Delete failed');
    setDeleteVeh(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search registration, make..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', ...V_TYPES].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{ padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif', background: typeFilter === t ? 'rgba(0,212,232,.2)' : 'rgba(255,255,255,.04)', color: typeFilter === t ? C.cyan : C.muted }}>
              {t === 'all' ? 'All' : `${TYPE_EMOJI[t]} ${t}`}
            </button>
          ))}
        </div>
        {canManage && (
          <button onClick={() => setEditVeh(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.cyan, color: C.bg, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <Truck size={14} /> Add Vehicle
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <Table headers={['Vehicle', 'Type', 'Status', 'Fuel', 'Driver', 'Route', 'Health', 'Insurance', '']}>
        {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: '40px 12px', textAlign: 'center', color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>No vehicles found</td></tr>}
        {filtered.map(v => (
          <TR key={v.id}>
            <TD>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.cyan, fontFamily: 'JetBrains Mono, monospace' }}>{v.registration}</span>
                <div style={{ fontSize: 11, color: C.muted }}>{v.make} {v.model} {v.year}</div>
              </div>
            </TD>
            <TD><span style={{ fontSize: 14 }}>{TYPE_EMOJI[v.type]}</span> <span style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>{v.type}</span></TD>
            <TD><StatusBadge status={v.status} /></TD>
            <TD mono>{v.current_fuel != null ? <span style={{ color: v.current_fuel < 20 ? C.red : C.amber }}>{Math.round(v.current_fuel)}%</span> : '—'}</TD>
            <TD>
              {v.driver_name
                ? <span style={{ fontSize: 12, color: C.text }}>{v.driver_name}</span>
                : <span style={{ fontSize: 11, color: C.dim }}>Unassigned</span>}
            </TD>
            <TD>
              {v.route_name
                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(0,212,232,.1)', color: C.cyan, borderLeft: `3px solid ${v.route_color || C.cyan}`, paddingLeft: 8 }}>{v.route_name}</span>
                : <span style={{ color: C.dim, fontSize: 11 }}>No Route</span>}
            </TD>
            <TD mono>
              {v.health_score != null
                ? <span style={{ color: v.health_score >= 80 ? C.green : v.health_score >= 60 ? C.amber : C.red }}>{Math.round(v.health_score)}</span>
                : '—'}
            </TD>
            <TD muted>
              {v.insurance_expiry
                ? (() => { const days = Math.ceil((new Date(v.insurance_expiry).getTime() - Date.now()) / 86400000); return <span style={{ color: days < 30 ? C.red : days < 90 ? C.amber : C.muted }}>{new Date(v.insurance_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}</span>; })()
                : '—'}
            </TD>
            <TD right>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {canEdit && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setAssignVeh(v); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(255,255,255,.07)`, background: 'rgba(255,255,255,.04)', color: C.cyan, cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      Assign Driver
                    </button>
                    <button onClick={e => { e.stopPropagation(); setRouteVeh(v); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(0,212,232,.2)`, background: 'rgba(0,212,232,.06)', color: C.cyan, cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      Route
                    </button>
                    <button onClick={e => { e.stopPropagation(); setQrVeh(v); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(255,255,255,.07)`, background: 'rgba(255,255,255,.04)', color: '#8da4c2', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      QR
                    </button>
                  </>
                )}
                {canManage && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setEditVeh(v); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(255,255,255,.07)`, background: 'rgba(255,255,255,.04)', color: '#8da4c2', cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      Edit
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteVeh(v); }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid rgba(239,68,68,.25)`, background: 'rgba(239,68,68,.08)', color: C.red, cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif' }}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </TD>
          </TR>
        ))}
      </Table>

      {editVeh !== undefined && <VehicleForm vehicle={editVeh} onSave={editVeh ? (p) => updateVehicle(editVeh.id, p) : createVehicle} onClose={() => setEditVeh(undefined)} />}
      {assignVeh && <AssignDriverModal vehicle={assignVeh} onClose={() => setAssignVeh(null)} />}
      {routeVeh && <AssignRouteModal vehicleId={routeVeh.id} vehicleReg={routeVeh.registration} currentRouteId={routeVeh.route_id} onClose={() => setRouteVeh(null)} />}
      {qrVeh && <QrCodeModal vehicle={qrVeh} onClose={() => setQrVeh(null)} />}
      {deleteVeh && <ConfirmDelete name={deleteVeh.registration} entity="vehicle" onConfirm={handleDelete} onCancel={() => setDeleteVeh(null)} />}
    </div>
  );
}
