import { useState } from "react";
import { supabase } from "../lib/supabase";
import { run } from "../lib/activity";
import { useAuth } from "../lib/auth";
import { useLoad } from "../lib/hooks";
import { PageHeader, Card, DataTable, Badge, ErrorBox } from "../components/ui";
import Payslip from "../components/Payslip";
import { money, monthName, date } from "../lib/format";

export default function Payslips() {
  const { profile } = useAuth();
  const [slip, setSlip] = useState(null);
  const { data: rows, error } = useLoad(() =>
    run({ action: "My payslips", component: "SELECT (RLS: own payroll rows)", tables: ["payroll"],
          sql: `SELECT * FROM payroll WHERE emp_id = ${profile.emp_id} ORDER BY pay_year DESC, pay_month DESC;` },
      () => supabase.from("payroll").select("*").eq("emp_id", profile.emp_id)
        .order("pay_year", { ascending: false }).order("pay_month", { ascending: false }), null, { silent: true }), [profile.emp_id]);

  return (
    <>
      <PageHeader title="My payslips" subtitle="Click a month to open the itemised payslip." />
      <ErrorBox>{error}</ErrorBox>
      <Card>
        <DataTable rows={rows} rowKey={(r) => r.payroll_id} onRowClick={setSlip} empty="No payslips yet." columns={[
          { key: "m", label: "Month", render: (r) => <span className="strong">{monthName(r.pay_month)} {r.pay_year}</span> },
          { key: "lop_days", label: "LOP days", align: "right", render: (r) => Number(r.lop_days) || "—" },
          { key: "gross_salary", label: "Gross", align: "right", render: (r) => money(r.gross_salary) },
          { key: "total_deductions", label: "Deductions", align: "right", render: (r) => money(r.total_deductions) },
          { key: "net_salary", label: "Net pay", align: "right", render: (r) => <span className="strong">{money(r.net_salary)}</span> },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          { key: "payment_date", label: "Paid on", render: (r) => date(r.payment_date) },
        ]} />
      </Card>
      {slip && <Payslip payroll={slip} onClose={() => setSlip(null)} />}
    </>
  );
}
