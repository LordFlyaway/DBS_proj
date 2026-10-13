-- =====================================================================
--  Employee Payroll Management System
--  File : 05_queries.sql   (19 queries, each saved as a view)
--  GENERATED from web/src/queries.js by scripts/gen_queries.mjs - edit there.
--  security_invoker = true: a view runs with the permissions of the user
--  who queries it, so Row Level Security still applies through the view.
-- =====================================================================

-- Q1. Employee directory with department, designation and manager
--      Concepts: INNER JOIN, LEFT SELF-JOIN
DROP VIEW IF EXISTS q01_employee_directory;
CREATE VIEW q01_employee_directory WITH (security_invoker = true) AS
SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       d.dept_name,
       g.title AS designation,
       m.first_name || ' ' || m.last_name AS manager,
       e.status
  FROM employee e
  JOIN department  d ON d.dept_id  = e.dept_id
  JOIN designation g ON g.desig_id = e.desig_id
  LEFT JOIN employee m ON m.emp_id = e.reports_to
 ORDER BY e.emp_id;

-- Q2. Head-count and average basic salary of every department (including empty ones)
--      Concepts: LEFT JOIN, GROUP BY, COUNT / AVG
DROP VIEW IF EXISTS q02_department_headcount;
CREATE VIEW q02_department_headcount WITH (security_invoker = true) AS
SELECT d.dept_name,
       d.location,
       COUNT(e.emp_id) AS active_employees,
       ROUND(AVG(g.basic_salary), 2) AS avg_basic_salary
  FROM department d
  LEFT JOIN employee e    ON e.dept_id = d.dept_id AND e.status = 'Active'
  LEFT JOIN designation g ON g.desig_id = e.desig_id
 GROUP BY d.dept_id, d.dept_name, d.location
 ORDER BY active_employees DESC, d.dept_name;

-- Q3. Employees whose basic salary is above the company average
--      Concepts: Scalar subquery, Comparison
DROP VIEW IF EXISTS q03_above_average_basic;
CREATE VIEW q03_above_average_basic WITH (security_invoker = true) AS
SELECT e.emp_id,
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
 ORDER BY g.basic_salary DESC;

-- Q4. Department-wise salary cost for the latest payroll month
--      Concepts: CTE (WITH), JOIN, SUM, GROUP BY
DROP VIEW IF EXISTS q04_department_salary_cost;
CREATE VIEW q04_department_salary_cost WITH (security_invoker = true) AS
WITH latest AS (
    SELECT pay_month, pay_year
      FROM payroll
     ORDER BY pay_year DESC, pay_month DESC
     LIMIT 1
)
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
 ORDER BY total_net DESC;

-- Q5. Top 5 earners by net salary in the latest month (with rank)
--      Concepts: Window function RANK(), ORDER BY, LIMIT
DROP VIEW IF EXISTS q05_top_earners;
CREATE VIEW q05_top_earners WITH (security_invoker = true) AS
WITH latest AS (
    SELECT pay_month, pay_year
      FROM payroll
     ORDER BY pay_year DESC, pay_month DESC
     LIMIT 1
)
SELECT RANK() OVER (ORDER BY p.net_salary DESC) AS rank,
       e.first_name || ' ' || e.last_name AS employee,
       g.title,
       p.net_salary
  FROM payroll p
  JOIN latest l      ON l.pay_month = p.pay_month AND l.pay_year = p.pay_year
  JOIN employee e    ON e.emp_id = p.emp_id
  JOIN designation g ON g.desig_id = e.desig_id
 ORDER BY p.net_salary DESC
 LIMIT 5;

-- Q6. Attendance summary of every employee for September 2026
--      Concepts: Conditional aggregation (FILTER), GROUP BY
DROP VIEW IF EXISTS q06_attendance_summary;
CREATE VIEW q06_attendance_summary WITH (security_invoker = true) AS
SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       COUNT(*) FILTER (WHERE a.status = 'Present')  AS present,
       COUNT(*) FILTER (WHERE a.status = 'Half-Day') AS half_days,
       COUNT(*) FILTER (WHERE a.status = 'Absent')   AS absent,
       COUNT(*) FILTER (WHERE a.status = 'Leave')    AS on_leave
  FROM employee e
  JOIN attendance a ON a.emp_id = e.emp_id
 WHERE a.att_date BETWEEN DATE '2026-09-01' AND DATE '2026-09-30'
 GROUP BY e.emp_id, e.first_name, e.last_name
 ORDER BY absent DESC, half_days DESC, e.emp_id;

-- Q7. Employees who lost pay (LOP) in any month, with the amount lost
--      Concepts: WHERE filter, Arithmetic expression, JOIN
DROP VIEW IF EXISTS q07_loss_of_pay;
CREATE VIEW q07_loss_of_pay WITH (security_invoker = true) AS
SELECT p.pay_month,
       p.pay_year,
       e.first_name || ' ' || e.last_name AS employee,
       p.lop_days,
       ROUND(p.basic_salary / p.working_days * p.lop_days, 2) AS basic_lost
  FROM payroll p
  JOIN employee e ON e.emp_id = p.emp_id
 WHERE p.lop_days > 0
 ORDER BY p.pay_year, p.pay_month, basic_lost DESC;

-- Q8. Remaining 2026 leave balance of every active employee
--      Concepts: User-defined FUNCTION in SELECT
DROP VIEW IF EXISTS q08_leave_balance;
CREATE VIEW q08_leave_balance WITH (security_invoker = true) AS
SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       g.annual_leave_quota AS quota,
       fn_leave_balance(e.emp_id, 2026) AS balance
  FROM employee e
  JOIN designation g ON g.desig_id = e.desig_id
 WHERE e.status = 'Active'
 ORDER BY balance, e.emp_id;

-- Q9. Pending leave requests and the manager who must approve them
--      Concepts: Self-join, Date arithmetic
DROP VIEW IF EXISTS q09_pending_leave;
CREATE VIEW q09_pending_leave WITH (security_invoker = true) AS
SELECT lr.leave_id,
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
 ORDER BY lr.start_date;

-- Q10. Managers with at least 3 direct reports
--      Concepts: Self-join, GROUP BY, HAVING
DROP VIEW IF EXISTS q10_manager_span;
CREATE VIEW q10_manager_span WITH (security_invoker = true) AS
SELECT m.emp_id,
       m.first_name || ' ' || m.last_name AS manager,
       COUNT(e.emp_id) AS direct_reports
  FROM employee m
  JOIN employee e ON e.reports_to = m.emp_id AND e.status = 'Active'
 GROUP BY m.emp_id, m.first_name, m.last_name
HAVING COUNT(e.emp_id) >= 3
 ORDER BY direct_reports DESC;

-- Q11. Itemised payslip lines of every employee for the latest month
--      Concepts: 4-table JOIN, M:N bridge table
DROP VIEW IF EXISTS q11_payslip_lines;
CREATE VIEW q11_payslip_lines WITH (security_invoker = true) AS
WITH latest AS (
    SELECT pay_month, pay_year
      FROM payroll
     ORDER BY pay_year DESC, pay_month DESC
     LIMIT 1
)
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
 ORDER BY e.emp_id, c.component_type, pd.amount DESC;

-- Q12. Active employees who have not taken any approved leave in 2026
--      Concepts: NOT EXISTS (correlated subquery)
DROP VIEW IF EXISTS q12_no_leave_taken;
CREATE VIEW q12_no_leave_taken WITH (security_invoker = true) AS
SELECT e.emp_id,
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
 ORDER BY e.emp_id;

-- Q13. Month-by-month payroll totals and payment status
--      Concepts: GROUP BY multiple columns, SUM, CASE
DROP VIEW IF EXISTS q13_monthly_payroll_totals;
CREATE VIEW q13_monthly_payroll_totals WITH (security_invoker = true) AS
SELECT pay_year,
       pay_month,
       COUNT(*) AS payslips,
       SUM(gross_salary) AS total_gross,
       SUM(net_salary)   AS total_net,
       CASE WHEN BOOL_AND(status = 'Paid') THEN 'All paid'
            ELSE COUNT(*) FILTER (WHERE status <> 'Paid') || ' unpaid' END AS payment_status
  FROM payroll
 GROUP BY pay_year, pay_month
 ORDER BY pay_year, pay_month;

-- Q14. Departments whose average net salary is above the company average (latest month)
--      Concepts: HAVING with subquery, AVG
DROP VIEW IF EXISTS q14_departments_above_avg_net;
CREATE VIEW q14_departments_above_avg_net WITH (security_invoker = true) AS
WITH latest AS (
    SELECT pay_month, pay_year
      FROM payroll
     ORDER BY pay_year DESC, pay_month DESC
     LIMIT 1
)
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
 ORDER BY avg_net_salary DESC;

-- Q15. Age and tenure of every active employee (derived attributes)
--      Concepts: Date functions AGE() / EXTRACT, Derived attributes
DROP VIEW IF EXISTS q15_tenure_and_age;
CREATE VIEW q15_tenure_and_age WITH (security_invoker = true) AS
SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.dob))::INT AS age,
       e.date_of_joining,
       EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.date_of_joining))::INT AS years_of_service
  FROM employee e
 WHERE e.status = 'Active'
 ORDER BY years_of_service DESC, e.emp_id;

-- Q16. Total paid out per salary component in the latest month
--      Concepts: JOIN, GROUP BY, ROLLUP-style totals with UNION ALL
DROP VIEW IF EXISTS q16_component_totals;
CREATE VIEW q16_component_totals WITH (security_invoker = true) AS
WITH latest AS (
    SELECT pay_month, pay_year
      FROM payroll
     ORDER BY pay_year DESC, pay_month DESC
     LIMIT 1
),
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
 ORDER BY component_type, total;

-- Q17. Employees who were both absent and on approved leave in September
--      Concepts: INTERSECT (set operation)
DROP VIEW IF EXISTS q17_absent_and_on_leave;
CREATE VIEW q17_absent_and_on_leave WITH (security_invoker = true) AS
SELECT e.emp_id, e.first_name || ' ' || e.last_name AS employee
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
 ORDER BY emp_id;

-- Q18. Everyone with leadership responsibility: department heads or people managers
--      Concepts: UNION (set operation), IN subquery
DROP VIEW IF EXISTS q18_leaders;
CREATE VIEW q18_leaders WITH (security_invoker = true) AS
SELECT e.emp_id, e.first_name || ' ' || e.last_name AS employee, 'Department head' AS responsibility
  FROM employee e
 WHERE e.emp_id IN (SELECT head_emp_id FROM department WHERE head_emp_id IS NOT NULL)
UNION
SELECT m.emp_id, m.first_name || ' ' || m.last_name, 'People manager'
  FROM employee m
 WHERE EXISTS (SELECT 1 FROM employee e WHERE e.reports_to = m.emp_id AND e.status = 'Active')
 ORDER BY emp_id, responsibility;

-- Q19. Employees who checked in after 09:35 more than 10 times since August
--      Concepts: Time comparison, GROUP BY, HAVING
DROP VIEW IF EXISTS q19_late_arrivals;
CREATE VIEW q19_late_arrivals WITH (security_invoker = true) AS
SELECT e.emp_id,
       e.first_name || ' ' || e.last_name AS employee,
       COUNT(*) AS late_days,
       MAX(a.check_in) AS latest_check_in
  FROM attendance a
  JOIN employee e ON e.emp_id = a.emp_id
 WHERE a.check_in > TIME '09:35'
 GROUP BY e.emp_id, e.first_name, e.last_name
HAVING COUNT(*) > 10
 ORDER BY late_days DESC;
