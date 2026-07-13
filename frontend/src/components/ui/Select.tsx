import React from 'react';

export interface SelectOption { value: string; label: string; }

export interface SelectProps {
  label?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options?: SelectOption[];
  style?: React.CSSProperties;
}

export function Select({ label, value, onChange, options = [], style }: SelectProps) {
  return (
    <div>
      {label && (
        <label style={{ fontSize: 11, color: 'var(--text-muted, #5d7a9a)', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6, fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        style={{
          width: '100%', padding: '9px 11px', cursor: 'pointer',
          background: 'rgba(255,255,255,.04)', border: '1px solid var(--surface-border-soft, rgba(255,255,255,.07))',
          borderRadius: 7, color: 'var(--text-primary, #e8eaf0)', fontSize: 13,
          fontFamily: 'var(--font-body, DM Sans, sans-serif)', outline: 'none', boxSizing: 'border-box',
          ...style,
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
