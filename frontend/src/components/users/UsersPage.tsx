import React, { useEffect, useState } from 'react';
import { UserPlus, Pencil, Trash2, ToggleLeft, ToggleRight, ShieldCheck, RefreshCw, Search } from 'lucide-react';
import { useUsersStore, type PortalUser, type UserRole } from '../../store/usersStore';
import { useAuthStore } from '../../store/authStore';
import UserModal from './UserModal';
import { timeAgo } from '../../utils/colors';

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  superadmin: { label: 'Superadmin', color: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
  admin:      { label: 'Admin',      color: '#a78bfa', bg: 'rgba(167,139,250,.15)' },
  operator:   { label: 'Operator',   color: '#00d4e8', bg: 'rgba(0,212,232,.12)' },
  viewer:     { label: 'Viewer',     color: '#64748b', bg: 'rgba(100,116,139,.15)' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const m = ROLE_META[role] || ROLE_META.viewer;
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: m.bg, color: m.color,
      fontFamily: 'DM Sans, sans-serif', letterSpacing: 0.3,
    }}>
      {m.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'rgba(0,212,232,.15)', border: '1px solid rgba(0,212,232,.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: '#00d4e8',
      fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function UsersPage() {
  const { users, isLoading, fetchUsers, createUser, updateUser, deleteUser, toggleActive } = useUsersStore();
  const { user: currentUser } = useAuthStore();

  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState<UserRole | 'all'>('all');
  const [modalUser,    setModalUser]    = useState<PortalUser | null | undefined>(undefined);
  // undefined = closed, null = create mode, PortalUser = edit mode
  const [confirmDelete, setConfirmDelete] = useState<PortalUser | null>(null);
  const [actionError,   setActionError]   = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const canCreate  = ['admin', 'superadmin'].includes(currentUser?.role || '');
  const canDelete  = currentUser?.role === 'superadmin';
  const isSuperadmin = currentUser?.role === 'superadmin';

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    const q           = search.toLowerCase();
    const matchSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const handleDelete = async (u: PortalUser) => {
    setActionError('');
    const result = await deleteUser(u.id);
    if (!result.ok) setActionError(result.error || 'Delete failed');
    setConfirmDelete(null);
  };

  const s: Record<string, React.CSSProperties> = {
    page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#050d1a', overflow: 'hidden' },
    header: { padding: '20px 24px 0', flexShrink: 0 },
    controls: { display: 'flex', gap: 10, padding: '14px 24px', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' },
    table: { flex: 1, overflowY: 'auto', padding: '0 16px 16px' },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 120px 100px 120px 80px',
      gap: 12, padding: '12px 16px',
      alignItems: 'center', borderRadius: 8,
      borderBottom: '1px solid rgba(255,255,255,.04)',
      transition: 'background .15s',
    },
    th: {
      display: 'grid',
      gridTemplateColumns: '1fr 120px 100px 120px 80px',
      gap: 12, padding: '8px 16px 10px',
      fontSize: 10, color: '#3a5070', letterSpacing: 1,
      textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif',
    },
  };

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#e8eaf0' }}>
              User Management
            </div>
            <div style={{ fontSize: 12, color: '#5d7a9a', marginTop: 3 }}>
              {users.length} portal {users.length === 1 ? 'user' : 'users'} · manage access and roles
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => fetchUsers()} title="Refresh" style={{
              padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,.1)',
              background: 'rgba(255,255,255,.04)', color: '#8da4c2', cursor: 'pointer', display: 'flex',
            }}>
              <RefreshCw size={14} />
            </button>
            {canCreate && (
              <button onClick={() => setModalUser(null)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 8, border: 'none',
                background: '#00d4e8', color: '#050d1a',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}>
                <UserPlus size={14} /> New User
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div style={{
            margin: '12px 0 0', padding: '10px 14px', borderRadius: 7,
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)',
            color: '#fca5a5', fontSize: 12,
          }}>
            {actionError}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div style={s.controls}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5d7a9a' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email..."
            style={{
              width: '100%', padding: '8px 10px 8px 30px',
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 6, color: '#e8eaf0', fontSize: 12, outline: 'none',
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
        </div>

        {/* Role filter */}
        {(['all', 'superadmin', 'admin', 'operator', 'viewer'] as const).map(r => (
          <button key={r} onClick={() => setRoleFilter(r)} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
            background: roleFilter === r
              ? (r === 'all' ? 'rgba(0,212,232,.2)' : ROLE_META[r as UserRole]?.bg || 'rgba(0,212,232,.2)')
              : 'rgba(255,255,255,.04)',
            color: roleFilter === r
              ? (r === 'all' ? '#00d4e8' : ROLE_META[r as UserRole]?.color || '#00d4e8')
              : '#5d7a9a',
          }}>
            {r === 'all' ? `All (${users.length})` : `${ROLE_META[r as UserRole]?.label} (${users.filter(u => u.role === r).length})`}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div style={s.table}>
        {/* Header row */}
        <div style={s.th}>
          <div>User</div>
          <div>Role</div>
          <div>Status</div>
          <div>Last Login</div>
          <div>Actions</div>
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', color: '#5d7a9a', padding: 40, fontSize: 13 }}>Loading users...</div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#5d7a9a', padding: 40, fontSize: 13 }}>
            {search ? 'No users match your search' : 'No users found'}
          </div>
        )}

        {filtered.map(u => {
          const isMe      = u.id === currentUser?.id;
          const canEdit   = isSuperadmin || (currentUser?.role === 'admin' && u.role !== 'superadmin' && u.role !== 'admin');
          const canToggle = canEdit && !isMe;
          const canDel    = canDelete && !isMe;

          return (
            <div
              key={u.id}
              style={{
                ...s.row,
                background: isMe ? 'rgba(0,212,232,.04)' : 'transparent',
                border: isMe ? '1px solid rgba(0,212,232,.12)' : '1px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,.04)',
                marginBottom: 2,
              }}
              onMouseEnter={e => { if (!isMe) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.02)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isMe ? 'rgba(0,212,232,.04)' : 'transparent'; }}
            >
              {/* User info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Avatar name={u.full_name} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.full_name}
                    </span>
                    {isMe && (
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,212,232,.15)', color: '#00d4e8' }}>
                        YOU
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#5d7a9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.email}
                  </div>
                  {u.phone && (
                    <div style={{ fontSize: 10, color: '#3a5070' }}>{u.phone}</div>
                  )}
                </div>
              </div>

              {/* Role */}
              <div><RoleBadge role={u.role} /></div>

              {/* Status */}
              <div>
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                  background: u.is_active ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                  color: u.is_active ? '#22c55e' : '#ef4444',
                }}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Last login */}
              <div style={{ fontSize: 11, color: '#5d7a9a', fontFamily: 'JetBrains Mono, monospace' }}>
                {u.last_login ? timeAgo(u.last_login) : 'Never'}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                {canEdit && (
                  <button
                    onClick={() => setModalUser(u)}
                    title="Edit user"
                    style={{
                      padding: '5px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,.08)',
                      background: 'rgba(255,255,255,.04)', color: '#8da4c2',
                      cursor: 'pointer', display: 'flex',
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                )}
                {canToggle && (
                  <button
                    onClick={() => toggleActive(u.id, !u.is_active)}
                    title={u.is_active ? 'Deactivate' : 'Activate'}
                    style={{
                      padding: '5px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,.08)',
                      background: 'rgba(255,255,255,.04)',
                      color: u.is_active ? '#ef4444' : '#22c55e',
                      cursor: 'pointer', display: 'flex',
                    }}
                  >
                    {u.is_active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  </button>
                )}
                {canDel && (
                  <button
                    onClick={() => { setActionError(''); setConfirmDelete(u); }}
                    title="Delete user"
                    style={{
                      padding: '5px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,.2)',
                      background: 'rgba(239,68,68,.08)', color: '#ef4444',
                      cursor: 'pointer', display: 'flex',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Create / Edit Modal ── */}
      {modalUser !== undefined && (
        <UserModal
          user={modalUser}
          onSave={modalUser ? (p) => updateUser(modalUser.id, p as any) : (p) => createUser(p as any)}
          onClose={() => setModalUser(undefined)}
        />
      )}

      {/* ── Delete Confirmation ── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#0a1828', border: '1px solid rgba(239,68,68,.3)',
            borderRadius: 14, padding: 28, maxWidth: 380, width: '100%',
            boxShadow: '0 40px 80px rgba(0,0,0,.6)',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Trash2 size={16} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#e8eaf0', marginBottom: 4 }}>
                  Delete user?
                </div>
                <div style={{ fontSize: 13, color: '#8da4c2' }}>
                  <strong style={{ color: '#e8eaf0' }}>{confirmDelete.full_name}</strong> ({confirmDelete.email}) will be permanently removed and will no longer be able to log in.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 7,
                  background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
                  color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 7, border: 'none',
                  background: '#ef4444', color: '#fff', cursor: 'pointer',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13,
                }}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
