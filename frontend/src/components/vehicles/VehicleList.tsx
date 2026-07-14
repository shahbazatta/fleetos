import React, { useState, useMemo } from 'react';
import { Search, ChevronDown } from 'lucide-react';
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
  // Tap-to-expand works without hover (required for touch/PWA). Desktop hover
  // still previews via hoveredId feeding the same open state.
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
          <Search size={14} style={{ position: 'absolute', insetInlineStart: 11, top: '50%', transform: 'translateY(-50%)', color: colors.muted }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vehicles or drivers..."
            dir="auto"
            style={{
              width: '100%', padding: '11px 12px', paddingInlineStart: 34,
              background: 'var(--fill-04)', border: `1px solid ${colors.sidebarBorder}`,
              borderRadius: 10, color: colors.text, fontSize: 13,
              fontFamily: 'DM Sans, sans-serif', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 5, padding: '12px 14px', flexShrink: 0, overflowX: 'auto' }}>
        {STATUS_TABS.map(tab => {
          const on = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              style={{
                padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, whiteSpace: 'nowrap',
                background: on
                  ? (tab.id === 'all' ? 'var(--acc-15)' : STATUS_BG[tab.id as VehicleStatus])
                  : 'var(--fill-04)',
                color: on
                  ? (tab.id === 'all' ? colors.cyan : STATUS_COLOR[tab.id as VehicleStatus])
                  : colors.muted,
                transition: 'background .15s, color .15s',
              }}
            >
              {tab.label} <span style={{ opacity: 0.7 }}>{counts[tab.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Vehicle cards — dot + ID + driver by default; telemetry on tap/hover */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2px 12px 14px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.muted, fontSize: 13, paddingTop: 40, fontFamily: 'DM Sans, sans-serif' }}>
            No vehicles found
          </div>
        )}
        {filtered.map(v => {
          const open = expandedId === v.id || hoveredId === v.id;
          return (
            <div
              key={v.id}
              onMouseEnter={() => setHoveredId(v.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                borderRadius: 12, marginBottom: 8,
                background: open ? 'var(--fill-04)' : 'transparent',
                border: `1px solid ${open ? 'var(--acc-30)' : colors.sidebarBorder}`,
                transition: 'background .15s, border-color .15s',
              }}
            >
              <div
                onClick={() => selectVehicle(v.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px', cursor: 'pointer', minHeight: 48 }}
              >
                <span style={{
                  width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_COLOR[v.status],
                  boxShadow: `0 0 0 3px ${STATUS_COLOR[v.status]}22`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span dir="ltr" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, fontWeight: 700, color: colors.text }}>
                      {v.registration}
                    </span>
                    {v.unread_alerts ? (
                      <span style={{ background: '#e14b42', color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 6px', fontWeight: 700, flexShrink: 0 }}>
                        {v.unread_alerts}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12.5, color: colors.muted, marginTop: 3, fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.driver_name || `${v.make} ${v.model}`}
                  </div>
                </div>
                {/* expand toggle — does not trigger card select */}
                <button
                  aria-label="Toggle details"
                  aria-expanded={open}
                  className="touch-target"
                  onClick={(e) => { e.stopPropagation(); setExpandedId(id => id === v.id ? null : v.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8, color: colors.muted,
                  }}
                >
                  <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
                </button>
              </div>

              {/* Secondary telemetry — revealed by tap or hover */}
              <div style={{
                maxHeight: open ? 46 : 0, opacity: open ? 1 : 0, overflow: 'hidden',
                transition: 'max-height .2s ease, opacity .15s ease',
              }}>
                <div dir="ltr" style={{
                  display: 'flex', gap: 18, margin: '0 14px', padding: '11px 0 13px',
                  borderTop: `1px dashed ${colors.sidebarBorder}`,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, color: colors.muted,
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
