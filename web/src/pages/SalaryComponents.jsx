import CrudPage from "../components/CrudPage";
import { Badge } from "../components/ui";
import { money } from "../lib/format";

export default function SalaryComponents() {
  return (
    <CrudPage
      table="salary_component" pk="component_id" orderBy="component_id" title="Salary components"
      subtitle="Allowances and deductions applied by generate_monthly_payroll (fn_component_amount). Only active ones are used."
      canEdit numeric={["value"]}
      columns={[
        { key: "component_id", label: "ID", width: 50 },
        { key: "component_name", label: "Component", render: (r) => <span className="strong">{r.component_name}</span> },
        { key: "component_type", label: "Type", render: (r) => <Badge>{r.component_type}</Badge> },
        { key: "rule", label: "Rule", render: (r) => (r.calc_method === "Percent" ? `${Number(r.value)}% of basic` : `${money(r.value)} fixed`) },
        { key: "is_taxable", label: "Taxable", render: (r) => (r.is_taxable ? "Yes" : "No") },
        { key: "is_active", label: "Active", render: (r) => (r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="grey">Inactive</Badge>) },
      ]}
      fields={[
        { key: "component_name", label: "Name", required: true },
        { key: "component_type", label: "Type", type: "select", required: true,
          options: [{ value: "Allowance", label: "Allowance" }, { value: "Deduction", label: "Deduction" }] },
        { key: "calc_method", label: "Calculation", type: "select", required: true,
          options: [{ value: "Fixed", label: "Fixed amount" }, { value: "Percent", label: "Percent of basic" }] },
        { key: "value", label: "Value", type: "number", required: true, hint: "₹ amount, or % (≤ 100)" },
        { key: "is_taxable", label: "Taxable", type: "bool" },
        { key: "is_active", label: "Active", type: "bool" },
      ]}
    />
  );
}
