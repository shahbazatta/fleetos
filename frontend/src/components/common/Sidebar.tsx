import React from 'react';
import { Truck, Bell, Users, BarChart2, UserCog } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';
import { useAuthStore } from '../../store/authStore';
import VehicleList from '../vehicles/VehicleList';
import VehicleDetail from '../vehicles/VehicleDetail';
import AlertsFeed from '../alerts/AlertsFeed';
import DriversTable from '../drivers/DriversTable';
import AnalyticsPanel from '../dashboard/AnalyticsPanel';
import UsersPage from '../users/UsersPage';

export type SidebarTab = 'vehicles' | 'alerts' | 'drivers' | 'analytics' | 'users';

export default function Sidebar() {
  const { sidebarTab, setSidebarTab, selectedVehicleId, selectVehicle, alerts } = useFleetStore();
  const { user } = useAuthStore();

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const canManageUsers = user?.role === 'admin' || user?.role === 'superadmin';

  const tabs: { id: SidebarTab; icon: React.ReactNode; label: string; badge?: number; adminOnly?: boolean }[] = [
    { id: 'vehicles',   icon: <Truck size={16} />,    label: 'Fleet' },
    { id: 'alerts',     icon: <Bell size={16} />,     label: 'Alerts', badge: unreadCount },
    { id: 'drivers',    icon: <Users size={16} />,    label: 'Drivers' },
    { id: 'analytics',  icon: <BarChart2 size={16} />, label: 'Analytics' },
    { id: 'users',      icon: <UserCog size={16} />,  label: 'Users', adminOnly: true },
  ].filter(t => !t.adminOnly || canManageUsers);

  return (
    <div style={{
      width: 340, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0a1828',
      borderRight: '1px solid rgba(0,212,232,.1)',
      flexShrink: 0,
      zIndex: 20,
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,212,232,.1)', flexShrink: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setSidebarTab(t.id); if (t.id !== 'vehicles') selectVehicle(null); }}
            style={{
              flex: 1, padding: '12px 4px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: sidebarTab === t.id ? '2px solid #00d4e8' : '2px solid transparent',
              color: sidebarTab === t.id ? '#00d4e8' : '#5d7a9a',
              fontSize: 10, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              letterSpacing: 0.5, textTransform: 'uppercase',
              position: 'relative', transition: 'color .15s',
            }}
          >
            {t.icon}
            {t.label}
            {t.badge ? (
              <span style={{
                position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                background: '#ef4444', color: '#fff', borderRadius: 10,
                fontSize: 9, padding: '1px 5px', fontWeight: 700, lineHeight: 1.4,
              }}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {sidebarTab === 'vehicles' && selectedVehicleId
          ? <VehicleDetail vehicleId={selectedVehicleId} onBack={() => selectVehicle(null)} />
          : sidebarTab === 'vehicles'   ? <VehicleList />
          : sidebarTab === 'alerts'     ? <AlertsFeed />
          : sidebarTab === 'drivers'    ? <DriversTable />
          : sidebarTab === 'analytics'  ? <AnalyticsPanel />
          : sidebarTab === 'users'      ? <UsersPage />
          : null
        }
      </div>
    </div>
  );
}
