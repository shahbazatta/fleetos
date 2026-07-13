import React from 'react';

export function LogoMark({ size = 26, color = 'var(--accent, #00d4e8)' }: { size?: number; color?: string }) {
  const h = size * (32 / 28);
  return (
    <svg width={size} height={h} viewBox="0 0 28 32" fill="none" style={{ display: 'block' }}>
      <polygon points="14,1 27,8 27,24 14,31 1,24 1,8" fill="none" stroke={color} strokeWidth="1.8" />
      <polygon points="14,6 22,11 22,21 14,26 6,21 6,11" fill={`${color}18`} stroke={color} strokeWidth="0.8" strokeOpacity="0.5" />
      <line x1="1" y1="8" x2="27" y2="24" stroke={color} strokeWidth="0.8" strokeOpacity="0.35" />
      <line x1="27" y1="8" x2="1" y2="24" stroke={color} strokeWidth="0.8" strokeOpacity="0.35" />
      <circle cx="14" cy="16" r="3" fill={color} />
    </svg>
  );
}
