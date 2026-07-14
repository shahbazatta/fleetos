import React, { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import FleetMap from '../components/map/FleetMap';
import MapControls from '../components/map/MapControls';
import Sidebar from '../components/common/Sidebar';
import GeofenceDrawModal from '../components/map/GeofenceDrawModal';
import AppLayout from './AppLayout';
import { useFleetStore } from '../store/fleetStore';
import { useFMStore } from '../store/fmStore';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import type { Geofence } from '../types';

export default function DashboardPage() {
  const { fetchVehicles, fetchAlerts, fetchGeofences, fetchDrivers, fetchSummary, connectWs, tenantFilter } = useFleetStore();
  const { fetchGeofencesOnly, loadLayers } = useFMStore();
  const { user } = useAuthStore();
  const { colors } = useThemeStore();

  const [drawOpen, setDrawOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile off-canvas sidebar

  const { flyToTenant, selectedVehicleId } = useFleetStore();

  useEffect(() => {
    Promise.all([fetchVehicles(), fetchAlerts(), fetchGeofences(), fetchDrivers(), fetchSummary()]);
    connectWs();
    if (user?.tenant) {
      flyToTenant(user.tenant.city, user.tenant.country);
    }
    const interval = setInterval(() => { fetchSummary(); fetchAlerts(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchGeofencesOnly(tenantFilter || undefined);
    const layerTenant = tenantFilter || user?.tenant_id;
    if (layerTenant) loadLayers(layerTenant);
  }, [user?.tenant_id, tenantFilter]);

  // Selecting a vehicle on mobile opens the drawer so the detail is visible
  useEffect(() => { if (selectedVehicleId) setDrawerOpen(true); }, [selectedVehicleId]);

  const handleEditGeofence = (g: Geofence) => {
    setEditingGeofence(g);
    setDrawOpen(true);
  };

  const handleDrawClose = () => {
    setDrawOpen(false);
    setEditingGeofence(null);
    fetchGeofencesOnly();
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div data-mobile-sidebar data-open={drawerOpen ? 'true' : 'false'} style={{ height: '100%', display: 'flex', flexShrink: 0 }}>
          <Sidebar />
        </div>

        {/* Scrim behind the drawer on mobile */}
        {drawerOpen && <div className="mobile-scrim" onClick={() => setDrawerOpen(false)} />}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Mobile-only drawer toggle */}
          <button
            className="mobile-sidebar-toggle touch-target"
            aria-label="Toggle fleet panel"
            onClick={() => setDrawerOpen(o => !o)}
            style={{
              position: 'absolute', top: 16, insetInlineStart: 16, zIndex: 61,
              width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
              background: colors.navBg, border: `1px solid ${colors.sidebarBorder}`,
              borderRadius: 12, color: colors.text, cursor: 'pointer',
              backdropFilter: 'blur(10px)', boxShadow: 'var(--shadow-pop)',
            }}
          >
            <Menu size={20} />
          </button>

          <FleetMap onEditGeofence={handleEditGeofence} />
          <MapControls onDrawGeofence={() => { setEditingGeofence(null); setDrawOpen(true); }} />
        </div>
      </div>

      {drawOpen && (
        <GeofenceDrawModal
          geofenceToEdit={editingGeofence as any}
          onClose={handleDrawClose}
        />
      )}
    </AppLayout>
  );
}
