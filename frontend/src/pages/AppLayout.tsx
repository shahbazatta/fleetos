import React from 'react';
import Navbar from '../components/common/Navbar';

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050d1a', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
