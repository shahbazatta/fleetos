import React from 'react';

export interface InputProps {
  label?: string;
  type?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  style?: React.CSSProperties;
}

export function Input({ label, type = 'text', value, onChange, placeholder, required, autoComplete, style }: InputProps) {
  return (
    <div>
      {label && (
        <label style={{ fontSize: 11, color: 'var(--text-muted, var(--txt-3))', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6, fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}>
          {label}{required && ' *'}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        dir="auto"
        style={{
          width: '100%', padding: '11px 14px',
          background: 'var(--fill-05)', border: '1px solid var(--surface-border, var(--acc-20))',
          borderRadius: 8, color: 'var(--text-primary, var(--txt-1))', fontSize: 14,
          fontFamily: 'var(--font-body, DM Sans, sans-serif)', outline: 'none', boxSizing: 'border-box',
          transition: 'border-color .15s',
          ...style,
        }}
      />
    </div>
  );
}
