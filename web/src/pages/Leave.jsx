import { useState } from "react";
import { supabase } from "../lib/supabase";
import { run, notify } from "../lib/activity";
import { useAuth } from "../lib/auth";
import { useLoad, useRefData } from "../lib/hooks";
import { sqlInsert, sqlDelete } from "../lib/sql";
import { PageHeader, Card, DataTable, Badge, Field, ErrorBox, Tabs, Stat } from "../components/ui";
import { date, fullName, todayISO } from "../lib/format";

export default function Leave() {
  const { profile, role } = useAuth();
  const approver = role === "Admin" || role === "Manager";
  const [tab, setTab] = useState(approver ? "approvals" : "mine");
  const ref = useRefData();

  const { data: rows, error, reload } = useLoad(() =>
    run({ action: "Load leave requests", component: "SELECT (RLS: own + team, all for staff)", tables: ["leave_request"],
          sql: "SELECT * FROM leave_request ORDER BY applied_on DESC;" },
      () => supabase.from("leave_request").select("*").order("applied_on", { ascending: false }).order("leave_id", { ascending: false }),
      null, { silent: true }), []);

  const mine = rows?.filter((r) => r.emp_id === profile.emp_id);
  const others = rows?.filter((r) => r.emp_id !== profile.emp_id);
  const pending = others?.filter((r) => r.status === "Pending");

  return (
    <>
      <PageHeader title="Leave" subtitle="Applying inserts a Pending row; approval runs PROCEDURE process_leave, and TRIGGER trg_leave_approved updates attendance." />
      <Tabs value={tab} onChange={setTab} tabs={[
        ...(approver ? [{ value: "approvals", label: "Approvals", count: pending?.length }] : []),
        { value: "mine", label: "My leave" },
        ...(approver || role === "Payroll" ? [{ value: "all", label: role === "Manager" ? "Team history" : "All requests" }] : []),
      ]} />
      <ErrorBox>{error}</ErrorBox>
      {tab === "approvals" && <Approvals rows={pending} emp={ref.data?.emp || {}} onDone={reload} />}
      {tab === "mine" && <MyLeave rows={mine} emp={ref.data?.emp || {}} onDone={reload} />}
      {tab === "all" && (
        <Card>
          <LeaveTable rows={others} emp={ref.data?.emp || {}} showEmp />
        </Card>
      )}
    </>
  );
}

function LeaveTable({ rows, emp, showEmp, actions }) {
  return (
    <DataTable rows={rows} rowKey={(r) => r.leave_id} empty="No leave requests." columns={[
      { key: "leave_id", label: "#", width: 40 },
      ...(showEmp ? [{ key: "emp", label: "Employee", render: (r) => fullName(emp[r.emp_id]) }] : []),
      { key: "leave_type", label: "Type" },
      { key: "dates", label: "Dates", render: (r) => `${date(r.start_date)} – ${date(r.end_date)}` },
      { key: "reason", label: "Reason", render: (r) => r.reason || "—" },
      { key: "applied_on", label: "Applied", render: (r) => date(r.applied_on) },
      { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
      { key: "by", label: "Decided by", render: (r) => (r.approved_by ? fullName(emp[r.approved_by]) : "—") },
      ...(actions ? [{ key: "act", label: "", align: "right", render: actions }] : []),
    ]} />
  );
}

function Approvals({ rows, emp, onDone }) {
  async function decide(r, decision) {
    try {
      await run({ action: `${decision === "Approved" ? "Approve" : "Reject"} leave #${r.leave_id}`,
                  component: "FUNCTION api_process_leave → PROCEDURE process_leave → TRIGGER trg_leave_approved",
                  tables: ["leave_request", "employee", "attendance"],
                  sql: `SELECT api_process_leave(${r.leave_id}, '${decision}');\n-- runs: CALL process_leave(${r.leave_id}, <your emp_id>, '${decision}');` },
        () => supabase.rpc("api_process_leave", { p_leave_id: r.leave_id, p_decision: decision }),
        () => decision === "Approved" ? "Leave approved; attendance rows set to 'Leave' by trigger" : "Leave rejected");
      notify("success", `Leave #${r.leave_id} ${decision.toLowerCase()}`);
      onDone();
    } catch (e) { notify("error", e.message); }
  }
  return (
    <Card title="Waiting for a decision">
      <LeaveTable rows={rows} emp={emp} showEmp actions={(r) => (
        <div className="row-actions">
          <button className="btn btn-sm btn-primary" onClick={() => decide(r, "Approved")}>Approve</button>
          <button className="btn btn-sm btn-danger-ghost" onClick={() => decide(r, "Rejected")}>Reject</button>
        </div>
      )} />
    </Card>
  );
}

function MyLeave({ rows, emp, onDone }) {
  const { profile } = useAuth();
  const year = new Date().getFullYear();
  const { data: balance, reload: reloadBalance } = useLoad(() =>
    run({ action: "My leave balance", component: "FUNCTION fn_leave_balance", tables: ["leave_request", "designation"],
          sql: `SELECT fn_leave_balance(${profile.emp_id}, ${year});` },
      () => supabase.rpc("fn_leave_balance", { p_emp_id: profile.emp_id, p_year: year }), null, { silent: true }), [profile.emp_id]);
  const [form, setForm] = useState({ leave_type: "Casual", start_date: todayISO(), end_date: todayISO(), reason: "" });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function apply(e) {
    e.preventDefault();
    setError(null);
    const data = { emp_id: profile.emp_id, ...form, reason: form.reason || null };
    try {
      await run({ action: "Apply for leave", component: "INSERT (RLS: own row, status Pending)", tables: ["leave_request"], sql: sqlInsert("leave_request", data) },
        () => supabase.from("leave_request").insert(data).select(), (d) => `1 row inserted (leave_id ${d[0].leave_id}, status Pending)`);
      notify("success", "Leave request submitted");
      setForm({ ...form, reason: "" });
      onDone();
      reloadBalance();
    } catch (err) { setError(err.message); }
  }

  async function cancel(r) {
    if (!confirm("Cancel this pending request?")) return;
    try {
      await run({ action: `Cancel leave #${r.leave_id}`, component: "DELETE (RLS: own pending only)", tables: ["leave_request"], sql: sqlDelete("leave_request", { leave_id: r.leave_id }) },
        () => supabase.from("leave_request").delete().eq("leave_id", r.leave_id).select(), (d) => `${d.length} row deleted`);
      notify("success", "Request cancelled");
      onDone();
    } catch (err) { notify("error", err.message); }
  }

  return (
    <div className="grid-side">
      <Card title="Apply for leave">
        <Stat label={`Paid leave left in ${year}`} value={balance ?? "…"} hint="fn_leave_balance(emp_id, year)" tone="green" />
        <form className="stack" onSubmit={apply}>
          <Field label="Type">
            <select value={form.leave_type} onChange={set("leave_type")}>
              {["Casual", "Sick", "Earned", "Unpaid"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="From"><input type="date" required value={form.start_date} onChange={set("start_date")} /></Field>
            <Field label="To" hint="Must be on/after start (CHECK)"><input type="date" required value={form.end_date} onChange={set("end_date")} /></Field>
          </div>
          <Field label="Reason"><input value={form.reason} onChange={set("reason")} maxLength={200} placeholder="Optional" /></Field>
          {error && <ErrorBox>{error}</ErrorBox>}
          <button className="btn btn-primary">Submit request</button>
          <p className="small muted">Unpaid leave becomes loss-of-pay days in payroll (fn_lop_days).</p>
        </form>
      </Card>
      <Card title="My requests">
        <LeaveTable rows={rows} emp={emp} actions={(r) => r.status === "Pending" && (
          <button className="btn btn-sm btn-danger-ghost" onClick={() => cancel(r)}>Cancel</button>
        )} />
      </Card>
    </div>
  );
}
