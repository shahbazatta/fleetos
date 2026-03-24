import React from 'react';
import { LogOut, Wifi, WifiOff, UserCog, Building2 } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFleetStore } from '../../store/fleetStore';
import { useAuthStore } from '../../store/authStore';

export default function Navbar() {
  const { summary, wsConnected } = useFleetStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const v = summary?.vehicles;
  const a = summary?.alerts;

  const canManageUsers    = ['admin', 'superadmin'].includes(user?.role || '');
  const isSuperadmin      = user?.role === 'superadmin';
  const onDashboard       = pathname === '/';
  const onUsersPage       = pathname === '/users';
  const onTenantsPage     = pathname === '/tenants';

  const kpi = (val: string | number | undefined, label: string, color = '#e8eaf0') => (
    <div style={{ textAlign: 'center', padding: '0 14px', borderRight: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{val ?? '—'}</div>
      <div style={{ fontSize: 9, color: '#5d7a9a', marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  const navBtn = (label: string, icon: React.ReactNode, path: string, active: boolean) => (
    <button onClick={() => navigate(active ? '/' : path)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      borderRadius: 7,
      background: active ? 'rgba(0,212,232,.15)' : 'rgba(255,255,255,.04)',
      border: `1px solid ${active ? 'rgba(0,212,232,.4)' : 'rgba(255,255,255,.1)'}`,
      color: active ? '#00d4e8' : '#8da4c2',
      cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
    }}>
      {icon}<span>{active ? '← Back' : label}</span>
    </button>
  );

  return (
    <div style={{ height: 56, display: 'flex', alignItems: 'center', background: 'rgba(5,13,26,.95)', borderBottom: '1px solid rgba(0,212,232,.1)', padding: '0 20px', gap: 0, backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 30 }}>
      {/* Logo */}
      <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 24, cursor: 'pointer' }}>
        <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
          <polygon points="14,1 27,8 27,24 14,31 1,24 1,8" fill="none" stroke="#00d4e8" strokeWidth="1.8"/>
          <polygon points="14,6 22,11 22,21 14,26 6,21 6,11" fill="rgba(0,212,232,.1)" stroke="#00d4e8" strokeWidth="0.8" strokeOpacity="0.5"/>
          <line x1="1" y1="8" x2="27" y2="24" stroke="#00d4e8" strokeWidth="0.8" strokeOpacity="0.35"/>
          <line x1="27" y1="8" x2="1" y2="24" stroke="#00d4e8" strokeWidth="0.8" strokeOpacity="0.35"/>
          <circle cx="14" cy="16" r="3" fill="#00d4e8"/>
        </svg>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: '#e8eaf0', letterSpacing: 0.5 }}>CLOUDNEXT</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: '#00d4e8', letterSpacing: 1.5 }}>FLEET MANAGEMENT</div>
        </div>
      </div>

      {/* KPI strip — dashboard only */}
      {onDashboard ? (
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {kpi(v?.total, 'Total')}
          {kpi(v?.active, 'Active', '#22c55e')}
          {kpi(v?.idle, 'Idle', '#f59e0b')}
          {kpi(v?.offline, 'Offline', '#64748b')}
          {kpi(v?.avg_speed ? `${v.avg_speed}` : '—', 'Avg km/h', '#00d4e8')}
          {kpi(v?.avg_fuel ? `${v.avg_fuel}%` : '—', 'Avg Fuel')}
          {kpi(a?.critical ?? 0, 'Critical', a?.critical ? '#ef4444' : '#e8eaf0')}
          {kpi(a?.unread ?? 0, 'Unread', a?.unread ? '#f59e0b' : '#e8eaf0')}
        </div>
      ) : (
        <div style={{ flex: 1, padding: '0 16px' }}>
          {user?.tenant && !isSuperadmin && (
            <span style={{ fontSize: 12, color: '#5d7a9a', fontFamily: 'DM Sans, sans-serif' }}>
              <span style={{ color: '#00d4e8', fontWeight: 600 }}>{user.tenant.name}</span>
              {' · '}<span style={{ textTransform: 'capitalize' }}>{user.tenant.plan}</span> plan
            </span>
          )}
          {isSuperadmin && (
            <span style={{ fontSize: 12, color: '#f59e0b', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>
              SUPERADMIN — Platform-wide access
            </span>
          )}
        </div>
      )}

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: wsConnected ? '#22c55e' : '#ef4444' }}>
          {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)' }} />

        {isSuperadmin && navBtn('Tenants', <Building2 size={14} />, '/tenants', onTenantsPage)}
        {canManageUsers && navBtn('Users', <UserCog size={14} />, '/users', onUsersPage)}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)' }} />
        <div style={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
          <span style={{ color: '#e8eaf0' }}>{user?.name}</span>
          {user?.tenant && <span style={{ color: '#3a5070' }}> · {user.tenant.name}</span>}
        </div>
        <button onClick={logout} title="Sign out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5d7a9a', display: 'flex', padding: 4 }}>
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}
