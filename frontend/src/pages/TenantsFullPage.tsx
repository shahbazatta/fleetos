import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Pencil, Trash2, RefreshCw, ArrowLeft, Globe, Users, Truck, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { useTenantsStore, type Tenant, type CreateTenantPayload } from '../store/tenantsStore';
import AppLayout from './AppLayout';

const PLAN_META: Record<string, { color: string; bg: string }> = {
  trial:      { color: '#64748b', bg: 'rgba(100,116,139,.12)' },
  standard:   { color: 'var(--acc)', bg: 'var(--acc-10)' },
  pro:        { color: '#a78bfa', bg: 'rgba(167,139,250,.12)' },
  enterprise: { color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
};

function TenantModal({ tenant, onSave, onClose }: {
  tenant: Tenant | null;
  onSave: (p: any) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const isEdit = !!tenant;
  const [name,        setName]        = useState(tenant?.name        || '');
  const [slug,        setSlug]        = useState(tenant?.slug        || '');
  const [country,     setCountry]     = useState(tenant?.country     || 'Pakistan');
  const [city,        setCity]        = useState(tenant?.city        || '');
  const [email,       setEmail]       = useState(tenant?.email       || '');
  const [phone,       setPhone]       = useState(tenant?.phone       || '');
  const [plan,        setPlan]        = useState(tenant?.plan        || 'standard');
  const [maxVehicles, setMaxVehicles] = useState(tenant?.max_vehicles || 50);
  const [maxUsers,    setMaxUsers]    = useState(tenant?.max_users    || 10);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  const autoSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload: any = { name, country, city, email, phone, plan, max_vehicles: maxVehicles, max_users: maxUsers };
    if (!isEdit) payload.slug = slug;
    const result = await onSave(payload);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Error');
    else onClose();
  };

  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', background: 'var(--fill-04)', border: '1px solid var(--bdr-10)', borderRadius: 7, color: 'var(--txt-1)', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none' };
  const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--txt-3)', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 5, fontFamily: 'DM Sans, sans-serif' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--srf-1)', border: '1px solid var(--acc-20)', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 40px 80px rgba(0,0,0,.6)', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--bdr-06)' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--txt-1)' }}>{isEdit ? 'Edit Company' : 'Add New Company'}</div>
            <div style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 2 }}>{isEdit ? tenant?.name : 'Create a new tenant organisation'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', display: 'flex' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Company Name *</label>
              <input value={name} onChange={e => { setName(e.target.value); if (!isEdit) setSlug(autoSlug(e.target.value)); }} style={inp} required placeholder="Al Noor Transport LLC" />
            </div>
            {!isEdit && (
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Slug * (URL identifier)</label>
                <input value={slug} onChange={e => setSlug(autoSlug(e.target.value))} style={{ ...inp, fontFamily: 'JetBrains Mono, monospace' }} required placeholder="al-noor-transport" />
              </div>
            )}
            <div>
              <label style={lbl}>Country</label>
              <input value={country} onChange={e => setCountry(e.target.value)} style={inp} placeholder="Pakistan" />
            </div>
            <div>
              <label style={lbl}>City</label>
              <input value={city} onChange={e => setCity(e.target.value)} style={inp} placeholder="Lahore" />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="ops@company.com" />
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="+92-42-..." />
            </div>
          </div>

          {/* Plan */}
          <div>
            <label style={lbl}>Plan</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {Object.entries(PLAN_META).map(([p, m]) => (
                <label key={p} style={{ padding: '8px 0', borderRadius: 7, border: `1px solid ${plan===p ? m.color+'60' : 'var(--bdr-08)'}`, background: plan===p ? m.bg : 'var(--fill-02)', textAlign: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="plan" value={p} checked={plan===p} onChange={() => setPlan(p)} style={{ display: 'none' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: plan===p ? m.color : 'var(--txt-3)', textTransform: 'capitalize' }}>{p}</div>
                </label>
              ))}
            </div>
          </div>

          {/* Limits */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Max Vehicles</label>
              <input type="number" value={maxVehicles} onChange={e => setMaxVehicles(parseInt(e.target.value))} style={inp} min={1} max={10000} />
            </div>
            <div>
              <label style={lbl}>Max Users</label>
              <input type="number" value={maxUsers} onChange={e => setMaxUsers(parseInt(e.target.value))} style={inp} min={1} max={500} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'var(--fill-04)', border: '1px solid var(--bdr-10)', color: 'var(--txt-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: saving ? 'var(--acc-40)' : 'var(--acc)', color: 'var(--srf-0)', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14 }}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantsFullPage() {
  const { tenants, isLoading, fetchTenants, createTenant, updateTenant, deleteTenant } = useTenantsStore();
  const navigate = useNavigate();
  const [modal,         setModal]         = useState<Tenant | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null);
  const [error,         setError]         = useState('');

  useEffect(() => { fetchTenants(); }, []);

  const handleDelete = async (t: Tenant) => {
    const result = await deleteTenant(t.id);
    if (!result.ok) setError(result.error || 'Delete failed');
    setConfirmDelete(null);
  };

  return (
    <AppLayout>
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', background: 'var(--srf-0)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--fill-04)', border: '1px solid var(--bdr-10)', borderRadius: 8, color: 'var(--txt-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
              <ArrowLeft size={14} /> Dashboard
            </button>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--txt-1)' }}>Tenant Management</div>
              <div style={{ fontSize: 13, color: 'var(--txt-3)', marginTop: 3 }}>{tenants.length} organisations on the platform</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => fetchTenants()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--fill-04)', border: '1px solid var(--bdr-10)', borderRadius: 8, color: 'var(--txt-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={() => setModal(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--acc)', color: 'var(--srf-0)', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              <Plus size={15} /> New Company
            </button>
          </div>
        </div>

        {error && <div style={{ padding: '12px 16px', borderRadius: 8, marginBottom: 20, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

        {/* Tenant cards */}
        {isLoading && <div style={{ textAlign: 'center', color: 'var(--txt-3)', padding: 60, fontSize: 14 }}>Loading...</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {tenants.map(t => {
            const pm = PLAN_META[t.plan] || PLAN_META.standard;
            return (
              <div key={t.id} style={{ background: 'var(--srf-1)', border: `1px solid ${t.is_active ? 'var(--acc-12)' : 'rgba(239,68,68,.15)'}`, borderRadius: 12, padding: 20 }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--acc-10)', border: '1px solid var(--acc-20)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={20} style={{ color: 'var(--acc)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt-1)', fontFamily: 'DM Sans, sans-serif' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{t.slug}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: pm.bg, color: pm.color, textTransform: 'capitalize' }}>{t.plan}</span>
                    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: t.is_active ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: t.is_active ? '#22c55e' : '#ef4444' }}>
                      {t.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                  {[
                    { icon: <Users size={13} />, val: t.user_count ?? 0,    label: 'Users',    max: t.max_users },
                    { icon: <Truck size={13} />, val: t.vehicle_count ?? 0, label: 'Vehicles', max: t.max_vehicles },
                    { icon: <Globe size={13} />, val: t.country,            label: 'Country' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--fill-03)', borderRadius: 7, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--txt-3)', marginBottom: 3 }}>{s.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt-1)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {s.max ? `${s.val}/${s.max}` : s.val}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Contact info */}
                {(t.email || t.phone) && (
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', fontFamily: 'DM Sans, sans-serif', marginBottom: 12, lineHeight: 1.6 }}>
                    {t.email && <div>{t.email}</div>}
                    {t.phone && <div>{t.phone}</div>}
                    {t.city  && <div>{t.city}, {t.country}</div>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--fill-05)' }}>
                  <button onClick={() => setModal(t)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 7, border: '1px solid var(--bdr-10)', background: 'var(--fill-04)', color: 'var(--txt-2)', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => updateTenant(t.id, { is_active: !t.is_active })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px', borderRadius: 7, border: '1px solid var(--bdr-08)', background: 'var(--fill-03)', color: t.is_active ? '#ef4444' : '#22c55e', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                    {t.is_active ? <><ToggleRight size={13}/> Suspend</> : <><ToggleLeft size={13}/> Activate</>}
                  </button>
                  <button onClick={() => { setError(''); setConfirmDelete(t); }} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,.2)', background: 'rgba(239,68,68,.08)', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal !== undefined && (
        <TenantModal
          tenant={modal}
          onSave={modal ? (p) => updateTenant(modal.id, p) : (p) => createTenant(p)}
          onClose={() => setModal(undefined)}
        />
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--srf-1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: 28, maxWidth: 400, width: '100%' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--txt-1)', marginBottom: 8 }}>Delete this company?</div>
            <div style={{ fontSize: 13, color: 'var(--txt-2)', marginBottom: 20, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--txt-1)' }}>{confirmDelete.name}</strong> and all of its vehicles, drivers, trips and data will be permanently deleted. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'var(--fill-04)', border: '1px solid var(--bdr-10)', color: 'var(--txt-2)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>Delete Company</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
