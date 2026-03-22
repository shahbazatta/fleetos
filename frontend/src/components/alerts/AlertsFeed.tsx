import React, { useState } from 'react';
import { CheckCheck, AlertTriangle, Info, Zap } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';
import { SEVERITY_COLOR, SEVERITY_BG, timeAgo } from '../../utils/colors';
import api from '../../services/api';
import type { AlertSeverity } from '../../types';

const ALERT_ICON: Record<string, React.ReactNode> = {
  speeding:        <Zap size={12} />,
  geofence_exit:   <AlertTriangle size={12} />,
  geofence_enter:  <AlertTriangle size={12} />,
  harsh_braking:   <AlertTriangle size={12} />,
  low_fuel:        <Info size={12} />,
  sos:             <AlertTriangle size={12} />,
  idle_timeout:    <Info size={12} />,
  maintenance_due: <Info size={12} />,
};

export default function AlertsFeed() {
  const { alerts, markAlertRead } = useFleetStore();
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);
  const unread = alerts.filter(a => !a.is_read).length;

  const markAll = async () => {
    await api.patch('/alerts/read-all');
    filtered.forEach(a => !a.is_read && markAlertRead(a.id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#8da4c2', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{unread}</span>
            {' '}unread alerts
          </div>
          {unread > 0 && (
            <button onClick={markAll} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
              color: '#5d7a9a', fontSize: 11, fontFamily: 'DM Sans, sans-serif',
            }}>
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
        </div>
        {/* Severity filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'critical', 'warning', 'info'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
              background: filter === s
                ? (s === 'all' ? 'rgba(0,212,232,.2)' : SEVERITY_BG[s])
                : 'rgba(255,255,255,.04)',
              color: filter === s
                ? (s === 'all' ? '#00d4e8' : SEVERITY_COLOR[s])
                : '#5d7a9a',
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {' '}<span style={{ opacity: 0.7 }}>
                {s === 'all' ? alerts.length : alerts.filter(a => a.severity === s).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#5d7a9a', fontSize: 13, paddingTop: 40, fontFamily: 'DM Sans, sans-serif' }}>
            No alerts
          </div>
        )}
        {filtered.map(a => (
          <div
            key={a.id}
            onClick={() => !a.is_read && markAlertRead(a.id)}
            style={{
              padding: '9px 10px', marginBottom: 3, borderRadius: 7,
              background: a.is_read ? 'rgba(255,255,255,.02)' : SEVERITY_BG[a.severity],
              border: `1px solid ${a.is_read ? 'rgba(255,255,255,.04)' : SEVERITY_COLOR[a.severity] + '40'}`,
              borderLeft: `3px solid ${SEVERITY_COLOR[a.severity]}`,
              cursor: a.is_read ? 'default' : 'pointer',
              opacity: a.is_read ? 0.6 : 1,
              transition: 'opacity .15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: SEVERITY_COLOR[a.severity], marginTop: 1, flexShrink: 0 }}>
                {ALERT_ICON[a.type] || <AlertTriangle size={12} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf0', fontFamily: 'DM Sans, sans-serif' }}>
                    {a.title}
                  </span>
                  <span style={{ fontSize: 9, color: '#3a5070', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>
                    {timeAgo(a.occurred_at)}
                  </span>
                </div>
                {a.registration && (
                  <span style={{ fontSize: 10, color: '#00d4e8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {a.registration}
                  </span>
                )}
                {a.message && (
                  <div style={{ fontSize: 10, color: '#5d7a9a', marginTop: 2, fontFamily: 'DM Sans, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.message}
                  </div>
                )}
              </div>
              {!a.is_read && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLOR[a.severity], flexShrink: 0, marginTop: 4 }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
