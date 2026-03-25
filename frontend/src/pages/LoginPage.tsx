import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';

type View = 'login' | 'signup';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, isLoading, error, token } = useAuthStore();
  const [view,     setView]    = useState<View>('login');
  const [email,    setEmail]   = useState('admin@cloudnext.com');
  const [password, setPassword] = useState('admin123');

  // Signup form fields
  const [sName,    setSName]    = useState('');
  const [sCompany, setSCompany] = useState('');
  const [sEmail,   setSEmail]   = useState('');
  const [sPhone,   setSPhone]   = useState('');
  const [sMsg,     setSMsg]     = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password);
    if (ok) navigate('/', { replace: true });
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!sName || !sEmail) {
    setSMsg('Name and Email are required');
    return;
  }

  try {
    const res = await fetch('/api/request-access', {   // or full URL: 'http://localhost:5000/api/request-access'
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: sName,
        company: sCompany,
        email: sEmail,
        phone: sPhone,
        message: sMsg,
      }),
    });

    const result = await res.json();

    if (res.ok) {
      alert('✅ Your request has been sent successfully! We will contact you soon.');
      // Reset form
      setSName(''); setSCompany(''); setSEmail(''); setSPhone(''); setSMsg('');
      setView('login');
    } else {
      alert('❌ Failed to send request: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error(err);
    alert('❌ Network error. Please try again later.');
  }
};
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(0,212,232,.2)',
    borderRadius: 8, color: '#e8eaf0', fontSize: 14,
    fontFamily: 'DM Sans, sans-serif', outline: 'none',
    transition: 'border-color .15s', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: '#5d7a9a', letterSpacing: 1,
    textTransform: 'uppercase', display: 'block', marginBottom: 6,
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050d1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,212,232,.06) 0%, transparent 70%)',
    }}>
      <div style={{ width: 400, maxWidth: '95vw' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
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

          {/* ── LOGIN VIEW ─────────────────────────────────────────── */}
          {view === 'login' && (
            <>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0', marginBottom: 4, fontFamily: 'Syne, sans-serif' }}>
                {t('login.title')}
              </div>
              <div style={{ fontSize: 13, color: '#5d7a9a', marginBottom: 24 }}>
                {t('login.subtitle')}
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

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>{t('login.email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('login.email_placeholder')}
                    style={inputStyle}
                    required
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t('login.password')}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    marginTop: 6, padding: '13px', borderRadius: 8, border: 'none',
                    background: '#00d4e8', color: '#050d1a',
                    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1,
                    transition: 'opacity .15s',
                    letterSpacing: 0.5,
                  }}
                >
                  {isLoading ? t('login.submitting') : t('login.submit')}
                </button>
              </form>

              {/* Demo hint */}
              <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(0,212,232,.05)', borderRadius: 6, fontSize: 11, color: '#5d7a9a', fontFamily: 'JetBrains Mono, monospace' }}>
                {t('login.demo_hint')}
              </div>

              {/* Switch to signup */}
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <button
                  onClick={() => setView('signup')}
style={{
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#00d4e8',
  fontSize: '32px',
  fontWeight: 800,
  fontFamily: 'DM Sans, sans-serif',
  textDecoration: 'underline',
  textUnderlineOffset: '8px',
  textDecorationThickness: '4px',
  letterSpacing: '-0.02em',
  transition: 'all 0.25s ease',
}}

onMouseEnter={(e) => {
  e.currentTarget.style.color = '#00f0ff';
  e.currentTarget.style.textDecorationThickness = '5px';
}}
onMouseLeave={(e) => {
  e.currentTarget.style.color = '#ffffff';
  e.currentTarget.style.textDecorationThickness = '3px';
}}
                >
                  {t('login.request_access')}
                </button>
              </div>
            </>
          )}

          {/* ── SIGNUP / REQUEST ACCESS VIEW ───────────────────────── */}
          {view === 'signup' && (
            <>
              <button
                onClick={() => setView('login')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#8da4c2', fontSize: 12, fontFamily: 'DM Sans, sans-serif',
                  padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {t('login.back_to_login')}
              </button>

              <div style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf0', marginBottom: 4, fontFamily: 'Syne, sans-serif' }}>
                {t('login.signup_title')}
              </div>
              <div style={{ fontSize: 13, color: '#5d7a9a', marginBottom: 22 }}>
                {t('login.signup_subtitle')}
              </div>

              <form onSubmit={handleSignupSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div>
                  <label style={labelStyle}>{t('login.full_name')} *</label>
                  <input
                    type="text"
                    value={sName}
                    onChange={e => setSName(e.target.value)}
                    placeholder={t('login.name_placeholder')}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t('login.company')}</label>
                  <input
                    type="text"
                    value={sCompany}
                    onChange={e => setSCompany(e.target.value)}
                    placeholder={t('login.company_placeholder')}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t('login.email')} *</label>
                  <input
                    type="email"
                    value={sEmail}
                    onChange={e => setSEmail(e.target.value)}
                    placeholder={t('login.email_placeholder')}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t('login.phone')}</label>
                  <input
                    type="tel"
                    value={sPhone}
                    onChange={e => setSPhone(e.target.value)}
                    placeholder={t('login.phone_placeholder')}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t('login.message')}</label>
                  <textarea
                    value={sMsg}
                    onChange={e => setSMsg(e.target.value)}
                    placeholder={t('login.message_placeholder')}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: 4, padding: '13px', borderRadius: 8, border: 'none',
                    background: '#00d4e8', color: '#050d1a',
                    fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 14,
                    cursor: 'pointer', letterSpacing: 0.5,
                  }}
                >
                  {t('login.send_request')}
                </button>
              </form>

              <div style={{ marginTop: 14, fontSize: 11, color: '#3a5070', textAlign: 'center', fontFamily: 'DM Sans, sans-serif', lineHeight: 1.5 }}>
                {t('login.signup_note')}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
