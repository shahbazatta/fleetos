import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Truck, MapPin, Warehouse, ArrowLeft, RefreshCw } from 'lucide-react';
import { useFMStore } from '../store/fmStore';
import { useAuthStore } from '../store/authStore';
import AppLayout from './AppLayout';
import DriversTab   from '../components/fm/DriversTab';
import VehiclesTab  from '../components/fm/VehiclesTab';
import GeofencesTab from '../components/fm/GeofencesTab';
import DepotsTab    from '../components/fm/DepotsTab';
import { C } from '../components/fm/FMShared';

type Tab = 'drivers' | 'vehicles' | 'geofences' | 'depots';

const TABS: { id: Tab; icon: React.ReactNode; label: string; summaryKey: 'drivers' | 'vehicles' | 'geofences' | 'depots' }[] = [
  { id: 'drivers',   icon: <Users    size={15} />, label: 'Drivers',   summaryKey: 'drivers'   },
  { id: 'vehicles',  icon: <Truck    size={15} />, label: 'Vehicles',  summaryKey: 'vehicles'  },
  { id: 'geofences', icon: <MapPin   size={15} />, label: 'Geofences', summaryKey: 'geofences' },
  { id: 'depots',    icon: <Warehouse size={15}/>, label: 'Depots',    summaryKey: 'depots'    },
];

export default function FleetManagementPage() {
  const { fetchAll, isLoading, summary, loadLayers } = useFMStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<Tab>('drivers');

  useEffect(() => {
    fetchAll();
    // Load saved layers from localStorage
    if (user?.tenant_id) loadLayers(user.tenant_id);
  }, [user?.tenant_id]);

  return (
    <AppLayout>
      <div style={{ flex: 1, overflow: 'auto', background: C.bg }}>

        {/* ── Page header ── */}
        <div style={{ background: '#0a1828', borderBottom: `1px solid ${C.border}`, padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, borderRadius: 7, color: '#8da4c2', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                <ArrowLeft size={13} /> Dashboard
              </button>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: C.text }}>Fleet Management</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: 'DM Sans, sans-serif' }}>
                  {user?.tenant ? user.tenant.name : 'Manage'} — drivers, vehicles, geofences and depots
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {/* Summary pills */}
              {summary && TABS.map(t => {
                const s = summary[t.summaryKey];
                return (
                  <div key={t.id} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: C.cyan, lineHeight: 1 }}>{s.total}</div>
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>{t.label}</div>
                  </div>
                );
              })}
              <button onClick={() => fetchAll()} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, borderRadius: 8, color: '#8da4c2', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => {
              const s = summary?.[t.summaryKey];
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: isActive ? `2px solid ${C.cyan}` : '2px solid transparent',
                    color: isActive ? C.cyan : C.muted,
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 600, fontSize: 13,
                    transition: 'color .15s',
                  }}
                >
                  {t.icon}
                  {t.label}
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
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        select option { background: #0a1828; color: #e8eaf0; }
      `}</style>
    </AppLayout>
  );
}
