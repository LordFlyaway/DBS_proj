import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles.css";
import { configured } from "./lib/supabase";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import Designations from "./pages/Designations";
import Attendance from "./pages/Attendance";
import Leave from "./pages/Leave";
import SalaryComponents from "./pages/SalaryComponents";
import PayrollRun from "./pages/PayrollRun";
import Payslips from "./pages/Payslips";
import Queries from "./pages/Queries";

function Guard({ roles, children }) {
  const { role } = useAuth();
  return roles.includes(role) ? children : <Navigate to="/" replace />;
}

function App() {
  const { session, profile, profileError, loading, signOut } = useAuth();
  if (loading) return <div className="center-screen"><Loading /></div>;
  if (!session) return <Login />;
  if (!profile)
    return (
      <div className="center-screen">
        <div className="card narrow">
          <h2>Account not linked</h2>
          <p className="muted">{profileError}</p>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Guard roles={["Admin", "Payroll", "Manager"]}><Employees /></Guard>} />
        <Route path="departments" element={<Guard roles={["Admin"]}><Departments /></Guard>} />
        <Route path="designations" element={<Guard roles={["Admin"]}><Designations /></Guard>} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leave" element={<Leave />} />
        <Route path="components" element={<Guard roles={["Admin", "Payroll"]}><SalaryComponents /></Guard>} />
        <Route path="payroll" element={<Guard roles={["Admin", "Payroll"]}><PayrollRun /></Guard>} />
        <Route path="payslips" element={<Payslips />} />
        <Route path="queries" element={<Guard roles={["Admin", "Payroll"]}><Queries /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function NotConfigured() {
  return (
    <div className="center-screen">
      <div className="card narrow">
        <h2>Supabase is not configured</h2>
        <p className="muted">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the project <code>.env</code> file
          (or in Vercel → Project → Settings → Environment Variables) and restart.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {configured ? (
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    ) : (
      <NotConfigured />
    )}
  </StrictMode>
);
