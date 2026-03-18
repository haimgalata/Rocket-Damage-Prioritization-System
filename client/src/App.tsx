import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { EventsPage } from './pages/admin/EventsPage';
import { UserManagement } from './pages/admin/UserManagement';
import { ModelRunner } from './pages/admin/ModelRunner';
import { NewEventForm } from './pages/operator/NewEventForm';
import { FieldMapView } from './pages/operator/FieldMapView';
import { OrgManagement } from './pages/super-admin/OrgManagement';
import { UserProfile } from './pages/UserProfile';
import { useAuthStore } from './store/authStore';
import { UserRole } from './types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex h-screen overflow-hidden bg-gray-50">
    <Sidebar />
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">{children}</div>
  </div>
);

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === UserRole.SUPER_ADMIN) return <Navigate to="/super-admin/organizations" replace />;
  if (user?.role === UserRole.ADMIN) return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/operator/new-event" replace />;
};

const AppRoutes: React.FC = () => {
  const { loginUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      const storedUser = localStorage.getItem('auth_user');
      const storedOrg = localStorage.getItem('auth_organization');
      if (storedUser && storedOrg) {
        try { loginUser(JSON.parse(storedUser), JSON.parse(storedOrg)); } catch { /* ignore */ }
      }
    }
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRedirect />} />

      <Route path="/profile" element={
        <ProtectedRoute>
          <AppLayout><UserProfile /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <AppLayout><UserProfile /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/super-admin/organizations" element={
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
          <AppLayout><OrgManagement /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/events" element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout><EventsPage /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/dashboard" element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout><UserManagement /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/models" element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout><ModelRunner /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/operator/new-event" element={
        <ProtectedRoute allowedRoles={[UserRole.OPERATOR, UserRole.ADMIN]}>
          <AppLayout><NewEventForm /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/operator/map" element={
        <ProtectedRoute allowedRoles={[UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout><FieldMapView /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
);

export default App;