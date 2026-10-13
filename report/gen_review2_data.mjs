// Runs the project SQL in an in-memory PostgreSQL (PGlite) and records real
// outputs for the Review II report: table counts, sample rows, every query,
// DML demonstrations, function/procedure calls and trigger behaviour.
// Output: report/review2_data.json
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "scripts", "package.json"));
const { PGlite } = await import(pathToFileURL(require.resolve("@electric-sql/pglite")).href);
const { QUERIES } = await import(pathToFileURL(path.join(ROOT, "web", "src", "queries.js")).href);

const db = new PGlite();
for (const f of ["01_schema.sql", "02_functions_procedures.sql", "03_triggers.sql", "04_seed_data.sql", "05_queries.sql"])
  await db.exec(readFileSync(path.join(ROOT, "sql", f), "utf8"));

const fmt = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};
async function q(sql) {
  const r = await db.query(sql);
  return { cols: r.fields.map((f) => f.name), rows: r.rows.map((row) => r.fields.map((f) => fmt(row[f.name]))), affected: r.affectedRows };
}
async function tryq(sql) {
  try { return { ok: true, ...(await q(sql)) }; }
  catch (e) { return { ok: false, error: e.message }; }
}

const out = {};

// ---- table counts + sample rows
out.counts = (await q(`
  SELECT 'department' AS table_name, COUNT(*) AS rows FROM department UNION ALL
  SELECT 'designation', COUNT(*) FROM designation UNION ALL
  SELECT 'employee', COUNT(*) FROM employee UNION ALL
  SELECT 'attendance', COUNT(*) FROM attendance UNION ALL
  SELECT 'leave_request', COUNT(*) FROM leave_request UNION ALL
  SELECT 'salary_component', COUNT(*) FROM salary_component UNION ALL
  SELECT 'payroll', COUNT(*) FROM payroll UNION ALL
  SELECT 'payroll_detail', COUNT(*) FROM payroll_detail`));

out.samples = {
  department: await q("SELECT dept_id, dept_name, location, head_emp_id, created_on FROM department ORDER BY dept_id"),
  designation: await q("SELECT desig_id, title, pay_grade, basic_salary, annual_leave_quota FROM designation ORDER BY desig_id"),
  employee: await q("SELECT emp_id, first_name, last_name, gender, date_of_joining, dept_id, desig_id, reports_to, app_role, status FROM employee ORDER BY emp_id"),
  attendance: await q("SELECT attendance_id, emp_id, att_date, check_in, check_out, status FROM attendance WHERE emp_id = 13 AND att_date BETWEEN '2026-09-01' AND '2026-09-14' ORDER BY att_date"),
  leave_request: await q("SELECT leave_id, emp_id, leave_type, start_date, end_date, status, applied_on, approved_by FROM leave_request ORDER BY leave_id"),
  salary_component: await q("SELECT component_id, component_name, component_type, calc_method, value, is_taxable, is_active FROM salary_component ORDER BY component_id"),
  payroll: await q("SELECT payroll_id, emp_id, pay_month, pay_year, working_days, lop_days, basic_salary, gross_salary, total_deductions, net_salary, status FROM payroll WHERE pay_month = 9 ORDER BY emp_id LIMIT 12"),
  payroll_detail: await q("SELECT pd.payroll_id, pd.component_id, c.component_name, pd.amount FROM payroll_detail pd JOIN salary_component c USING (component_id) JOIN payroll p USING (payroll_id) WHERE p.emp_id = 6 AND p.pay_month = 9 ORDER BY pd.component_id"),
};

// ---- queries
out.queries = [];
for (const item of QUERIES) {
  const r = await q(`SELECT * FROM ${item.view}`);
  out.queries.push({ id: item.id, title: item.title, concepts: item.concepts, sql: item.sql, total: r.rows.length, cols: r.cols, rows: r.rows.slice(0, 10) });
}

// ---- functions
out.functions = {
  working_days: await q("SELECT fn_working_days(8, 2026) AS aug_2026, fn_working_days(9, 2026) AS sep_2026, fn_working_days(10, 2026) AS oct_2026"),
  component_amount: await q("SELECT component_name, calc_method, value, fn_component_amount(component_id, 45000) AS amount_for_basic_45000 FROM salary_component WHERE is_active ORDER BY component_id"),
  lop_days: await q("SELECT e.emp_id, e.first_name || ' ' || e.last_name AS employee, fn_lop_days(e.emp_id, 9, 2026) AS lop_sep_2026 FROM employee e WHERE e.emp_id IN (2, 10, 13, 16) ORDER BY e.emp_id"),
  leave_balance: await q("SELECT e.emp_id, e.first_name || ' ' || e.last_name AS employee, g.annual_leave_quota AS quota, fn_leave_balance(e.emp_id, 2026) AS balance FROM employee e JOIN designation g USING (desig_id) WHERE e.emp_id IN (6, 7, 12, 14) ORDER BY e.emp_id"),
};

// ---- DML demonstration (+ constraint violations)
const dml = [];
async function step(title, sql, note) { dml.push({ title, sql, note, result: await tryq(sql) }); }
await step("INSERT a new employee", `INSERT INTO employee (first_name, last_name, email, phone, gender, dob, date_of_joining,
                      pan_no, bank_account_no, ifsc_code, dept_id, desig_id, reports_to)
VALUES ('Kylian', 'Mbappe', 'kylian.mbappe@allcaps.example', '9840012321', 'M', '1998-12-20',
        '2026-10-01', 'AUKPM1221F', '501000123421', 'HDFC0001201', 2, 2, 4)
RETURNING emp_id, first_name, last_name, status, app_role;`, "status and app_role take their DEFAULT values ('Active', 'Employee').");
await step("INSERT rejected by CHECK constraint (invalid PAN format)", `INSERT INTO employee (first_name, last_name, email, phone, gender, dob, date_of_joining,
                      pan_no, bank_account_no, ifsc_code, dept_id, desig_id)
VALUES ('Test', 'User', 'test.user@allcaps.example', '9840012399', 'M', '1999-01-01',
        '2026-10-01', 'BADPAN', '501000999999', 'HDFC0001201', 2, 2);`, "The PAN must match ^[A-Z]{5}[0-9]{4}[A-Z]$.");
await step("INSERT rejected by UNIQUE constraint (attendance already recorded)", `INSERT INTO attendance (emp_id, att_date, status)
VALUES (6, '2026-09-01', 'Present');`, "UNIQUE (emp_id, att_date) allows one row per employee per day.");
await step("INSERT rejected by FOREIGN KEY (department does not exist)", `INSERT INTO employee (first_name, last_name, email, phone, gender, dob, date_of_joining,
                      pan_no, bank_account_no, ifsc_code, dept_id, desig_id)
VALUES ('Test', 'User', 'test.user@allcaps.example', '9840012399', 'M', '1999-01-01',
        '2026-10-01', 'AVTPU1299G', '501000999999', 'HDFC0001201', 99, 2);`, "dept_id 99 is not in DEPARTMENT.");
await step("UPDATE: annual salary revision of a designation", `UPDATE designation
   SET basic_salary = basic_salary * 1.10
 WHERE title = 'Software Engineer'
RETURNING desig_id, title, basic_salary;`, "Future payroll runs use the new basic; paid payslips keep their stored snapshot.");
await step("UPDATE: deactivate a salary component", `UPDATE salary_component
   SET is_active = FALSE
 WHERE component_name = 'Internet Allowance'
RETURNING component_id, component_name, is_active;`, "Inactive components are skipped by generate_monthly_payroll.");
await step("DELETE: employee cancels a pending leave request", `DELETE FROM leave_request
 WHERE leave_id = 13 AND status = 'Pending'
RETURNING leave_id, emp_id, leave_type, status;`, null);
await step("DELETE: remove the employee added above (no payroll yet)", `DELETE FROM employee
 WHERE email = 'kylian.mbappe@allcaps.example'
RETURNING emp_id, first_name, last_name;`, null);
await step("DELETE rejected by FOREIGN KEY (employee has payroll history)", `DELETE FROM employee WHERE emp_id = 7;`,
  "payroll.emp_id references employee with ON DELETE RESTRICT (default NO ACTION), so salary history cannot be lost.");
out.dml = dml;

// ---- transactions (procedures, cursor, triggers) in the order the app performs them
const tx = {};
tx.apply = await tryq(`INSERT INTO leave_request (emp_id, leave_type, start_date, end_date, reason)
VALUES (7, 'Unpaid', '2026-10-21', '2026-10-22', 'Family emergency')
RETURNING leave_id, emp_id, leave_type, start_date, end_date, status;`);
const newLeave = tx.apply.rows?.[0]?.[0];
tx.att_before = await q(`SELECT att_date, status FROM attendance WHERE emp_id = 20 AND att_date BETWEEN '2026-10-14' AND '2026-10-17' ORDER BY att_date`);
tx.approve = await tryq(`CALL process_leave(10, 4, 'Approved');`);
tx.att_after = await q(`SELECT att_date, status FROM attendance WHERE emp_id = 20 AND att_date BETWEEN '2026-10-14' AND '2026-10-17' ORDER BY att_date`);
tx.leave_after = await q(`SELECT leave_id, emp_id, leave_type, status, approved_by FROM leave_request WHERE leave_id = 10`);
tx.approve_wrong_mgr = await tryq(`CALL process_leave(${newLeave}, 5, 'Approved');`);
tx.approve_self = await tryq(`CALL process_leave(${newLeave}, 7, 'Approved');`);
tx.approve_twice = await tryq(`CALL process_leave(10, 4, 'Approved');`);
tx.approve_new = await tryq(`CALL process_leave(${newLeave}, 4, 'Approved');`);
tx.big_leave = await tryq(`INSERT INTO leave_request (emp_id, leave_type, start_date, end_date) VALUES (12, 'Earned', '2026-11-02', '2026-11-27') RETURNING leave_id;`);
tx.balance_fail = await tryq(`CALL process_leave(${tx.big_leave.rows?.[0]?.[0]}, 5, 'Approved');`);

tx.gen_count_before = await q(`SELECT COUNT(*) AS october_payslips FROM payroll WHERE pay_month = 10 AND pay_year = 2026`);
tx.generate = await tryq(`CALL generate_monthly_payroll(10, 2026);`);
tx.generate_again = await tryq(`CALL generate_monthly_payroll(10, 2026);`);
tx.gen_rows = await q(`SELECT p.emp_id, e.first_name || ' ' || e.last_name AS employee, p.working_days, p.lop_days, p.basic_salary, p.gross_salary, p.total_deductions, p.net_salary, p.status
  FROM payroll p JOIN employee e USING (emp_id) WHERE p.pay_month = 10 AND p.pay_year = 2026 AND p.emp_id IN (1, 6, 7, 13, 20) ORDER BY p.emp_id`);
tx.gen_detail_count = await q(`SELECT COUNT(*) AS october_line_items FROM payroll_detail pd JOIN payroll p USING (payroll_id) WHERE p.pay_month = 10`);

tx.pay = await tryq(`CALL pay_monthly_payroll(10, 2026, 'NEFT');`);
tx.pay_rows = await q(`SELECT emp_id, status, payment_date, payment_mode, transaction_ref FROM payroll WHERE pay_month = 10 AND emp_id IN (1, 6, 7) ORDER BY emp_id`);
tx.lock_update = await tryq(`UPDATE payroll SET net_salary = net_salary + 10000 WHERE pay_month = 10 AND emp_id = 6;`);
tx.lock_delete = await tryq(`DELETE FROM payroll WHERE pay_month = 10 AND emp_id = 6;`);

tx.mgr_bad = await tryq(`UPDATE employee SET reports_to = 19 WHERE emp_id = 8;`);
tx.mgr_cycle = await tryq(`UPDATE employee SET reports_to = 6 WHERE emp_id = 4;`);

tx.exit_before = await q(`SELECT emp_id, first_name || ' ' || last_name AS employee, reports_to FROM employee WHERE reports_to = 5 ORDER BY emp_id`);
tx.exit_head_before = await q(`SELECT dept_name, head_emp_id FROM department WHERE dept_name = 'Sales'`);
tx.exit = await tryq(`UPDATE employee SET status = 'Resigned' WHERE emp_id = 5;`);
tx.exit_after = await q(`SELECT emp_id, first_name || ' ' || last_name AS employee, reports_to FROM employee WHERE emp_id IN (12, 13, 14) ORDER BY emp_id`);
tx.exit_head_after = await q(`SELECT dept_name, head_emp_id FROM department WHERE dept_name = 'Sales'`);
out.tx = tx;

writeFileSync(path.join(ROOT, "report", "review2_data.json"), JSON.stringify(out, null, 1));
console.log("wrote report/review2_data.json");
for (const [k, v] of Object.entries(tx)) if (v && v.ok === false) console.log(`  [expected error] ${k}: ${v.error}`);
for (const d of dml) console.log(`  DML ${d.title}: ${d.result.ok ? (d.result.rows.length + " row(s)") : "ERROR " + d.result.error}`);
