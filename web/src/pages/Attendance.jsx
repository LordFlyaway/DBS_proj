import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { run, notify } from "../lib/activity";
import { useAuth } from "../lib/auth";
import { useLoad, useRefData } from "../lib/hooks";
import { sqlInsert, sqlUpdate, sqlDelete, clean } from "../lib/sql";
import { PageHeader, Card, DataTable, Badge, Modal, Field, ErrorBox, Stat } from "../components/ui";
import { date, time, hoursBetween, monthRange, MONTHS, fullName, todayISO } from "../lib/format";

export default function Attendance() {
  const { profile, isAdmin, isStaff, role } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [empFilter, setEmpFilter] = useState(isStaff || role === "Manager" ? "" : String(profile.emp_id));
  const [editing, setEditing] = useState(null);
  const ref = useRefData();

  const [from, to] = monthRange(month, year);
  const { data: rows, error, reload } = useLoad(() => {
    let q = supabase.from("attendance").select("*").gte("att_date", from).lte("att_date", to)
      .order("att_date", { ascending: false }).order("emp_id");
    if (empFilter) q = q.eq("emp_id", Number(empFilter));
    return run({ action: "Load attendance", component: "SELECT (RLS filters rows by role)", tables: ["attendance"],
                 sql: `SELECT * FROM attendance\n WHERE att_date BETWEEN '${from}' AND '${to}'${empFilter ? ` AND emp_id = ${empFilter}` : ""}\n ORDER BY att_date DESC, emp_id;` },
      () => q, null, { silent: true });
  }, [from, to, empFilter]);

  const summary = useMemo(() => {
    const s = { Present: 0, "Half-Day": 0, Absent: 0, Leave: 0 };
    (rows || []).forEach((r) => (s[r.status] = (s[r.status] || 0) + 1));
    return s;
  }, [rows]);

  async function remove(r) {
    if (!confirm("Delete this attendance record?")) return;
    try {
      await run({ action: `Delete attendance #${r.attendance_id}`, component: "DELETE", tables: ["attendance"], sql: sqlDelete("attendance", { attendance_id: r.attendance_id }) },
        () => supabase.from("attendance").delete().eq("attendance_id", r.attendance_id).select(), (d) => `${d.length} row deleted`);
      notify("success", "Deleted");
      reload();
    } catch (e) { notify("error", e.message); }
  }

  const emp = ref.data?.emp || {};
  const visibleEmps = ref.data?.employees || [];
  return (
    <>
      <PageHeader title="Attendance" subtitle="One row per employee per working day (UNIQUE emp_id, att_date). Approved leave is written here by a trigger.">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => <option key={y}>{y}</option>)}
        </select>
        {(isStaff || role === "Manager") && (
          <select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
            <option value="">All visible employees</option>
            {visibleEmps.map((e) => <option key={e.emp_id} value={e.emp_id}>{fullName(e)}</option>)}
          </select>
        )}
        {isAdmin && <button className="btn btn-primary" onClick={() => setEditing({ mode: "add", row: { att_date: todayISO(), status: "Present" } })}>+ Record</button>}
      </PageHeader>
      <div className="stats stats-4">
        <Stat label="Present" value={summary.Present} tone="green" />
        <Stat label="Half days" value={summary["Half-Day"]} tone="amber" />
        <Stat label="Absent" value={summary.Absent} tone="red" />
        <Stat label="On leave" value={summary.Leave} tone="blue" />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.attendance_id} empty="No attendance in this period." columns={[
          { key: "att_date", label: "Date", render: (r) => date(r.att_date) },
          { key: "emp", label: "Employee", render: (r) => fullName(emp[r.emp_id]) },
          { key: "check_in", label: "In", render: (r) => time(r.check_in) },
          { key: "check_out", label: "Out", render: (r) => time(r.check_out) },
          { key: "hours", label: "Hours", align: "right", render: (r) => hoursBetween(r.check_in, r.check_out) ?? "—" },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          ...(isAdmin ? [{ key: "act", label: "", align: "right", render: (r) => (
            <div className="row-actions">
              <button className="btn btn-sm" onClick={() => setEditing({ mode: "edit", row: r })}>Edit</button>
              <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(r)}>Delete</button>
            </div>) }] : []),
        ]} />
      </Card>
      {editing && <AttendanceForm {...editing} employees={visibleEmps} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function AttendanceForm({ mode, row, employees, onClose, onSaved }) {
  const [form, setForm] = useState({
    emp_id: row.emp_id ?? "", att_date: row.att_date ?? "", check_in: row.check_in?.slice(0, 5) ?? "09:00",
    check_out: row.check_out?.slice(0, 5) ?? "18:00", status: row.status ?? "Present",
  });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setError(null);
    const noTimes = form.status === "Absent" || form.status === "Leave";
    const data = clean({ ...form, check_in: noTimes ? "" : form.check_in, check_out: noTimes ? "" : form.check_out }, ["emp_id"]);
    try {
      if (mode === "add")
        await run({ action: "Record attendance", component: "INSERT", tables: ["attendance"], sql: sqlInsert("attendance", data) },
          () => supabase.from("attendance").insert(data).select(), () => "1 row inserted");
      else
        await run({ action: `Update attendance #${row.attendance_id}`, component: "UPDATE", tables: ["attendance"], sql: sqlUpdate("attendance", data, { attendance_id: row.attendance_id }) },
          () => supabase.from("attendance").update(data).eq("attendance_id", row.attendance_id).select(), (d) => `${d.length} row updated`);
      notify("success", "Attendance saved");
      onSaved();
    } catch (err) { setError(err.message); }
  }

  return (
    <Modal title={mode === "add" ? "Record attendance" : "Edit attendance"} onClose={onClose}
           footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="att-form">Save</button></>}>
      <form id="att-form" className="form-grid" onSubmit={save}>
        <Field label="Employee">
          <select required value={form.emp_id} onChange={set("emp_id")} disabled={mode === "edit"}>
            <option value="">Select…</option>
            {employees.map((e) => <option key={e.emp_id} value={e.emp_id}>{fullName(e)}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" required value={form.att_date} onChange={set("att_date")} /></Field>
        <Field label="Status">
          <select value={form.status} onChange={set("status")}>
            {["Present", "Half-Day", "Absent", "Leave"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div />
        <Field label="Check in"><input type="time" value={form.check_in} onChange={set("check_in")} /></Field>
        <Field label="Check out" hint="Must be after check-in (CHECK)"><input type="time" value={form.check_out} onChange={set("check_out")} /></Field>
        {error && <div className="field-span"><ErrorBox>{error}</ErrorBox></div>}
      </form>
    </Modal>
  );
}
