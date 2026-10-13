// Review I presentation – Employee Payroll Management System
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(
  "C:/Users/krish/AppData/Roaming/Claude/local-agent-mode-sessions/skills-plugin/3c3e9824-2f1e-4088-8af7-f087c6c53091/5008a513-a59b-467f-b954-0e7eafac5810/skills/pptx/scripts/apply_theme.js"
);

const THEME = {
  name: "Payroll Ledger",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B2B26", lt1: "FFFFFF", dk2: "16443A", lt2: "EEF4F1",
    accent1: "16443A", accent2: "2F8F6B", accent3: "D9A441", accent4: "8FC4AE",
    accent5: "5B6B66", accent6: "B5473A", hlink: "2F8F6B", folHlink: "5B6B66",
  },
};
const DIAG = path.join(__dirname, "..", "diagrams");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "Employee Payroll Management System – Review I";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.2, w: 11.7, h: 1.6,
      fontSize: 44, bold: true, color: C.background1, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.95, w: 11.7, h: 0.8,
      fontSize: 20, color: C.accent4, valign: "top", align: "left" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.9,
      fontSize: 30, bold: true, color: C.text2, valign: "middle", align: "left" }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent5 },
});

const card = (slide, x, y, w, h, fill) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12,
    fill: { color: fill || C.background2 }, line: { color: fill || C.background2 } });

const circleNum = (slide, x, y, n, fill) => {
  slide.addShape(pres.shapes.OVAL, { x, y, w: 0.55, h: 0.55, fill: { color: fill || C.accent2 }, line: { color: fill || C.accent2 } });
  slide.addText(String(n), { x, y, w: 0.55, h: 0.55, align: "center", valign: "middle", fontSize: 16, bold: true,
    color: C.background1, margin: 0, isTextBox: true });
};

// ------------------------------------------------------------ 1. title
let s = pres.addSlide({ masterName: "TITLE_DARK" });
s.addText("Employee Payroll Management System", { placeholder: "title" });
s.addText("BCSE302L Database Systems  |  Course Project – Review I: Problem Analysis & Database Design", { placeholder: "body" });
s.addText("<Student Name>  ·  <Register Number>          Guide: <Faculty Name>", {
  x: 0.8, y: 6.2, w: 11.7, h: 0.5, fontSize: 16, color: C.background1, isTextBox: true });
s.addNotes("Introduce the project: a cloud-hosted PostgreSQL (Supabase) database with a web admin panel that automates monthly payroll.");

// ------------------------------------------------------------ 2. problem
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Spreadsheet payroll is error-prone and unauditable", { placeholder: "title" });
const problems = [
  ["Manual calculation", "HRA, DA, PF, tax and loss-of-pay are worked out by hand every month."],
  ["Duplicate & inconsistent data", "The same employee or department is typed into many sheets."],
  ["No rule enforcement", "Nothing stops a duplicate payslip, a negative salary or self-approved leave."],
  ["No history or reports", "Hard to answer: what did the Sales department cost last month?"],
];
problems.forEach(([h, d], i) => {
  const x = 0.6 + i * 3.08;
  card(s, x, 1.6, 2.85, 2.9);
  circleNum(s, x + 0.3, 1.9, i + 1, C.accent6);
  s.addText(h, { x: x + 0.3, y: 2.6, w: 2.35, h: 0.7, fontSize: 18, bold: true, color: C.text1, margin: 0, valign: "top", isTextBox: true });
  s.addText(d, { x: x + 0.3, y: 3.3, w: 2.35, h: 1.1, fontSize: 14, color: C.accent5, margin: 0, valign: "top", isTextBox: true });
});
card(s, 0.6, 4.85, 12.1, 1.85, C.text2);
s.addText([
  { text: "Problem statement: ", options: { bold: true, color: C.accent3 } },
  { text: "design a centralised, consistent database that stores employee, attendance, leave and salary-structure data, and computes each employee’s monthly gross and net salary (including loss-of-pay), with business rules enforced by constraints and triggers instead of manual checks.", options: { color: C.background1 } },
], { x: 0.95, y: 4.95, w: 11.4, h: 1.65, fontSize: 17, valign: "middle", margin: 0, isTextBox: true });

// ------------------------------------------------------------ 3. objectives & users
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Objectives and users of the system", { placeholder: "title" });
s.addText("Objectives", { x: 0.6, y: 1.45, w: 5.6, h: 0.5, fontSize: 20, bold: true, color: C.accent2, margin: 0, isTextBox: true });
s.addText([
  { text: "Single source of truth for employees, departments and designations", options: { bullet: true, breakLine: true } },
  { text: "Record attendance and leave; compute loss-of-pay automatically", options: { bullet: true, breakLine: true } },
  { text: "Configurable allowances and deductions (fixed or % of basic)", options: { bullet: true, breakLine: true } },
  { text: "Generate the whole month’s payroll and itemised payslips in one step", options: { bullet: true, breakLine: true } },
  { text: "Enforce integrity with PK/FK, CHECK, UNIQUE, DEFAULT and triggers", options: { bullet: true, breakLine: true } },
  { text: "Web admin panel connected to the database", options: { bullet: true } },
], { x: 0.6, y: 2.0, w: 5.7, h: 4.8, fontSize: 16, color: C.text1, paraSpaceAfter: 10, valign: "top", isTextBox: true });
const users = [
  ["HR Administrator", "Departments, designations, employees, attendance"],
  ["Payroll Officer", "Salary components, monthly payroll run, payments"],
  ["Reporting Manager", "Approves or rejects leave of their team"],
  ["Employee", "Views payslips and attendance; applies for leave"],
];
users.forEach(([h, d], i) => {
  const y = 1.5 + i * 1.33;
  card(s, 6.8, y, 5.9, 1.15);
  circleNum(s, 7.05, y + 0.3, i + 1);
  s.addText(h, { x: 7.85, y: y + 0.12, w: 4.6, h: 0.45, fontSize: 17, bold: true, color: C.text1, margin: 0, isTextBox: true });
  s.addText(d, { x: 7.85, y: y + 0.55, w: 4.6, h: 0.45, fontSize: 14, color: C.accent5, margin: 0, isTextBox: true });
});

// ------------------------------------------------------------ 4. scope + FRs
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Requirements cover the full monthly payroll cycle", { placeholder: "title" });
const steps = [
  ["Org setup", "Departments, designations, pay grades, department head"],
  ["Employees", "Personal, PAN and bank details; manager; status"],
  ["Attendance", "Daily check-in/out; one row per employee per day"],
  ["Leave", "Apply → manager approves → attendance updated"],
  ["Payroll run", "LOP, allowances, deductions, gross and net pay"],
  ["Payment & reports", "Mark paid, payslip, department cost reports"],
];
steps.forEach(([h, d], i) => {
  const x = 0.6 + i * 2.04;
  card(s, x, 1.6, 1.86, 2.75);
  circleNum(s, x + 0.65, 1.8, i + 1);
  s.addText(h, { x: x + 0.12, y: 2.5, w: 1.62, h: 0.5, fontSize: 16, bold: true, align: "center", color: C.text1, margin: 0, isTextBox: true });
  s.addText(d, { x: x + 0.12, y: 3.0, w: 1.62, h: 1.25, fontSize: 13, align: "center", color: C.accent5, margin: 0, valign: "top", isTextBox: true });
});
card(s, 0.6, 4.7, 5.9, 2.1);
s.addText([
  { text: "In scope", options: { bold: true, color: C.accent2, fontSize: 18, breakLine: true } },
  { text: "Employee master data, attendance, leave, salary components, payroll generation, payslips, payment records, management reports.", options: { color: C.text1, fontSize: 14 } },
], { x: 0.85, y: 4.85, w: 5.45, h: 1.85, valign: "top", margin: 0, isTextBox: true });
card(s, 6.8, 4.7, 5.9, 2.1);
s.addText([
  { text: "Out of scope", options: { bold: true, color: C.accent6, fontSize: 18, breakLine: true } },
  { text: "Real bank transfers, full income-tax regime calculation, recruitment, appraisals, biometric hardware. TDS is a simple % deduction.", options: { color: C.text1, fontSize: 14 } },
], { x: 7.05, y: 4.85, w: 5.45, h: 1.85, valign: "top", margin: 0, isTextBox: true });

// ------------------------------------------------------------ 5. entities
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Seven entities hold the payroll data", { placeholder: "title" });
const ents = [
  ["EMPLOYEE", "emp_id", "name (first, last), email, phone, gender, dob, age*, joining date, PAN, bank a/c, IFSC, status"],
  ["DEPARTMENT", "dept_id", "dept_name, location, created_on"],
  ["DESIGNATION", "desig_id", "title, pay_grade, basic_salary, annual_leave_quota"],
  ["ATTENDANCE", "attendance_id", "att_date, check_in, check_out, status, hours_worked*"],
  ["LEAVE_REQUEST", "leave_id", "leave_type, start/end date, no_of_days*, reason, status, applied_on"],
  ["SALARY_COMPONENT", "component_id", "name, type (Allowance/Deduction), calc_method (Fixed/%), value, is_taxable"],
  ["PAYROLL", "payroll_id", "pay period (month, year), working/LOP days, basic, allowances, deductions, gross*, net*, status, payment"],
];
ents.forEach(([name, pk, attrs], i) => {
  const col = i < 4 ? 0 : 1;
  const row = i < 4 ? i : i - 4;
  const x = col === 0 ? 0.6 : 6.8;
  const y = 1.45 + row * 1.32;
  card(s, x, y, 5.9, 1.18);
  s.addText(name, { x: x + 0.25, y: y + 0.1, w: 3.2, h: 0.4, fontSize: 16, bold: true, color: C.text2, margin: 0, isTextBox: true });
  s.addText("PK: " + pk, { x: x + 3.4, y: y + 0.1, w: 2.3, h: 0.4, fontSize: 13, bold: true, color: C.accent2, align: "right", margin: 0, isTextBox: true });
  s.addText(attrs, { x: x + 0.25, y: y + 0.5, w: 5.45, h: 0.62, fontSize: 12.5, color: C.accent5, margin: 0, valign: "top", isTextBox: true });
});
s.addText("* derived attribute", { x: 6.8, y: 5.45, w: 5.9, h: 0.4, fontSize: 12, italic: true, color: C.accent5, margin: 0, isTextBox: true });

// ------------------------------------------------------------ 6. relationships
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Nine relationships, including recursive, 1:1 and M:N", { placeholder: "title" });
const hdr = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: THEME.colors.dk2 } } });
const rels = [
  ["WORKS_IN", "Department – Employee", "1 : N", "Every employee is in one department"],
  ["HEADS", "Employee – Department", "1 : 1", "A department has at most one head"],
  ["HOLDS", "Designation – Employee", "1 : N", "Every employee has one designation"],
  ["REPORTS_TO", "Employee – Employee", "1 : N", "Recursive: manager ↔ subordinates"],
  ["MARKS", "Employee – Attendance", "1 : N", "Daily attendance rows"],
  ["APPLIES", "Employee – Leave_Request", "1 : N", "Employee applies for leave"],
  ["APPROVES", "Employee – Leave_Request", "1 : N", "Manager approves leave"],
  ["RECEIVES", "Employee – Payroll", "1 : N", "One payroll per employee per month"],
  ["INCLUDES", "Payroll – Salary_Component", "M : N", "Payslip line items, attribute: amount"],
];
s.addTable([[hdr("Relationship"), hdr("Entities"), hdr("Cardinality"), hdr("Meaning")],
  ...rels.map((r) => r.map((c, j) => ({ text: c, options: j === 2 ? { bold: true, color: THEME.colors.accent2, align: "center" } : (j === 0 ? { bold: true } : {}) })))],
  { x: 0.6, y: 1.4, w: 12.1, colW: [2.2, 3.4, 1.6, 4.9], fontSize: 14, fontFace: "Calibri", color: THEME.colors.dk1,
    border: { type: "solid", pt: 0.75, color: "C9D6D0" }, rowH: 0.5, valign: "middle",
    fill: { color: "FFFFFF" } });

// ------------------------------------------------------------ 7. ER diagram
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("ER diagram (Chen notation)", { placeholder: "title" });
// image is 3726 x 2138 -> ratio 1.743
s.addImage({ path: path.join(DIAG, "er_diagram.png"), x: 1.44, y: 1.3, w: 10.46, h: 6.0 });
s.addNotes("Walk through: EMPLOYEE at the centre. Double lines show total participation (every employee must be in a department and have a designation). REPORTS_TO is recursive. INCLUDES is M:N with attribute amount. Dashed ovals are derived (age, hours_worked, no_of_days, gross/net salary).");

// ------------------------------------------------------------ 8. relational schema
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Relational schema: 8 tables with PK/FK links", { placeholder: "title" });
// image 2802 x 1768 -> ratio 1.585
s.addImage({ path: path.join(DIAG, "relational_schema.png"), x: 1.91, y: 1.3, w: 9.51, h: 6.0 });

// ------------------------------------------------------------ 9. mapping
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("How the ER model became tables", { placeholder: "title" });
const maps = [
  ["Strong entities → tables", "7 entities became 7 tables with SERIAL surrogate primary keys."],
  ["Composite → simple columns", "name → first_name, last_name; pay period → pay_month, pay_year."],
  ["1:N → FK on the N side", "employee.dept_id, employee.desig_id, attendance.emp_id, payroll.emp_id …"],
  ["Recursive → self FK", "employee.reports_to references employee.emp_id."],
  ["1:1 → FK + UNIQUE", "department.head_emp_id (UNIQUE): each department has at most one head."],
  ["M:N → new table", "payroll_detail(payroll_id, component_id, amount) with a composite PK."],
];
maps.forEach(([h, d], i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.6 + col * 6.2, y = 1.5 + row * 1.75;
  card(s, x, y, 5.9, 1.5);
  circleNum(s, x + 0.25, y + 0.25, i + 1);
  s.addText(h, { x: x + 1.0, y: y + 0.2, w: 4.7, h: 0.5, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true });
  s.addText(d, { x: x + 1.0, y: y + 0.7, w: 4.7, h: 0.7, fontSize: 14, color: C.accent5, margin: 0, valign: "top", isTextBox: true });
});
s.addText("All tables are in 3NF. Gross and net salary are stored on purpose as a monthly snapshot, so old payslips stay correct when salary rules change.", {
  x: 0.6, y: 6.75, w: 12.1, h: 0.45, fontSize: 14, italic: true, color: C.text2, margin: 0, isTextBox: true });

// ------------------------------------------------------------ 10. constraints
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Business rules enforced inside the database", { placeholder: "title" });
const cons = [
  ["UNIQUE", ["One attendance row per employee per day", "One payroll per employee per month", "Unique email, phone, PAN, bank a/c"]],
  ["CHECK", ["PAN, IFSC and phone formats (regex)", "end_date ≥ start_date; check_out > check_in", "LOP days ≤ working days; net salary ≥ 0", "Employee at least 18 at joining"]],
  ["DEFAULT / NOT NULL", ["status = 'Active' / 'Pending' / 'Generated'", "date_of_joining, applied_on = CURRENT_DATE", "All identity and salary fields NOT NULL"]],
  ["FK actions", ["Payroll history: RESTRICT delete", "Attendance & leave: CASCADE", "Manager / approver: SET NULL"]],
];
cons.forEach(([h, items], i) => {
  const x = 0.6 + i * 3.08;
  card(s, x, 1.5, 2.85, 5.2);
  s.addText(h, { x: x + 0.25, y: 1.7, w: 2.4, h: 0.5, fontSize: 18, bold: true, color: C.accent2, margin: 0, isTextBox: true });
  s.addText(items.map((t, k) => ({ text: t, options: { bullet: true, breakLine: k < items.length - 1 } })),
    { x: x + 0.15, y: 2.3, w: 2.6, h: 4.2, fontSize: 14, color: C.text1, valign: "top", paraSpaceAfter: 8, isTextBox: true });
});

// ------------------------------------------------------------ 11. architecture
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Architecture: web admin panel on Supabase PostgreSQL", { placeholder: "title" });
const flow = [
  ["User operation", "Admin fills a form in the web panel"],
  ["SQL / PL/pgSQL", "supabase-js sends the query or calls a procedure (RPC)"],
  ["DB processing", "Constraints and triggers validate the change"],
  ["Update / retrieval", "Tables are changed or read"],
  ["Result", "Payslip, table or report shown in the panel"],
];
flow.forEach(([h, d], i) => {
  const x = 0.6 + i * 2.48;
  card(s, x, 1.6, 2.2, 2.2, i === 2 ? C.text2 : C.background2);
  s.addText(h, { x: x + 0.15, y: 1.75, w: 1.9, h: 0.6, fontSize: 16, bold: true, align: "center",
    color: i === 2 ? C.background1 : C.text1, margin: 0, isTextBox: true });
  s.addText(d, { x: x + 0.15, y: 2.4, w: 1.9, h: 1.3, fontSize: 13, align: "center",
    color: i === 2 ? C.accent4 : C.accent5, margin: 0, valign: "top", isTextBox: true });
  if (i < flow.length - 1)
    s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.22, y: 2.55, w: 0.24, h: 0.3, fill: { color: C.accent3 }, line: { color: C.accent3 } });
});
const stack = [
  ["Database", "PostgreSQL 15 on Supabase (cloud)"],
  ["Connectivity", "supabase-js client / PostgREST API"],
  ["Front end", "HTML, CSS, JavaScript admin panel"],
  ["Security", "Supabase Auth + Row Level Security"],
];
stack.forEach(([h, d], i) => {
  const x = 0.6 + (i % 2) * 6.2, y = 4.3 + Math.floor(i / 2) * 1.25;
  card(s, x, y, 5.9, 1.05);
  s.addText(h, { x: x + 0.3, y, w: 1.9, h: 1.05, fontSize: 16, bold: true, color: C.accent2, margin: 0, valign: "middle", isTextBox: true });
  s.addText(d, { x: x + 2.2, y, w: 3.5, h: 1.05, fontSize: 15, color: C.text1, margin: 0, valign: "middle", isTextBox: true });
});

// ------------------------------------------------------------ 12. next steps
s = pres.addSlide({ masterName: "TITLE_DARK" });
s.addText("Next: data, queries and PL/pgSQL", { placeholder: "title" });
s.addText("Review II plan", { placeholder: "body" });
const next = [
  ["2 Procedures", "generate_monthly_payroll, process_leave"],
  ["3 Functions", "fn_lop_days, fn_component_amount, fn_leave_balance"],
  ["1 Cursor", "loops over active employees in the payroll run"],
  ["3 Triggers", "leave → attendance, lock paid payroll, validate manager"],
];
next.forEach(([h, d], i) => {
  const x = 0.8 + i * 2.95;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.0, w: 2.7, h: 1.7, rectRadius: 0.12,
    fill: { color: C.accent1, transparency: 0 }, line: { color: C.accent4, width: 1 } });
  s.addText(h, { x: x + 0.2, y: 5.12, w: 2.3, h: 0.5, fontSize: 18, bold: true, color: C.accent3, margin: 0, isTextBox: true });
  s.addText(d, { x: x + 0.2, y: 5.62, w: 2.3, h: 1.0, fontSize: 13, color: C.background1, margin: 0, valign: "top", isTextBox: true });
});

(async () => {
  const out = path.join(__dirname, "Payroll_DBMS_Review1.pptx");
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote", out);
})();
