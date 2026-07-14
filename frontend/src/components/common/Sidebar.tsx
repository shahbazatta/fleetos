import React from 'react';
import { Truck, Bell, Users, BarChart2, Layers } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFleetStore } from '../../store/fleetStore';
import { useFMStore } from '../../store/fmStore';
import { useThemeStore } from '../../store/themeStore';
import VehicleList from '../vehicles/VehicleList';
import VehicleDetail from '../vehicles/VehicleDetail';
import AlertsFeed from '../alerts/AlertsFeed';
import DriversTable from '../drivers/DriversTable';
import AnalyticsPanel from '../dashboard/AnalyticsPanel';
import { LayersPanel } from '../fm/GeofencesTab';

export default function Sidebar() {
  const { t } = useTranslation();
  const { sidebarTab, setSidebarTab, selectedVehicleId, selectVehicle, alerts } = useFleetStore();
  const { geofences: fmGeofences } = useFMStore();
  const { colors } = useThemeStore();
  const unreadCount = alerts.filter(a => !a.is_read).length;

  const TABS = [
    { id: 'vehicles'  as const, icon: <Truck size={16} />,     label: t('sidebar.fleet') },
    { id: 'alerts'    as const, icon: <Bell size={16} />,      label: t('sidebar.alerts') },
    { id: 'drivers'   as const, icon: <Users size={16} />,     label: t('sidebar.drivers') },
    { id: 'analytics' as const, icon: <BarChart2 size={16} />, label: t('sidebar.analytics') },
    { id: 'layers'    as const, icon: <Layers size={16} />,    label: t('sidebar.layers') },
  ];

  return (
    <div style={{
      width: 340, height: '100%', display: 'flex', flexDirection: 'column',
      background: colors.sidebarBg,
      borderInlineEnd: `1px solid ${colors.sidebarBorder}`,
      flexShrink: 0, zIndex: 20,
      transition: 'background .2s, border-color .2s',
    }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.sidebarBorder}`, flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setSidebarTab(t.id as any); if (t.id !== 'vehicles') selectVehicle(null); }}
            style={{
              flex: 1, padding: '10px 4px', minWidth: 52,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: sidebarTab === t.id ? `2px solid ${colors.tabActive}` : '2px solid transparent',
              color: sidebarTab === t.id ? colors.tabActive : colors.tabColor,
              fontSize: 9, fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              letterSpacing: 0.4, textTransform: 'uppercase',
              position: 'relative', transition: 'color .15s',
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon}
            {t.label}
            {t.id === 'alerts' && unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                background: '#e14b42', color: '#fff', borderRadius: 10,
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
          : sidebarTab === 'analytics'  ? <AnalyticsPanel />
          : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              <LayersPanel geofences={fmGeofences} />
            </div>
          )
        }
      </div>
    </div>
  );
}
