import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignIn, SignUp, useAuth } from '@clerk/clerk-react';

import LandingPage from './pages/LandingPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import Overview from './pages/dashboard/Overview';
import Properties from './pages/dashboard/Properties';
import Settings from './pages/dashboard/Settings';
import Onboarding from './pages/dashboard/Onboarding';

function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
}

// Redirect signed-in users away from the landing page
function LandingOrDashboard() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingOrDashboard />} />
      <Route
        path="/sign-in/*"
        element={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a0a' }}>
            <SignIn routing="path" path="/sign-in" forceRedirectUrl="/dashboard" />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a0a' }}>
            <SignUp routing="path" path="/sign-up" forceRedirectUrl="/dashboard" />
          </div>
        }
      />

      {/* Protected Dashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="properties" element={<Properties />} />
        <Route path="settings" element={<Settings />} />
        <Route path="onboarding" element={<Onboarding />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
