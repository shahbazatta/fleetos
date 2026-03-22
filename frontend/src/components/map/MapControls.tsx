import React from 'react';
import { Layers, Thermometer, Route, RefreshCw } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';

export default function MapControls() {
  const { showGeofences, showHeatmap, showTrails, setShowGeofences, setShowHeatmap, setShowTrails, fetchVehicles, wsConnected } = useFleetStore();

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px',
        background: active ? 'rgba(0,212,232,0.2)' : 'rgba(10,24,40,0.9)',
        border: `1px solid ${active ? 'rgba(0,212,232,0.6)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6,
        color: active ? '#00d4e8' : '#8da4c2',
        fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'all .15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 6, zIndex: 10, pointerEvents: 'auto',
    }}>
      {btn(showGeofences, () => setShowGeofences(!showGeofences), <Layers size={14} />, 'Geofences')}
      {btn(showHeatmap, () => setShowHeatmap(!showHeatmap), <Thermometer size={14} />, 'Alert Heat')}
      {btn(showTrails, () => setShowTrails(!showTrails), <Route size={14} />, 'Trails')}

      {/* Live indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 12px',
        background: 'rgba(10,24,40,0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        backdropFilter: 'blur(8px)',
        color: wsConnected ? '#22c55e' : '#ef4444',
        fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: wsConnected ? 'pulse 2s infinite' : 'none', display: 'inline-block' }} />
        {wsConnected ? 'LIVE' : 'OFFLINE'}
      </div>

      <button
        onClick={fetchVehicles}
        title="Refresh"
        style={{
          display: 'flex', alignItems: 'center',
          padding: '7px 10px',
          background: 'rgba(10,24,40,0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: '#8da4c2', cursor: 'pointer',
          backdropFilter: 'blur(8px)',
        }}
      >
        <RefreshCw size={14} />
      </button>
    </div>
  );
}
