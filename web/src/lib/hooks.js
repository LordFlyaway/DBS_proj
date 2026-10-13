import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { run } from "./activity";

/** Loads data with fn(); returns { data, loading, error, reload }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await load();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e.message });
    }
  }, [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload };
}

/** Departments, designations and the employees this user may see (RLS). */
export function useRefData() {
  return useLoad(async () => {
    const [departments, designations, employees] = await Promise.all([
      run({ action: "Load departments", component: "SELECT", sql: "SELECT * FROM department ORDER BY dept_name", tables: ["department"] },
        () => supabase.from("department").select("*").order("dept_name"), null, { silent: true }),
      run({ action: "Load designations", component: "SELECT", sql: "SELECT * FROM designation ORDER BY title", tables: ["designation"] },
        () => supabase.from("designation").select("*").order("title"), null, { silent: true }),
      run({ action: "Load employees", component: "SELECT", sql: "SELECT * FROM employee ORDER BY emp_id", tables: ["employee"] },
        () => supabase.from("employee").select("*").order("emp_id"), null, { silent: true }),
    ]);
    const byId = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
    return {
      departments,
      designations,
      employees,
      dept: byId(departments, "dept_id"),
      desig: byId(designations, "desig_id"),
      emp: byId(employees, "emp_id"),
    };
  }, []);
}
