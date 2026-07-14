import React from 'react';
import Navbar from '../components/common/Navbar';
import OfflineBanner from '../components/common/OfflineBanner';

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--srf-0)', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <OfflineBanner />
    </div>
  );
}
