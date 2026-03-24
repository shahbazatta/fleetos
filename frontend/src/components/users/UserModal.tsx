import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import type { PortalUser, UserRole, CreateUserPayload, UpdateUserPayload } from '../../store/usersStore';
import { useAuthStore } from '../../store/authStore';

const ROLES: { value: UserRole; label: string; desc: string; color: string }[] = [
  { value: 'viewer',     label: 'Viewer',     desc: 'Read-only access to dashboard and reports',        color: '#64748b' },
  { value: 'operator',   label: 'Operator',   desc: 'Manage vehicles, alerts and drivers',              color: '#00d4e8' },
  { value: 'admin',      label: 'Admin',      desc: 'Full access except user management',               color: '#a78bfa' },
  { value: 'superadmin', label: 'Superadmin', desc: 'Full access including creating and deleting users', color: '#f59e0b' },
];

interface Props {
  user?:    PortalUser | null;   // null = create mode
  onSave:  (payload: CreateUserPayload | UpdateUserPayload) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

export default function UserModal({ user, onSave, onClose }: Props) {
  const { user: currentUser } = useAuthStore();
  const isEdit = !!user;

  const [fullName,  setFullName]  = useState(user?.full_name  || '');
  const [email,     setEmail]     = useState(user?.email      || '');
  const [phone,     setPhone]     = useState(user?.phone      || '');
  const [role,      setRole]      = useState<UserRole>(user?.role || 'operator');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');

  // Roles the current user is allowed to assign
  const allowedRoles = ROLES.filter(r => {
    if (currentUser?.role === 'superadmin') return true;
    if (currentUser?.role === 'admin') return r.value === 'viewer' || r.value === 'operator';
    return false;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isEdit && password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (password && password !== confirm) {
      return setError('Passwords do not match');
    }

    setSaving(true);
    const payload: any = { full_name: fullName.trim(), role, phone: phone.trim() || undefined };
    if (!isEdit) {
      payload.email    = email.trim().toLowerCase();
      payload.password = password;
    } else if (password) {
      payload.password = password;
    }

    const result = await onSave(payload);
    setSaving(false);

    if (!result.ok) {
      setError(result.error || 'Something went wrong');
    } else {
      onClose();
    }
  };

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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#0a1828', border: '1px solid rgba(0,212,232,.2)',
        borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 40px 80px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,.06)',
        }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#e8eaf0' }}>
              {isEdit ? 'Edit User' : 'Create New User'}
            </div>
            <div style={{ fontSize: 12, color: '#5d7a9a', marginTop: 2 }}>
              {isEdit ? `Editing ${user?.email}` : 'Add a user who can log into the portal'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#5d7a9a', padding: 4, display: 'flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 7,
              background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
              color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* Full name */}
          <div>
            <label style={labelCss}>Full Name *</label>
            <input
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="e.g. Ahmed Raza"
              style={inputCss}
              required
            />
          </div>

          {/* Email (only on create) */}
          {!isEdit && (
            <div>
              <label style={labelCss}>Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@company.com"
                style={inputCss}
                required
              />
            </div>
          )}

          {/* Phone */}
          <div>
            <label style={labelCss}>Phone (optional)</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+92-300-1234567"
              style={inputCss}
            />
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
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    style={{ accentColor: r.color }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: role === r.value ? r.color : '#e8eaf0' }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#5d7a9a', marginTop: 1 }}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={labelCss}>
              {isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? '••••••••' : 'Min. 8 characters'}
                style={{ ...inputCss, paddingRight: 40 }}
                required={!isEdit}
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#5d7a9a',
                  display: 'flex', padding: 2,
                }}
              >
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
                style={{
                  ...inputCss,
                  borderColor: confirm && confirm !== password ? 'rgba(239,68,68,.5)' : undefined,
                }}
                required={!!password}
              />
              {confirm && confirm !== password && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '11px', borderRadius: 8,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                fontSize: 13, fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || (!!password && password !== confirm)}
              style={{
                flex: 2, padding: '11px', borderRadius: 8, border: 'none',
                background: saving ? 'rgba(0,212,232,.4)' : '#00d4e8',
                color: '#050d1a', cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14,
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
