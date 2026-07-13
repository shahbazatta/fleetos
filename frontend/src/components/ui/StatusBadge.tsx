import React from 'react';

const MAP: Record<string, { color: string; bg: string }> = {
  active:      { color: 'var(--status-active, #22c55e)',      bg: 'rgba(34,197,94,.12)' },
  idle:        { color: 'var(--status-idle, #f59e0b)',        bg: 'rgba(245,158,11,.12)' },
  offline:     { color: 'var(--status-offline, #64748b)',     bg: 'rgba(100,116,139,.12)' },
  maintenance: { color: 'var(--status-maintenance, #a855f7)', bg: 'rgba(168,85,247,.12)' },
  alert:       { color: 'var(--status-alert, #ef4444)',       bg: 'rgba(239,68,68,.12)' },
  on_leave:    { color: 'var(--status-idle, #f59e0b)',        bg: 'rgba(245,158,11,.12)' },
  suspended:   { color: 'var(--status-alert, #ef4444)',       bg: 'rgba(239,68,68,.12)' },
  inactive:    { color: 'var(--status-offline, #64748b)',     bg: 'rgba(100,116,139,.12)' },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] || MAP.offline;
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600,
      background: m.bg, color: m.color, fontFamily: 'var(--font-body, DM Sans, sans-serif)',
      whiteSpace: 'nowrap', textTransform: 'capitalize',
    }}>
      {String(status).replace('_', ' ')}
    </span>
  );
}
