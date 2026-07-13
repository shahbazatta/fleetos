import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.1)',
      border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5', fontSize: 13,
      fontFamily: 'var(--font-body, DM Sans, sans-serif)', display: 'flex', alignItems: 'center', gap: 8,
      textAlign: 'start',
    }}>
      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 0, display: 'flex' }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
