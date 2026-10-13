import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { run, notify } from "../lib/activity";
import { useAuth } from "../lib/auth";
import { useRefData } from "../lib/hooks";
import { sqlInsert, sqlUpdate, sqlDelete, clean } from "../lib/sql";
import { PageHeader, Card, DataTable, Badge, Modal, Field, Loading, ErrorBox } from "../components/ui";
import { date, fullName } from "../lib/format";

const EMPTY = {
  first_name: "", last_name: "", email: "", phone: "", gender: "F", dob: "", date_of_joining: new Date().toISOString().slice(0, 10),
  pan_no: "", bank_account_no: "", ifsc_code: "", status: "Active", dept_id: "", desig_id: "", reports_to: "", app_role: "Employee",
};
const NUMERIC = ["dept_id", "desig_id", "reports_to"];

export default function Employees() {
  const { isAdmin, role } = useAuth();
  const ref = useRefData();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | {mode, row}

  const rows = useMemo(() => {
    if (!ref.data) return null;
    const q = search.toLowerCase();
    return ref.data.employees.filter((e) =>
      !q || `${e.first_name} ${e.last_name} ${e.email} ${ref.data.dept[e.dept_id]?.dept_name}`.toLowerCase().includes(q));
  }, [ref.data, search]);

  async function remove(e) {
    if (!confirm(`Delete ${fullName(e)}? Employees with payroll history cannot be deleted (FK RESTRICT) — mark them Resigned instead.`)) return;
    try {
      await run({ action: `Delete employee #${e.emp_id}`, component: "DELETE", tables: ["employee", "attendance (CASCADE)", "leave_request (CASCADE)"],
                  sql: sqlDelete("employee", { emp_id: e.emp_id }) },
        () => supabase.from("employee").delete().eq("emp_id", e.emp_id).select(),
        (d) => d.length ? "1 row deleted" : "0 rows deleted (not permitted)");
      notify("success", `${fullName(e)} deleted`);
      ref.reload();
    } catch (err) { notify("error", err.message); }
  }

  if (ref.loading && !ref.data) return <Loading />;
  const { dept, desig, emp } = ref.data || {};

  return (
    <>
      <PageHeader title={role === "Manager" ? "My Team" : "Employees"}
                  subtitle={role === "Manager" ? "You, your manager and the people who report to you (Row Level Security)." : `${ref.data?.employees.length ?? 0} employees`}>
        <input className="search" placeholder="Search name, e-mail, department…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {isAdmin && <button className="btn btn-primary" onClick={() => setEditing({ mode: "add", row: EMPTY })}>+ Add employee</button>}
      </PageHeader>
      <ErrorBox>{ref.error}</ErrorBox>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.emp_id} columns={[
          { key: "emp_id", label: "ID", width: 50 },
          { key: "name", label: "Name", render: (r) => <div><div className="strong">{fullName(r)}</div><div className="muted small">{r.email}</div></div> },
          { key: "dept", label: "Department", render: (r) => dept[r.dept_id]?.dept_name },
          { key: "desig", label: "Designation", render: (r) => desig[r.desig_id]?.title },
          { key: "mgr", label: "Manager", render: (r) => (r.reports_to ? fullName(emp[r.reports_to]) : "—") },
          { key: "doj", label: "Joined", render: (r) => date(r.date_of_joining) },
          { key: "app_role", label: "Role", render: (r) => <Badge>{r.app_role}</Badge> },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          ...(isAdmin ? [{ key: "act", label: "", align: "right", render: (r) => (
            <div className="row-actions">
              <button className="btn btn-sm" onClick={() => setEditing({ mode: "edit", row: r })}>Edit</button>
              <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(r)}>Delete</button>
            </div>) }] : []),
        ]} />
      </Card>
      {editing && <EmployeeForm {...editing} refData={ref.data} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); ref.reload(); }} />}
    </>
  );
}

function EmployeeForm({ mode, row, refData, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    const f = { ...EMPTY };
    for (const k of Object.keys(EMPTY)) f[k] = row[k] ?? "";
    return f;
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = clean({ ...form, pan_no: form.pan_no.toUpperCase(), ifsc_code: form.ifsc_code.toUpperCase() }, NUMERIC);
    try {
      if (mode === "add") {
        await run({ action: "Add employee", component: "INSERT (+ trigger trg_validate_manager)", tables: ["employee"], sql: sqlInsert("employee", data) },
          () => supabase.from("employee").insert(data).select(), (d) => `1 row inserted (emp_id ${d[0].emp_id})`);
      } else {
        await run({ action: `Update employee #${row.emp_id}`, component: "UPDATE (+ triggers trg_validate_manager, trg_employee_exit)", tables: ["employee"],
                    sql: sqlUpdate("employee", data, { emp_id: row.emp_id }) },
          () => supabase.from("employee").update(data).eq("emp_id", row.emp_id).select(), (d) => `${d.length} row updated`);
      }
      notify("success", mode === "add" ? "Employee added" : "Employee updated");
      onSaved();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  const managers = refData.employees.filter((e) => e.status === "Active" && e.emp_id !== row.emp_id);
  return (
    <Modal title={mode === "add" ? "Add employee" : `Edit ${fullName(row)}`} onClose={onClose} wide
           footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="emp-form" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
      <form id="emp-form" className="form-grid" onSubmit={save}>
        <Field label="First name"><input required value={form.first_name} onChange={set("first_name")} /></Field>
        <Field label="Last name"><input required value={form.last_name} onChange={set("last_name")} /></Field>
        <Field label="E-mail" hint="A login with this e-mail is linked automatically"><input type="email" required value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone" hint="10 digits, starts with 6–9"><input required value={form.phone} onChange={set("phone")} /></Field>
        <Field label="Gender">
          <select value={form.gender} onChange={set("gender")}><option value="F">Female</option><option value="M">Male</option><option value="O">Other</option></select>
        </Field>
        <Field label="Date of birth"><input type="date" required value={form.dob} onChange={set("dob")} /></Field>
        <Field label="Date of joining" hint="Must be at least 18 years after DOB"><input type="date" required value={form.date_of_joining} onChange={set("date_of_joining")} /></Field>
        <Field label="PAN" hint="Format ABCDE1234F"><input required value={form.pan_no} onChange={set("pan_no")} /></Field>
        <Field label="Bank account no."><input required value={form.bank_account_no} onChange={set("bank_account_no")} /></Field>
        <Field label="IFSC" hint="Format ABCD0123456"><input required value={form.ifsc_code} onChange={set("ifsc_code")} /></Field>
        <Field label="Department">
          <select required value={form.dept_id} onChange={set("dept_id")}>
            <option value="">Select…</option>
            {refData.departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
          </select>
        </Field>
        <Field label="Designation">
          <select required value={form.desig_id} onChange={set("desig_id")}>
            <option value="">Select…</option>
            {refData.designations.map((d) => <option key={d.desig_id} value={d.desig_id}>{d.title} ({d.pay_grade})</option>)}
          </select>
        </Field>
        <Field label="Reports to">
          <select value={form.reports_to} onChange={set("reports_to")}>
            <option value="">— none —</option>
            {managers.map((m) => <option key={m.emp_id} value={m.emp_id}>{fullName(m)}</option>)}
          </select>
        </Field>
        <Field label="App role">
          <select value={form.app_role} onChange={set("app_role")}>
            {["Employee", "Manager", "Payroll", "Admin"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Status" hint={mode === "edit" ? "Resigned/Terminated fires trg_employee_exit" : undefined}>
          <select value={form.status} onChange={set("status")}>
            {["Active", "On Leave", "Resigned", "Terminated"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        {error && <div className="field-span"><ErrorBox>{error}</ErrorBox></div>}
      </form>
    </Modal>
  );
}
