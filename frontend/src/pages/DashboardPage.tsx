import React, { useEffect } from 'react';
import FleetMap from '../components/map/FleetMap';
import MapControls from '../components/map/MapControls';
import Sidebar from '../components/common/Sidebar';
import Navbar from '../components/common/Navbar';
import { useFleetStore } from '../store/fleetStore';

export default function DashboardPage() {
  const { fetchVehicles, fetchAlerts, fetchGeofences, fetchDrivers, fetchSummary, connectWs } = useFleetStore();

  useEffect(() => {
    // Initial data load
    Promise.all([fetchVehicles(), fetchAlerts(), fetchGeofences(), fetchDrivers(), fetchSummary()]);

    // Connect WebSocket for live updates
    connectWs();

    // Refresh summary every 30s
    const interval = setInterval(() => {
      fetchSummary();
      fetchAlerts();
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050d1a', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <FleetMap />
          <MapControls />
        </div>
      </div>
    </div>
  );
}
