import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage from './DashboardPage';

export function AppShell() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
