import { useState } from "react";
import { useAuth } from "../lib/auth";

const DEMO = [
  { role: "Admin", who: "Priya Raman · HR Manager", email: "priya.raman@nexatech.example" },
  { role: "Payroll", who: "Karthik Subramanian · Payroll Officer", email: "karthik.s@nexatech.example" },
  { role: "Manager", who: "Meera Krishnan · Engineering Manager", email: "meera.krishnan@nexatech.example" },
  { role: "Employee", who: "Ananya Iyer · Senior Software Engineer", email: "ananya.iyer@nexatech.example" },
];

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="login">
      <div className="login-panel">
        <div className="brand brand-lg">
          <span className="brand-mark">₹</span>
          <div>
            <div className="brand-name">NexaTech Payroll</div>
            <div className="brand-sub">Employee Payroll Management System</div>
          </div>
        </div>
        <h1>Sign in</h1>
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span className="field-label">Work e-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
      <div className="login-side">
        <h2>Demo accounts</h2>
        <p>Each role sees a different part of the system. Pick one to fill in the e-mail; the password is the project's demo password.</p>
        <div className="demo-list">
          {DEMO.map((d) => (
            <button key={d.role} className="demo" type="button" onClick={() => setEmail(d.email)}>
              <span className="demo-role">{d.role}</span>
              <span className="demo-who">{d.who}</span>
              <span className="demo-email">{d.email}</span>
            </button>
          ))}
        </div>
        <p className="small">BCSE302L Database Systems · Course Project · PostgreSQL on Supabase</p>
      </div>
    </div>
  );
}
