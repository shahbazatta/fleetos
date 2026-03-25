import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';

// ── CSS vars ─────────────────────────────────────────────────────────────────
export const C = {
  bg:      '#050d1a',
  surface: '#0a1828',
  border:  'rgba(0,212,232,.12)',
  borderW: 'rgba(255,255,255,.07)',
  text:    '#e8eaf0',
  muted:   '#5d7a9a',
  dim:     '#3a5070',
  cyan:    '#00d4e8',
  green:   '#22c55e',
  amber:   '#f59e0b',
  red:     '#ef4444',
  purple:  '#a78bfa',
};

export const inp: React.CSSProperties = {
  width: '100%', padding: '9px 11px',
  background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`,
  borderRadius: 7, color: C.text, fontSize: 13,
  fontFamily: 'DM Sans, sans-serif', outline: 'none',
};
export const lbl: React.CSSProperties = {
  fontSize: 11, color: C.muted, letterSpacing: 1,
  textTransform: 'uppercase', display: 'block',
  marginBottom: 5, fontFamily: 'DM Sans, sans-serif',
};
export const sel: React.CSSProperties = {
  ...inp, cursor: 'pointer',
};

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, subtitle, onClose, children, width = 520 }: {
  title: string; subtitle?: string; onClose: () => void;
  children: React.ReactNode; width?: number;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 80px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: `1px solid ${C.borderW}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: C.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, display: 'flex', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ overflow: 'auto', flex: 1, padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

// ── ConfirmDelete ─────────────────────────────────────────────────────────────
export function ConfirmDelete({ name, entity, onConfirm, onCancel }: {
  name: string; entity: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.surface, border: '1px solid rgba(239,68,68,.3)', borderRadius: 14, padding: 28, maxWidth: 380, width: '100%' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red }}>
            <Trash2 size={17} />
          </div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 5 }}>Delete {entity}?</div>
            <div style={{ fontSize: 13, color: '#8da4c2', lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>{name}</strong> will be permanently removed. This cannot be undone.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 13 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13, fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 0 }}><X size={13} /></button>}
    </div>
  );
}

// ── SaveButton ────────────────────────────────────────────────────────────────
export function SaveButton({ saving, label = 'Save Changes', onCreate = false }: { saving: boolean; label?: string; onCreate?: boolean }) {
  return (
    <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: saving ? 'rgba(0,212,232,.4)' : C.cyan, color: C.bg, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14 }}>
      {saving ? 'Saving...' : label}
    </button>
  );
}

// ── CancelButton ──────────────────────────────────────────────────────────────
export function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: '11px', borderRadius: 8, background: 'rgba(255,255,255,.04)', border: `1px solid ${C.borderW}`, color: '#8da4c2', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 13 }}>
      Cancel
    </button>
  );
}

// ── FormRow ───────────────────────────────────────────────────────────────────
export function FormRow({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label: fieldLabel, span, children }: { label: string; span?: number; children: React.ReactNode }) {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : {}}>
      <label style={lbl}>{fieldLabel}</label>
      {children}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    active:      { color: C.green,  bg: 'rgba(34,197,94,.12)' },
    idle:        { color: C.amber,  bg: 'rgba(245,158,11,.12)' },
    offline:     { color: C.muted,  bg: 'rgba(100,116,139,.12)' },
    maintenance: { color: C.purple, bg: 'rgba(168,85,247,.12)' },
    alert:       { color: C.red,    bg: 'rgba(239,68,68,.12)' },
    on_leave:    { color: C.amber,  bg: 'rgba(245,158,11,.12)' },
    suspended:   { color: C.red,    bg: 'rgba(239,68,68,.12)' },
    inactive:    { color: C.muted,  bg: 'rgba(100,116,139,.12)' },
  };
  const m = map[status] || map.offline;
  return (
    <span style={{ padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: m.bg, color: m.color, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ headers, children, emptyMessage = 'No records found' }: {
  headers: string[]; children: React.ReactNode; emptyMessage?: string;
}) {
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.borderW}` }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: C.dim, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TR({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderBottom: `1px solid ${C.borderW}`, background: hovered ? 'rgba(255,255,255,.02)' : 'transparent', cursor: onClick ? 'pointer' : 'default', transition: 'background .1s' }}
    >
      {children}
    </tr>
  );
}

export function TD({ children, mono, muted, right }: { children: React.ReactNode; mono?: boolean; muted?: boolean; right?: boolean }) {
  return (
    <td style={{ padding: '11px 12px', color: muted ? C.muted : C.text, fontFamily: mono ? 'JetBrains Mono, monospace' : 'DM Sans, sans-serif', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>
      {children}
    </td>
  );
}

// ── ActionButtons ─────────────────────────────────────────────────────────────
export function ActionButtons({ onEdit, onDelete, onAssign, assignLabel = 'Assign' }: {
  onEdit?: () => void; onDelete?: () => void; onAssign?: () => void; assignLabel?: string;
}) {
  const btn = (label: string, onClick: () => void, danger = false, color?: string) => (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        padding: '5px 10px', borderRadius: 6, border: `1px solid ${danger ? 'rgba(239,68,68,.25)' : C.borderW}`,
        background: danger ? 'rgba(239,68,68,.08)' : 'rgba(255,255,255,.04)',
        color: danger ? C.red : color || '#8da4c2',
        cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      {onAssign && btn(assignLabel, onAssign, false, C.cyan)}
      {onEdit   && btn('Edit',    onEdit)}
      {onDelete && btn('Delete',  onDelete, true)}
    </div>
  );
}
