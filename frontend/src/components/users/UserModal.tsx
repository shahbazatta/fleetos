import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Building2, AlertCircle } from 'lucide-react';
import type { PortalUser, UserRole, CreateUserPayload, UpdateUserPayload } from '../../store/usersStore';
import { useAuthStore } from '../../store/authStore';
import { useTenantsStore } from '../../store/tenantsStore';

const ROLES: { value: UserRole; label: string; desc: string; color: string }[] = [
  { value: 'viewer',     label: 'Viewer',     desc: 'Read-only: view map, alerts and reports',             color: '#64748b' },
  { value: 'operator',   label: 'Operator',   desc: 'Assign drivers/vehicles, manage trips and alerts',    color: '#00d4e8' },
  { value: 'admin',      label: 'Admin',      desc: 'Full tenant access: manage fleet, users and settings',color: '#a78bfa' },
  { value: 'superadmin', label: 'Superadmin', desc: 'Platform-wide access: manage all tenants and users',  color: '#f59e0b' },
];

interface Props {
  user?:   PortalUser | null;  // null = create mode, PortalUser = edit mode
  onSave:  (payload: CreateUserPayload | UpdateUserPayload) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export default function UserModal({ user, onSave, onClose }: Props) {
  const { user: currentUser }          = useAuthStore();
  const { tenants, fetchTenants, isLoading: tenantsLoading } = useTenantsStore();
  const isEdit       = !!user;
  const isSuperadmin = currentUser?.role === 'superadmin';

  const [fullName,  setFullName]  = useState(user?.full_name  || '');
  const [email,     setEmail]     = useState(user?.email      || '');
  const [phone,     setPhone]     = useState(user?.phone      || '');
  const [role,      setRole]      = useState<UserRole>(user?.role || 'operator');
  const [tenantId,  setTenantId]  = useState<string>(
    user?.tenant_id || currentUser?.tenant_id || ''
  );
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  // Superadmin creating a user needs the tenant list
  useEffect(() => {
    if (isSuperadmin && !isEdit && tenants.length === 0) {
      fetchTenants();
    }
  }, [isSuperadmin, isEdit]);

  // When role changes to superadmin, clear the tenant (superadmin is cross-tenant)
  const handleRoleChange = (r: UserRole) => {
    setRole(r);
    if (r === 'superadmin') setTenantId('');
  };

  // Roles the current user is allowed to assign
  const allowedRoles = ROLES.filter(r => {
    if (isSuperadmin) return true;
    return r.value === 'viewer' || r.value === 'operator';
  });

  // Active tenants only, sorted by name
  const activeTenants = tenants
    .filter(t => t.is_active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedTenant = tenants.find(t => t.id === tenantId);
  const tenantRequired = !isEdit && role !== 'superadmin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEdit && password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (password && password !== confirm) {
      return setError('Passwords do not match');
    }
    if (tenantRequired && !tenantId) {
      return setError('Please select a company (tenant) for this user');
    }

    setSaving(true);
    const payload: any = {
      full_name: fullName.trim(),
      role,
      phone: phone.trim() || undefined,
    };

    if (!isEdit) {
      payload.email     = email.trim().toLowerCase();
      payload.password  = password;
      // Include tenant_id — backend ignores it for superadmin role
      if (tenantId) payload.tenant_id = tenantId;
    } else if (password) {
      payload.password = password;
    }

    const result = await onSave(payload);
    setSaving(false);
    if (!result.ok) setError(result.error || 'Something went wrong');
    else onClose();
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inputCss: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'rgba(255,255,255,.04)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 7, color: '#e8eaf0', fontSize: 13,
    fontFamily: 'DM Sans, sans-serif', outline: 'none',
    transition: 'border-color .15s',
  };
  const labelCss: React.CSSProperties = {
    fontSize: 11, color: '#5d7a9a', letterSpacing: 1,
    textTransform: 'uppercase', display: 'block', marginBottom: 5,
    fontFamily: 'DM Sans, sans-serif',
  };
  const selCss: React.CSSProperties = {
    ...inputCss, cursor: 'pointer',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#0a1828', border: '1px solid rgba(0,212,232,.2)',
        borderRadius: 16, width: '100%', maxWidth: 500,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 80px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,.06)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#e8eaf0' }}>
              {isEdit ? 'Edit User' : 'Create New User'}
            </div>
            <div style={{ fontSize: 12, color: '#5d7a9a', marginTop: 2 }}>
              {isEdit ? `Editing ${user?.email}` : 'Add a user who can log into the portal'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5d7a9a', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 7, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Full name */}
          <div>
            <label style={labelCss}>Full Name *</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Ahmed Raza" style={inputCss} required />
          </div>

          {/* Email (create only) */}
          {!isEdit && (
            <div>
              <label style={labelCss}>Email Address *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" style={inputCss} required autoComplete="off" />
            </div>
          )}

          {/* Phone */}
          <div>
            <label style={labelCss}>Phone (optional)</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+92-300-1234567" style={inputCss} />
          </div>

          {/* Role */}
          <div>
            <label style={labelCss}>Role *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allowedRoles.map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${role === r.value ? r.color + '60' : 'rgba(255,255,255,.06)'}`,
                  background: role === r.value ? r.color + '14' : 'rgba(255,255,255,.02)',
                  transition: 'all .15s',
                }}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => handleRoleChange(r.value)} style={{ accentColor: r.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: role === r.value ? r.color : '#e8eaf0' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: '#5d7a9a', marginTop: 1 }}>{r.desc}</div>
                  </div>
                  {r.value === 'superadmin' && (
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontWeight: 700, letterSpacing: 0.5 }}>PLATFORM</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* ── Tenant selector — superadmin creating non-superadmin user ── */}
          {isSuperadmin && !isEdit && role !== 'superadmin' && (
            <div>
              <label style={labelCss}>
                Company (Tenant) *
                {tenantsLoading && <span style={{ color: '#3a5070', fontWeight: 400, marginLeft: 8 }}>loading...</span>}
              </label>

              {activeTenants.length === 0 && !tenantsLoading ? (
                <div style={{ padding: '10px 12px', borderRadius: 7, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', color: '#f59e0b', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                  No active tenants found. Create a company first in Tenant Management.
                </div>
              ) : (
                <>
                  <select
                    value={tenantId}
                    onChange={e => setTenantId(e.target.value)}
                    style={{
                      ...selCss,
                      borderColor: tenantRequired && !tenantId ? 'rgba(239,68,68,.5)' : undefined,
                    }}
                    required={tenantRequired}
                  >
                    <option value="">— Select a company —</option>
                    {activeTenants.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.country}{t.city ? `, ${t.city}` : ''}) — {t.plan}
                      </option>
                    ))}
                  </select>

                  {/* Selected tenant info card */}
                  {selectedTenant && (
                    <div style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(0,212,232,.06)', border: '1px solid rgba(0,212,232,.2)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,212,232,.12)', border: '1px solid rgba(0,212,232,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={15} style={{ color: '#00d4e8' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', fontFamily: 'DM Sans, sans-serif' }}>{selectedTenant.name}</div>
                        <div style={{ fontSize: 11, color: '#5d7a9a', marginTop: 1, fontFamily: 'DM Sans, sans-serif' }}>
                          {[selectedTenant.city, selectedTenant.country].filter(Boolean).join(', ')}
                          {' · '}
                          <span style={{ textTransform: 'capitalize' }}>{selectedTenant.plan}</span> plan
                          {' · '}
                          {selectedTenant.user_count ?? '?'}/{selectedTenant.max_users} users
                        </div>
                      </div>
                      {/* Capacity warning */}
                      {selectedTenant.user_count != null && selectedTenant.user_count >= selectedTenant.max_users - 1 && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(245,158,11,.15)', color: '#f59e0b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {selectedTenant.user_count >= selectedTenant.max_users ? 'FULL' : 'ALMOST FULL'}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Note for superadmin role — no tenant */}
          {isSuperadmin && !isEdit && role === 'superadmin' && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', fontSize: 12, color: '#f59e0b', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              Superadmin accounts are not assigned to any company — they have platform-wide access.
            </div>
          )}

          {/* Current tenant display for non-superadmin admins */}
          {!isSuperadmin && !isEdit && currentUser?.tenant && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(0,212,232,.05)', border: '1px solid rgba(0,212,232,.15)', fontSize: 12, color: '#5d7a9a', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Building2 size={13} style={{ color: '#00d4e8', flexShrink: 0 }} />
              This user will be created in <strong style={{ color: '#00d4e8', marginLeft: 4 }}>{currentUser.tenant.name}</strong>
            </div>
          )}

          {/* Password */}
          <div>
            <label style={labelCss}>{isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Min. 8 characters'}
                style={{ ...inputCss, paddingRight: 40 }}
                required={!isEdit}
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5d7a9a', display: 'flex', padding: 2 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          {password && (
            <div>
              <label style={labelCss}>Confirm Password *</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                style={{ ...inputCss, borderColor: confirm && confirm !== password ? 'rgba(239,68,68,.5)' : undefined }}
                required={!!password}
              />
              {confirm && confirm !== password && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!!password && password !== confirm) || (tenantRequired && !tenantId && isSuperadmin)}
              style={{
                flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                background: saving ? 'rgba(0,212,232,.4)' : '#00d4e8',
                color: '#050d1a', cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14,
                opacity: (tenantRequired && !tenantId && isSuperadmin) ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
