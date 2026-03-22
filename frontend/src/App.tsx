import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { init } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore token from localStorage synchronously before first render
    init();
    setReady(true);
  }, []);

  // Don't render routes until auth state is restored — prevents flash to /login
  if (!ready) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
