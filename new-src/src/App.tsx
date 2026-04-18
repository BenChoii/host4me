import { Routes, Route, Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import Landing from "./pages/Landing";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Onboarding from "./pages/dashboard/Onboarding";
import Properties from "./pages/dashboard/Properties";
import Settings from "./pages/dashboard/Settings";
import AlfredBrain from "./pages/dashboard/AlfredBrain";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="properties" element={<Properties />} />
        <Route path="brain" element={<AlfredBrain />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
