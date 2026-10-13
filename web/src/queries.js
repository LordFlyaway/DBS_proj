// Single source of truth for the project's SQL queries.
// scripts/gen_queries.mjs turns each entry into a view (sql/05_queries.sql);
// the Queries page reads the same list to show the SQL next to its live output.
// "Latest month" = the most recent month that has payroll rows.

const LATEST = `latest AS (
    SELECT pay_month, pay_year
      FROM payroll
     ORDER BY pay_year DESC, pay_month DESC
     LIMIT 1
)`;

export const QUERIES = [
  {
    id: 1,
    view: "q01_employee_directory",
    title: "Employee directory with department, designation and manager",
    concepts: ["INNER JOIN", "LEFT SELF-JOIN"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       d.dept_name,
       g.title AS designation,
       m.first_name || ' ' || m.last_name AS manager,
       e.status
  FROM employee e
  JOIN department  d ON d.dept_id  = e.dept_id
  JOIN designation g ON g.desig_id = e.desig_id
  LEFT JOIN employee m ON m.emp_id = e.reports_to
 ORDER BY e.emp_id`,
  },
  {
    id: 2,
    view: "q02_department_headcount",
    title: "Head-count and average basic salary of every department (including empty ones)",
    concepts: ["LEFT JOIN", "GROUP BY", "COUNT / AVG"],
    sql: `SELECT d.dept_name,
       d.location,
       COUNT(e.emp_id) AS active_employees,
       ROUND(AVG(g.basic_salary), 2) AS avg_basic_salary
  FROM department d
  LEFT JOIN employee e    ON e.dept_id = d.dept_id AND e.status = 'Active'
  LEFT JOIN designation g ON g.desig_id = e.desig_id
 GROUP BY d.dept_id, d.dept_name, d.location
 ORDER BY active_employees DESC, d.dept_name`,
  },
  {
    id: 3,
    view: "q03_above_average_basic",
    title: "Employees whose basic salary is above the company average",
    concepts: ["Scalar subquery", "Comparison"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       g.title,
       g.basic_salary
  FROM employee e
  JOIN designation g ON g.desig_id = e.desig_id
 WHERE e.status = 'Active'
   AND g.basic_salary > (SELECT AVG(g2.basic_salary)
                           FROM employee e2
                           JOIN designation g2 ON g2.desig_id = e2.desig_id
                          WHERE e2.status = 'Active')
 ORDER BY g.basic_salary DESC`,
  },
  {
    id: 4,
    view: "q04_department_salary_cost",
    title: "Department-wise salary cost for the latest payroll month",
    concepts: ["CTE (WITH)", "JOIN", "SUM", "GROUP BY"],
    sql: `WITH ${LATEST}
SELECT d.dept_name,
       COUNT(*)              AS employees_paid,
       SUM(p.gross_salary)   AS total_gross,
       SUM(p.total_deductions) AS total_deductions,
       SUM(p.net_salary)     AS total_net
  FROM payroll p
  JOIN latest l     ON l.pay_month = p.pay_month AND l.pay_year = p.pay_year
  JOIN employee e   ON e.emp_id = p.emp_id
  JOIN department d ON d.dept_id = e.dept_id
 GROUP BY d.dept_name
 ORDER BY total_net DESC`,
  },
  {
    id: 5,
    view: "q05_top_earners",
    title: "Top 5 earners by net salary in the latest month (with rank)",
    concepts: ["Window function RANK()", "ORDER BY", "LIMIT"],
    sql: `WITH ${LATEST}
SELECT RANK() OVER (ORDER BY p.net_salary DESC) AS rank,
       e.first_name || ' ' || e.last_name AS employee,
       g.title,
       p.net_salary
  FROM payroll p
  JOIN latest l      ON l.pay_month = p.pay_month AND l.pay_year = p.pay_year
  JOIN employee e    ON e.emp_id = p.emp_id
  JOIN designation g ON g.desig_id = e.desig_id
 ORDER BY p.net_salary DESC
 LIMIT 5`,
  },
  {
    id: 6,
    view: "q06_attendance_summary",
    title: "Attendance summary of every employee for September 2026",
    concepts: ["Conditional aggregation (FILTER)", "GROUP BY"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       COUNT(*) FILTER (WHERE a.status = 'Present')  AS present,
       COUNT(*) FILTER (WHERE a.status = 'Half-Day') AS half_days,
       COUNT(*) FILTER (WHERE a.status = 'Absent')   AS absent,
       COUNT(*) FILTER (WHERE a.status = 'Leave')    AS on_leave
  FROM employee e
  JOIN attendance a ON a.emp_id = e.emp_id
 WHERE a.att_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'
 GROUP BY e.emp_id, e.first_name, e.last_name
 ORDER BY absent DESC, half_days DESC, e.emp_id`,
  },
  {
    id: 7,
    view: "q07_loss_of_pay",
    title: "Employees who lost pay (LOP) in any month, with the amount lost",
    concepts: ["WHERE filter", "Arithmetic expression", "JOIN"],
    sql: `SELECT p.pay_month,
       p.pay_year,
       e.first_name || ' ' || e.last_name AS employee,
       p.lop_days,
       ROUND(p.basic_salary / p.working_days * p.lop_days, 2) AS basic_lost
  FROM payroll p
  JOIN employee e ON e.emp_id = p.emp_id
 WHERE p.lop_days > 0
 ORDER BY p.pay_year, p.pay_month, basic_lost DESC`,
  },
  {
    id: 8,
    view: "q08_leave_balance",
    title: "Remaining 2026 leave balance of every active employee",
    concepts: ["User-defined FUNCTION in SELECT"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       g.annual_leave_quota AS quota,
       fn_leave_balance(e.emp_id, 2026) AS balance
  FROM employee e
  JOIN designation g ON g.desig_id = e.desig_id
 WHERE e.status = 'Active'
 ORDER BY balance, e.emp_id`,
  },
  {
    id: 9,
    view: "q09_pending_leave",
    title: "Pending leave requests and the manager who must approve them",
    concepts: ["Self-join", "Date arithmetic"],
    sql: `SELECT lr.leave_id,
       e.first_name || ' ' || e.last_name AS employee,
       lr.leave_type,
       lr.start_date,
       lr.end_date,
       (lr.end_date - lr.start_date + 1) AS calendar_days,
       COALESCE(m.first_name || ' ' || m.last_name, '(Admin)') AS approver
  FROM leave_request lr
  JOIN employee e      ON e.emp_id = lr.emp_id
  LEFT JOIN employee m ON m.emp_id = e.reports_to
 WHERE lr.status = 'Pending'
 ORDER BY lr.start_date`,
  },
  {
    id: 10,
    view: "q10_manager_span",
    title: "Managers with at least 3 direct reports",
    concepts: ["Self-join", "GROUP BY", "HAVING"],
    sql: `SELECT m.emp_id,
       m.first_name || ' ' || m.last_name AS manager,
       COUNT(e.emp_id) AS direct_reports
  FROM employee m
  JOIN employee e ON e.reports_to = m.emp_id AND e.status = 'Active'
 GROUP BY m.emp_id, m.first_name, m.last_name
HAVING COUNT(e.emp_id) >= 3
 ORDER BY direct_reports DESC`,
  },
  {
    id: 11,
    view: "q11_payslip_lines",
    title: "Itemised payslip lines of every employee for the latest month",
    concepts: ["4-table JOIN", "M:N bridge table"],
    sql: `WITH ${LATEST}
SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       c.component_type,
       c.component_name,
       pd.amount
  FROM payroll p
  JOIN latest l           ON l.pay_month = p.pay_month AND l.pay_year = p.pay_year
  JOIN employee e         ON e.emp_id = p.emp_id
  JOIN payroll_detail pd  ON pd.payroll_id = p.payroll_id
  JOIN salary_component c ON c.component_id = pd.component_id
 ORDER BY e.emp_id, c.component_type, pd.amount DESC`,
  },
  {
    id: 12,
    view: "q12_no_leave_taken",
    title: "Active employees who have not taken any approved leave in 2026",
    concepts: ["NOT EXISTS (correlated subquery)"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       d.dept_name
  FROM employee e
  JOIN department d ON d.dept_id = e.dept_id
 WHERE e.status = 'Active'
   AND NOT EXISTS (SELECT 1
                     FROM leave_request lr
                    WHERE lr.emp_id = e.emp_id
                      AND lr.status = 'Approved'
                      AND EXTRACT(YEAR FROM lr.start_date) = 2026)
 ORDER BY e.emp_id`,
  },
  {
    id: 13,
    view: "q13_monthly_payroll_totals",
    title: "Month-by-month payroll totals and payment status",
    concepts: ["GROUP BY multiple columns", "SUM", "CASE"],
    sql: `SELECT pay_year,
       pay_month,
       COUNT(*) AS payslips,
       SUM(gross_salary) AS total_gross,
       SUM(net_salary)   AS total_net,
       CASE WHEN BOOL_AND(status = 'Paid') THEN 'All paid'
            ELSE COUNT(*) FILTER (WHERE status <> 'Paid') || ' unpaid' END AS payment_status
  FROM payroll
 GROUP BY pay_year, pay_month
 ORDER BY pay_year, pay_month`,
  },
  {
    id: 14,
    view: "q14_departments_above_avg_net",
    title: "Departments whose average net salary is above the company average (latest month)",
    concepts: ["HAVING with subquery", "AVG"],
    sql: `WITH ${LATEST}
SELECT d.dept_name,
       ROUND(AVG(p.net_salary), 2) AS avg_net_salary
  FROM payroll p
  JOIN latest l     ON l.pay_month = p.pay_month AND l.pay_year = p.pay_year
  JOIN employee e   ON e.emp_id = p.emp_id
  JOIN department d ON d.dept_id = e.dept_id
 GROUP BY d.dept_name
HAVING AVG(p.net_salary) > (SELECT AVG(p2.net_salary)
                              FROM payroll p2
                              JOIN latest l2 ON l2.pay_month = p2.pay_month AND l2.pay_year = p2.pay_year)
 ORDER BY avg_net_salary DESC`,
  },
  {
    id: 15,
    view: "q15_tenure_and_age",
    title: "Age and tenure of every active employee (derived attributes)",
    concepts: ["Date functions AGE() / EXTRACT", "Derived attributes"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.dob))::INT AS age,
       e.date_of_joining,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_of_joining))::INT AS years_of_service
  FROM employee e
 WHERE e.status = 'Active'
 ORDER BY years_of_service DESC, e.emp_id`,
  },
  {
    id: 16,
    view: "q16_component_totals",
    title: "Total paid out per salary component in the latest month",
    concepts: ["JOIN", "GROUP BY", "ROLLUP-style totals with UNION ALL"],
    sql: `WITH ${LATEST},
lines AS (
    SELECT c.component_type, c.component_name, pd.amount
      FROM payroll p
      JOIN latest l           ON l.pay_month = p.pay_month AND l.pay_year = p.pay_year
      JOIN payroll_detail pd  ON pd.payroll_id = p.payroll_id
      JOIN salary_component c ON c.component_id = pd.component_id
)
SELECT component_type, component_name, SUM(amount) AS total
  FROM lines
 GROUP BY component_type, component_name
UNION ALL
SELECT component_type, '— TOTAL ' || UPPER(component_type) || 'S', SUM(amount)
  FROM lines
 GROUP BY component_type
 ORDER BY component_type, total`,
  },
  {
    id: 17,
    view: "q17_absent_and_on_leave",
    title: "Employees who were both absent and on approved leave in September",
    concepts: ["INTERSECT (set operation)"],
    sql: `SELECT e.emp_id, e.first_name || ' ' || e.last_name AS employee
  FROM employee e
  JOIN attendance a ON a.emp_id = e.emp_id
 WHERE a.status IN ('Absent', 'Half-Day')
   AND a.att_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'
INTERSECT
SELECT e.emp_id, e.first_name || ' ' || e.last_name
  FROM employee e
  JOIN leave_request lr ON lr.emp_id = e.emp_id
 WHERE lr.status = 'Approved'
   AND lr.start_date <= DATE '2026-09-30' AND lr.end_date >= DATE '2026-09-01'
 ORDER BY emp_id`,
  },
  {
    id: 18,
    view: "q18_leaders",
    title: "Everyone with leadership responsibility: department heads or people managers",
    concepts: ["UNION (set operation)", "IN subquery"],
    sql: `SELECT e.emp_id, e.first_name || ' ' || e.last_name AS employee, 'Department head' AS responsibility
  FROM employee e
 WHERE e.emp_id IN (SELECT head_emp_id FROM department WHERE head_emp_id IS NOT NULL)
UNION
SELECT m.emp_id, m.first_name || ' ' || m.last_name, 'People manager'
  FROM employee m
 WHERE EXISTS (SELECT 1 FROM employee e WHERE e.reports_to = m.emp_id AND e.status = 'Active')
 ORDER BY emp_id, responsibility`,
  },
  {
    id: 19,
    view: "q19_late_arrivals",
    title: "Employees who checked in after 09:35 more than 10 times since August",
    concepts: ["Time comparison", "GROUP BY", "HAVING"],
    sql: `SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       COUNT(*) AS late_days,
       MAX(a.check_in) AS latest_check_in
  FROM attendance a
  JOIN employee e ON e.emp_id = a.emp_id
 WHERE a.check_in > TIME '09:35'
 GROUP BY e.emp_id, e.first_name, e.last_name
HAVING COUNT(*) > 10
 ORDER BY late_days DESC`,
  },
];
