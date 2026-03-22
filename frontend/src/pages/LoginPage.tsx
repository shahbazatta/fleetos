import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const { login, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('admin@cloudnext.com');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(0,212,232,.2)',
    borderRadius: 8, color: '#e8eaf0', fontSize: 14,
    fontFamily: 'DM Sans, sans-serif', outline: 'none',
    transition: 'border-color .15s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050d1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,212,232,.06) 0%, transparent 70%)',
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <svg width="52" height="60" viewBox="0 0 52 60" fill="none" style={{ display: 'block', margin: '0 auto 16px' }}>
            <polygon points="26,2 50,14.5 50,45.5 26,58 2,45.5 2,14.5" fill="none" stroke="#00d4e8" strokeWidth="2"/>
            <polygon points="26,10 42,19 42,41 26,50 10,41 10,19" fill="rgba(0,212,232,.08)" stroke="#00d4e8" strokeWidth="1" strokeOpacity="0.4"/>
            <line x1="2" y1="14.5" x2="50" y2="45.5" stroke="#00d4e8" strokeWidth="1" strokeOpacity="0.3"/>
            <line x1="50" y1="14.5" x2="2" y2="45.5" stroke="#00d4e8" strokeWidth="1" strokeOpacity="0.3"/>
            <circle cx="26" cy="30" r="6" fill="#00d4e8"/>
          </svg>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 22, color: '#e8eaf0', letterSpacing: 1 }}>
            CLOUDNEXT
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#00d4e8', letterSpacing: 3, marginTop: 3 }}>
            FLEET MANAGEMENT SYSTEM
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#0a1828',
          border: '1px solid rgba(0,212,232,.15)',
          borderRadius: 16, padding: '32px 28px',
          boxShadow: '0 40px 80px rgba(0,0,0,.5)',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0', marginBottom: 6, fontFamily: 'Syne, sans-serif' }}>
            Sign in
          </div>
          <div style={{ fontSize: 13, color: '#5d7a9a', marginBottom: 24 }}>
            Access your fleet command center
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 7, marginBottom: 16,
              background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
              color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#5d7a9a', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#5d7a9a', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                marginTop: 8, padding: '13px', borderRadius: 8, border: 'none',
                background: '#00d4e8', color: '#050d1a',
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                transition: 'opacity .15s, transform .1s',
                letterSpacing: 0.5,
              }}
            >
              {isLoading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: '12px', background: 'rgba(0,212,232,.05)', borderRadius: 6, fontSize: 11, color: '#5d7a9a', fontFamily: 'JetBrains Mono, monospace' }}>
            Demo: admin@cloudnext.com / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
