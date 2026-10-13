-- =====================================================================
--  Employee Payroll Management System
--  File : 04_seed_data.sql   (sample data for NEXATECH SOLUTIONS PVT. LTD.)
--  Run after 01_schema.sql, 02_functions_procedures.sql, 03_triggers.sql
--  Payroll rows are NOT typed in by hand: they are produced by calling
--  the procedures, exactly as the application does.
-- =====================================================================

-- ---------------------------------------------------------------- 1. departments (10)
INSERT INTO department (dept_name, location, created_on) VALUES
 ('Human Resources',   'Chennai',   '2012-06-01'),
 ('Engineering',       'Bengaluru', '2012-06-01'),
 ('Finance',           'Chennai',   '2012-06-01'),
 ('Sales',             'Mumbai',    '2013-04-15'),
 ('Marketing',         'Mumbai',    '2014-02-10'),
 ('Operations',        'Pune',      '2015-09-01'),
 ('Customer Support',  'Hyderabad', '2016-01-04'),
 ('Quality Assurance', 'Bengaluru', '2017-07-17'),
 ('Legal',             'New Delhi', '2018-03-12'),
 ('Administration',    'Vellore',   '2012-06-01');

-- ---------------------------------------------------------------- 2. designations (13)
INSERT INTO designation (title, pay_grade, basic_salary, annual_leave_quota) VALUES
 ('HR Manager',               'G4',  85000, 24),
 ('Software Engineer',        'G2',  45000, 20),
 ('Senior Software Engineer', 'G3',  65000, 22),
 ('Engineering Manager',      'G4',  95000, 24),
 ('Accountant',               'G2',  40000, 20),
 ('Payroll Officer',          'G3',  52000, 22),
 ('Sales Executive',          'G1',  30000, 18),
 ('Sales Manager',            'G4',  80000, 24),
 ('Marketing Analyst',        'G2',  42000, 20),
 ('Operations Associate',     'G1',  28000, 18),
 ('Director',                 'G5', 150000, 30),
 ('HR Executive',             'G2',  38000, 20),
 ('Legal Counsel',            'G3',  70000, 22);

-- ---------------------------------------------------------------- 3. employees (20)
-- Inserted in hierarchy order so every reports_to refers to an existing,
-- active employee (checked by trigger trg_validate_manager).
INSERT INTO employee (first_name, last_name, email, phone, gender, dob, date_of_joining,
                      pan_no, bank_account_no, ifsc_code, status, dept_id, desig_id, reports_to, app_role) VALUES
 ('Sachin',    'Tendulkar',    'sachin.tendulkar@nexatech.example',   '9840012301', 'M', '1975-04-12', '2012-06-01', 'AAKPN1201K', '501000123401', 'HDFC0001201', 'Active', 10, 11, NULL, 'Admin'),
 ('MF',        'DOOM',         'mf.doom@nexatech.example',            '9840012302', 'M', '1985-09-23', '2015-03-16', 'ABMPR1202L', '501000123402', 'HDFC0001201', 'Active',  1,  1,    1, 'Admin'),
 ('Jeffery',   'Williams',     'jeffery.williams@nexatech.example',   '9840012303', 'M', '1988-01-30', '2016-07-11', 'ACKPS1203M', '30211456783',  'SBIN0000456', 'Active',  3,  6,    1, 'Payroll'),
 ('Aubrey',    'Graham',       'aubrey.graham@nexatech.example',      '9840012304', 'M', '1984-11-05', '2014-01-20', 'ADMPK1204N', '002101567804', 'ICIC0002345', 'Active',  2,  4,    1, 'Manager'),
 ('Michael',   'Jordan',       'michael.jordan@nexatech.example',     '9840012305', 'M', '1983-03-17', '2013-08-05', 'AEVPS1205P', '916010045605', 'UTIB0000789', 'Active',  4,  8,    1, 'Manager'),
 ('LeBron',    'James',        'lebron.james@nexatech.example',       '9840012306', 'M', '1996-07-14', '2019-07-01', 'AFAPI1206Q', '501000123406', 'HDFC0001201', 'Active',  2,  3,    4, 'Employee'),
 ('Cristiano', 'Ronaldo',      'cristiano.ronaldo@nexatech.example',  '9840012307', 'M', '1998-02-28', '2021-08-02', 'AGRPV1207R', '30211456787',  'SBIN0000456', 'Active',  2,  2,    4, 'Employee'),
 ('Serena',    'Williams',     'serena.williams@nexatech.example',    '9840012308', 'F', '1999-10-09', '2022-01-10', 'AHSPP1208S', '002101567808', 'ICIC0002345', 'Active',  2,  2,    4, 'Employee'),
 ('Lionel',    'Messi',        'lionel.messi@nexatech.example',       '9840012309', 'M', '1997-05-21', '2020-11-16', 'AIAPR1209T', '916010045609', 'UTIB0000789', 'Active',  8,  2,    4, 'Employee'),
 ('Simone',    'Biles',        'simone.biles@nexatech.example',       '9840012310', 'F', '1995-12-02', '2019-04-08', 'AJFPS1210U', '501000123410', 'HDFC0001201', 'Active',  3,  5,    3, 'Employee'),
 ('Rafael',    'Nadal',        'rafael.nadal@nexatech.example',       '9840012311', 'M', '1994-08-19', '2018-09-03', 'AKRPK1211V', '30211456791',  'SBIN0000456', 'Active',  3,  5,    3, 'Employee'),
 ('PV',        'Sindhu',       'pv.sindhu@nexatech.example',          '9840012312', 'F', '2000-06-25', '2023-02-01', 'ALDPM1212W', '002101567812', 'ICIC0002345', 'Active',  4,  7,    5, 'Employee'),
 ('Virat',     'Kohli',        'virat.kohli@nexatech.example',        '9840012313', 'M', '1999-01-13', '2022-06-15', 'AMSPK1213X', '916010045613', 'UTIB0000789', 'Active',  4,  7,    5, 'Employee'),
 ('Naomi',     'Osaka',        'naomi.osaka@nexatech.example',        '9840012314', 'F', '1993-04-04', '2017-10-23', 'ANLPN1214Y', '501000123414', 'HDFC0001201', 'Active',  5,  9,    5, 'Employee'),
 ('Usain',     'Bolt',         'usain.bolt@nexatech.example',         '9840012315', 'M', '2001-09-30', '2024-01-08', 'AOHPG1215Z', '30211456795',  'SBIN0000456', 'Active',  6, 10,    1, 'Employee'),
 ('Sania',     'Mirza',        'sania.mirza@nexatech.example',        '9840012316', 'F', '1997-11-11', '2021-03-22', 'APNPJ1216A', '002101567816', 'ICIC0002345', 'Active',  7, 10,    1, 'Employee'),
 ('Novak',     'Djokovic',     'novak.djokovic@nexatech.example',     '9840012317', 'M', '1992-07-07', '2017-05-29', 'AQAPP1217B', '916010045617', 'UTIB0000789', 'Active',  1, 12,    2, 'Employee'),
 ('Mary',      'Kom',          'mary.kom@nexatech.example',           '9840012318', 'F', '1996-03-15', '2020-02-17', 'ARPPD1218C', '501000123418', 'HDFC0001201', 'Active',  9, 13,    1, 'Employee'),
 ('Zlatan',    'Ibrahimovic',  'zlatan.ibrahimovic@nexatech.example', '9840012319', 'M', '1990-12-20', '2016-12-05', 'ASMPR1219D', '30211456799',  'SBIN0000456', 'Active',  2,  3,    4, 'Employee'),
 ('Coco',      'Gauff',        'coco.gauff@nexatech.example',         '9840012320', 'F', '2002-05-05', '2025-07-14', 'ATKPB1220E', '002101567820', 'ICIC0002345', 'Active',  2,  2,    4, 'Employee');

-- department heads (1:1 HEADS relationship)
UPDATE department SET head_emp_id = 2  WHERE dept_name = 'Human Resources';
UPDATE department SET head_emp_id = 4  WHERE dept_name = 'Engineering';
UPDATE department SET head_emp_id = 3  WHERE dept_name = 'Finance';
UPDATE department SET head_emp_id = 5  WHERE dept_name = 'Sales';
UPDATE department SET head_emp_id = 14 WHERE dept_name = 'Marketing';
UPDATE department SET head_emp_id = 1  WHERE dept_name = 'Administration';

-- ---------------------------------------------------------------- 4. salary components (12)
INSERT INTO salary_component (component_name, component_type, calc_method, value, is_taxable, is_active) VALUES
 ('House Rent Allowance (HRA)',  'Allowance', 'Percent', 40.00, TRUE,  TRUE),
 ('Dearness Allowance (DA)',     'Allowance', 'Percent', 12.00, TRUE,  TRUE),
 ('Special Allowance',           'Allowance', 'Percent', 10.00, TRUE,  TRUE),
 ('Conveyance Allowance',        'Allowance', 'Fixed',  1600.00, FALSE, TRUE),
 ('Medical Allowance',           'Allowance', 'Fixed',  1250.00, FALSE, TRUE),
 ('Internet Allowance',          'Allowance', 'Fixed',  1000.00, FALSE, TRUE),
 ('Night Shift Allowance',       'Allowance', 'Fixed',  2000.00, TRUE,  FALSE),
 ('Provident Fund (PF)',         'Deduction', 'Percent', 12.00, FALSE, TRUE),
 ('Professional Tax',            'Deduction', 'Fixed',   200.00, FALSE, TRUE),
 ('Income Tax (TDS)',            'Deduction', 'Percent',  5.00, FALSE, TRUE),
 ('Group Health Insurance',      'Deduction', 'Fixed',   500.00, FALSE, TRUE),
 ('Labour Welfare Fund',         'Deduction', 'Fixed',    25.00, FALSE, FALSE);

-- ---------------------------------------------------------------- 5. attendance
-- Every weekday from 1 Aug to 9 Oct 2026 for each employee (Zlatan Ibrahimovic
-- only until 31 Aug, his last working day). A fixed arithmetic pattern
-- gives a realistic, repeatable mix of late check-ins, absences and
-- half days.
INSERT INTO attendance (emp_id, att_date, check_in, check_out, status)
SELECT e.emp_id,
       d::DATE,
       CASE WHEN s.status = 'Absent' THEN NULL
            ELSE TIME '09:00' + make_interval(mins => (e.emp_id * 7 + EXTRACT(DOY FROM d)::INT) % 45) END,
       CASE WHEN s.status = 'Absent'   THEN NULL
            WHEN s.status = 'Half-Day' THEN TIME '13:30' + make_interval(mins => (e.emp_id * 7 + EXTRACT(DOY FROM d)::INT) % 45)
            ELSE TIME '18:00' + make_interval(mins => (e.emp_id * 11 + EXTRACT(DOY FROM d)::INT) % 50) END,
       s.status
  FROM employee e
 CROSS JOIN generate_series(DATE '2026-08-01', DATE '2026-10-09', INTERVAL '1 day') AS d
 CROSS JOIN LATERAL (
        SELECT CASE WHEN (e.emp_id * 31 + EXTRACT(DOY FROM d)::INT) % 37 = 0 THEN 'Absent'
                    WHEN (e.emp_id * 13 + EXTRACT(DOY FROM d)::INT) % 41 = 0 THEN 'Half-Day'
                    ELSE 'Present' END AS status) s
 WHERE EXTRACT(ISODOW FROM d) < 6
   AND d >= e.date_of_joining
   AND (e.emp_id <> 19 OR d <= DATE '2026-08-31');

-- ---------------------------------------------------------------- 6. leave requests (13)
INSERT INTO leave_request (emp_id, leave_type, start_date, end_date, reason, applied_on) VALUES
 ( 6, 'Casual', '2026-08-10', '2026-08-11', 'Family function in Kochi',          '2026-08-03'),
 ( 7, 'Sick',   '2026-08-19', '2026-08-20', 'Viral fever',                       '2026-08-19'),
 (12, 'Earned', '2026-08-24', '2026-08-28', 'Vacation with family',              '2026-08-05'),
 (13, 'Unpaid', '2026-09-07', '2026-09-09', 'Personal work in home town',        '2026-08-31'),
 ( 8, 'Casual', '2026-09-14', '2026-09-14', 'Bank and documentation work',       '2026-09-10'),
 (10, 'Sick',   '2026-09-21', '2026-09-23', 'Minor medical procedure',           '2026-09-18'),
 (14, 'Earned', '2026-09-28', '2026-09-30', 'Travel for sister''s wedding',      '2026-09-12'),
 (16, 'Unpaid', '2026-09-16', '2026-09-17', 'Extended personal trip',            '2026-09-08'),
 ( 9, 'Casual', '2026-10-05', '2026-10-06', 'Moving to a new apartment',         '2026-09-29'),
 (20, 'Sick',   '2026-10-15', '2026-10-16', 'Dental surgery',                    '2026-10-09'),
 (11, 'Earned', '2026-10-26', '2026-10-30', 'Diwali at home',                    '2026-10-07'),
 (17, 'Casual', '2026-10-19', '2026-10-19', 'House shifting',                    '2026-10-08'),
 ( 6, 'Earned', '2026-11-09', '2026-11-13', 'Year-end vacation',                 '2026-10-09');

-- Decisions go through the procedure (validates manager + leave balance);
-- trigger trg_leave_approved then writes 'Leave' rows into attendance.
CALL process_leave( 1, 4, 'Approved');
CALL process_leave( 2, 4, 'Approved');
CALL process_leave( 3, 5, 'Approved');
CALL process_leave( 4, 5, 'Approved');
CALL process_leave( 5, 4, 'Rejected');
CALL process_leave( 6, 3, 'Approved');
CALL process_leave( 7, 5, 'Approved');
CALL process_leave( 8, 1, 'Approved');
CALL process_leave( 9, 4, 'Approved');
-- requests 10-13 stay 'Pending' for the live demo

-- ---------------------------------------------------------------- 7. payroll (procedures + cursor)
CALL generate_monthly_payroll(8, 2026);      -- August: all 20 employees
CALL pay_monthly_payroll(8, 2026, 'NEFT');   -- August salaries paid

-- Zlatan Ibrahimovic resigns at the end of August (fires trg_employee_exit)
UPDATE employee SET status = 'Resigned' WHERE emp_id = 19;

CALL generate_monthly_payroll(9, 2026);      -- September: 19 active employees, left 'Generated'
