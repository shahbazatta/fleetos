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
 * floating chips scattered across the top of the map. Positioned with logical
 * properties so it mirrors automatically under RTL while the map stays fixed.
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
      style={{
        width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? `${colors.cyan}1f` : 'transparent',
        border: 'none', borderRadius: 8,
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
      display: 'flex', flexDirection: 'column', gap: 2, padding: 4,
      background: colors.navBg,
      border: `1px solid ${colors.sidebarBorder}`,
      borderRadius: 12, backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 28px rgba(10,20,40,.10)',
    }}>
      {dockBtn(showGeofences, () => setShowGeofences(!showGeofences), <Layers size={16} />, t('map.geofences'))}
      {dockBtn(showHeatmap,   () => setShowHeatmap(!showHeatmap),     <Thermometer size={16} />, t('map.alert_heat'))}
      {dockBtn(showTrails,    () => setShowTrails(!showTrails),       <Route size={16} />, t('map.trails'))}

      <div style={{ height: 1, background: colors.sidebarBorder, margin: '3px 6px' }} />

      {onDrawGeofence && dockBtn(false, onDrawGeofence, <PenTool size={16} />, t('map.draw_geofence'))}
      {dockBtn(false, () => fetchVehicles(), <RefreshCw size={16} />, t('map.refresh'))}

      {/* connection state — tiny dot, tooltip only (full LIVE pill lives in the navbar) */}
      <div
        title={wsConnected ? t('map.live', 'LIVE') : t('map.offline', 'OFFLINE')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 18 }}
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
