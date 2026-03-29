import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Truck, MapPin, Warehouse, ArrowLeft, RefreshCw, Route } from 'lucide-react';
import { useFMStore } from '../store/fmStore';
import { useAuthStore } from '../store/authStore';
import { useFleetStore } from '../store/fleetStore';
import { useTenantsStore } from '../store/tenantsStore';
import AppLayout from './AppLayout';
import DriversTab   from '../components/fm/DriversTab';
import VehiclesTab  from '../components/fm/VehiclesTab';
import GeofencesTab from '../components/fm/GeofencesTab';
import DepotsTab    from '../components/fm/DepotsTab';
import RoutesTab    from '../components/fm/RoutesTab';
import { C } from '../components/fm/FMShared';

type Tab = 'drivers' | 'vehicles' | 'geofences' | 'depots' | 'routes';

export default function FleetManagementPage() {
  const { t } = useTranslation();
  const { fetchAll, isLoading, summary, loadLayers } = useFMStore();
  const { user } = useAuthStore();
  const { tenantFilter } = useFleetStore();
  const { tenants, fetchTenants } = useTenantsStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<Tab>('drivers');

  const isSuperadmin = user?.role === 'superadmin';

  const TABS: { id: Tab; icon: React.ReactNode; label: string; summaryKey: Tab }[] = [
    { id: 'drivers',   icon: <Users     size={15} />, label: t('fleet_mgmt.tabs.drivers'),   summaryKey: 'drivers'   },
    { id: 'vehicles',  icon: <Truck     size={15} />, label: t('fleet_mgmt.tabs.vehicles'),  summaryKey: 'vehicles'  },
    { id: 'geofences', icon: <MapPin    size={15} />, label: t('fleet_mgmt.tabs.geofences'), summaryKey: 'geofences' },
    { id: 'depots',    icon: <Warehouse size={15} />, label: t('fleet_mgmt.tabs.depots'),    summaryKey: 'depots'    },
    { id: 'routes',    icon: <Route     size={15} />, label: 'Routes',                       summaryKey: 'routes'    },
  ];

  useEffect(() => {
    if (isSuperadmin && tenants.length === 0) fetchTenants();
  }, [isSuperadmin]);

  useEffect(() => {
    const tid = tenantFilter || undefined;
    fetchAll(tid);
    const layerTenant = tenantFilter || user?.tenant_id;
    if (layerTenant) loadLayers(layerTenant);
  }, [tenantFilter, user?.tenant_id]);

  return (
    <AppLayout>
      <div style={{ flex: 1, overflow: 'auto', background: C.bg }}>

        {/* ── Page header ── */}
        <div style={{ background: '#0a1828', borderBottom: `1px solid ${C.border}`, padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => navigate('/')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, borderRadius: 7, color: '#8da4c2', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
              >
                <ArrowLeft size={13} /> {t('fleet_mgmt.back')}
              </button>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: C.text }}>
                  {t('fleet_mgmt.title')}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: 'DM Sans, sans-serif' }}>
                  {isSuperadmin && tenantFilter
                    ? <>
                        {t('fleet_mgmt.filtering_by')}{' '}
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                          {tenants.find(t => t.id === tenantFilter)?.name ?? 'Tenant'}
                        </span>
                      </>
                    : <>{user?.tenant ? user.tenant.name : ''} — {t('fleet_mgmt.subtitle')}</>
                  }
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {/* Summary pills */}
              {summary && TABS.map(tab => {
                const s = summary[tab.summaryKey];
                if (!s) return null;
                return (
                  <div key={tab.id} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: C.cyan, lineHeight: 1 }}>{s.total}</div>
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>{tab.label}</div>
                  </div>
                );
              })}
              <button
                onClick={() => fetchAll(tenantFilter || undefined)}
                disabled={isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, borderRadius: 8, color: '#8da4c2', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}
              >
                <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                {isLoading ? t('fleet_mgmt.loading') : t('fleet_mgmt.refresh')}
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(tab => {
              const s = summary?.[tab.summaryKey];
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: isActive ? `2px solid ${C.cyan}` : '2px solid transparent',
                    color: isActive ? C.cyan : C.muted,
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13,
                    transition: 'color .15s',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                  {s && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: isActive ? 'rgba(0,212,232,.15)' : 'rgba(255,255,255,.06)', color: isActive ? C.cyan : C.muted }}>
                      {s.total}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ padding: '24px 32px' }}>
          {activeTab === 'drivers'   && <DriversTab />}
          {activeTab === 'vehicles'  && <VehiclesTab />}
          {activeTab === 'geofences' && <GeofencesTab />}
          {activeTab === 'depots'    && <DepotsTab />}
          {activeTab === 'routes'    && <RoutesTab />}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #0a1828; color: #e8eaf0; }
      `}</style>
    </AppLayout>
  );
}
