import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Wifi, WifiOff, UserCog, Building2, Layers, Palette, Globe, Filter } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFleetStore } from '../../store/fleetStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore, type ThemeName } from '../../store/themeStore';
import { useTenantsStore } from '../../store/tenantsStore';

function Dropdown({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer' }}>{trigger}</div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: '#0a1828', border: '1px solid rgba(0,212,232,.15)',
          borderRadius: 10, padding: '6px 0', zIndex: 200,
          boxShadow: '0 12px 40px rgba(0,0,0,.5)', minWidth: 160,
        }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
      padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      fontSize: 12, fontFamily: 'DM Sans, sans-serif', color: active ? '#00d4e8' : '#8da4c2',
      fontWeight: active ? 600 : 400,
    }}>
      {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4e8', flexShrink: 0 }} />}
      {!active && <span style={{ width: 6, flexShrink: 0 }} />}
      {label}
    </button>
  );
}

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { summary, wsConnected, tenantFilter, setTenantFilter } = useFleetStore();
  const { user, logout } = useAuthStore();
  const { theme, colors, setTheme } = useThemeStore();
  const { tenants, fetchTenants } = useTenantsStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const v = summary?.vehicles;
  const a = summary?.alerts;

  const canManageUsers = ['admin', 'superadmin'].includes(user?.role || '');
  const isSuperadmin   = user?.role === 'superadmin';
  const onDashboard    = pathname === '/';
  const onUsersPage    = pathname === '/users';
  const onTenantsPage  = pathname === '/tenants';
  const onFleetPage    = pathname === '/fleet';

  // Load tenants list for superadmin tenant filter
  useEffect(() => {
    if (isSuperadmin && tenants.length === 0) fetchTenants();
  }, [isSuperadmin]);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('fleet_language', lng);
  };

  const kpi = (val: string | number | undefined, label: string, color = colors.text) => (
    <div style={{ textAlign: 'center', padding: '0 12px', borderRight: `1px solid rgba(255,255,255,.06)` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{val ?? '—'}</div>
      <div style={{ fontSize: 9, color: colors.muted, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );

  const navBtn = (label: string, icon: React.ReactNode, path: string, active: boolean) => (
    <button onClick={() => navigate(active && path !== '/fleet' ? '/' : path)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7,
      background: active ? `rgba(${theme === 'light' ? '0,120,136' : '0,212,232'},.15)` : 'rgba(255,255,255,.04)',
      border: `1px solid ${active ? (theme === 'light' ? 'rgba(0,120,136,.4)' : 'rgba(0,212,232,.4)') : 'rgba(255,255,255,.1)'}`,
      color: active ? colors.cyan : colors.muted,
      cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
    }}>
      {icon}<span>{active && path !== '/fleet' ? t('nav.back') : label}</span>
    </button>
  );

  const iconBtnStyle = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 10px', borderRadius: 7,
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
    color: colors.muted, cursor: 'pointer', fontSize: 12,
    fontFamily: 'DM Sans, sans-serif', transition: 'all .15s',
  } as React.CSSProperties;

  const themeLabels: Record<ThemeName, string> = {
    dark: t('themes.dark'),
    light: t('themes.light'),
    contrast: t('themes.contrast'),
  };

  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center',
      background: colors.navBg,
      borderBottom: `1px solid ${colors.sidebarBorder}`,
      padding: '0 20px', gap: 0,
      backdropFilter: 'blur(12px)', flexShrink: 0, zIndex: 30,
      transition: 'background .2s, border-color .2s',
    }}>
      {/* Logo */}
      <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 20, cursor: 'pointer' }}>
        <svg width="26" height="30" viewBox="0 0 28 32" fill="none">
          <polygon points="14,1 27,8 27,24 14,31 1,24 1,8" fill="none" stroke={colors.cyan} strokeWidth="1.8"/>
          <polygon points="14,6 22,11 22,21 14,26 6,21 6,11" fill={`${colors.cyan}18`} stroke={colors.cyan} strokeWidth="0.8" strokeOpacity="0.5"/>
          <line x1="1" y1="8" x2="27" y2="24" stroke={colors.cyan} strokeWidth="0.8" strokeOpacity="0.35"/>
          <line x1="27" y1="8" x2="1" y2="24" stroke={colors.cyan} strokeWidth="0.8" strokeOpacity="0.35"/>
          <circle cx="14" cy="16" r="3" fill={colors.cyan}/>
        </svg>
        <div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 13, color: colors.text, letterSpacing: 0.5 }}>FIRSTCITY AI</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: colors.cyan, letterSpacing: 1.5 }}>FLEET MANAGEMENT</div>
        </div>
      </div>

      {/* KPI strip — dashboard only */}
      {onDashboard ? (
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          {kpi(v?.total, t('kpi.total'))}
          {kpi(v?.active, t('kpi.active'), '#22c55e')}
          {kpi(v?.idle, t('kpi.idle'), '#f59e0b')}
          {kpi(v?.offline, t('kpi.offline'), '#64748b')}
          {kpi(v?.avg_speed ? `${v.avg_speed}` : '—', t('kpi.avg_speed'), colors.cyan)}
          {kpi(v?.avg_fuel ? `${v.avg_fuel}%` : '—', t('kpi.avg_fuel'))}
          {kpi(a?.critical ?? 0, t('kpi.critical'), a?.critical ? '#ef4444' : colors.text)}
          {kpi(a?.unread ?? 0, t('kpi.unread'), a?.unread ? '#f59e0b' : colors.text)}
        </div>
      ) : (
        <div style={{ flex: 1, padding: '0 16px' }}>
          {user?.tenant && !isSuperadmin && <span style={{ fontSize: 12, color: colors.muted, fontFamily: 'DM Sans, sans-serif' }}><span style={{ color: colors.cyan, fontWeight: 600 }}>{user.tenant.name}</span>{' · '}<span style={{ textTransform: 'capitalize' }}>{user.tenant.plan}</span> plan</span>}
          {isSuperadmin && <span style={{ fontSize: 12, color: '#f59e0b', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>{t('nav.platform_access')}</span>}
        </div>
      )}

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

        {/* Superadmin tenant filter */}
        {isSuperadmin && (
          <>
            <Dropdown trigger={
              <div style={{ ...iconBtnStyle, borderColor: tenantFilter ? 'rgba(245,158,11,.5)' : undefined, color: tenantFilter ? '#f59e0b' : colors.muted }}>
                <Filter size={13} />
                <span style={{ fontSize: 11, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tenantFilter ? (tenants.find(t => t.id === tenantFilter)?.name ?? 'Tenant') : t('common.all_tenants')}
                </span>
              </div>
            }>
              <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#3a5070', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>{t('common.filter_by_tenant')}</div>
              <DropItem label={t('common.all_tenants')} active={!tenantFilter} onClick={() => setTenantFilter(null)} />
              {tenants.filter(t => t.is_active).map(tenant => (
                <DropItem key={tenant.id} label={tenant.name} active={tenantFilter === tenant.id}
                  onClick={() => setTenantFilter(tenant.id, tenant.city, tenant.country)} />
              ))}
            </Dropdown>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)' }} />
          </>
        )}

        {/* Live status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: wsConnected ? '#22c55e' : '#ef4444' }}>
          {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{wsConnected ? t('nav.live') : t('nav.offline')}</span>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)' }} />

        {/* Theme switcher */}
        <Dropdown trigger={
          <div style={iconBtnStyle}>
            <Palette size={14} />
            <span style={{ fontSize: 11 }}>{themeLabels[theme]}</span>
          </div>
        }>
          <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#3a5070', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>{t('themes.label')}</div>
          {(['dark', 'light', 'contrast'] as ThemeName[]).map(th => (
            <DropItem key={th} label={themeLabels[th]} active={theme === th} onClick={() => setTheme(th)} />
          ))}
        </Dropdown>

        {/* Language switcher */}
        <Dropdown trigger={
          <div style={iconBtnStyle}>
            <Globe size={14} />
            <span style={{ fontSize: 11 }}>{i18n.language === 'ar' ? 'AR' : 'EN'}</span>
          </div>
        }>
          <div style={{ padding: '6px 14px 4px', fontSize: 10, color: '#3a5070', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>{t('language.label')}</div>
          <DropItem label="English" active={i18n.language === 'en'} onClick={() => changeLanguage('en')} />
          <DropItem label="العربية" active={i18n.language === 'ar'} onClick={() => changeLanguage('ar')} />
        </Dropdown>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)' }} />

        {navBtn(t('nav.fleet_mgmt'), <Layers size={14} />, '/fleet', onFleetPage)}
        {isSuperadmin   && navBtn(t('nav.tenants'), <Building2 size={14} />, '/tenants', onTenantsPage)}
        {canManageUsers && navBtn(t('nav.users'),   <UserCog  size={14} />, '/users',   onUsersPage)}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,.08)' }} />
        <div style={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
          <span style={{ color: colors.text }}>{user?.name}</span>
          {user?.tenant && <span style={{ color: colors.muted }}> · {user.tenant.name}</span>}
        </div>
        <button onClick={logout} title={t('nav.sign_out')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.muted, display: 'flex', padding: 4 }}>
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}
