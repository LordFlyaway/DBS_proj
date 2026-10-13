import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { run, notify } from "../lib/activity";
import { useLoad, useRefData } from "../lib/hooks";
import { sqlDelete } from "../lib/sql";
import { PageHeader, Card, DataTable, Badge, Stat, ErrorBox } from "../components/ui";
import Payslip from "../components/Payslip";
import { money, money0, monthName, MONTHS, fullName } from "../lib/format";

export default function PayrollRun() {
  const ref = useRefData();
  const [period, setPeriod] = useState(null);
  const [mode, setMode] = useState("NEFT");
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState(null);

  // default to the latest month that has payroll, else the current month
  useEffect(() => {
    supabase.from("payroll").select("pay_month, pay_year").order("pay_year", { ascending: false })
      .order("pay_month", { ascending: false }).limit(1)
      .then(({ data }) => {
        const d = new Date();
        setPeriod(data?.[0] ? { month: data[0].pay_month, year: data[0].pay_year } : { month: d.getMonth() + 1, year: d.getFullYear() });
      });
  }, []);

  const { data: rows, error, reload } = useLoad(async () => {
    if (!period) return null;
    return run({ action: `Load payroll ${period.month}/${period.year}`, component: "SELECT", tables: ["payroll"],
                 sql: `SELECT * FROM payroll WHERE pay_month = ${period.month} AND pay_year = ${period.year} ORDER BY emp_id;` },
      () => supabase.from("payroll").select("*").eq("pay_month", period.month).eq("pay_year", period.year).order("emp_id"), null, { silent: true });
  }, [period?.month, period?.year]);

  async function generate() {
    setBusy(true);
    try {
      const n = await run({ action: `Generate payroll ${monthName(period.month)} ${period.year}`,
                            component: "FUNCTION api_generate_payroll → PROCEDURE generate_monthly_payroll (CURSOR over active employees; uses fn_working_days, fn_lop_days, fn_component_amount)",
                            tables: ["employee", "designation", "attendance", "leave_request", "salary_component", "payroll", "payroll_detail"],
                            sql: `SELECT api_generate_payroll(${period.month}, ${period.year});\n-- runs: CALL generate_monthly_payroll(${period.month}, ${period.year});` },
        () => supabase.rpc("api_generate_payroll", { p_month: period.month, p_year: period.year }),
        (d) => `${d} payslip(s) generated${d === 0 ? " (already generated for everyone)" : ""}`);
      notify("success", `${n} payslip(s) generated`);
      reload();
    } catch (e) { notify("error", e.message); }
    setBusy(false);
  }

  async function payAll() {
    if (!confirm(`Mark all unpaid salaries for ${monthName(period.month)} ${period.year} as paid via ${mode}? Paid payroll is locked by a trigger.`)) return;
    setBusy(true);
    try {
      const n = await run({ action: `Pay salaries ${monthName(period.month)} ${period.year}`,
                            component: "FUNCTION api_pay_payroll → PROCEDURE pay_monthly_payroll (CURSOR … FOR UPDATE)",
                            tables: ["payroll"],
                            sql: `SELECT api_pay_payroll(${period.month}, ${period.year}, '${mode}');\n-- runs: CALL pay_monthly_payroll(${period.month}, ${period.year}, '${mode}');` },
        () => supabase.rpc("api_pay_payroll", { p_month: period.month, p_year: period.year, p_mode: mode }),
        (d) => `${d} payroll row(s) marked Paid`);
      notify("success", `${n} salaries paid`);
      reload();
    } catch (e) { notify("error", e.message); }
    setBusy(false);
  }

  async function remove(r) {
    if (!confirm(`Delete the ${monthName(r.pay_month)} payroll of ${fullName(ref.data?.emp[r.emp_id])}? (Paid payroll is protected by trigger trg_lock_paid_payroll.)`)) return;
    try {
      await run({ action: `Delete payroll #${r.payroll_id}`, component: "DELETE (TRIGGER trg_lock_paid_payroll checks status; payroll_detail CASCADE)",
                  tables: ["payroll", "payroll_detail"], sql: sqlDelete("payroll", { payroll_id: r.payroll_id }) },
        () => supabase.from("payroll").delete().eq("payroll_id", r.payroll_id).select(), (d) => `${d.length} row deleted`);
      notify("success", "Payroll row deleted — generate again to recalculate");
      reload();
    } catch (e) { notify("error", e.message); }
  }

  if (!period) return null;
  const emp = ref.data?.emp || {};
  const totals = (rows || []).reduce((t, r) => ({
    gross: t.gross + Number(r.gross_salary), ded: t.ded + Number(r.total_deductions), net: t.net + Number(r.net_salary),
    unpaid: t.unpaid + (r.status !== "Paid" ? 1 : 0),
  }), { gross: 0, ded: 0, net: 0, unpaid: 0 });

  return (
    <>
      <PageHeader title="Payroll run" subtitle="Generate calls a stored procedure that loops over active employees with a cursor.">
        <select value={period.month} onChange={(e) => setPeriod({ ...period, month: Number(e.target.value) })}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={period.year} onChange={(e) => setPeriod({ ...period, year: Number(e.target.value) })}>
          {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
        </select>
        <button className="btn btn-primary" disabled={busy} onClick={generate}>Generate payroll</button>
        <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Payment mode">
          {["NEFT", "IMPS", "Cheque"].map((m) => <option key={m}>{m}</option>)}
        </select>
        <button className="btn" disabled={busy || !totals.unpaid} onClick={payAll}>Pay all ({totals.unpaid})</button>
      </PageHeader>
      <div className="stats stats-4">
        <Stat label="Payslips" value={rows?.length ?? "…"} />
        <Stat label="Gross" value={money0(totals.gross)} />
        <Stat label="Deductions" value={money0(totals.ded)} tone="red" />
        <Stat label="Net payout" value={money0(totals.net)} tone="green" />
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.payroll_id} onRowClick={setSlip}
                   empty={`No payroll for ${monthName(period.month)} ${period.year} yet — click “Generate payroll”.`} columns={[
          { key: "emp", label: "Employee", render: (r) => <span className="strong">{fullName(emp[r.emp_id])}</span> },
          { key: "lop_days", label: "LOP days", align: "right", render: (r) => Number(r.lop_days) || "—" },
          { key: "basic_salary", label: "Basic", align: "right", render: (r) => money(r.basic_salary) },
          { key: "total_allowances", label: "Allowances", align: "right", render: (r) => money(r.total_allowances) },
          { key: "gross_salary", label: "Gross", align: "right", render: (r) => money(r.gross_salary) },
          { key: "total_deductions", label: "Deductions", align: "right", render: (r) => money(r.total_deductions) },
          { key: "net_salary", label: "Net", align: "right", render: (r) => <span className="strong">{money(r.net_salary)}</span> },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          { key: "act", label: "", align: "right", render: (r) => (
            <button className="btn btn-sm btn-danger-ghost" onClick={(e) => { e.stopPropagation(); remove(r); }}>Delete</button>) },
        ]} />
      </Card>
      {slip && <Payslip payroll={slip} onClose={() => setSlip(null)} />}
    </>
  );
}
