import React, { useState, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';
import { useThemeStore } from '../../store/themeStore';
import { STATUS_COLOR, STATUS_BG, formatSpeed, formatFuel } from '../../utils/colors';
import type { VehicleStatus } from '../../types';

const STATUS_TABS: { id: VehicleStatus | 'all'; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'active',      label: 'Moving' },
  { id: 'idle',        label: 'Idle' },
  { id: 'offline',     label: 'Offline' },
  { id: 'maintenance', label: 'Maint.' },
];

export default function VehicleList() {
  const { vehicles, selectVehicle } = useFleetStore();
  const { colors } = useThemeStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || v.registration.toLowerCase().includes(q)
        || `${v.make} ${v.model}`.toLowerCase().includes(q)
        || (v.driver_name?.toLowerCase().includes(q) ?? false);
      return matchStatus && matchSearch;
    });
  }, [vehicles, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: vehicles.length };
    vehicles.forEach(v => { c[v.status] = (c[v.status] || 0) + 1; });
    return c;
  }, [vehicles]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)', color: colors.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vehicles or drivers..."
            dir="auto"
            style={{
              width: '100%', padding: '8px 10px', paddingInlineStart: 30,
              background: 'rgba(127,138,160,.08)', border: `1px solid ${colors.sidebarBorder}`,
              borderRadius: 8, color: colors.text, fontSize: 12,
              fontFamily: 'DM Sans, sans-serif', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 14px', flexShrink: 0, overflowX: 'auto' }}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, whiteSpace: 'nowrap',
              background: statusFilter === tab.id
                ? (tab.id === 'all' ? `${colors.cyan}1f` : STATUS_BG[tab.id as VehicleStatus])
                : 'rgba(127,138,160,.08)',
              color: statusFilter === tab.id
                ? (tab.id === 'all' ? colors.cyan : STATUS_COLOR[tab.id as VehicleStatus])
                : colors.muted,
            }}
          >
            {tab.label} <span style={{ opacity: 0.7 }}>{counts[tab.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Vehicle cards — dot + ID + driver by default; telemetry on hover */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 12px 12px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.muted, fontSize: 13, paddingTop: 40, fontFamily: 'DM Sans, sans-serif' }}>
            No vehicles found
          </div>
        )}
        {filtered.map(v => {
          const hovered = hoveredId === v.id;
          return (
            <div
              key={v.id}
              onClick={() => selectVehicle(v.id)}
              onMouseEnter={() => setHoveredId(v.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: '12px 14px', borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                background: hovered ? 'rgba(127,138,160,.07)' : 'transparent',
                border: `1px solid ${hovered ? `${colors.cyan}55` : colors.sidebarBorder}`,
                transition: 'background .15s, border-color .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_COLOR[v.status],
                  boxShadow: `0 0 0 3px ${STATUS_COLOR[v.status]}22`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 700, color: colors.text }}>
                      {v.registration}
                    </span>
                    {v.unread_alerts ? (
                      <span style={{ background: STATUS_COLOR.alert, color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 6px', fontWeight: 700, flexShrink: 0 }}>
                        {v.unread_alerts}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted, marginTop: 2, fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.driver_name || `${v.make} ${v.model}`}
                  </div>
                </div>
                <ChevronRight size={14} className="rtl-flip" style={{ color: colors.muted, opacity: 0.5, flexShrink: 0 }} />
              </div>

              {/* Secondary telemetry — hidden until hover */}
              <div style={{
                maxHeight: hovered ? 34 : 0, opacity: hovered ? 1 : 0, overflow: 'hidden',
                transition: 'max-height .18s ease, opacity .15s ease',
              }}>
                <div dir="ltr" style={{
                  display: 'flex', gap: 16, paddingTop: 9, marginTop: 9,
                  borderTop: `1px dashed ${colors.sidebarBorder}`,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: colors.muted,
                }}>
                  <span>{formatSpeed(v.current_speed)}</span>
                  <span>{formatFuel(v.current_fuel)} fuel</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.make} {v.model}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
