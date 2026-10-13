import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { run, notify } from "../lib/activity";
import { useAuth } from "../lib/auth";
import { useLoad } from "../lib/hooks";
import { PageHeader, Card, Stat, Badge, Loading, DataTable } from "../components/ui";
import { money, money0, monthName, date, time, todayISO, nowTime, hoursBetween } from "../lib/format";

export default function Dashboard() {
  const { profile, isStaff, role } = useAuth();
  const [version, setVersion] = useState(0); // bumps after check-in/out so the counts reload
  return (
    <>
      <PageHeader title={`Welcome, ${profile.first_name}`} subtitle={greetingLine(role)} />
      <div className="grid-2">
        <CheckInCard onChange={() => setVersion((v) => v + 1)} />
        <MySummary />
      </div>
      {isStaff && <CompanyOverview key={version} />}
      {role === "Manager" && <TeamOverview />}
    </>
  );
}

function greetingLine(role) {
  return {
    Admin: "You manage employees, departments, attendance and leave approvals.",
    Payroll: "You maintain salary components and run monthly payroll.",
    Manager: "Approve your team's leave and follow their attendance.",
    Employee: "Check in, apply for leave and view your payslips.",
  }[role];
}

/* ---------------- check-in / check-out (INSERT / UPDATE on attendance) ---------------- */
function CheckInCard({ onChange }) {
  const { profile } = useAuth();
  const today = todayISO();
  const { data: rec, loading, reload } = useLoad(() =>
    run({ action: "Today's attendance", component: "SELECT", tables: ["attendance"],
          sql: `SELECT * FROM attendance WHERE emp_id = ${profile.emp_id} AND att_date = '${today}'` },
      () => supabase.from("attendance").select("*").eq("emp_id", profile.emp_id).eq("att_date", today).maybeSingle(),
      null, { silent: true }), [profile.emp_id, today]);

  const weekend = [0, 6].includes(new Date().getDay());

  async function checkIn() {
    const t = nowTime();
    try {
      await run({ action: "Check in", component: "INSERT (RLS: own row, today only)", tables: ["attendance"],
                  sql: `INSERT INTO attendance (emp_id, att_date, check_in, status)\nVALUES (${profile.emp_id}, '${today}', '${t}', 'Present');` },
        () => supabase.from("attendance").insert({ emp_id: profile.emp_id, att_date: today, check_in: t, status: "Present" }),
        () => "1 row inserted");
      notify("success", `Checked in at ${t}`);
      reload();
      onChange();
    } catch (e) { notify("error", e.message); }
  }
  async function checkOut() {
    const t = nowTime();
    try {
      await run({ action: "Check out", component: "UPDATE (RLS: own row, today only)", tables: ["attendance"],
                  sql: `UPDATE attendance SET check_out = '${t}'\n WHERE emp_id = ${profile.emp_id} AND att_date = '${today}';` },
        () => supabase.from("attendance").update({ check_out: t }).eq("emp_id", profile.emp_id).eq("att_date", today).select(),
        (d) => `${d.length} row updated`);
      notify("success", `Checked out at ${t}`);
      reload();
      onChange();
    } catch (e) { notify("error", e.message); }
  }

  return (
    <Card title="Today">
      {loading ? <Loading /> : (
        <div className="checkin">
          <div>
            <div className="big-date">{date(today)}</div>
            {rec ? (
              <div className="row-gap">
                <Badge>{rec.status}</Badge>
                <span className="muted">In {time(rec.check_in)} · Out {time(rec.check_out)}
                  {rec.check_in && rec.check_out ? ` · ${hoursBetween(rec.check_in, rec.check_out)} h` : ""}</span>
              </div>
            ) : (
              <span className="muted">{weekend ? "Weekend — no attendance needed." : "You have not checked in yet."}</span>
            )}
          </div>
          <div className="row-gap">
            {!rec && !weekend && <button className="btn btn-primary" onClick={checkIn}>Check in</button>}
            {rec && rec.status === "Present" && !rec.check_out && <button className="btn" onClick={checkOut}>Check out</button>}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- my leave balance + latest payslip (FUNCTION call + SELECT) ---------------- */
function MySummary() {
  const { profile } = useAuth();
  const year = new Date().getFullYear();
  const { data, loading } = useLoad(async () => {
    const [balance, pay] = await Promise.all([
      run({ action: "My leave balance", component: "FUNCTION fn_leave_balance", tables: ["leave_request", "designation"],
            sql: `SELECT fn_leave_balance(${profile.emp_id}, ${year});` },
        () => supabase.rpc("fn_leave_balance", { p_emp_id: profile.emp_id, p_year: year }), null, { silent: true }),
      run({ action: "My latest payslip", component: "SELECT", tables: ["payroll"],
            sql: `SELECT * FROM payroll WHERE emp_id = ${profile.emp_id}\n ORDER BY pay_year DESC, pay_month DESC LIMIT 1;` },
        () => supabase.from("payroll").select("*").eq("emp_id", profile.emp_id)
          .order("pay_year", { ascending: false }).order("pay_month", { ascending: false }).limit(1), null, { silent: true }),
    ]);
    return { balance, pay: pay[0] };
  }, [profile.emp_id]);

  return (
    <Card title="My summary">
      {loading || !data ? <Loading /> : (
        <div className="stats">
          <Stat label={`Leave balance ${year}`} value={`${data.balance} days`} hint={<Link to="/leave">Apply for leave →</Link>} />
          <Stat label={data.pay ? `Net pay · ${monthName(data.pay.pay_month)} ${data.pay.pay_year}` : "Net pay"}
                value={data.pay ? money0(data.pay.net_salary) : "—"}
                hint={data.pay ? <Link to="/payslips">View payslip →</Link> : "No payslip yet"} tone="green" />
        </div>
      )}
    </Card>
  );
}

/* ---------------- Admin / Payroll overview (views q13, q04 + counts) ---------------- */
function CompanyOverview() {
  const { data, loading } = useLoad(async () => {
    const [months, deptCost] = await Promise.all([
      run({ action: "Monthly totals", component: "VIEW q13_monthly_payroll_totals", tables: ["payroll"], sql: "SELECT * FROM q13_monthly_payroll_totals;" },
        () => supabase.from("q13_monthly_payroll_totals").select("*"), null, { silent: true }),
      run({ action: "Department cost", component: "VIEW q04_department_salary_cost", tables: ["payroll", "employee", "department"], sql: "SELECT * FROM q04_department_salary_cost;" },
        () => supabase.from("q04_department_salary_cost").select("*"), null, { silent: true }),
    ]);
    return { months, deptCost };
  }, []);
  if (loading || !data) return <Card title="Company overview"><Loading /></Card>;

  const latest = data.months[data.months.length - 1];
  const maxCost = Math.max(...data.deptCost.map((d) => Number(d.total_net)), 1);
  return (
    <>
      <div className="stats stats-4">
        <CountStat label="Active employees" table="employee" filter={["status", "Active"]} />
        <CountStat label="Pending leave requests" table="leave_request" filter={["status", "Pending"]} link="/leave" />
        <CountStat label="Checked in today" table="attendance" filter={["att_date", todayISO()]} />
        <Stat label={latest ? `Net payroll · ${monthName(latest.pay_month)} ${latest.pay_year}` : "Net payroll"}
              value={latest ? money0(latest.total_net) : "—"} hint={latest?.payment_status} tone="green" />
      </div>
      <div className="grid-2">
        <Card title={latest ? `Net salary cost by department · ${monthName(latest.pay_month)}` : "Net salary cost by department"}>
          <div className="bars">
            {data.deptCost.map((d) => (
              <div key={d.dept_name} className="bar-row">
                <span className="bar-label">{d.dept_name}</span>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(Number(d.total_net) / maxCost) * 100}%` }} /></span>
                <span className="bar-value">{money0(d.total_net)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Payroll by month" actions={<Link to="/payroll" className="btn btn-sm">Open payroll →</Link>}>
          <DataTable rows={data.months} rowKey={(r) => `${r.pay_year}-${r.pay_month}`} columns={[
            { key: "m", label: "Month", render: (r) => `${monthName(r.pay_month)} ${r.pay_year}` },
            { key: "payslips", label: "Payslips", align: "right" },
            { key: "total_net", label: "Net total", align: "right", render: (r) => money(r.total_net) },
            { key: "payment_status", label: "Status", render: (r) => <Badge tone={r.payment_status === "All paid" ? "green" : "amber"}>{r.payment_status}</Badge> },
          ]} />
        </Card>
      </div>
    </>
  );
}

function CountStat({ label, table, filter, link }) {
  const { data } = useLoad(async () => {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(filter[0], filter[1]);
    if (error) throw error;
    return count;
  }, [table, filter[0], filter[1]]);
  return <Stat label={label} value={data ?? "…"} hint={link ? <Link to={link}>Review →</Link> : null} />;
}

/* ---------------- Manager: pending approvals of the team ---------------- */
function TeamOverview() {
  const { profile } = useAuth();
  const { data, loading } = useLoad(async () => {
    const [team, pending] = await Promise.all([
      run({ action: "My team", component: "SELECT (RLS: own team)", tables: ["employee"], sql: `SELECT * FROM employee WHERE reports_to = ${profile.emp_id};` },
        () => supabase.from("employee").select("emp_id, first_name, last_name, status").eq("reports_to", profile.emp_id).order("emp_id"), null, { silent: true }),
      run({ action: "Team pending leave", component: "SELECT", tables: ["leave_request"], sql: `SELECT * FROM leave_request WHERE status = 'Pending' AND emp_id <> ${profile.emp_id};` },
        () => supabase.from("leave_request").select("*").eq("status", "Pending").neq("emp_id", profile.emp_id).order("start_date"), null, { silent: true }),
    ]);
    return { team, pending };
  }, [profile.emp_id]);
  if (loading || !data) return <Card title="My team"><Loading /></Card>;
  const name = Object.fromEntries(data.team.map((e) => [e.emp_id, `${e.first_name} ${e.last_name}`]));
  return (
    <div className="grid-2">
      <Card title={`My team (${data.team.length})`}>
        <DataTable rows={data.team} rowKey={(r) => r.emp_id} columns={[
          { key: "emp_id", label: "ID", width: 60 },
          { key: "name", label: "Name", render: (r) => `${r.first_name} ${r.last_name}` },
          { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
        ]} />
      </Card>
      <Card title={`Waiting for your approval (${data.pending.length})`} actions={<Link to="/leave" className="btn btn-sm">Review →</Link>}>
        <DataTable rows={data.pending} rowKey={(r) => r.leave_id} empty="Nothing to approve." columns={[
          { key: "who", label: "Employee", render: (r) => name[r.emp_id] || `#${r.emp_id}` },
          { key: "leave_type", label: "Type" },
          { key: "dates", label: "Dates", render: (r) => `${date(r.start_date)} – ${date(r.end_date)}` },
        ]} />
      </Card>
    </div>
  );
}
