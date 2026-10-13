-- =====================================================================
--  Employee Payroll Management System
--  File : 03_triggers.sql      4 TRIGGERS (PL/pgSQL)
-- =====================================================================

-- ---------------------------------------------------------------------
-- TRIGGER 1: trg_leave_approved   (AFTER UPDATE ON leave_request)
--   When a leave request becomes 'Approved', every weekday in the leave
--   range is written to ATTENDANCE with status 'Leave'. Existing rows for
--   those days are overwritten (UPSERT on the (emp_id, att_date) key).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trgfn_leave_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'Approved' AND OLD.status IS DISTINCT FROM 'Approved' THEN
        INSERT INTO attendance (emp_id, att_date, check_in, check_out, status)
        SELECT NEW.emp_id, d::DATE, NULL, NULL, 'Leave'
          FROM generate_series(NEW.start_date, NEW.end_date, INTERVAL '1 day') AS d
         WHERE EXTRACT(ISODOW FROM d) < 6
        ON CONFLICT (emp_id, att_date)
        DO UPDATE SET status = 'Leave', check_in = NULL, check_out = NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_approved ON leave_request;
CREATE TRIGGER trg_leave_approved
AFTER UPDATE OF status ON leave_request
FOR EACH ROW
EXECUTE FUNCTION trgfn_leave_approved();

-- ---------------------------------------------------------------------
-- TRIGGER 2: trg_lock_paid_payroll   (BEFORE UPDATE OR DELETE ON payroll)
--   A payroll that has been Paid is a financial record: it can no longer
--   be changed or deleted.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trgfn_lock_paid_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'Paid' THEN
        RAISE EXCEPTION 'Payroll % (employee %, %/%) is already Paid and cannot be %',
            OLD.payroll_id, OLD.emp_id, OLD.pay_month, OLD.pay_year,
            CASE TG_OP WHEN 'DELETE' THEN 'deleted' ELSE 'modified' END;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_paid_payroll ON payroll;
CREATE TRIGGER trg_lock_paid_payroll
BEFORE UPDATE OR DELETE ON payroll
FOR EACH ROW
EXECUTE FUNCTION trgfn_lock_paid_payroll();

-- ---------------------------------------------------------------------
-- TRIGGER 3: trg_validate_manager   (BEFORE INSERT OR UPDATE ON employee)
--   The reporting manager must exist, be Active, and must not report to
--   this employee (no two-person cycles).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trgfn_validate_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_status   employee.status%TYPE;
    v_mgr_mgr  employee.reports_to%TYPE;
BEGIN
    IF NEW.reports_to IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT status, reports_to INTO v_status, v_mgr_mgr
      FROM employee WHERE emp_id = NEW.reports_to;

    IF v_status IS DISTINCT FROM 'Active' THEN
        RAISE EXCEPTION 'Manager % is not an active employee', NEW.reports_to;
    END IF;
    IF v_mgr_mgr = NEW.emp_id THEN
        RAISE EXCEPTION 'Circular reporting: employee % already reports to %', NEW.reports_to, NEW.emp_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_manager ON employee;
CREATE TRIGGER trg_validate_manager
BEFORE INSERT OR UPDATE OF reports_to ON employee
FOR EACH ROW
EXECUTE FUNCTION trgfn_validate_manager();

-- ---------------------------------------------------------------------
-- TRIGGER 4: trg_employee_exit   (AFTER UPDATE OF status ON employee)
--   When an employee Resigns or is Terminated:
--     * their direct reports are moved to the leaving employee's manager
--     * they are removed as head of any department
--     * their pending leave requests are rejected
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trgfn_employee_exit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IN ('Resigned', 'Terminated')
       AND OLD.status NOT IN ('Resigned', 'Terminated') THEN

        UPDATE employee
           SET reports_to = NEW.reports_to
         WHERE reports_to = NEW.emp_id;

        UPDATE department
           SET head_emp_id = NULL
         WHERE head_emp_id = NEW.emp_id;

        UPDATE leave_request
           SET status = 'Rejected'
         WHERE emp_id = NEW.emp_id AND status = 'Pending';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_exit ON employee;
CREATE TRIGGER trg_employee_exit
AFTER UPDATE OF status ON employee
FOR EACH ROW
EXECUTE FUNCTION trgfn_employee_exit();
