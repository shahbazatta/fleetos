import React, { useEffect } from 'react';
import FleetMap from '../components/map/FleetMap';
import MapControls from '../components/map/MapControls';
import Sidebar from '../components/common/Sidebar';
import AppLayout from './AppLayout';
import { useFleetStore } from '../store/fleetStore';

export default function DashboardPage() {
  const { fetchVehicles, fetchAlerts, fetchGeofences, fetchDrivers, fetchSummary, connectWs } = useFleetStore();

  useEffect(() => {
    Promise.all([fetchVehicles(), fetchAlerts(), fetchGeofences(), fetchDrivers(), fetchSummary()]);
    connectWs();
    const interval = setInterval(() => { fetchSummary(); fetchAlerts(); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppLayout>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FleetMap />
          <MapControls />
        </div>
      </div>
    </AppLayout>
  );
}
