# Review I – Viva Prep (Employee Payroll Management System)

## 30-second pitch
A cloud PostgreSQL (Supabase) database with a web admin panel that automates monthly payroll.
It has 7 entities and 8 tables in 3NF. Business rules are enforced inside the database through constraints now and triggers later.
One procedure call generates the whole month's payroll. It loops through employees with a cursor and works out loss-of-pay, allowances, deductions, and gross and net pay.

## Likely questions

**Why 8 tables when you have 7 entities?**
INCLUDES is an M:N relationship between PAYROLL and SALARY_COMPONENT, so it becomes its own table, `payroll_detail(payroll_id, component_id, amount)`. Its primary key is the composite of both foreign keys. `amount` is a relationship attribute.

**Why store gross/net salary if they're derived?**
They are a monthly snapshot. If HRA changes from 40% to 45% next year, last year's payslips must not change, and payroll records are legal and financial history. `age`, `hours_worked` and `no_of_days` are not stored because they can always be recomputed.

**Where did you put the FK for the 1:1 HEADS relationship and why?**
It is `department.head_emp_id` with a UNIQUE constraint. On the department side the column is nearly always filled. On the employee side it would be NULL for almost every employee.

**How do you represent the manager hierarchy?**
`employee.reports_to` is a recursive (self-referencing) FK to `employee.emp_id`. A CHECK stops an employee from being their own manager.

**What does total participation mean in your diagram?**
Every employee must be in a department and have a designation (double lines), so `dept_id` and `desig_id` are NOT NULL. Every attendance, leave and payroll row must belong to an employee.

**Why ON DELETE RESTRICT on payroll.emp_id but CASCADE on attendance?**
Salary history must never be deleted, so an employee who leaves is marked `Resigned` instead of being deleted. Attendance and leave rows mean nothing without their employee.

**How is loss-of-pay calculated?**
LOP days are the days marked Absent, plus half of the Half-Day days, plus approved Unpaid leave. LOP amount = basic ÷ working_days × lop_days.

**Is it in 3NF?**
Yes. Department and designation details are not repeated in employee. Component rules are separate from payslip lines. payroll_detail has no partial dependency because amount depends on both key parts. There are no transitive dependencies, which is why age is not stored.

**Why Supabase/PostgreSQL instead of Oracle?**
It is a free cloud-hosted database, so the web panel can connect from anywhere. PL/pgSQL supports procedures, functions, cursors and triggers just like PL/SQL. The syntax differs slightly: for example `CREATE OR REPLACE FUNCTION ... LANGUAGE plpgsql`, and triggers call a trigger function.

**Which constraints use CHECK?**
- PAN format `^[A-Z]{5}[0-9]{4}[A-Z]$`, IFSC format, and a 10-digit phone starting 6–9
- gender, status and leave_type value lists
- end_date ≥ start_date, check_out > check_in
- lop_days ≤ working_days, net_salary ≥ 0
- age at joining ≥ 18
- a payroll marked Paid must have a payment date and mode
