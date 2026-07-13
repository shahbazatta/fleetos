import React from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function Modal({ title, subtitle, onClose, children, width = 520 }: ModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface-card, #0a1828)', border: '1px solid var(--surface-border, rgba(0,212,232,.15))', borderRadius: 16, width: '100%', maxWidth: width, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-modal, 0 40px 80px rgba(0,0,0,.6))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--surface-border-soft, rgba(255,255,255,.07))', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head, Syne, sans-serif)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary, #e8eaf0)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted, #5d7a9a)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #5d7a9a)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflow: 'auto', flex: 1, padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}
