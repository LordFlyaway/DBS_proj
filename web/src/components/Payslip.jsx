import { supabase } from "../lib/supabase";
import { run } from "../lib/activity";
import { useLoad } from "../lib/hooks";
import { Modal, Loading, ErrorBox, Badge } from "./ui";
import { money, monthName, date, fullName } from "../lib/format";

/** Payslip for one payroll row: PAYROLL + PAYROLL_DETAIL + SALARY_COMPONENT (+ employee info). */
export default function Payslip({ payroll, onClose }) {
  const { data, error } = useLoad(async () => {
    const [lines, emp] = await Promise.all([
      run({ action: `Payslip #${payroll.payroll_id}`, component: "SELECT … JOIN (M:N bridge table)", tables: ["payroll_detail", "salary_component"],
            sql: `SELECT c.component_type, c.component_name, pd.amount\n  FROM payroll_detail pd\n  JOIN salary_component c ON c.component_id = pd.component_id\n WHERE pd.payroll_id = ${payroll.payroll_id};` },
        () => supabase.from("payroll_detail").select("amount, salary_component(component_name, component_type, calc_method, value)").eq("payroll_id", payroll.payroll_id)),
      supabase.from("employee").select("*, department!employee_dept_id_fkey(dept_name), designation(title, pay_grade)")
        .eq("emp_id", payroll.emp_id).maybeSingle().then((r) => r.data),
    ]);
    return { lines, emp };
  }, [payroll.payroll_id]);

  const p = payroll;
  const lop = Number(p.basic_salary) / p.working_days * Number(p.lop_days);
  const earnings = data?.lines.filter((l) => l.salary_component.component_type === "Allowance") || [];
  const deductions = data?.lines.filter((l) => l.salary_component.component_type === "Deduction") || [];

  return (
    <Modal title={`Payslip · ${monthName(p.pay_month)} ${p.pay_year}`} onClose={onClose} wide
           footer={<><button className="btn" onClick={() => window.print()}>Print</button><button className="btn btn-primary" onClick={onClose}>Close</button></>}>
      <ErrorBox>{error}</ErrorBox>
      {!data ? <Loading /> : (
        <div className="payslip">
          <div className="payslip-head">
            <div>
              <div className="payslip-company">NexaTech Solutions Pvt. Ltd.</div>
              <div className="muted small">Salary slip for {monthName(p.pay_month)} {p.pay_year}</div>
            </div>
            <Badge>{p.status}</Badge>
          </div>
          <div className="payslip-info">
            <div><span>Employee</span>{fullName(data.emp)} (#{p.emp_id})</div>
            <div><span>Designation</span>{data.emp?.designation?.title} · {data.emp?.designation?.pay_grade}</div>
            <div><span>Department</span>{data.emp?.department?.dept_name}</div>
            <div><span>PAN</span>{data.emp?.pan_no}</div>
            <div><span>Bank A/c</span>{data.emp?.bank_account_no} · {data.emp?.ifsc_code}</div>
            <div><span>Working days</span>{p.working_days} (LOP {Number(p.lop_days)})</div>
          </div>
          <div className="payslip-cols">
            <table className="table">
              <thead><tr><th>Earnings</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                <tr><td>Basic salary</td><td className="num">{money(p.basic_salary)}</td></tr>
                {lop > 0 && <tr><td>Less: loss of pay ({Number(p.lop_days)} days)</td><td className="num neg">− {money(lop)}</td></tr>}
                {earnings.map((l) => (
                  <tr key={l.salary_component.component_name}><td>{l.salary_component.component_name}</td><td className="num">{money(l.amount)}</td></tr>
                ))}
                <tr className="total"><td>Gross earnings</td><td className="num">{money(p.gross_salary)}</td></tr>
              </tbody>
            </table>
            <table className="table">
              <thead><tr><th>Deductions</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
              <tbody>
                {deductions.map((l) => (
                  <tr key={l.salary_component.component_name}><td>{l.salary_component.component_name}</td><td className="num">{money(l.amount)}</td></tr>
                ))}
                <tr className="total"><td>Total deductions</td><td className="num">{money(p.total_deductions)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="netpay">
            <span>Net pay</span>
            <strong>{money(p.net_salary)}</strong>
          </div>
          {p.status === "Paid" && (
            <div className="muted small">Paid on {date(p.payment_date)} via {p.payment_mode} · Ref {p.transaction_ref}</div>
          )}
        </div>
      )}
    </Modal>
  );
}
