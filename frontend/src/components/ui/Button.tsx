import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12 },
  md: { padding: '11px 16px', fontSize: 14 },
  lg: { padding: '13px 20px', fontSize: 14 },
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: { background: 'var(--accent, var(--acc))', color: 'var(--surface-bg, var(--srf-0))', border: 'none' },
  secondary: { background: 'var(--fill-04)', border: '1px solid var(--surface-border-soft, var(--bdr-07))', color: 'var(--text-secondary, var(--txt-2))' },
  ghost: { background: 'none', border: 'none', color: 'var(--text-muted, var(--txt-3))' },
  danger: { background: 'var(--danger, #ef4444)', color: '#fff', border: 'none' },
};

export interface ButtonProps {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
  title?: string;
}

export function Button({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', style, title }: ButtonProps) {
  const brand = variant === 'primary' || variant === 'danger';
  const base: React.CSSProperties = {
    borderRadius: 'var(--radius-md, 8px)',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: brand ? 'var(--font-head, Syne, sans-serif)' : 'var(--font-body, DM Sans, sans-serif)',
    fontWeight: brand ? 800 : 400,
    letterSpacing: brand ? 0.5 : 0,
    opacity: disabled ? 0.7 : 1,
    transition: 'opacity .15s, background .15s',
    ...SIZES[size],
  };

  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} style={{ ...base, ...VARIANTS[variant], ...style }}>
      {children}
    </button>
  );
}
