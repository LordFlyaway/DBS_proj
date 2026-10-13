import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useActivity, useToasts, clearActivity } from "../lib/activity";
import { Badge, SqlBlock } from "./ui";

const CREDITS = [
  { name: "Krishiv Rajkumar", reg: "24BDE0132" },
  { name: "Asher Mathew", reg: "24BDE0128" },
  { name: "Sai Praneeth", reg: "24BYB0143" },
];

const NAV = [
  { to: "/", label: "Dashboard", icon: "◧", roles: ["Admin", "Payroll", "Manager", "Employee"] },
  { to: "/employees", label: "Employees", icon: "◎", roles: ["Admin", "Payroll", "Manager"], managerLabel: "My Team" },
  { to: "/departments", label: "Departments", icon: "▦", roles: ["Admin"] },
  { to: "/designations", label: "Designations", icon: "◈", roles: ["Admin"] },
  { to: "/attendance", label: "Attendance", icon: "◷", roles: ["Admin", "Payroll", "Manager", "Employee"] },
  { to: "/leave", label: "Leave", icon: "✈", roles: ["Admin", "Payroll", "Manager", "Employee"] },
  { to: "/components", label: "Salary Components", icon: "±", roles: ["Admin", "Payroll"] },
  { to: "/payroll", label: "Payroll Run", icon: "₹", roles: ["Admin", "Payroll"] },
  { to: "/payslips", label: "My Payslips", icon: "▤", roles: ["Admin", "Payroll", "Manager", "Employee"] },
  { to: "/queries", label: "SQL Queries", icon: "⌘", roles: ["Admin", "Payroll"] },
];

export default function Layout() {
  const { profile, role, signOut } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const activity = useActivity();

  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-name">All Caps</div>
          <div className="brand-sub">Payroll Management System</div>
        </div>
        <nav className="nav" onClick={() => setMenu(false)}>
          {NAV.filter((n) => n.roles.includes(role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <span className="nav-icon" aria-hidden>{n.icon}</span>
              {role === "Manager" && n.managerLabel ? n.managerLabel : n.label}
            </NavLink>
          ))}
        </nav>
        <div className="credits" aria-label="Credits">
          <div className="credits-title">Credits</div>
          {CREDITS.map((c) => (
            <div key={c.reg} className="credit">
              <span className="credit-name">{c.name}</span>
              <span className="credit-reg">{c.reg}</span>
            </div>
          ))}
        </div>
        <div className="user-card">
          <div className="avatar">{profile.first_name[0]}{profile.last_name[0]}</div>
          <div className="user-meta">
            <div className="user-name">{profile.first_name} {profile.last_name}</div>
            <Badge>{role}</Badge>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu">☰</button>
          <div className="topbar-spacer" />
          <button className={`btn btn-ghost ${drawer ? "btn-pressed" : ""}`} onClick={() => setDrawer((d) => !d)}>
            DB activity {activity.length > 0 && <span className="pill">{activity.length}</span>}
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      {drawer && <ActivityDrawer entries={activity} onClose={() => setDrawer(false)} />}
      <Toasts />
    </div>
  );
}

function ActivityDrawer({ entries, onClose }) {
  return (
    <aside className="drawer" aria-label="Database activity">
      <div className="drawer-head">
        <div>
          <h2>Database activity</h2>
          <p className="muted small">User operation → SQL / PL/pgSQL → tables → result</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost btn-sm" onClick={clearActivity}>Clear</button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
      </div>
      <div className="drawer-body">
        {entries.length === 0 && <div className="empty">Perform an action (add, approve, generate…) to see the SQL it runs.</div>}
        {entries.map((e) => (
          <div key={e.id} className={`activity ${e.ok ? "" : "activity-error"}`}>
            <div className="activity-top">
              <strong>{e.action}</strong>
              <span className="muted small">{e.at.toLocaleTimeString()} · {e.ms} ms</span>
            </div>
            <div className="activity-component">{e.component}</div>
            <SqlBlock>{e.sql}</SqlBlock>
            {e.tables?.length > 0 && (
              <div className="small muted">Tables: {e.tables.join(", ")}</div>
            )}
            <div className={`activity-result ${e.ok ? "ok" : "bad"}`}>{e.ok ? "✔ " : "✖ "}{e.result}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}
