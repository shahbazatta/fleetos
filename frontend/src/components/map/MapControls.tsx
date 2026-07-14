import React from 'react';
import { Layers, Thermometer, Route, RefreshCw, PenTool } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFleetStore } from '../../store/fleetStore';
import { useThemeStore } from '../../store/themeStore';

interface Props {
  onDrawGeofence?: () => void;
}

/**
 * Unified vertical map dock (CAD/Figma-style) — replaces the previous row of
 * floating chips. Positioned with logical properties so it mirrors under RTL
 * while the map stays fixed. Buttons are 44px with a >=48px coarse-pointer
 * hit area (.touch-target) for PWA/tablet use.
 */
export default function MapControls({ onDrawGeofence }: Props) {
  const { t } = useTranslation();
  const { colors } = useThemeStore();
  const { showGeofences, showHeatmap, showTrails, setShowGeofences, setShowHeatmap, setShowTrails, fetchVehicles, wsConnected } = useFleetStore();

  const dockBtn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="touch-target"
      style={{
        width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--acc-15)' : 'transparent',
        border: 'none', borderRadius: 10,
        color: active ? colors.cyan : colors.muted,
        cursor: 'pointer', transition: 'background .15s, color .15s',
      }}
    >
      {icon}
    </button>
  );

  return (
    <div style={{
      position: 'absolute', insetInlineEnd: 16, top: 16, zIndex: 10,
      display: 'flex', flexDirection: 'column', gap: 3, padding: 5,
      background: colors.navBg,
      border: `1px solid ${colors.sidebarBorder}`,
      borderRadius: 14, backdropFilter: 'blur(10px)',
      boxShadow: 'var(--shadow-pop)',
    }}>
      {dockBtn(showGeofences, () => setShowGeofences(!showGeofences), <Layers size={18} />, t('map.geofences'))}
      {dockBtn(showHeatmap,   () => setShowHeatmap(!showHeatmap),     <Thermometer size={18} />, t('map.alert_heat'))}
      {dockBtn(showTrails,    () => setShowTrails(!showTrails),       <Route size={18} />, t('map.trails'))}

      <div style={{ height: 1, background: colors.sidebarBorder, margin: '3px 7px' }} />

      {onDrawGeofence && dockBtn(false, onDrawGeofence, <PenTool size={18} />, t('map.draw_geofence'))}
      {dockBtn(false, () => fetchVehicles(), <RefreshCw size={18} />, t('map.refresh'))}

      {/* connection state — tiny dot, tooltip only (full LIVE pill lives in navbar) */}
      <div
        title={wsConnected ? t('map.live', 'LIVE') : t('map.offline', 'OFFLINE')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20 }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: wsConnected ? '#0f9d74' : '#e14b42',
          animation: wsConnected ? 'pulse 2s infinite' : 'none',
        }} />
      </div>
    </div>
  );
}
