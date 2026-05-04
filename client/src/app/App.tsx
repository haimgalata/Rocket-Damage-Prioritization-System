import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Login } from '../pages/auth/Login';
import { Dashboard } from '../pages/admin/Dashboard';
import { EventsPage } from '../pages/admin/EventsPage';
import { UserManagement } from '../pages/admin/UserManagement';
import { ModelRunner } from '../pages/admin/ModelRunner';
import { NewEventForm } from '../pages/operator/NewEventForm';
import { FieldMapView } from '../pages/operator/FieldMapView';
import { OperatorDashboard } from '../pages/operator/OperatorDashboard';
import { OrgManagement } from '../pages/super-admin/OrgManagement';
import { SuperAdminDashboard } from '../pages/super-admin/SuperAdminDashboard';
import { UserProfile } from '../pages/UserProfile';
import { EventDetailPage } from '../features/events/EventDetailPage';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types';
import { fetchAuthMe } from '../api/auth';

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
  if (user?.role === UserRole.SUPER_ADMIN) return <Navigate to="/super-admin/dashboard" replace />;
  if (user?.role === UserRole.ADMIN) return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/operator/dashboard" replace />;
};

/** Validate JWT on load; sync read from localStorage already set isAuthenticated. */
const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(() => !useAuthStore.getState().isAuthenticated);

  useEffect(() => {
    const { isAuthenticated, accessToken, setSession, logoutUser } = useAuthStore.getState();
    if (!isAuthenticated || !accessToken) {
      setReady(true);
      return;
    }
    let cancelled = false;
    fetchAuthMe()
      .then((me) => {
        if (cancelled) return;
        if (me) setSession(me.user, me.organization, me.accessToken);
        else logoutUser();
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        logoutUser();
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 text-sm">
        Loading session…
      </div>
    );
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/" element={<RootRedirect />} />

    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <AppLayout>
            <UserProfile />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/settings"
      element={
        <ProtectedRoute>
          <AppLayout>
            <UserProfile />
          </AppLayout>
        </ProtectedRoute>
      }
    />

    <Route
      path="/super-admin/dashboard"
      element={
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <SuperAdminDashboard />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/super-admin/organizations"
      element={
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <OrgManagement />
          </AppLayout>
        </ProtectedRoute>
      }
    />

    <Route
      path="/admin/dashboard"
      element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/events/:eventId"
      element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR]}>
          <AppLayout>
            <EventDetailPage />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/events"
      element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.OPERATOR]}>
          <AppLayout>
            <EventsPage />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/users"
      element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <UserManagement />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin/models"
      element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <ModelRunner />
          </AppLayout>
        </ProtectedRoute>
      }
    />

    <Route
      path="/operator/dashboard"
      element={
        <ProtectedRoute allowedRoles={[UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <OperatorDashboard />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/operator/new-event"
      element={
        <ProtectedRoute allowedRoles={[UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <NewEventForm />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/operator/events/new"
      element={
        <ProtectedRoute allowedRoles={[UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <NewEventForm />
          </AppLayout>
        </ProtectedRoute>
      }
    />
    <Route
      path="/operator/map"
      element={
        <ProtectedRoute allowedRoles={[UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
          <AppLayout>
            <FieldMapView />
          </AppLayout>
        </ProtectedRoute>
      }
    />

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <BrowserRouter>
    <AuthBootstrap>
      <AppRoutes />
    </AuthBootstrap>
  </BrowserRouter>
);

export default App;
