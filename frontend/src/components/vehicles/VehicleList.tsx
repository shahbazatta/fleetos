import React, { useState, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';
import { STATUS_COLOR, STATUS_BG, TYPE_EMOJI, formatSpeed, formatFuel, timeAgo } from '../../utils/colors';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');

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
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5d7a9a' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vehicles or drivers..."
            style={{
              width: '100%', padding: '8px 10px 8px 30px',
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 6, color: '#e8eaf0', fontSize: 12,
              fontFamily: 'DM Sans, sans-serif', outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 14px', flexShrink: 0, overflowX: 'auto' }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            style={{
              padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontFamily: 'DM Sans, sans-serif', fontWeight: 600, whiteSpace: 'nowrap',
              background: statusFilter === t.id
                ? (t.id === 'all' ? 'rgba(0,212,232,.2)' : STATUS_BG[t.id as VehicleStatus])
                : 'rgba(255,255,255,.04)',
              color: statusFilter === t.id
                ? (t.id === 'all' ? '#00d4e8' : STATUS_COLOR[t.id as VehicleStatus])
                : '#5d7a9a',
            }}
          >
            {t.label} <span style={{ opacity: 0.7 }}>{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Vehicle rows */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#5d7a9a', fontSize: 13, paddingTop: 40, fontFamily: 'DM Sans, sans-serif' }}>
            No vehicles found
          </div>
        )}
        {filtered.map(v => (
          <div
            key={v.id}
            onClick={() => selectVehicle(v.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 10px',
              borderRadius: 8, cursor: 'pointer', marginBottom: 2,
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.04)',
              transition: 'background .15s, border-color .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,212,232,.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,212,232,.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,.02)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.04)'; }}
          >
            {/* Status dot + emoji */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 18,
                background: 'rgba(255,255,255,.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {TYPE_EMOJI[v.type]}
              </div>
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 10, height: 10, borderRadius: '50%',
                background: STATUS_COLOR[v.status],
                border: '1.5px solid #0a1828',
              }} />
            </div>

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color: '#00d4e8' }}>
                  {v.registration}
                </span>
                {v.unread_alerts ? (
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 5px', fontWeight: 700 }}>
                    {v.unread_alerts}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: '#8da4c2', marginTop: 1, fontFamily: 'DM Sans, sans-serif' }}>
                {v.make} {v.model}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: v.current_speed > 0 ? '#22c55e' : '#5d7a9a', fontFamily: 'JetBrains Mono, monospace' }}>
                  {formatSpeed(v.current_speed)}
                </span>
                <span style={{ fontSize: 10, color: v.current_fuel < 20 ? '#ef4444' : '#5d7a9a', fontFamily: 'JetBrains Mono, monospace' }}>
                  ⛽ {formatFuel(v.current_fuel)}
                </span>
                {v.driver_name && (
                  <span style={{ fontSize: 10, color: '#5d7a9a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    👤 {v.driver_name.split(' ')[0]}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight size={14} style={{ color: '#3a5070', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
