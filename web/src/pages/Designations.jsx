import CrudPage from "../components/CrudPage";
import { money } from "../lib/format";

const GRADES = ["G1", "G2", "G3", "G4", "G5"].map((g) => ({ value: g, label: g }));

export default function Designations() {
  return (
    <CrudPage
      table="designation" pk="desig_id" orderBy="basic_salary" title="Designations"
      subtitle="Job titles with pay grade, monthly basic salary and annual leave quota."
      canEdit numeric={["basic_salary", "annual_leave_quota"]}
      columns={[
        { key: "desig_id", label: "ID", width: 50 },
        { key: "title", label: "Title", render: (r) => <span className="strong">{r.title}</span> },
        { key: "pay_grade", label: "Grade" },
        { key: "basic_salary", label: "Basic salary", align: "right", render: (r) => money(r.basic_salary) },
        { key: "annual_leave_quota", label: "Leave quota", align: "right", render: (r) => `${r.annual_leave_quota} days` },
      ]}
      fields={[
        { key: "title", label: "Title", required: true },
        { key: "pay_grade", label: "Pay grade", type: "select", required: true, options: GRADES },
        { key: "basic_salary", label: "Basic salary (₹ / month)", type: "number", required: true, hint: "Must be > 0" },
        { key: "annual_leave_quota", label: "Annual leave quota", type: "number", default: 24, hint: "0 – 60 days" },
      ]}
    />
  );
}
