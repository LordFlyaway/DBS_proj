-- =====================================================================
--  Employee Payroll Management System
--  File : 02_functions_procedures.sql
--  4 FUNCTIONS, 3 PROCEDURES (2 of them use explicit CURSORS)
--  PL/pgSQL (PostgreSQL / Supabase)
-- =====================================================================

-- ---------------------------------------------------------------------
-- FUNCTION 1: fn_working_days(month, year)
--   Number of working days (Monday-Friday) in a month.
--   Used by: generate_monthly_payroll
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_working_days(p_month INT, p_year INT)
RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
    v_first DATE := make_date(p_year, p_month, 1);
    v_last  DATE := (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
BEGIN
    RETURN (SELECT COUNT(*)
              FROM generate_series(v_first, v_last, INTERVAL '1 day') AS d
             WHERE EXTRACT(ISODOW FROM d) < 6);
END;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION 2: fn_component_amount(component_id, basic)
--   Amount of one salary component for a given (earned) basic salary.
--   Fixed components return their value; Percent components return
--   value% of basic.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_component_amount(p_component_id INT, p_basic NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_method salary_component.calc_method%TYPE;
    v_value  salary_component.value%TYPE;
BEGIN
    SELECT calc_method, value INTO v_method, v_value
      FROM salary_component
     WHERE component_id = p_component_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Salary component % does not exist', p_component_id;
    END IF;

    IF v_method = 'Fixed' THEN
        RETURN v_value;
    END IF;
    RETURN ROUND(p_basic * v_value / 100, 2);
END;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION 3: fn_lop_days(emp_id, month, year)
--   Loss-of-pay days = Absent days + 0.5 x Half-Day days
--                    + weekdays covered by APPROVED UNPAID leave.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_lop_days(p_emp_id INT, p_month INT, p_year INT)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_first   DATE := make_date(p_year, p_month, 1);
    v_last    DATE := (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_absent  NUMERIC;
    v_unpaid  NUMERIC;
BEGIN
    SELECT COALESCE(SUM(CASE status WHEN 'Absent' THEN 1
                                    WHEN 'Half-Day' THEN 0.5
                                    ELSE 0 END), 0)
      INTO v_absent
      FROM attendance
     WHERE emp_id = p_emp_id
       AND att_date BETWEEN v_first AND v_last;

    SELECT COUNT(*)
      INTO v_unpaid
      FROM leave_request lr
      CROSS JOIN LATERAL generate_series(GREATEST(lr.start_date, v_first),
                                         LEAST(lr.end_date, v_last),
                                         INTERVAL '1 day') AS d
     WHERE lr.emp_id = p_emp_id
       AND lr.leave_type = 'Unpaid'
       AND lr.status = 'Approved'
       AND EXTRACT(ISODOW FROM d) < 6;

    RETURN v_absent + v_unpaid;
END;
$$;

-- ---------------------------------------------------------------------
-- FUNCTION 4: fn_leave_balance(emp_id, year)
--   Remaining paid leave = designation quota - approved paid leave
--   (Casual/Sick/Earned) weekdays taken in that year.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_leave_balance(p_emp_id INT, p_year INT)
RETURNS INT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_quota INT;
    v_taken INT;
BEGIN
    SELECT d.annual_leave_quota INTO v_quota
      FROM employee e JOIN designation d ON d.desig_id = e.desig_id
     WHERE e.emp_id = p_emp_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee % does not exist', p_emp_id;
    END IF;

    SELECT COUNT(*) INTO v_taken
      FROM leave_request lr
      CROSS JOIN LATERAL generate_series(lr.start_date, lr.end_date, INTERVAL '1 day') AS d
     WHERE lr.emp_id = p_emp_id
       AND lr.status = 'Approved'
       AND lr.leave_type <> 'Unpaid'
       AND EXTRACT(YEAR FROM d) = p_year
       AND EXTRACT(ISODOW FROM d) < 6;

    RETURN v_quota - v_taken;
END;
$$;

-- ---------------------------------------------------------------------
-- PROCEDURE 1: generate_monthly_payroll(month, year, INOUT generated)
--   Uses an explicit CURSOR over all active employees. For each one:
--     LOP days -> earned basic -> every active salary component
--     -> PAYROLL row + PAYROLL_DETAIL line items.
--   Employees who already have a payroll for that month are skipped,
--   so the procedure can safely be run again.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE generate_monthly_payroll(
    p_month INT,
    p_year INT,
    INOUT p_generated INT DEFAULT 0)
LANGUAGE plpgsql
AS $$
DECLARE
    v_month_end   DATE := (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    v_work_days   INT  := fn_working_days(p_month, p_year);

    cur_emp CURSOR FOR
        SELECT e.emp_id, d.basic_salary
          FROM employee e
          JOIN designation d ON d.desig_id = e.desig_id
         WHERE e.status IN ('Active', 'On Leave')
           AND e.date_of_joining <= v_month_end
         ORDER BY e.emp_id;

    rec           RECORD;
    comp          RECORD;
    v_lop         NUMERIC;
    v_earned      NUMERIC;
    v_amount      NUMERIC;
    v_allow       NUMERIC;
    v_deduct      NUMERIC;
    v_payroll_id  INT;
BEGIN
    p_generated := 0;
    OPEN cur_emp;
    LOOP
        FETCH cur_emp INTO rec;
        EXIT WHEN NOT FOUND;

        CONTINUE WHEN EXISTS (SELECT 1 FROM payroll
                               WHERE emp_id = rec.emp_id
                                 AND pay_month = p_month AND pay_year = p_year);

        v_lop    := LEAST(fn_lop_days(rec.emp_id, p_month, p_year), v_work_days);
        v_earned := ROUND(rec.basic_salary - rec.basic_salary / v_work_days * v_lop, 2);
        v_allow  := 0;
        v_deduct := 0;

        INSERT INTO payroll (emp_id, pay_month, pay_year, working_days, lop_days, basic_salary)
        VALUES (rec.emp_id, p_month, p_year, v_work_days, v_lop, rec.basic_salary)
        RETURNING payroll_id INTO v_payroll_id;

        FOR comp IN SELECT component_id, component_type
                      FROM salary_component
                     WHERE is_active
                     ORDER BY component_id
        LOOP
            v_amount := fn_component_amount(comp.component_id, v_earned);
            INSERT INTO payroll_detail (payroll_id, component_id, amount)
            VALUES (v_payroll_id, comp.component_id, v_amount);

            IF comp.component_type = 'Allowance' THEN
                v_allow := v_allow + v_amount;
            ELSE
                v_deduct := v_deduct + v_amount;
            END IF;
        END LOOP;

        UPDATE payroll
           SET total_allowances = v_allow,
               total_deductions = v_deduct,
               gross_salary     = v_earned + v_allow,
               net_salary       = GREATEST(v_earned + v_allow - v_deduct, 0)
         WHERE payroll_id = v_payroll_id;

        p_generated := p_generated + 1;
    END LOOP;
    CLOSE cur_emp;

    RAISE NOTICE 'Payroll % / %: % employee(s) processed', p_month, p_year, p_generated;
END;
$$;

-- ---------------------------------------------------------------------
-- PROCEDURE 2: process_leave(leave_id, approver_id, decision)
--   Approves or rejects a pending leave request.
--   Rules: request must be Pending; approver must be the applicant's
--   manager or an Admin; paid leave cannot exceed the leave balance.
--   On approval, trigger trg_leave_approved updates ATTENDANCE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE process_leave(
    p_leave_id INT,
    p_approver_id INT,
    p_decision VARCHAR)
LANGUAGE plpgsql
AS $$
DECLARE
    v_req        leave_request%ROWTYPE;
    v_manager    INT;
    v_role       employee.app_role%TYPE;
    v_days       INT;
    v_balance    INT;
BEGIN
    IF p_decision NOT IN ('Approved', 'Rejected') THEN
        RAISE EXCEPTION 'Decision must be Approved or Rejected, got %', p_decision;
    END IF;

    SELECT * INTO v_req FROM leave_request WHERE leave_id = p_leave_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Leave request % not found', p_leave_id;
    END IF;
    IF v_req.status <> 'Pending' THEN
        RAISE EXCEPTION 'Leave request % is already %', p_leave_id, v_req.status;
    END IF;

    SELECT reports_to INTO v_manager FROM employee WHERE emp_id = v_req.emp_id;
    SELECT app_role  INTO v_role    FROM employee WHERE emp_id = p_approver_id;
    IF p_approver_id = v_req.emp_id THEN
        RAISE EXCEPTION 'An employee cannot approve their own leave';
    END IF;
    IF v_role IS DISTINCT FROM 'Admin' AND p_approver_id IS DISTINCT FROM v_manager THEN
        RAISE EXCEPTION 'Employee % is not the manager of employee %', p_approver_id, v_req.emp_id;
    END IF;

    IF p_decision = 'Approved' AND v_req.leave_type <> 'Unpaid' THEN
        SELECT COUNT(*) INTO v_days
          FROM generate_series(v_req.start_date, v_req.end_date, INTERVAL '1 day') AS d
         WHERE EXTRACT(ISODOW FROM d) < 6;
        v_balance := fn_leave_balance(v_req.emp_id, EXTRACT(YEAR FROM v_req.start_date)::INT);
        IF v_days > v_balance THEN
            RAISE EXCEPTION 'Insufficient leave balance: requested %, available %', v_days, v_balance;
        END IF;
    END IF;

    UPDATE leave_request
       SET status = p_decision,
           approved_by = p_approver_id
     WHERE leave_id = p_leave_id;
END;
$$;

-- ---------------------------------------------------------------------
-- PROCEDURE 3: pay_monthly_payroll(month, year, mode, INOUT paid)
--   Uses a CURSOR ... FOR UPDATE over all 'Generated' payroll rows of
--   the month, marks each one Paid and assigns a transaction reference.
-- ---------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE pay_monthly_payroll(
    p_month INT,
    p_year INT,
    p_mode VARCHAR DEFAULT 'NEFT',
    INOUT p_paid INT DEFAULT 0)
LANGUAGE plpgsql
AS $$
DECLARE
    cur_pay CURSOR FOR
        SELECT payroll_id, emp_id
          FROM payroll
         WHERE pay_month = p_month AND pay_year = p_year AND status = 'Generated'
         ORDER BY emp_id
           FOR UPDATE;
    rec RECORD;
BEGIN
    p_paid := 0;
    OPEN cur_pay;
    LOOP
        FETCH cur_pay INTO rec;
        EXIT WHEN NOT FOUND;

        UPDATE payroll
           SET status          = 'Paid',
               payment_date    = (make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
               payment_mode    = p_mode,
               transaction_ref = 'TXN' || p_year || LPAD(p_month::TEXT, 2, '0') || LPAD(rec.emp_id::TEXT, 4, '0')
         WHERE CURRENT OF cur_pay;

        p_paid := p_paid + 1;
    END LOOP;
    CLOSE cur_pay;
END;
$$;
