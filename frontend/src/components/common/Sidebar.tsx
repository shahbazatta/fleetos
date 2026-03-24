import React from 'react';
import { Truck, Bell, Users, BarChart2 } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';
import VehicleList from '../vehicles/VehicleList';
import VehicleDetail from '../vehicles/VehicleDetail';
import AlertsFeed from '../alerts/AlertsFeed';
import DriversTable from '../drivers/DriversTable';
import AnalyticsPanel from '../dashboard/AnalyticsPanel';

const TABS = [
  { id: 'vehicles'  as const, icon: <Truck size={16} />,     label: 'Fleet' },
  { id: 'alerts'    as const, icon: <Bell size={16} />,      label: 'Alerts' },
  { id: 'drivers'   as const, icon: <Users size={16} />,     label: 'Drivers' },
  { id: 'analytics' as const, icon: <BarChart2 size={16} />, label: 'Analytics' },
];

export default function Sidebar() {
  const { sidebarTab, setSidebarTab, selectedVehicleId, selectVehicle, alerts } = useFleetStore();
  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <div style={{
      width: 340, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0a1828',
      borderRight: '1px solid rgba(0,212,232,.1)',
      flexShrink: 0, zIndex: 20,
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,212,232,.1)', flexShrink: 0 }}>
        {TABS.map(t => (
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
            {t.id === 'alerts' && unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                background: '#ef4444', color: '#fff', borderRadius: 10,
                fontSize: 9, padding: '1px 5px', fontWeight: 700, lineHeight: 1.4,
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
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
          : <AnalyticsPanel />
        }
      </div>
    </div>
  );
}
