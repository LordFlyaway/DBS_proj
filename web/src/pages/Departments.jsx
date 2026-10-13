import CrudPage from "../components/CrudPage";
import { supabase } from "../lib/supabase";
import { date, fullName } from "../lib/format";

const loadEmployees = async () => {
  const { data } = await supabase.from("employee").select("emp_id, first_name, last_name, status").order("first_name");
  return data || [];
};

export default function Departments() {
  return (
    <CrudPage
      table="department" pk="dept_id" orderBy="dept_name" title="Departments"
      subtitle="Department head is the 1:1 HEADS relationship (UNIQUE foreign key)."
      canEdit numeric={["head_emp_id"]} extraLoad={loadEmployees}
      columns={(emps = []) => {
        const byId = Object.fromEntries(emps.map((e) => [e.emp_id, e]));
        return [
          { key: "dept_id", label: "ID", width: 50 },
          { key: "dept_name", label: "Department", render: (r) => <span className="strong">{r.dept_name}</span> },
          { key: "location", label: "Location" },
          { key: "head", label: "Head", render: (r) => (r.head_emp_id ? fullName(byId[r.head_emp_id]) : "—") },
          { key: "created_on", label: "Created", render: (r) => date(r.created_on) },
        ];
      }}
      fields={(emps = []) => [
        { key: "dept_name", label: "Name", required: true },
        { key: "location", label: "Location", required: true },
        { key: "head_emp_id", label: "Department head", type: "select",
          options: emps.filter((e) => e.status === "Active").map((e) => ({ value: e.emp_id, label: fullName(e) })) },
        { key: "created_on", label: "Created on", type: "date", default: new Date().toISOString().slice(0, 10) },
      ]}
    />
  );
}
