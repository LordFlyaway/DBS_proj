-- =====================================================================
--  Employee Payroll Management System
--  File : 06_supabase_auth_rls.sql   (Supabase only - needs auth schema)
--    * links Supabase Auth users to EMPLOYEE rows (by e-mail)
--    * role helper functions
--    * Row Level Security policies per role (Admin, Payroll, Manager, Employee)
--    * api_* functions: the web app calls procedures through these
--      (PostgREST can call FUNCTIONS over HTTP, not PROCEDURES)
-- =====================================================================

-- ---------------------------------------------------------------- auth link
ALTER TABLE employee DROP CONSTRAINT IF EXISTS fk_emp_auth_user;
ALTER TABLE employee
    ADD CONSTRAINT fk_emp_auth_user
    FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- A new login account is attached to the employee with the same e-mail.
CREATE OR REPLACE FUNCTION public.trgfn_link_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    UPDATE public.employee
       SET auth_user_id = NEW.id
     WHERE lower(email) = lower(NEW.email)
       AND auth_user_id IS NULL;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_auth_user ON auth.users;
CREATE TRIGGER trg_link_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.trgfn_link_auth_user();

-- ---------------------------------------------------------------- role helpers
-- SECURITY DEFINER so they can read EMPLOYEE without triggering RLS
-- recursion inside the policies below.
CREATE OR REPLACE FUNCTION public.app_emp_id()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT emp_id FROM employee WHERE auth_user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT app_role FROM employee WHERE auth_user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.app_is_staff()      -- Admin or Payroll officer
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(app_user_role() IN ('Admin', 'Payroll'), FALSE) $$;

CREATE OR REPLACE FUNCTION public.app_can_see_emp(p_emp_id INT)  -- self, own manager, or own team
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM employee e
         WHERE e.emp_id = p_emp_id
           AND (e.emp_id = app_emp_id()
                OR e.reports_to = app_emp_id()
                OR e.emp_id = (SELECT reports_to FROM employee WHERE emp_id = app_emp_id())))
$$;

CREATE OR REPLACE FUNCTION public.app_manages(p_emp_id INT)      -- caller is p_emp_id's manager
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM employee WHERE emp_id = p_emp_id AND reports_to = app_emp_id()) $$;

-- ---------------------------------------------------------------- privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, public;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA public FROM anon, authenticated, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ---------------------------------------------------------------- RLS
ALTER TABLE department       ENABLE ROW LEVEL SECURITY;
ALTER TABLE designation      ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_request    ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_component ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_detail   ENABLE ROW LEVEL SECURITY;

-- Reference data: everyone signed in can read; Admin maintains it.
CREATE POLICY dept_read   ON department  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY dept_admin  ON department  FOR ALL    TO authenticated
    USING (app_user_role() = 'Admin') WITH CHECK (app_user_role() = 'Admin');
CREATE POLICY desig_read  ON designation FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY desig_admin ON designation FOR ALL    TO authenticated
    USING (app_user_role() = 'Admin') WITH CHECK (app_user_role() = 'Admin');
CREATE POLICY comp_read   ON salary_component FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY comp_staff  ON salary_component FOR ALL    TO authenticated
    USING (app_is_staff()) WITH CHECK (app_is_staff());

-- Employees: staff see everyone; others see themselves, their manager and their team.
CREATE POLICY emp_read  ON employee FOR SELECT TO authenticated
    USING (app_is_staff() OR app_can_see_emp(emp_id));
CREATE POLICY emp_admin ON employee FOR ALL TO authenticated
    USING (app_user_role() = 'Admin') WITH CHECK (app_user_role() = 'Admin');

-- Attendance: staff see all, managers their team, employees themselves.
-- Admin edits anything; an employee may check in / out for TODAY only.
CREATE POLICY att_read  ON attendance FOR SELECT TO authenticated
    USING (app_is_staff() OR emp_id = app_emp_id() OR app_manages(emp_id));
CREATE POLICY att_admin ON attendance FOR ALL TO authenticated
    USING (app_user_role() = 'Admin') WITH CHECK (app_user_role() = 'Admin');
CREATE POLICY att_self_checkin  ON attendance FOR INSERT TO authenticated
    WITH CHECK (emp_id = app_emp_id() AND att_date = CURRENT_DATE AND status = 'Present');
CREATE POLICY att_self_checkout ON attendance FOR UPDATE TO authenticated
    USING (emp_id = app_emp_id() AND att_date = CURRENT_DATE)
    WITH CHECK (emp_id = app_emp_id() AND att_date = CURRENT_DATE AND status = 'Present');

-- Leave: employees apply / cancel their own pending requests;
-- approvals go through api_process_leave (procedure process_leave).
CREATE POLICY leave_read ON leave_request FOR SELECT TO authenticated
    USING (app_is_staff() OR emp_id = app_emp_id() OR app_manages(emp_id));
CREATE POLICY leave_apply ON leave_request FOR INSERT TO authenticated
    WITH CHECK (emp_id = app_emp_id() AND status = 'Pending' AND approved_by IS NULL);
CREATE POLICY leave_cancel ON leave_request FOR DELETE TO authenticated
    USING (emp_id = app_emp_id() AND status = 'Pending');
CREATE POLICY leave_admin ON leave_request FOR ALL TO authenticated
    USING (app_user_role() = 'Admin') WITH CHECK (app_user_role() = 'Admin');

-- Payroll: staff see all and may delete a not-yet-paid payroll (trigger
-- protects paid ones); employees see only their own payslips.
-- Rows are created/paid only by the procedures via api_* functions.
CREATE POLICY pay_read ON payroll FOR SELECT TO authenticated
    USING (app_is_staff() OR emp_id = app_emp_id());
CREATE POLICY pay_staff_delete ON payroll FOR DELETE TO authenticated
    USING (app_is_staff());
CREATE POLICY paydet_read ON payroll_detail FOR SELECT TO authenticated
    USING (app_is_staff()
           OR EXISTS (SELECT 1 FROM payroll p
                       WHERE p.payroll_id = payroll_detail.payroll_id
                         AND p.emp_id = app_emp_id()));

-- ---------------------------------------------------------------- API (RPC) functions
CREATE OR REPLACE FUNCTION public.api_generate_payroll(p_month INT, p_year INT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
    IF NOT app_is_staff() THEN
        RAISE EXCEPTION 'Only Admin or Payroll staff can generate payroll';
    END IF;
    CALL generate_monthly_payroll(p_month, p_year, v_count);
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_pay_payroll(p_month INT, p_year INT, p_mode TEXT DEFAULT 'NEFT')
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count INT := 0;
BEGIN
    IF NOT app_is_staff() THEN
        RAISE EXCEPTION 'Only Admin or Payroll staff can pay salaries';
    END IF;
    CALL pay_monthly_payroll(p_month, p_year, p_mode, v_count);
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.api_process_leave(p_leave_id INT, p_decision TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    IF app_emp_id() IS NULL THEN
        RAISE EXCEPTION 'Your login is not linked to an employee record';
    END IF;
    CALL process_leave(p_leave_id, app_emp_id(), p_decision);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.api_generate_payroll(INT, INT)    FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.api_pay_payroll(INT, INT, TEXT)  FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.api_process_leave(INT, TEXT)     FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.api_generate_payroll(INT, INT)    TO authenticated;
GRANT  EXECUTE ON FUNCTION public.api_pay_payroll(INT, INT, TEXT)  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.api_process_leave(INT, TEXT)     TO authenticated;
