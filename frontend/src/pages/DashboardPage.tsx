import React, { useEffect, useState } from 'react';
import FleetMap from '../components/map/FleetMap';
import MapControls from '../components/map/MapControls';
import Sidebar from '../components/common/Sidebar';
import GeofenceDrawModal from '../components/map/GeofenceDrawModal';
import AppLayout from './AppLayout';
import { useFleetStore } from '../store/fleetStore';
import { useFMStore } from '../store/fmStore';
import { useAuthStore } from '../store/authStore';
import type { Geofence } from '../types';

export default function DashboardPage() {
  const { fetchVehicles, fetchAlerts, fetchGeofences, fetchDrivers, fetchSummary, connectWs, tenantFilter } = useFleetStore();
  const { fetchGeofencesOnly, loadLayers } = useFMStore();
  const { user } = useAuthStore();

  const [drawOpen, setDrawOpen] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState<Geofence | null>(null);

  useEffect(() => {
    Promise.all([fetchVehicles(), fetchAlerts(), fetchGeofences(), fetchDrivers(), fetchSummary()]);
    connectWs();
    const interval = setInterval(() => { fetchSummary(); fetchAlerts(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Load FM geofences and layers for the Layers sidebar panel — re-runs on tenant filter change
  useEffect(() => {
    fetchGeofencesOnly(tenantFilter || undefined);
    const layerTenant = tenantFilter || user?.tenant_id;
    if (layerTenant) loadLayers(layerTenant);
  }, [user?.tenant_id, tenantFilter]);

  const handleEditGeofence = (g: Geofence) => {
    // Cast Geofence → FMGeofence-compatible for the draw modal
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
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
