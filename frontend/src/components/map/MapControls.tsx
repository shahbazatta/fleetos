import React from 'react';
import { Layers, Thermometer, Route, RefreshCw, PenTool } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFleetStore } from '../../store/fleetStore';

interface Props {
  onDrawGeofence?: () => void;
}

export default function MapControls({ onDrawGeofence }: Props) {
  const { t } = useTranslation();
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
      display: 'flex', gap: 6, zIndex: 10, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center',
    }}>
      {btn(showGeofences, () => setShowGeofences(!showGeofences), <Layers size={14} />, t('map.geofences'))}
      {btn(showHeatmap, () => setShowHeatmap(!showHeatmap), <Thermometer size={14} />, t('map.alert_heat'))}
      {btn(showTrails, () => setShowTrails(!showTrails), <Route size={14} />, t('map.trails'))}

      {onDrawGeofence && (
        <button
          onClick={onDrawGeofence}
          title={t('map.draw_geofence')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px',
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 6,
            color: '#22c55e',
            fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all .15s',
            whiteSpace: 'nowrap',
          }}
        >
          <PenTool size={14} />{t('map.draw_geofence')}
        </button>
      )}

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
        {wsConnected ? t('map.live', 'LIVE') : t('map.offline', 'OFFLINE')}
      </div>

      <button
        onClick={fetchVehicles}
        title={t('map.refresh')}
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
