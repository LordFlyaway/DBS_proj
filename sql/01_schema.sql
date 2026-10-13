-- =====================================================================
--  Employee Payroll Management System
--  BCSE302L Database Systems - Course Project
--  Target DBMS : PostgreSQL 15+ (hosted on Supabase)
--  File        : 01_schema.sql  (table creation + constraints)
-- =====================================================================

-- Drop in reverse dependency order so the script can be re-run
DROP TABLE IF EXISTS payroll_detail   CASCADE;
DROP TABLE IF EXISTS payroll          CASCADE;
DROP TABLE IF EXISTS salary_component CASCADE;
DROP TABLE IF EXISTS leave_request    CASCADE;
DROP TABLE IF EXISTS attendance       CASCADE;
DROP TABLE IF EXISTS employee         CASCADE;
DROP TABLE IF EXISTS designation      CASCADE;
DROP TABLE IF EXISTS department       CASCADE;

-- ---------------------------------------------------------------------
-- 1. DEPARTMENT : organisational units of the company
-- ---------------------------------------------------------------------
CREATE TABLE department (
    dept_id      SERIAL        PRIMARY KEY,
    dept_name    VARCHAR(50)   NOT NULL UNIQUE,
    location     VARCHAR(50)   NOT NULL,
    head_emp_id  INT,                               -- FK added after EMPLOYEE exists
    created_on   DATE          NOT NULL DEFAULT CURRENT_DATE
);

-- ---------------------------------------------------------------------
-- 2. DESIGNATION : job titles and their basic pay
-- ---------------------------------------------------------------------
CREATE TABLE designation (
    desig_id     SERIAL        PRIMARY KEY,
    title        VARCHAR(50)   NOT NULL UNIQUE,
    pay_grade    CHAR(2)       NOT NULL CHECK (pay_grade IN ('G1','G2','G3','G4','G5')),
    basic_salary NUMERIC(10,2) NOT NULL CHECK (basic_salary > 0),
    annual_leave_quota INT     NOT NULL DEFAULT 24 CHECK (annual_leave_quota BETWEEN 0 AND 60)
);

-- ---------------------------------------------------------------------
-- 3. EMPLOYEE : core entity; reports_to is a recursive (self) FK
-- ---------------------------------------------------------------------
CREATE TABLE employee (
    emp_id          SERIAL        PRIMARY KEY,
    first_name      VARCHAR(30)   NOT NULL,
    last_name       VARCHAR(30)   NOT NULL,
    email           VARCHAR(100)  NOT NULL UNIQUE CHECK (email LIKE '%_@_%._%'),
    phone           CHAR(10)      NOT NULL UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),
    gender          CHAR(1)       NOT NULL CHECK (gender IN ('M','F','O')),
    dob             DATE          NOT NULL,
    date_of_joining DATE          NOT NULL DEFAULT CURRENT_DATE,
    pan_no          CHAR(10)      NOT NULL UNIQUE CHECK (pan_no ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
    bank_account_no VARCHAR(18)   NOT NULL UNIQUE,
    ifsc_code       CHAR(11)      NOT NULL CHECK (ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
    status          VARCHAR(10)   NOT NULL DEFAULT 'Active'
                                  CHECK (status IN ('Active','On Leave','Resigned','Terminated')),
    dept_id         INT           NOT NULL REFERENCES department(dept_id),
    desig_id        INT           NOT NULL REFERENCES designation(desig_id),
    reports_to      INT           REFERENCES employee(emp_id) ON DELETE SET NULL,
    app_role        VARCHAR(10)   NOT NULL DEFAULT 'Employee'
                                  CHECK (app_role IN ('Admin','Payroll','Manager','Employee')),
    auth_user_id    UUID          UNIQUE,              -- login account (Supabase auth.users.id)
    CONSTRAINT chk_emp_age     CHECK (date_of_joining >= dob + INTERVAL '18 years'),
    CONSTRAINT chk_not_own_mgr  CHECK (reports_to IS NULL OR reports_to <> emp_id)
);

-- Department head is an employee (1:1 "heads" relationship)
ALTER TABLE department
    ADD CONSTRAINT fk_dept_head
    FOREIGN KEY (head_emp_id) REFERENCES employee(emp_id) ON DELETE SET NULL;
ALTER TABLE department
    ADD CONSTRAINT uq_dept_head UNIQUE (head_emp_id);

-- ---------------------------------------------------------------------
-- 4. ATTENDANCE : one row per employee per working day
-- ---------------------------------------------------------------------
CREATE TABLE attendance (
    attendance_id SERIAL       PRIMARY KEY,
    emp_id        INT          NOT NULL REFERENCES employee(emp_id) ON DELETE CASCADE,
    att_date      DATE         NOT NULL,
    check_in      TIME,
    check_out     TIME,
    status        VARCHAR(8)   NOT NULL DEFAULT 'Present'
                               CHECK (status IN ('Present','Absent','Half-Day','Leave')),
    CONSTRAINT uq_att_emp_day UNIQUE (emp_id, att_date),
    CONSTRAINT chk_att_times  CHECK (check_out IS NULL OR check_in IS NULL OR check_out > check_in)
);

-- ---------------------------------------------------------------------
-- 5. LEAVE_REQUEST : applied by an employee, approved by a manager
-- ---------------------------------------------------------------------
CREATE TABLE leave_request (
    leave_id     SERIAL       PRIMARY KEY,
    emp_id       INT          NOT NULL REFERENCES employee(emp_id) ON DELETE CASCADE,
    leave_type   VARCHAR(10)  NOT NULL CHECK (leave_type IN ('Casual','Sick','Earned','Unpaid')),
    start_date   DATE         NOT NULL,
    end_date     DATE         NOT NULL,
    reason       VARCHAR(200),
    status       VARCHAR(10)  NOT NULL DEFAULT 'Pending'
                              CHECK (status IN ('Pending','Approved','Rejected')),
    applied_on   DATE         NOT NULL DEFAULT CURRENT_DATE,
    approved_by  INT          REFERENCES employee(emp_id) ON DELETE SET NULL,
    CONSTRAINT chk_leave_dates   CHECK (end_date >= start_date),
    CONSTRAINT chk_not_self_appr CHECK (approved_by IS NULL OR approved_by <> emp_id)
);

-- ---------------------------------------------------------------------
-- 6. SALARY_COMPONENT : master list of allowances and deductions
-- ---------------------------------------------------------------------
CREATE TABLE salary_component (
    component_id   SERIAL        PRIMARY KEY,
    component_name VARCHAR(40)   NOT NULL UNIQUE,
    component_type VARCHAR(10)   NOT NULL CHECK (component_type IN ('Allowance','Deduction')),
    calc_method    VARCHAR(10)   NOT NULL CHECK (calc_method IN ('Fixed','Percent')),
    value          NUMERIC(10,2) NOT NULL CHECK (value >= 0),
    is_taxable     BOOLEAN       NOT NULL DEFAULT TRUE,
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_percent_range CHECK (calc_method <> 'Percent' OR value <= 100)
);

-- ---------------------------------------------------------------------
-- 7. PAYROLL : one salary record per employee per month (+ payment info)
-- ---------------------------------------------------------------------
CREATE TABLE payroll (
    payroll_id        SERIAL        PRIMARY KEY,
    emp_id            INT           NOT NULL REFERENCES employee(emp_id),
    pay_month         SMALLINT      NOT NULL CHECK (pay_month BETWEEN 1 AND 12),
    pay_year          SMALLINT      NOT NULL CHECK (pay_year BETWEEN 2000 AND 2100),
    working_days      SMALLINT      NOT NULL CHECK (working_days BETWEEN 0 AND 31),
    lop_days          NUMERIC(4,1)  NOT NULL DEFAULT 0 CHECK (lop_days >= 0),
    basic_salary      NUMERIC(10,2) NOT NULL CHECK (basic_salary >= 0),
    total_allowances  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_allowances >= 0),
    total_deductions  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_deductions >= 0),
    gross_salary      NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_salary        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (net_salary >= 0),
    status            VARCHAR(10)   NOT NULL DEFAULT 'Generated'
                                    CHECK (status IN ('Generated','Paid','On Hold')),
    generated_on      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_date      DATE,
    payment_mode      VARCHAR(10)   CHECK (payment_mode IN ('NEFT','IMPS','Cheque')),
    transaction_ref   VARCHAR(30)   UNIQUE,
    CONSTRAINT uq_payroll_emp_month UNIQUE (emp_id, pay_month, pay_year),
    CONSTRAINT chk_lop_le_days      CHECK (lop_days <= working_days),
    CONSTRAINT chk_paid_has_date    CHECK (status <> 'Paid' OR (payment_date IS NOT NULL AND payment_mode IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- 8. PAYROLL_DETAIL : M:N between PAYROLL and SALARY_COMPONENT
--    (line items of a payslip)
-- ---------------------------------------------------------------------
CREATE TABLE payroll_detail (
    payroll_id   INT           NOT NULL REFERENCES payroll(payroll_id) ON DELETE CASCADE,
    component_id INT           NOT NULL REFERENCES salary_component(component_id),
    amount       NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    PRIMARY KEY (payroll_id, component_id)
);

-- Helpful indexes on foreign keys used in joins
CREATE INDEX idx_emp_dept      ON employee(dept_id);
CREATE INDEX idx_emp_desig     ON employee(desig_id);
CREATE INDEX idx_att_emp_date  ON attendance(emp_id, att_date);
CREATE INDEX idx_leave_emp     ON leave_request(emp_id);
CREATE INDEX idx_payroll_month ON payroll(pay_year, pay_month);
