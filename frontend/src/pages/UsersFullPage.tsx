import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  UserPlus, Pencil, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, Search, ArrowLeft, Shield, Users, Activity,
} from 'lucide-react';
import { useUsersStore, type PortalUser, type UserRole } from '../store/usersStore';
import { useAuthStore } from '../store/authStore';
import { useFleetStore } from '../store/fleetStore';
import { useTenantsStore } from '../store/tenantsStore';
import UserModal from '../components/users/UserModal';
import AppLayout from './AppLayout';
import { timeAgo } from '../utils/colors';

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; border: string }> = {
  superadmin: { label: 'Superadmin', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.3)' },
  admin:      { label: 'Admin',      color: '#a78bfa', bg: 'rgba(167,139,250,.12)', border: 'rgba(167,139,250,.3)' },
  operator:   { label: 'Operator',   color: '#00d4e8', bg: 'rgba(0,212,232,.10)',   border: 'rgba(0,212,232,.3)' },
  viewer:     { label: 'Viewer',     color: '#64748b', bg: 'rgba(100,116,139,.12)', border: 'rgba(100,116,139,.3)' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const m = ROLE_META[role] || ROLE_META.viewer;
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  );
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'rgba(0,212,232,.12)', border: '1px solid rgba(0,212,232,.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.32, fontWeight: 700, color: '#00d4e8',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {initials}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: '#5d7a9a', marginTop: 3, fontFamily: 'DM Sans, sans-serif' }}>{label}</div>
      </div>
    </div>
  );
}

export default function UsersFullPage() {
  const { t } = useTranslation();
  const { users, isLoading, fetchUsers, createUser, updateUser, deleteUser, toggleActive } = useUsersStore();
  const { user: currentUser } = useAuthStore();
  const { tenantFilter } = useFleetStore();
  const { tenants, fetchTenants } = useTenantsStore();
  const navigate = useNavigate();

  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState<UserRole | 'all'>('all');
  const [modalUser,     setModalUser]     = useState<PortalUser | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<PortalUser | null>(null);
  const [actionError,   setActionError]   = useState('');

  const isSuperadmin = currentUser?.role === 'superadmin';
  const canCreate    = ['admin', 'superadmin'].includes(currentUser?.role || '');

  useEffect(() => {
    if (isSuperadmin && tenants.length === 0) fetchTenants();
  }, [isSuperadmin]);

  useEffect(() => {
    fetchUsers(tenantFilter || undefined);
  }, [tenantFilter]);

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const counts = {
    total:      users.length,
    active:     users.filter(u => u.is_active).length,
    superadmin: users.filter(u => u.role === 'superadmin').length,
    admin:      users.filter(u => u.role === 'admin').length,
    operator:   users.filter(u => u.role === 'operator').length,
    viewer:     users.filter(u => u.role === 'viewer').length,
  };

  const handleDelete = async (u: PortalUser) => {
    setActionError('');
    const result = await deleteUser(u.id);
    if (!result.ok) setActionError(result.error || 'Delete failed');
    setConfirmDelete(null);
  };

  const activeTenantName = tenantFilter ? (tenants.find(t => t.id === tenantFilter)?.name ?? 'Tenant') : null;

  const ROLE_LABELS: Record<UserRole, string> = {
    superadmin: 'Superadmin',
    admin: 'Admin',
    operator: 'Operator',
    viewer: 'Viewer',
  };

  return (
    <AppLayout>
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px', background: '#050d1a' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={() => navigate('/')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 8, color: '#8da4c2', cursor: 'pointer', fontSize: 13,
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <ArrowLeft size={14} /> {t('common.dashboard')}
            </button>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: '#e8eaf0' }}>
                {t('users.title')}
              </div>
              <div style={{ fontSize: 13, color: '#5d7a9a', marginTop: 3, fontFamily: 'DM Sans, sans-serif' }}>
                {isSuperadmin && activeTenantName
                  ? <>{t('users.filtering_by')} <span style={{ color: '#f59e0b', fontWeight: 600 }}>{activeTenantName}</span></>
                  : t('users.subtitle')
                }
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => fetchUsers(tenantFilter || undefined)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 8, color: '#8da4c2', cursor: 'pointer', fontSize: 13,
              fontFamily: 'DM Sans, sans-serif',
            }}>
              <RefreshCw size={14} /> {t('users.refresh')}
            </button>
            {canCreate && (
              <button onClick={() => setModalUser(null)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                borderRadius: 8, border: 'none', background: '#00d4e8', color: '#050d1a',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                <UserPlus size={15} /> {t('users.new_user')}
              </button>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
          <StatCard icon={<Users size={18} />}    label={t('users.total_users')}  value={counts.total}      color="#00d4e8" />
          <StatCard icon={<Activity size={18} />} label={t('users.active')}       value={counts.active}     color="#22c55e" />
          <StatCard icon={<Shield size={18} />}   label={t('users.superadmins')}  value={counts.superadmin} color="#f59e0b" />
          <StatCard icon={<Shield size={18} />}   label={t('users.admins')}       value={counts.admin}      color="#a78bfa" />
          <StatCard icon={<Users size={18} />}    label={t('users.operators')}    value={counts.operator}   color="#00d4e8" />
          <StatCard icon={<Users size={18} />}    label={t('users.viewers')}      value={counts.viewer}     color="#64748b" />
        </div>

        {/* ── Error banner ── */}
        {actionError && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 20,
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
            color: '#fca5a5', fontSize: 13, fontFamily: 'DM Sans, sans-serif',
          }}>
            {actionError}
          </div>
        )}

        {/* ── Table card ── */}
        <div style={{
          background: '#0a1828', border: '1px solid rgba(0,212,232,.1)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Controls bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#5d7a9a' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('users.search_placeholder')}
                style={{
                  width: '100%', padding: '8px 12px 8px 32px',
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 7, color: '#e8eaf0', fontSize: 13, outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
            </div>

            {/* Role filter pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all', 'superadmin', 'admin', 'operator', 'viewer'] as const).map(r => {
                const meta = r !== 'all' ? ROLE_META[r] : null;
                const count = r === 'all' ? users.length : users.filter(u => u.role === r).length;
                const active = roleFilter === r;
                return (
                  <button key={r} onClick={() => setRoleFilter(r)} style={{
                    padding: '5px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                    background: active ? (meta?.bg || 'rgba(0,212,232,.15)') : 'rgba(255,255,255,.04)',
                    color: active ? (meta?.color || '#00d4e8') : '#5d7a9a',
                    transition: 'all .15s',
                  }}>
                    {r === 'all' ? t('users.role_all') : ROLE_LABELS[r]} <span style={{ opacity: 0.7 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 160px 100px',
            gap: 0, padding: '10px 20px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
            fontSize: 10, color: '#3a5070', letterSpacing: 1,
            textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif',
          }}>
            <div>{t('users.col_user')}</div>
            <div>{t('users.col_role')}</div>
            <div>{t('users.col_status')}</div>
            <div>{t('users.col_last_login')}</div>
            <div>{t('users.col_member_since')}</div>
            <div style={{ textAlign: 'right' }}>{t('users.col_actions')}</div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#5d7a9a', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
              {t('users.loading')}
            </div>
          )}

          {/* Empty */}
          {!isLoading && filtered.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#5d7a9a', fontSize: 14, fontFamily: 'DM Sans, sans-serif' }}>
              {search ? t('users.no_match') : t('users.no_users')}
            </div>
          )}

          {/* Rows */}
          {!isLoading && filtered.map((u, idx) => {
            const isMe      = u.id === currentUser?.id;
            const canEdit   = isSuperadmin || (currentUser?.role === 'admin' && u.role !== 'superadmin' && u.role !== 'admin');
            const canToggle = canEdit && !isMe;
            const canDel    = isSuperadmin && !isMe;

            return (
              <div
                key={u.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 160px 100px',
                  gap: 0, padding: '14px 20px',
                  borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                  background: isMe ? 'rgba(0,212,232,.03)' : 'transparent',
                  alignItems: 'center',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.02)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isMe ? 'rgba(0,212,232,.03)' : 'transparent'; }}
              >
                {/* User info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar name={u.full_name} size={40} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>
                        {u.full_name}
                      </span>
                      {isMe && (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,212,232,.15)', color: '#00d4e8', fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>
                          {t('users.you')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#5d7a9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>
                      {u.email}
                    </div>
                    {u.phone && (
                      <div style={{ fontSize: 11, color: '#3a5070', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>{u.phone}</div>
                    )}
                    {isSuperadmin && u.tenant_name && (
                      <div style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'DM Sans, sans-serif', marginTop: 1, opacity: 0.8 }}>{u.tenant_name}</div>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div><RoleBadge role={u.role} /></div>

                {/* Status */}
                <div>
                  <span style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                    background: u.is_active ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
                    color: u.is_active ? '#22c55e' : '#ef4444',
                    border: `1px solid ${u.is_active ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
                    fontFamily: 'DM Sans, sans-serif',
                  }}>
                    {u.is_active ? t('users.status_active') : t('users.status_inactive')}
                  </span>
                </div>

                {/* Last login */}
                <div style={{ fontSize: 12, color: '#5d7a9a', fontFamily: 'JetBrains Mono, monospace' }}>
                  {u.last_login ? timeAgo(u.last_login) : <span style={{ color: '#3a5070' }}>{t('users.never')}</span>}
                </div>

                {/* Created */}
                <div style={{ fontSize: 12, color: '#5d7a9a', fontFamily: 'DM Sans, sans-serif' }}>
                  {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  {canEdit && (
                    <button onClick={() => { setActionError(''); setModalUser(u); }} title={t('users.edit')} style={{
                      display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                      borderRadius: 6, border: '1px solid rgba(255,255,255,.1)',
                      background: 'rgba(255,255,255,.04)', color: '#8da4c2',
                      cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif',
                    }}>
                      <Pencil size={12} /> {t('users.edit')}
                    </button>
                  )}
                  {canToggle && (
                    <button onClick={() => toggleActive(u.id, !u.is_active)} title={u.is_active ? 'Deactivate' : 'Activate'} style={{
                      display: 'flex', alignItems: 'center', padding: '6px 8px',
                      borderRadius: 6, border: '1px solid rgba(255,255,255,.08)',
                      background: 'rgba(255,255,255,.03)',
                      color: u.is_active ? '#ef4444' : '#22c55e',
                      cursor: 'pointer',
                    }}>
                      {u.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                    </button>
                  )}
                  {canDel && (
                    <button onClick={() => { setActionError(''); setConfirmDelete(u); }} title={t('common.delete')} style={{
                      display: 'flex', alignItems: 'center', padding: '6px 8px',
                      borderRadius: 6, border: '1px solid rgba(239,68,68,.2)',
                      background: 'rgba(239,68,68,.08)', color: '#ef4444', cursor: 'pointer',
                    }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onSave={modalUser
            ? (p) => updateUser(modalUser.id, p as any)
            : (p) => createUser(p as any)
          }
          onClose={() => setModalUser(undefined)}
        />
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#0a1828', border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 14, padding: 28, maxWidth: 400, width: '100%',
            boxShadow: '0 40px 80px rgba(0,0,0,.6)',
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
              }}>
                <Trash2 size={17} />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: '#e8eaf0', marginBottom: 6 }}>
                  {t('users.delete_title')}
                </div>
                <div style={{ fontSize: 13, color: '#8da4c2', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}>
                  <strong style={{ color: '#e8eaf0' }}>{confirmDelete.full_name}</strong> ({confirmDelete.email}) {t('users.delete_body')}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                flex: 1, padding: '11px', borderRadius: 8,
                background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13,
              }}>
                {t('users.cancel')}
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{
                flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                background: '#ef4444', color: '#fff', cursor: 'pointer',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
              }}>
                {t('users.confirm_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
