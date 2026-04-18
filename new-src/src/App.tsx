import { Routes, Route, Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { Component, type ReactNode } from "react";
import Landing from "./pages/Landing";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import Onboarding from "./pages/dashboard/Onboarding";
import Properties from "./pages/dashboard/Properties";
import Settings from "./pages/dashboard/Settings";
import AlfredBrain from "./pages/dashboard/AlfredBrain";

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const msg = this.state.error?.message || "";
      const isConvex = msg.includes("Could not find public function") || msg.includes("CONVEX");
      return (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", padding:"60px 24px", textAlign:"center", fontFamily:"Inter, sans-serif", color:"#525252" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🧠</div>
          <h3 style={{ fontSize:18, fontWeight:600, color:"#1a1a1a", margin:"0 0 8px" }}>
            {isConvex ? "Backend not deployed" : "Something went wrong"}
          </h3>
          <p style={{ fontSize:14, maxWidth:400, lineHeight:1.6, margin:0 }}>
            {isConvex
              ? "The Convex functions haven't been deployed to production yet. Run npx convex deploy in your terminal to fix this."
              : msg || "An unexpected error occurred. Try refreshing the page."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop:20, padding:"8px 20px", borderRadius:8, border:"1px solid #e5e5e5", background:"#fff", color:"#1a1a1a", fontSize:13, fontWeight:550, cursor:"pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8f8f8]">
        <div className="text-[#1a1a1a]">Loading...</div>
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
        <Route path="brain" element={<ErrorBoundary><AlfredBrain /></ErrorBoundary>} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
