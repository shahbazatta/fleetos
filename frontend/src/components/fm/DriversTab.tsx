import React, { useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { useFMStore, type FMDriver } from '../../store/fmStore';
import { useAuthStore } from '../../store/authStore';
import { Modal, ConfirmDelete, ErrorBanner, FormRow, FormField, SaveButton, CancelButton, StatusBadge, Table, TR, TD, ActionButtons, inp, lbl, sel, C } from './FMShared';

const DRIVER_STATUSES = ['active', 'inactive', 'on_leave', 'suspended'];
const LICENSE_CLASSES = ['LTV', 'HTV', 'PSV', 'Motorcycle'];

function DriverForm({ driver, onSave, onClose }: {
  driver: FMDriver | null;
  onSave: (p: any) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isEdit = !!driver;
  const [form, setForm] = useState({
    employee_id:       driver?.employee_id       || '',
    full_name:         driver?.full_name         || '',
    phone:             driver?.phone             || '',
    email:             driver?.email             || '',
    license_number:    driver?.license_number    || '',
    license_class:     driver?.license_class     || 'LTV',
    license_expiry:    driver?.license_expiry    || '',
    status:            driver?.status            || 'active',
    emergency_contact: driver?.emergency_contact || '',
    depot_id:          driver?.depot_id          || '',
  });
  const { depots } = useFMStore();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = { ...form, depot_id: form.depot_id || null };
    const result = await onSave(payload);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title={isEdit ? 'Edit Driver' : 'Add Driver'} subtitle={isEdit ? driver?.full_name : 'Register a new driver to your fleet'} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
        <FormRow>
          <FormField label="Full Name *"><input value={form.full_name} onChange={set('full_name')} style={inp} required placeholder="Ahmed Raza" /></FormField>
          <FormField label="Employee ID *"><input value={form.employee_id} onChange={set('employee_id')} style={inp} required placeholder="EMP-001" disabled={isEdit} /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Phone"><input value={form.phone} onChange={set('phone')} style={inp} placeholder="+92-300-..." /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={set('email')} style={inp} placeholder="driver@company.com" /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="License Number *"><input value={form.license_number} onChange={set('license_number')} style={inp} required placeholder="LHR-DL-001" /></FormField>
          <FormField label="License Class">
            <select value={form.license_class} onChange={set('license_class')} style={sel}>
              {LICENSE_CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="License Expiry *"><input type="date" value={form.license_expiry} onChange={set('license_expiry')} style={inp} required /></FormField>
          <FormField label="Status">
            <select value={form.status} onChange={set('status')} style={sel}>
              {DRIVER_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </FormField>
        </FormRow>
        <FormRow>
          <FormField label="Home Depot">
            <select value={form.depot_id} onChange={set('depot_id')} style={sel}>
              <option value="">— No depot —</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FormField>
          <FormField label="Emergency Contact"><input value={form.emergency_contact} onChange={set('emergency_contact')} style={inp} placeholder="+92-..." /></FormField>
        </FormRow>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <CancelButton onClick={onClose} />
          <SaveButton saving={saving} label={isEdit ? 'Save Changes' : 'Add Driver'} />
        </div>
      </form>
    </Modal>
  );
}

function AssignDriverModal({ driver, onClose }: { driver: FMDriver; onClose: () => void }) {
  const { vehicles, assignDriver } = useFMStore();
  const [selected, setSelected] = useState(driver.vehicle_id || '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const availableVehicles = vehicles.filter(v => !v.driver_id || v.driver_id === driver.id);

  const handle = async () => {
    setSaving(true);
    const result = await assignDriver(driver.id, selected || null);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  return (
    <Modal title="Assign Vehicle" subtitle={`Assign a vehicle to ${driver.full_name}`} onClose={onClose} width={440}>
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>Select Vehicle</label>
        <select value={selected} onChange={e => setSelected(e.target.value)} style={{ ...sel, width: '100%' }}>
          <option value="">— Unassign (no vehicle) —</option>
          {availableVehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.registration} — {v.make} {v.model} ({v.status})
            </option>
          ))}
        </select>
        {selected && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(0,212,232,.08)', borderRadius: 7, fontSize: 12, color: C.cyan }}>
            Selected: {vehicles.find(v => v.id === selected)?.registration}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <CancelButton onClick={onClose} />
        <SaveButton saving={saving} label={selected ? 'Assign Vehicle' : 'Unassign'} />
      </div>
    </Modal>
  );
}

export default function DriversTab() {
  const { drivers, createDriver, updateDriver, deleteDriver } = useFMStore();
  const { user } = useAuthStore();
  const canEdit = ['admin', 'superadmin', 'operator'].includes(user?.role || '');
  const canManage = ['admin', 'superadmin'].includes(user?.role || '');

  const [search,    setSearch]    = useState('');
  const [editDriver, setEditDriver] = useState<FMDriver | null | undefined>(undefined);
  const [assignDrv,  setAssignDrv]  = useState<FMDriver | null>(null);
  const [deleteDrv,  setDeleteDrv]  = useState<FMDriver | null>(null);
  const [error,      setError]      = useState('');

  const filtered = drivers.filter(d => {
    const q = search.toLowerCase();
    return !q || d.full_name.toLowerCase().includes(q) || d.employee_id.toLowerCase().includes(q) || (d.phone || '').includes(q);
  });

  const handleDelete = async () => {
    if (!deleteDrv) return;
    const result = await deleteDriver(deleteDrv.id);
    if (!result.ok) setError(result.error || 'Delete failed');
    setDeleteDrv(null);
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search drivers..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        {canManage && (
          <button onClick={() => setEditDriver(null)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', background: C.cyan, color: C.bg, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <UserPlus size={14} /> Add Driver
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <Table headers={['Driver', 'Employee ID', 'License', 'Expiry', 'Status', 'Vehicle', 'Depot', 'Score', '']}>
        {filtered.length === 0 && (
          <tr><td colSpan={9} style={{ padding: '40px 12px', textAlign: 'center', color: C.muted, fontFamily: 'DM Sans, sans-serif' }}>No drivers found</td></tr>
        )}
        {filtered.map(d => (
          <TR key={d.id}>
            <TD>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,212,232,.12)', border: '1px solid rgba(0,212,232,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.cyan, flexShrink: 0 }}>
                  {d.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.full_name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{d.phone || d.email || '—'}</div>
                </div>
              </div>
            </TD>
            <TD mono>{d.employee_id}</TD>
            <TD mono>{d.license_number} <span style={{ fontSize: 10, color: C.muted }}>({d.license_class})</span></TD>
            <TD muted>{d.license_expiry ? new Date(d.license_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</TD>
            <TD><StatusBadge status={d.status} /></TD>
            <TD>
              {d.vehicle_reg
                ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(34,197,94,.1)', color: C.green, fontFamily: 'JetBrains Mono, monospace' }}>{d.vehicle_reg}</span>
                : <span style={{ color: C.dim, fontSize: 11 }}>Unassigned</span>}
            </TD>
            <TD muted>{d.depot_name || '—'}</TD>
            <TD mono>
              <span style={{ color: (d.current_score || d.safety_score) >= 85 ? C.green : (d.current_score || d.safety_score) >= 70 ? C.amber : C.red }}>
                {Math.round(d.current_score || d.safety_score)}
              </span>
            </TD>
            <TD right>
              <ActionButtons
                onAssign={canEdit ? () => setAssignDrv(d) : undefined}
                assignLabel="Assign Vehicle"
                onEdit={canManage ? () => setEditDriver(d) : undefined}
                onDelete={canManage ? () => setDeleteDrv(d) : undefined}
              />
            </TD>
          </TR>
        ))}
      </Table>

      {editDriver !== undefined && (
        <DriverForm
          driver={editDriver}
          onSave={editDriver ? (p) => updateDriver(editDriver.id, p) : createDriver}
          onClose={() => setEditDriver(undefined)}
        />
      )}
      {assignDrv && <AssignDriverModal driver={assignDrv} onClose={() => setAssignDrv(null)} />}
      {deleteDrv && <ConfirmDelete name={deleteDrv.full_name} entity="driver" onConfirm={handleDelete} onCancel={() => setDeleteDrv(null)} />}
    </div>
  );
}
