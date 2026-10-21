// Builds the Review II project report (Word) for the Employee Payroll Management System.
// Inputs: ../sql/*.sql, review2_data.json (real outputs, see gen_review2_data.mjs),
//         ../diagrams/*.png, shots/*.png (app screenshots, see ../scripts/capture_screens.mjs)
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, ImageRun, PageBreak, PageOrientation, LevelFormat, BorderStyle,
  Footer, PageNumber, TableOfContents, TableLayoutType,
} = require("docx");

const ROOT = path.join(__dirname, "..");
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "review2_data.json"), "utf8"));
const SQL = (f) => fs.readFileSync(path.join(ROOT, "sql", f), "utf8").replace(/\r/g, "");
const FONT = "Calibri";
const MONO = "Consolas";
const NAVY = "000000";
const GREEN = "000000";
const CONTENT_W = 9026; // A4 portrait, 1" margins (DXA)
const FINAL = process.env.REVIEW === "3"; // Review III final report adds integration sections
const LIVE_URL = process.env.LIVE_URL || "https://dbs-proj-mauve.vercel.app";

const TEAM = [
  ["Krishiv Rajkumar", "24BDE0132"],
  ["Asher Mathew", "24BDE0128"],
  ["Sai Praneeth", "24BYB0143"],
];

// ------------------------------------------------------------------ helpers
const t = (s, o = {}) => new TextRun({ text: s, ...o });
const b = (s) => new TextRun({ text: s, bold: true });
const code = (s) => new TextRun({ text: s, font: MONO, size: 19 });
const p = (children, opts = {}) =>
  new Paragraph({ spacing: { after: 120, line: 300 }, ...opts, children: typeof children === "string" ? [t(children)] : children });
const h1 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t(s)] });
const h2 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [t(s)] });
const h3 = (s) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [t(s)] });
const bullet = (children) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60, line: 280 }, children: typeof children === "string" ? [t(children)] : children });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });
const caption = (s) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 220 },
  children: [t(s, { italics: true, size: 19, color: "000000" })] });
const gap = () => new Paragraph({ spacing: { after: 60 }, children: [] });

const line = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const borders = { top: line, bottom: line, left: line, right: line };

function table(headers, rows, widths, { size = 19, headerFill = NAVY } = {}) {
  const total = widths.reduce((a, c) => a + c, 0);
  const mk = (content, w, header) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ children: Array.isArray(content) ? content
      : [t(String(content), { bold: header, size })] })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => mk(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, widths[i], false)) })),
    ],
  });
}

/** Query-output table: columns sized from header and content length, never
 *  narrower than the header; the font shrinks for very wide tables. */
function resultTable(cols, rows, { size = 16 } = {}) {
  const data = cols.map((c, i) => Math.min(Math.max(...rows.map((r) => String(r[i]).length), 1), 40));
  const layout = (sz) => {
    const mins = cols.map((c) => Math.ceil(c.length * sz * 5.0 + 190));
    const needs = cols.map((c, i) => Math.max(mins[i], Math.ceil(data[i] * sz * 4.6 + 190)));
    return { mins, needs, sumMin: mins.reduce((a, c) => a + c, 0), sumNeed: needs.reduce((a, c) => a + c, 0) };
  };
  let L = layout(size);
  while (L.sumNeed > CONTENT_W && size > 13) L = layout(--size);
  let widths;
  if (L.sumNeed <= CONTENT_W) {
    widths = L.needs.map((n) => Math.floor(n * (CONTENT_W / L.sumNeed)));
  } else {
    const spare = Math.max(CONTENT_W - L.sumMin, 0);
    const over = L.needs.map((n, i) => n - L.mins[i]);
    const overSum = over.reduce((a, c) => a + c, 0) || 1;
    widths = L.mins.map((m, i) => m + Math.floor((over[i] / overSum) * spare));
  }
  widths[widths.length - 1] += CONTENT_W - widths.reduce((a, c) => a + c, 0);
  return table(cols, rows, widths, { size });
}

/** Grey code box (one-cell table) with one paragraph per line. */
function codeBlock(src, { size = 16 } = {}) {
  const lines = src.replace(/\s+$/, "").split("\n");
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, layout: TableLayoutType.FIXED, columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
                 left: { style: BorderStyle.SINGLE, size: 4, color: "000000" }, right: { style: BorderStyle.SINGLE, size: 4, color: "000000" } },
      margins: { top: 80, bottom: 80, left: 140, right: 100 },
      children: lines.map((l) => new Paragraph({ spacing: { after: 0, line: 240 },
        children: [new TextRun({ text: l.length ? l : " ", font: MONO, size })] })),
    })] })],
  });
}

function errorBox(msg) {
  return new Paragraph({
    spacing: { before: 60, after: 160 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "000000", space: 6 } },
    children: [t("ERROR:  ", { bold: true, color: "000000", size: 19 }), t(msg, { color: "000000", size: 19, font: MONO })],
  });
}
function okBox(msg) {
  return new Paragraph({
    spacing: { before: 60, after: 160 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "000000", space: 6 } },
    children: [t("RESULT:  ", { bold: true, color: "000000", size: 19 }), t(msg, { color: "000000", size: 19 })],
  });
}

function image(file, w, h) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 },
    children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width: w, height: h } })] });
}
// The short final report keeps only the key screenshots; figures are renumbered in order.
const KEEP_SHOTS = ["05_manager_approved", "06_payroll_generate", "07_payslip", "09_paid_locked", "11_queries"];
let figNo = 3;
const shot = (name, cap) => (FINAL && !KEEP_SHOTS.includes(name)) ? []
  : [image(path.join(__dirname, "shots", `${name}.png`), 600, 375), caption(`Figure ${figNo++} – ${cap.replace(/^Figure \d+ – /, "")}`)];

/** Splits a SQL file into sections: [file header, section 1, section 2, ...].
 *  Each section is "-- ----" / comment lines / "-- ----" / code, so separators come
 *  in pairs and a section runs from one even-numbered separator to the next. */
function blocks(file) {
  const lines = SQL(file).split("\n");
  const seps = lines.map((l, i) => (/^-- -{20,}\s*$/.test(l) ? i : -1)).filter((i) => i >= 0);
  const starts = seps.filter((_, k) => k % 2 === 0);
  const out = [lines.slice(0, starts[0]).join("\n").trim()];
  starts.forEach((st, k) => out.push(lines.slice(st, k + 1 < starts.length ? starts[k + 1] : lines.length).join("\n").trim()));
  return out;
}
const outOf = (r) => (r.ok === false ? errorBox(r.error)
  : !r.cols?.length ? okBox("Statement completed successfully (no rows returned).")
  : resultTable(r.cols, r.rows));

/** The five questions the guidelines ask for every transaction. */
function txTable(rows) {
  return table(["Question", "Answer"], rows.map(([q, a]) => [[b(q)], typeof a === "string" ? a : a]), [2300, CONTENT_W - 2300]);
}

// ------------------------------------------------------------------ title + contents
const titlePage = [
  new Paragraph({ spacing: { before: 1300 }, alignment: AlignmentType.CENTER,
    children: [t("School of Computer Science Engineering and Information Systems", { size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 500 },
    children: [t("BCSE302L – Database Systems | Course Project", { size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
    children: [t("EMPLOYEE PAYROLL MANAGEMENT SYSTEM", { bold: true, size: 44, color: GREEN })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 900 },
    children: [t(FINAL ? "Review III – Integrated System & Final Demonstration" : "Review II – Database Implementation", { size: 28, color: "000000" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [b("Submitted by")] }),
  ...TEAM.map(([n, r]) => new Paragraph({ alignment: AlignmentType.CENTER, children: [t(`${n}  –  ${r}`, { size: 24 })] })),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [b("Under the guidance of")] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Dr Rubimalaya R", { size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [t("October 2026")] }),
  ...(LIVE_URL ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 },
    children: [b("Project link: "), t(LIVE_URL)] })] : []),
  pageBreak(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [t("Contents")] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  p([t("(If page numbers are missing, right-click the table and choose “Update Field”.)", { italics: true, size: 18, color: "000000" })]),
  pageBreak(),
];

// ------------------------------------------------------------------ 1. title & team
const sec1 = [
  h1("1. Project Title and Team Details"),
  table(["Item", "Details"], [
    ["Project title", "Employee Payroll Management System"],
    ["Course", "BCSE302L – Database Systems (Lab course project)"],
    ["Team", TEAM.map(([n, r]) => `${n} (${r})`).join(", ")],
    ["Guide", "Dr Rubimalaya R"],
    ["Database", "PostgreSQL 17 hosted on Supabase (cloud); PL/pgSQL for procedures, functions, cursors and triggers"],
    ["Application", "React + Vite web application connected to the database through the supabase-js client"],
    ...(LIVE_URL ? [["Project link", LIVE_URL]] : []),
    ["Source code", "github.com/LordFlyaway/DBS_proj"],
    ["Sample company", "All Caps Pvt. Ltd. – a fictional company whose 20 employees are named after musicians and athletes"],
  ], [2200, CONTENT_W - 2200]),
  pageBreak(),
];

// ------------------------------------------------------------------ 2. introduction
const sec2 = [
  h1("2. Introduction and Problem Statement"),
  h2("2.1 Introduction"),
  p("Every organisation has to pay its employees correctly and on time. A salary is not one fixed number: it depends on the designation and basic pay, allowances such as HRA and DA, deductions such as Provident Fund, Professional Tax and TDS, the days actually worked, and approved or unapproved leave. When this is managed in spreadsheets, calculations go wrong, records are duplicated, nothing stops invalid entries and there is no audit trail."),
  p("The Employee Payroll Management System stores organisation, employee, attendance, leave and salary-structure data in a relational database and generates monthly payroll and payslips from that data with stored procedures. Business rules are enforced inside the database through constraints, triggers and Row Level Security, and a role-based web application lets HR, payroll staff, managers and employees work with the data."),
  h2("2.2 Problem Statement"),
  p("Design and implement a centralised, consistent and secure database that (a) maintains employee and organisational data, (b) records daily attendance and leave, (c) defines salary components (allowances and deductions), and (d) computes each employee’s monthly gross and net salary, including loss-of-pay for unpaid absence, while enforcing business rules with database constraints and triggers instead of manual checks."),
  h2("2.3 Objectives"),
  bullet("A single source of truth for employees, departments and designations."),
  bullet("Attendance and leave recording, with loss-of-pay calculated automatically."),
  bullet("Configurable salary components – fixed amounts or a percentage of basic pay."),
  bullet("One-step monthly payroll generation with itemised payslips, followed by salary payment."),
  bullet("Integrity through PK/FK, NOT NULL, UNIQUE, CHECK and DEFAULT constraints, triggers and Row Level Security."),
  bullet("Interactive access through a web application connected to the database."),
  h2("2.4 Users and Roles"),
  table(["Role (demo login)", "What the role can do"], [
    ["Admin – Daniel Dumile (HR Manager)", "Manage employees, departments, designations and attendance; approve any leave; run payroll; run the SQL query catalogue."],
    ["Payroll – Jeffery Williams (Payroll Officer)", "Maintain salary components; generate, pay and (if unpaid) delete payroll; run the SQL query catalogue."],
    ["Manager – Aubrey Graham (Engineering Manager)", "See their team; approve or reject the team’s leave; follow team attendance."],
    ["Employee – LeBron James (Sr. Software Engineer)", "Check in and out; apply for and cancel leave; view own attendance and payslips."],
  ], [3300, CONTENT_W - 3300]),
  p([t("Every role also sees its own dashboard, leave balance and payslips. Logins are e-mail/password accounts in Supabase Auth, linked to EMPLOYEE rows through "), code("employee.auth_user_id"), t(" and authorised through "), code("employee.app_role"), t(".")], { spacing: { before: 120, after: 120 } }),
  pageBreak(),
];

// ------------------------------------------------------------------ 3. functional requirements
const sec3 = [
  h1("3. Functional Requirements"),
  table(["ID", "Requirement", "Implemented by"], [
    ["FR1", "Add, update and delete departments, including the department head.", "DEPARTMENT; Departments page"],
    ["FR2", "Maintain designations with pay grade, basic salary and annual leave quota.", "DESIGNATION; Designations page"],
    ["FR3", "Register employees with personal, PAN and bank details, department, designation, manager and login role.", "EMPLOYEE; CHECK/UNIQUE constraints; trg_validate_manager"],
    ["FR4", "Record attendance – one row per employee per day; employees check themselves in and out.", "ATTENDANCE; UNIQUE (emp_id, att_date); RLS policy"],
    ["FR5", "Employees apply for leave; managers approve or reject; approved leave appears in attendance.", "LEAVE_REQUEST; process_leave; trg_leave_approved"],
    ["FR6", "Define allowances and deductions as fixed amounts or a percentage of basic.", "SALARY_COMPONENT; fn_component_amount"],
    ["FR7", "Generate the month’s payroll for all active employees with LOP, gross and net salary.", "generate_monthly_payroll (cursor); fn_working_days; fn_lop_days"],
    ["FR8", "Keep an itemised payslip (amount of every component).", "PAYROLL_DETAIL (M:N bridge)"],
    ["FR9", "Pay salaries: mark payroll Paid with date, mode and transaction reference.", "pay_monthly_payroll (cursor FOR UPDATE)"],
    ["FR10", "Prevent invalid operations – duplicate payroll, editing paid payroll, self-approval, exceeding leave balance.", "Constraints, procedures and triggers"],
    ["FR11", "Handle employee exits – reassign their team, clear department headship, reject pending leave.", "trg_employee_exit"],
    ["FR12", "Management reports: department cost, attendance summary, leave balance, top earners and others.", "19 SQL queries saved as views"],
    ["FR13", "Role-based web application connected to the database.", "React app + supabase-js + Row Level Security"],
  ], [800, 4900, CONTENT_W - 5700]),
  pageBreak(),
];

// ------------------------------------------------------------------ 4/5. ER + schema (landscape)
const sec4 = [
  h1("4. ER Diagram"),
  image(path.join(ROOT, "diagrams", "er_diagram.png"), 900, 516),
  caption("Figure 1 – ER diagram (Chen notation): 7 entities and 9 relationships, including the recursive REPORTS_TO, the 1:1 HEADS and the M:N INCLUDES relationship."),
];
const sec5img = [
  h1("5. Relational Schema"),
  image(path.join(ROOT, "diagrams", "relational_schema.png"), 860, 543),
  caption("Figure 2 – Relational schema: 8 tables with primary and foreign keys."),
];
function schemaLine(name, cols) {
  const children = [b(name.toUpperCase()), t(" (")];
  cols.forEach((c, i) => {
    const [col, tag] = c.split(":");
    children.push(new TextRun({ text: col, bold: tag?.includes("PK"), underline: tag?.includes("PK") ? {} : undefined, italics: tag?.includes("FK") }));
    if (i < cols.length - 1) children.push(t(", "));
  });
  children.push(t(")"));
  return new Paragraph({ spacing: { after: 120, line: 280 }, children });
}
const sec5text = [
  h2("5.1 Relational Schema (text notation)"),
  p([t("Primary keys are "), new TextRun({ text: "bold and underlined", bold: true, underline: {} }), t("; foreign keys are "), new TextRun({ text: "italic", italics: true }), t(".")]),
  schemaLine("department", ["dept_id:PK", "dept_name", "location", "head_emp_id:FK", "created_on"]),
  schemaLine("designation", ["desig_id:PK", "title", "pay_grade", "basic_salary", "annual_leave_quota"]),
  schemaLine("employee", ["emp_id:PK", "first_name", "last_name", "email", "phone", "gender", "dob", "date_of_joining", "pan_no", "bank_account_no", "ifsc_code", "status", "dept_id:FK", "desig_id:FK", "reports_to:FK", "app_role", "auth_user_id"]),
  schemaLine("attendance", ["attendance_id:PK", "emp_id:FK", "att_date", "check_in", "check_out", "status"]),
  schemaLine("leave_request", ["leave_id:PK", "emp_id:FK", "leave_type", "start_date", "end_date", "reason", "status", "applied_on", "approved_by:FK"]),
  schemaLine("salary_component", ["component_id:PK", "component_name", "component_type", "calc_method", "value", "is_taxable", "is_active"]),
  schemaLine("payroll", ["payroll_id:PK", "emp_id:FK", "pay_month", "pay_year", "working_days", "lop_days", "basic_salary", "total_allowances", "total_deductions", "gross_salary", "net_salary", "status", "generated_on", "payment_date", "payment_mode", "transaction_ref"]),
  schemaLine("payroll_detail", ["payroll_id:PK,FK", "component_id:PK,FK", "amount"]),
  p([b("Change since Review I: "), t("two columns were added to EMPLOYEE for the web application – "), code("app_role"), t(" (Admin, Payroll, Manager or Employee) and "), code("auth_user_id"), t(" (the employee’s Supabase login, UNIQUE). Keeping them in EMPLOYEE keeps the design at 8 tables.")]),
  p("All tables are in Third Normal Form: department and designation details are stored once and referenced by key, salary rules are separate from payslip line items, and the only non-key attribute of the composite-key table PAYROLL_DETAIL (amount) depends on the whole key. Age, hours worked and leave days are derived in queries and are not stored; gross and net salary are stored on purpose as a monthly snapshot so that old payslips do not change when salary rules change."),
  pageBreak(),
];

// ------------------------------------------------------------------ 6. DDL, data, DML
const counts = DATA.counts.rows;
const S = DATA.samples;
const sec6 = [
  h1("6. Table Creation and Constraints"),
  p([t("The database is created by "), code("sql/01_schema.sql"), t(". Each table and the business rule behind each constraint is summarised below, followed by the complete DDL.")]),
  h2("6.1 Constraint Summary"),
  table(["Table", "Keys", "NOT NULL / UNIQUE / CHECK / DEFAULT"], [
    ["DEPARTMENT", "PK dept_id; FK head_emp_id (UNIQUE) → employee", "dept_name UNIQUE NOT NULL; created_on DEFAULT CURRENT_DATE"],
    ["DESIGNATION", "PK desig_id", "title UNIQUE; pay_grade IN (G1–G5); basic_salary > 0; annual_leave_quota DEFAULT 24, 0–60"],
    ["EMPLOYEE", "PK emp_id; FK dept_id, desig_id, reports_to (self)", "email, phone, pan_no, bank_account_no, auth_user_id UNIQUE; phone ^[6-9][0-9]{9}$; PAN ^[A-Z]{5}[0-9]{4}[A-Z]$; IFSC format; gender IN (M,F,O); status DEFAULT 'Active'; app_role DEFAULT 'Employee'; at least 18 at joining; cannot report to self"],
    ["ATTENDANCE", "PK attendance_id; FK emp_id (CASCADE)", "UNIQUE (emp_id, att_date); status IN (Present, Absent, Half-Day, Leave) DEFAULT 'Present'; check_out > check_in"],
    ["LEAVE_REQUEST", "PK leave_id; FK emp_id (CASCADE), approved_by (SET NULL)", "leave_type IN (Casual, Sick, Earned, Unpaid); end_date ≥ start_date; status DEFAULT 'Pending'; approver ≠ applicant"],
    ["SALARY_COMPONENT", "PK component_id", "component_name UNIQUE; type IN (Allowance, Deduction); calc_method IN (Fixed, Percent); value ≥ 0 and ≤ 100 for Percent; is_taxable, is_active DEFAULT TRUE"],
    ["PAYROLL", "PK payroll_id; FK emp_id (RESTRICT)", "UNIQUE (emp_id, pay_month, pay_year); month 1–12; lop_days ≤ working_days; net_salary ≥ 0; status DEFAULT 'Generated'; Paid ⇒ payment_date and mode present; transaction_ref UNIQUE"],
    ["PAYROLL_DETAIL", "PK (payroll_id, component_id); FK both (CASCADE / RESTRICT)", "amount ≥ 0"],
  ], [1800, 2700, CONTENT_W - 4500], { size: 18 }),
  h2("6.2 DDL – sql/01_schema.sql"),
  codeBlock(SQL("01_schema.sql")),
  h2("6.3 Data Population"),
  p([t("The sample data ("), code("sql/04_seed_data.sql"), t(") describes All Caps Pvt. Ltd. from August to October 2026. Every table has at least 10 meaningful rows. Attendance is generated for every working day; payroll rows are not typed in by hand but produced by calling the payroll procedures, exactly as the application does.")]),
  table(["Table", "Rows", "Contents"], [
    [counts[0][0], counts[0][1], "Departments in seven cities, six with a department head"],
    [counts[1][0], counts[1][1], "Job titles from Operations Associate (G1) to Director (G5)"],
    [counts[2][0], counts[2][1], "20 employees in a 3-level reporting hierarchy; one resigned in August"],
    [counts[3][0], counts[3][1], "Every weekday from 1 Aug to 9 Oct 2026, with absences, half days and leave"],
    [counts[4][0], counts[4][1], "Approved, rejected and pending requests, including unpaid leave"],
    [counts[5][0], counts[5][1], "6 active allowances, 4 active deductions, 2 inactive components"],
    [counts[6][0], counts[6][1], "August (20 employees, Paid) and September (19 employees, Generated)"],
    [counts[7][0], counts[7][1], "10 line items per payslip"],
  ], [2000, 900, CONTENT_W - 2900]),
  h3("DEPARTMENT"), resultTable(S.department.cols, S.department.rows),
  h3("DESIGNATION"), resultTable(S.designation.cols, S.designation.rows),
  h3("EMPLOYEE"), resultTable(S.employee.cols, S.employee.rows, { size: 14 }),
  h3("SALARY_COMPONENT"), resultTable(S.salary_component.cols, S.salary_component.rows),
  h3("LEAVE_REQUEST"), resultTable(S.leave_request.cols, S.leave_request.rows),
  h3("ATTENDANCE (Virat Kohli, 1–14 September 2026)"), resultTable(S.attendance.cols, S.attendance.rows),
  p([t("Virat Kohli’s approved unpaid leave on 7–9 September appears as status "), code("Leave"), t(" – it was written by trigger "), code("trg_leave_approved"), t(".")]),
  h3("PAYROLL (September 2026, first 12 employees)"), resultTable(S.payroll.cols, S.payroll.rows, { size: 15 }),
  h3("PAYROLL_DETAIL (LeBron James, September 2026)"), resultTable(S.payroll_detail.cols, S.payroll_detail.rows),
  h2("6.4 DML Demonstration – INSERT, UPDATE and DELETE"),
  p("Each statement below was executed on the populated database. Successful statements show the returned rows; rejected statements show the error PostgreSQL raised, which proves the constraint is enforced by the database itself."),
  ...DATA.dml.flatMap((d, i) => [
    h3(`${i + 1}. ${d.title}`),
    codeBlock(d.sql),
    d.result.ok ? (d.result.rows.length ? resultTable(d.result.cols, d.result.rows) : okBox(`${d.result.affected ?? 0} row(s) affected`)) : errorBox(d.result.error),
    ...(d.note ? [p([t(d.note, { italics: true, color: "000000" })])] : []),
  ]),
  pageBreak(),
];

// ------------------------------------------------------------------ 7. queries
const sec7 = [
  h1("7. SQL Queries and Outputs"),
  p([t("Nineteen queries answer real questions an HR or payroll team asks. Each is saved as a view in "), code("sql/05_queries.sql"), t(" and can be run live from the SQL Queries page of the application. Outputs below are the actual results on the sample data (at most 10 rows shown).")]),
  table(["#", "Question answered", "SQL concepts"], DATA.queries.map((q) => [`Q${q.id}`, q.title, q.concepts.join(", ")]), [600, 5200, CONTENT_W - 5800], { size: 17 }),
  ...DATA.queries.flatMap((q) => [
    h2(`Q${q.id}. ${q.title}`),
    p([b("Concepts: "), t(q.concepts.join(", "))]),
    codeBlock(q.sql + ";"),
    p([t(`Output – ${q.total} row(s)${q.total > q.rows.length ? `, first ${q.rows.length} shown` : ""}:`, { italics: true, color: "000000", size: 19 })], { spacing: { before: 100, after: 60 } }),
    resultTable(q.cols, q.rows),
    gap(),
  ]),
  pageBreak(),
];

// ------------------------------------------------------------------ 8. PL/pgSQL
const F = blocks("02_functions_procedures.sql"); // [header, f1, f2, f3, f4, p1, p2, p3]
const T = blocks("03_triggers.sql");             // [header, t1, t2, t3, t4]
const fx = DATA.functions;
const tx = DATA.tx;
const sec8h85 = h2(FINAL ? "8.4 Calling Procedures from the Application" : "8.5 Calling Procedures from the Application");
const sec8 = [
  h1("8. Procedures, Functions, Cursor and Triggers"),
  p([t("All server-side logic is written in PL/pgSQL, PostgreSQL’s procedural language (the equivalent of Oracle PL/SQL). It lives in "), code("sql/02_functions_procedures.sql"), t(" and "), code("sql/03_triggers.sql"), t(".")]),
  h2("8.1 Overview"),
  table(["Type", "Name", "Business purpose", "Used by"], [
    ["Function", "fn_working_days(month, year)", "Working days (Mon–Fri) in a month", "generate_monthly_payroll"],
    ["Function", "fn_component_amount(component, basic)", "Amount of a fixed or % salary component", "generate_monthly_payroll"],
    ["Function", "fn_lop_days(emp, month, year)", "Loss-of-pay days: absent + ½ half-day + unpaid leave", "generate_monthly_payroll, Q7"],
    ["Function", "fn_leave_balance(emp, year)", "Remaining paid leave for the year", "process_leave, Q8, Leave page"],
    ["Procedure + cursor", "generate_monthly_payroll(month, year)", "Creates every active employee’s payroll and payslip lines", "Payroll Run page"],
    ["Procedure", "process_leave(leave, approver, decision)", "Validates and approves/rejects a leave request", "Leave approvals page"],
    ["Procedure + cursor", "pay_monthly_payroll(month, year, mode)", "Marks the month’s payroll Paid with a transaction reference", "Payroll Run page"],
    ["Trigger", "trg_leave_approved", "Approved leave → ‘Leave’ rows in ATTENDANCE", "leave_request UPDATE"],
    ["Trigger", "trg_lock_paid_payroll", "Paid payroll cannot be changed or deleted", "payroll UPDATE/DELETE"],
    ["Trigger", "trg_validate_manager", "Manager must be active; no reporting cycles", "employee INSERT/UPDATE"],
    ["Trigger", "trg_employee_exit", "On resignation: reassign team, clear headship, reject pending leave", "employee UPDATE"],
  ], [1500, 2900, 2900, CONTENT_W - 7300], { size: 17 }),
  h2("8.2 Functions"),
  h3("Function 1 – fn_working_days"), codeBlock(F[1]), p("Example:"), outOf(fx.working_days),
  h3("Function 2 – fn_component_amount"), codeBlock(F[2]), p("Example – every active component for a basic salary of ₹45,000:"), outOf(fx.component_amount),
  h3("Function 3 – fn_lop_days"), codeBlock(F[3]), p("Example – September 2026:"), outOf(fx.lop_days),
  p([t("Virat Kohli and Sania Mirza each had 2–3 days of approved "), b("unpaid"), t(" leave in September; Daniel Dumile’s 1.5 days come from one absence and one half day.")]),
  h3("Function 4 – fn_leave_balance"), codeBlock(F[4]), p("Example:"), outOf(fx.leave_balance),
  h2("8.3 Procedures and Cursors"),
  h3("Procedure 1 – generate_monthly_payroll (explicit cursor)"), codeBlock(F[5]),
  p([b("How the cursor is used: "), code("cur_emp"), t(" is declared over all Active / On Leave employees who had joined by the end of the month. The procedure OPENs it, FETCHes one employee per loop iteration (EXIT WHEN NOT FOUND), computes LOP days, earned basic and every active component through the functions above, inserts one PAYROLL row and its PAYROLL_DETAIL lines, then CLOSEs the cursor. Employees who already have a payroll for that month are skipped with CONTINUE, so running it twice never creates duplicates.")]),
  p("Execution – October 2026, then the same call again:"),
  outOf(tx.generate), outOf(tx.generate_again),
  outOf(tx.gen_rows),
  p([t("Cristiano Ronaldo has 2.5 LOP days: 0.5 from a half day plus 2 days of approved unpaid leave on 21–22 October (see 8.4). October was generated after the 10 % Software Engineer revision and the Internet Allowance deactivation from section 6.4, so Cristiano and Coco Gauff are paid the new basic of ₹49,500 and nobody receives the Internet Allowance.", { italics: true, color: "000000" })]),
  h3("Procedure 2 – process_leave"), codeBlock(F[6]),
  h3("Procedure 3 – pay_monthly_payroll (cursor FOR UPDATE … WHERE CURRENT OF)"), codeBlock(F[7]),
  p([b("How the cursor is used: "), code("cur_pay"), t(" selects the month’s unpaid payroll rows FOR UPDATE, which locks them so two payroll officers cannot pay the same salaries at the same time. Each fetched row is updated through "), code("WHERE CURRENT OF cur_pay"), t(", the positioned update that changes exactly the row the cursor is on.")]),
  outOf(tx.pay), outOf(tx.pay_rows),
  h2("8.4 Triggers"),
  h3("Trigger 1 – trg_leave_approved"), codeBlock(T[1]),
  p("Coco Gauff’s pending sick leave (15–16 October) is approved by her manager Aubrey Graham (employee 4). Attendance before and after:"),
  p([t("Before: ", { bold: true }), t(tx.att_before.rows.length ? "" : "no attendance rows for 14–17 October (future dates).")]),
  outOf(tx.approve),
  p([b("After:")]), outOf(tx.att_after), outOf(tx.leave_after),
  p("The procedure process_leave also rejects invalid approvals:"),
  table(["Attempt", "Database response"], [
    ["Michael Jordan (not his manager) approves Cristiano’s leave", tx.approve_wrong_mgr.error],
    ["Cristiano approves his own leave", tx.approve_self.error],
    ["The same request is approved twice", tx.approve_twice.error],
    ["PV Sindhu requests 20 days of Earned leave", tx.balance_fail.error],
  ], [3800, CONTENT_W - 3800], { size: 18 }),
  h3("Trigger 2 – trg_lock_paid_payroll"), codeBlock(T[2]),
  p("After October is paid, attempts to change or delete a payslip:"), outOf(tx.lock_update), outOf(tx.lock_delete),
  h3("Trigger 3 – trg_validate_manager"), codeBlock(T[3]),
  p("Assigning a resigned employee as manager, and creating a reporting cycle (Aubrey Graham to report to his own report LeBron James):"),
  outOf(tx.mgr_bad), outOf(tx.mgr_cycle),
  h3("Trigger 4 – trg_employee_exit"), codeBlock(T[4]),
  p("Michael Jordan (employee 5, Sales Manager and head of Sales) resigns:"),
  codeBlock("UPDATE employee SET status = 'Resigned' WHERE emp_id = 5;"),
  p([b("Before – his direct reports and the Sales department head:")]), outOf(tx.exit_before), outOf(tx.exit_head_before),
  p([b("After – the trigger moved his team to his own manager (Sachin Tendulkar, employee 1) and cleared the department head:")]), outOf(tx.exit_after), outOf(tx.exit_head_after),
  sec8h85,
  p([t("The web application talks to the database through Supabase’s REST interface (PostgREST), which can call SQL "), b("functions"), t(" over HTTP but not procedures. Thin SECURITY DEFINER wrapper functions therefore check the caller’s role and then CALL the procedure. Row Level Security policies decide which rows each role may read or change; they are defined in "), code("sql/06_supabase_auth_rls.sql"), t(".")]),
  codeBlock(`CREATE OR REPLACE FUNCTION public.api_generate_payroll(p_month INT, p_year INT)
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

-- Row Level Security example: employees see only their own payslips
CREATE POLICY pay_read ON payroll FOR SELECT TO authenticated
    USING (app_is_staff() OR emp_id = app_emp_id());`),
  pageBreak(),
];

// ------------------------------------------------------------------ Review III additions
/** 9.2 – how the components chain together over one monthly payroll cycle. */
function integratedWorkflow() {
  const Y = "✓";
  return [
    h2("9.2 Integrated Workflow – One Monthly Payroll Cycle"),
    p("The database components are not independent programs: the output of one operation is the input of the next. Attendance and leave recorded during the month feed fn_lop_days, which feeds the payroll procedure; approving leave writes attendance through a trigger; paying salaries locks the payroll through another trigger; and the reports read what the procedures produced. The table follows one month from start to finish."),
    table(["Step", "Actor", "User operation", "SQL / PL/pgSQL executed", "Tables written"], [
      ["1", "Admin", "Onboards a new employee", "INSERT employee – CHECK, UNIQUE and FK constraints; trg_validate_manager", "employee"],
      ["2", "Employee", "Checks in and out every day", "INSERT / UPDATE attendance (RLS: own row, today)", "attendance"],
      ["3", "Employee", "Applies for leave", "fn_leave_balance; INSERT leave_request (status Pending)", "leave_request"],
      ["4", "Manager", "Approves the leave", "process_leave → fn_leave_balance → trg_leave_approved", "leave_request, attendance"],
      ["5", "Payroll", "Generates the month’s payroll", "generate_monthly_payroll – cursor cur_emp; fn_working_days, fn_lop_days, fn_component_amount", "payroll, payroll_detail"],
      ["6", "Payroll", "Pays salaries", "pay_monthly_payroll – cursor cur_pay FOR UPDATE … WHERE CURRENT OF", "payroll"],
      ["7", "Payroll", "Tries to change a paid payslip", "UPDATE / DELETE payroll → trg_lock_paid_payroll rejects it", "– (rolled back)"],
      ["8", "Employee", "Opens their payslip", "SELECT payroll ⋈ payroll_detail ⋈ salary_component (RLS: own rows)", "– (read)"],
      ["9", "Admin / Payroll", "Reviews reports", "Views q04, q06, q08, q13 and the other query views", "– (read)"],
      ["10", "Admin", "Records a resignation", "UPDATE employee status → trg_employee_exit → trg_validate_manager", "employee, department, leave_request"],
    ], [600, 1100, 2000, 3626, 1700], { size: 17 }),
    p([b("Data flow: "), t("attendance (step 2) and approved unpaid leave (step 4) → fn_lop_days → loss of pay in the payroll (step 5) → payslip and reports (steps 8–9). Approved leave reaches attendance only through trg_leave_approved, so the payroll always sees the approved leave without the application having to update two tables.")], { spacing: { before: 140, after: 140 } }),
    h3("Which database component runs in which transaction"),
    table(["Component", "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9"], [
      ["fn_working_days", "", "", "", Y, "", "", "", "", ""],
      ["fn_component_amount", "", "", "", Y, "", "", "", "", ""],
      ["fn_lop_days", "", "", "", Y, "", "", "", "", ""],
      ["fn_leave_balance", "", Y, Y, "", "", "", "", "", Y],
      ["generate_monthly_payroll + cursor cur_emp", "", "", "", Y, "", "", "", "", ""],
      ["process_leave", "", "", Y, "", "", "", "", "", ""],
      ["pay_monthly_payroll + cursor cur_pay", "", "", "", "", "", Y, "", "", ""],
      ["trg_leave_approved", "", "", Y, "", "", "", "", "", ""],
      ["trg_lock_paid_payroll", "", "", "", "", "", Y, Y, "", ""],
      ["trg_validate_manager", "", "", "", "", "", "", "", Y, ""],
      ["trg_employee_exit", "", "", "", "", "", "", "", Y, ""],
      ["Constraints (PK/FK/UNIQUE/CHECK)", Y, Y, Y, Y, "", Y, "", Y, ""],
      ["Row Level Security", Y, Y, Y, Y, Y, Y, Y, Y, Y],
      ["Query views (Q1–Q19)", "", "", "", "", "", "", "", "", Y],
    ], [3026, ...Array(9).fill(667)], { size: 17 }),
    p([t("T1 check-in · T2 apply leave · T3 approve leave · T4 generate payroll · T5 payslip · T6 pay salaries · T7 delete paid payroll · T8 resignation · T9 report queries. In T6 the lock trigger runs while the rows are updated from Generated to Paid and lets the change through.", { italics: true, size: 19 })]),
    h2("9.3 Transactions"),
  ];
}

/** 9.4 reports + 9.5 validation tests (Output & Reports criterion). */
function reportsAndValidation() {
  const q = (id) => DATA.queries.find((x) => x.id === id);
  const dml = DATA.dml;
  return [
    h2("9.4 Reports Generated from the Database"),
    p("The application turns the stored data into the reports a payroll team needs. Each report below is produced by the database (a view or a procedure) and shown in the application; the figures are actual outputs on the sample data."),
    table(["Report", "Produced by", "Where it appears"], [
      ["Itemised payslip", "PAYROLL + PAYROLL_DETAIL + SALARY_COMPONENT (written by generate_monthly_payroll)", "Payroll Run and My Payslips pages"],
      ["Monthly payroll totals and payment status", "View q13_monthly_payroll_totals", "Admin / Payroll dashboard"],
      ["Department-wise salary cost", "View q04_department_salary_cost", "Dashboard bar chart and SQL Queries page"],
      ["Attendance summary", "View q06_attendance_summary", "SQL Queries page"],
      ["Leave balance of every employee", "View q08_leave_balance → fn_leave_balance", "SQL Queries page; each employee’s Leave page"],
      ["Loss-of-pay report", "View q07_loss_of_pay", "SQL Queries page"],
    ], [2600, 3600, CONTENT_W - 6200], { size: 18 }),
    h3("Monthly payroll totals (q13)"), resultTable(q(13).cols, q(13).rows),
    h3("Department-wise salary cost, September 2026 (q04)"), resultTable(q(4).cols, q(4).rows),
    ...(FINAL ? [] : [
      h3("Attendance summary, September 2026 (q06, first 10 employees)"), resultTable(q(6).cols, q(6).rows),
      h3("Leave balance 2026 (q08, first 10 employees)"), resultTable(q(8).cols, q(8).rows)]),
    h2("9.5 Validation – Invalid Operations Rejected by the Database"),
    p("Every business rule was tested by deliberately attempting an invalid operation. In each case the database itself refused the change, so the rule holds no matter which client sends the request."),
    table(["#", "Attempted operation", "Rule / component", "Database response", "Result"], [
      ["1", "Insert employee with PAN 'BADPAN'", "CHECK constraint", dml[1].result.error, "Pass"],
      ["2", "Second attendance row for the same day", "UNIQUE (emp_id, att_date)", dml[2].result.error, "Pass"],
      ["3", "Employee in a non-existent department", "FOREIGN KEY", dml[3].result.error, "Pass"],
      ["4", "Delete an employee who has payroll history", "FK ON DELETE RESTRICT", dml[8].result.error, "Pass"],
      ["5", "Manager approves leave of someone outside their team", "process_leave", tx.approve_wrong_mgr.error, "Pass"],
      ["6", "Employee approves their own leave", "process_leave", tx.approve_self.error, "Pass"],
      ["7", "Approve the same request twice", "process_leave", tx.approve_twice.error, "Pass"],
      ["8", "Approve 20 days of paid leave with 13 left", "process_leave + fn_leave_balance", tx.balance_fail.error, "Pass"],
      ["9", "Generate October payroll a second time", "generate_monthly_payroll (skip logic)", `${tx.generate_again.rows?.[0]?.[0]} new payslips created`, "Pass"],
      ["10", "Change net salary of a paid payslip", "trg_lock_paid_payroll", tx.lock_update.error, "Pass"],
      ["11", "Delete a paid payslip", "trg_lock_paid_payroll", tx.lock_delete.error, "Pass"],
      ["12", "Assign a resigned employee as manager", "trg_validate_manager", tx.mgr_bad.error, "Pass"],
      ["13", "Create a two-person reporting cycle", "trg_validate_manager", tx.mgr_cycle.error, "Pass"],
      ["14", "Employee calls the payroll generation API", "api_generate_payroll role check", "Only Admin or Payroll staff can generate payroll", "Pass"],
      ["15", "Read employee data without signing in", "Privileges + Row Level Security", "permission denied for table employee", "Pass"],
    ], [450, 2300, 1800, CONTENT_W - 5250, 700], { size: 16 }),
  ];
}

/** 10.1 – design choices and why (Viva criterion). */
function designDecisions() {
  return [
    h2("10.1 Design Decisions and Justification"),
    table(["Decision", "Justification"], [
      ["PostgreSQL (Supabase) with PL/pgSQL", "A hosted database the web application can reach from anywhere; PL/pgSQL offers the same procedures, functions, cursors and triggers as Oracle PL/SQL."],
      ["Surrogate SERIAL keys, natural keys kept UNIQUE", "Short, stable keys for joins and foreign keys, while e-mail, phone, PAN and bank account still cannot be duplicated."],
      ["Gross and net salary stored in PAYROLL", "A deliberate snapshot: a payslip must not change when salary rules change later. Derived values that never become history (age, hours worked, leave days) are computed instead."],
      ["PAYROLL_DETAIL bridge table", "Resolves the M:N relationship between payroll and salary components and keeps an auditable, itemised payslip."],
      ["Business rules inside the database", "Constraints and triggers apply to every client – the web app, the SQL editor or the API – so a rule cannot be skipped by a missing UI check."],
      ["Explicit cursor in generate_monthly_payroll", "Each employee needs several dependent steps (LOP, earned basic, every component, one header and many detail rows), with already-processed employees skipped; a cursor processes them one at a time in a defined order."],
      ["Cursor FOR UPDATE in pay_monthly_payroll", "Locks the month’s unpaid rows so two payroll officers cannot pay the same salary twice; WHERE CURRENT OF updates exactly the fetched row."],
      ["FK actions: RESTRICT / CASCADE / SET NULL", "Payroll history can never be deleted with an employee (RESTRICT); attendance and leave have no meaning without the employee (CASCADE); a departing manager or approver leaves the records intact (SET NULL)."],
      ["Triggers for side effects", "Writing leave into attendance and cleaning up after a resignation happen in the same transaction as the change that causes them, so they cannot be forgotten or half-done."],
      ["Row Level Security + api_* wrapper functions", "Each role sees only permitted rows; PostgREST cannot call procedures, so SECURITY DEFINER functions check the caller’s role and then CALL the procedure."],
      ["Views with security_invoker", "Report queries are written once, reused by the dashboard and the SQL Queries page, and still respect each user’s row permissions."],
    ], [3000, CONTENT_W - 3000], { size: 18 }),
  ];
}

// ------------------------------------------------------------------ 9. transactions
const sec9 = [
  h1("9. Real-World Transaction Demonstrations"),
  h2("9.1 Application and Database Connectivity"),
  p("The application is a React single-page app. It connects to the PostgreSQL database with the supabase-js client: SELECT/INSERT/UPDATE/DELETE requests are sent to PostgREST, procedures are reached through the api_* functions (RPC), and every request carries the signed-in user’s token so Row Level Security applies. Every screen has a “DB activity” panel that lists, for each user action, the SQL or PL/pgSQL component executed, the tables involved and the result – the flow the guidelines ask for:"),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 },
    children: [t("User operation  →  SQL / PL/pgSQL  →  Database processing  →  Database update / retrieval  →  Result", { bold: true, color: GREEN })] }),
  ...shot("01_login", "Figure 3 – Sign-in page. Each demo account opens a different role."),
  p("Row Level Security was verified by signing in as each role and counting the rows the database returned for the same queries:"),
  table(["Signed in as", "employee", "payroll", "leave_request", "attendance", "Generate payroll?"], [
    ["Not signed in", "denied", "denied", "denied", "denied", "denied"],
    ["Admin (Daniel Dumile)", "20", "39", "13", "971", "allowed"],
    ["Payroll (Jeffery Williams)", "20", "39", "13", "971", "allowed"],
    ["Manager (Aubrey Graham)", "8 (self, manager, team)", "2 (own)", "6 (own + team)", "321", "blocked"],
    ["Employee (LeBron James)", "2 (self + manager)", "2 (own)", "2 (own)", "50 (own)", "blocked"],
  ], [2400, 1500, 1100, 1400, 1100, CONTENT_W - 7500], { size: 18 }),
  ...(FINAL ? integratedWorkflow() : []),

  h2("T1. Employee checks in"),
  txTable([
    ["Operation", "LeBron James clicks “Check in” on his dashboard."],
    ["Tables involved", "ATTENDANCE"],
    ["SQL component", "INSERT INTO attendance (emp_id, att_date, check_in, status) VALUES (6, CURRENT_DATE, <time>, 'Present'); – allowed by an RLS policy only for the employee’s own row and only for today."],
    ["Effect on database", "One attendance row is inserted. UNIQUE (emp_id, att_date) rejects a second check-in on the same day."],
    ["Result", "The dashboard shows “Present · In 16:02” and a Check out button (which performs an UPDATE of check_out)."],
  ]),
  ...shot("02_employee_checkin", "Figure 4 – Employee check-in with the INSERT shown in the DB activity panel."),

  h2("T2. Employee applies for leave"),
  txTable([
    ["Operation", "LeBron applies for 2 days of Casual leave (27–28 October)."],
    ["Tables involved", "LEAVE_REQUEST (read: LEAVE_REQUEST, DESIGNATION for the balance)"],
    ["SQL component", "SELECT fn_leave_balance(6, 2026) to show the balance; INSERT INTO leave_request … with status DEFAULT 'Pending'."],
    ["Effect on database", "A Pending request is inserted. CHECK (end_date ≥ start_date) and the RLS policy (own row, status Pending, no approver) are enforced."],
    ["Result", "The request appears under “My requests” with status Pending."],
  ]),
  ...shot("03_employee_apply_leave", "Figure 5 – Applying for leave: fn_leave_balance shown on the left, the INSERT in the activity panel."),

  h2("T3. Manager approves leave"),
  txTable([
    ["Operation", "Aubrey Graham approves Coco Gauff’s sick leave (request #10)."],
    ["Tables involved", "LEAVE_REQUEST, EMPLOYEE, DESIGNATION, ATTENDANCE"],
    ["SQL / PL/pgSQL component", "SELECT api_process_leave(10, 'Approved') → CALL process_leave(10, 4, 'Approved') → fn_leave_balance → TRIGGER trg_leave_approved."],
    ["Effect on database", "leave_request #10 becomes Approved with approved_by = 4; the trigger inserts ‘Leave’ attendance rows for 15 and 16 October."],
    ["Result", "The request leaves the approval queue; Coco’s attendance shows the two leave days (section 8.4)."],
  ]),
  ...shot("04_manager_approvals", "Figure 6 – The manager’s approval queue (RLS returns only the manager’s team)."),
  ...shot("05_manager_approved", "Figure 7 – After approval: the procedure and trigger chain shown in the activity panel."),

  h2("T4. Payroll officer generates the monthly payroll"),
  txTable([
    ["Operation", "Jeffery Williams selects October 2026 and clicks “Generate payroll”."],
    ["Tables involved", "EMPLOYEE, DESIGNATION, ATTENDANCE, LEAVE_REQUEST, SALARY_COMPONENT (read); PAYROLL, PAYROLL_DETAIL (write)"],
    ["SQL / PL/pgSQL component", "SELECT api_generate_payroll(10, 2026) → CALL generate_monthly_payroll(10, 2026) – cursor over active employees using fn_working_days, fn_lop_days and fn_component_amount."],
    ["Effect on database", `${tx.generate.rows?.[0]?.[0]} PAYROLL rows (status Generated) and one PAYROLL_DETAIL row per active salary component for each are inserted. Running it again inserts nothing.`],
    ["Result", "The payroll table lists all 19 active employees with LOP days, gross, deductions and net pay; totals are shown above it."],
  ]),
  ...shot("06_payroll_generate", "Figure 8 – Generating October payroll: one click runs the cursor-based procedure for 19 employees."),

  h2("T5. Viewing an itemised payslip"),
  txTable([
    ["Operation", "The payroll officer (or the employee, from My Payslips) opens a payslip."],
    ["Tables involved", "PAYROLL, PAYROLL_DETAIL, SALARY_COMPONENT, EMPLOYEE, DEPARTMENT, DESIGNATION"],
    ["SQL component", "SELECT … FROM payroll_detail JOIN salary_component … WHERE payroll_id = ? (the M:N bridge table) plus the employee details."],
    ["Effect on database", "Read only. RLS lets an employee read only their own payslips."],
    ["Result", "Earnings (basic, loss of pay, allowances), deductions and net pay, ready to print."],
  ]),
  ...shot("07_payslip", "Figure 9 – Itemised payslip built from PAYROLL_DETAIL."),

  h2("T6. Paying the month’s salaries"),
  txTable([
    ["Operation", "The payroll officer chooses NEFT and clicks “Pay all”."],
    ["Tables involved", "PAYROLL"],
    ["SQL / PL/pgSQL component", "SELECT api_pay_payroll(10, 2026, 'NEFT') → CALL pay_monthly_payroll(…) – cursor FOR UPDATE with UPDATE … WHERE CURRENT OF."],
    ["Effect on database", "Every Generated row of the month becomes Paid with payment_date, payment_mode and a unique transaction_ref (CHECK: Paid ⇒ date and mode present)."],
    ["Result", "“19 payroll row(s) marked Paid”; the rows are now locked by trg_lock_paid_payroll."],
  ]),
  ...shot("08_payroll_paid", "Figure 10 – Paying salaries through the second cursor-based procedure."),

  h2("T7. Attempt to delete a paid payslip"),
  txTable([
    ["Operation", "The payroll officer clicks Delete on Sachin Tendulkar’s paid October payroll."],
    ["Tables involved", "PAYROLL (PAYROLL_DETAIL would cascade)"],
    ["SQL / PL/pgSQL component", "DELETE FROM payroll WHERE payroll_id = 40; → BEFORE DELETE trigger trg_lock_paid_payroll."],
    ["Effect on database", "The trigger raises an exception, so the DELETE is rolled back and nothing changes."],
    ["Result", "The error message from the database is shown to the user."],
  ]),
  ...shot("09_paid_locked", "Figure 11 – The trigger blocks deleting a paid payroll; the error comes from the database."),

  h2("T8. Employee resignation"),
  txTable([
    ["Operation", "The Admin edits Michael Jordan’s record and sets status to Resigned."],
    ["Tables involved", "EMPLOYEE, DEPARTMENT, LEAVE_REQUEST"],
    ["SQL / PL/pgSQL component", "UPDATE employee SET status = 'Resigned' WHERE emp_id = 5; → AFTER UPDATE trigger trg_employee_exit (which in turn fires trg_validate_manager for the moved employees)."],
    ["Effect on database", "His three reports now report to Sachin Tendulkar, the Sales department has no head, and any pending leave of his is rejected. He is excluded from later payroll runs."],
    ["Result", "Shown with before/after outputs in section 8.4 (Trigger 4)."],
  ]),

  h2("T9. Running the report queries from the application"),
  txTable([
    ["Operation", "The Admin opens SQL Queries and runs Q4 (department-wise salary cost)."],
    ["Tables involved", "PAYROLL, EMPLOYEE, DEPARTMENT (through view q04_department_salary_cost)"],
    ["SQL component", "SELECT * FROM q04_department_salary_cost; – a view created WITH (security_invoker = true) so RLS still applies."],
    ["Effect on database", "Read only."],
    ["Result", "The SQL text, the concepts used and the live result table are shown on one page."],
  ]),
  ...shot("11_queries", "Figure 12 – The SQL Queries page running Q4 live against the database."),
  ...shot("10_admin_dashboard", "Figure 13 – Admin dashboard built from views q13 and q04 and live counts."),
  ...(FINAL ? reportsAndValidation() : []),
  pageBreak(),
];

// ------------------------------------------------------------------ 10. conclusion
const sec10 = [
  h1("10. Conclusion"),
  ...(FINAL ? designDecisions() : []),
  ...(FINAL ? [h2("10.2 Conclusion and Future Work")] : []),
  p("The Employee Payroll Management System has been implemented as a PostgreSQL database on Supabase with a role-based web application. The database has 8 normalised tables with complete primary key, foreign key, NOT NULL, UNIQUE, CHECK and DEFAULT constraints, populated with realistic data for a 20-employee company over three months."),
  p("Nineteen SQL queries cover joins, self-joins, aggregation, grouping with HAVING, correlated and scalar subqueries, set operations, window functions and date functions. Four functions, three procedures (two using explicit cursors) and four triggers implement the real business operations – loss-of-pay calculation, leave approval, payroll generation, salary payment and employee exit – and the database itself rejects invalid operations such as editing a paid payslip, approving one’s own leave or exceeding the leave balance."),
  p("Every component has a clear purpose in the application: each user action in the web app maps to a specific SQL statement, procedure or trigger, and the DB activity panel shows that flow live during the demonstration. Possible extensions are tax-regime based TDS calculation, salary revisions with effective dates, and an audit log table populated by triggers."),
];

// ------------------------------------------------------------------ short sections (final report)
const sec6short = [
  ...sec6.slice(0, 4), // heading, intro, 6.1 constraint summary table
  p([t("The complete DDL is in "), code("sql/01_schema.sql"), t(" and was presented in full in the Review II report.")]),
  h2("6.2 Data Population"),
  p("Every table holds at least 10 meaningful rows describing All Caps Pvt. Ltd. from August to October 2026; payroll rows are produced by the payroll procedures, not typed in."),
  table(["Table", "Rows"], counts.map((r) => [r[0], r[1]]), [4500, CONTENT_W - 4500]),
  h2("6.3 DML Demonstration"),
  p("INSERT, UPDATE and DELETE statements executed on the populated database, including statements the constraints reject:"),
  table(["#", "Operation", "Database result"], DATA.dml.map((d, i) => [String(i + 1), d.title,
    d.result.ok ? `Success – ${d.result.rows.length || d.result.affected || 0} row(s)` : `Rejected – ${d.result.error}`]),
    [450, 3900, CONTENT_W - 4350], { size: 17 }),
  pageBreak(),
];

const SHOWN_QUERIES = [4, 5, 8, 14];
const sec7short = [
  h1("7. SQL Queries and Outputs"),
  p([t("Nineteen queries are saved as views in "), code("sql/05_queries.sql"), t(" and run live from the SQL Queries page. The table lists all of them; four representative queries are shown in full with their actual output.")]),
  table(["#", "Question answered", "SQL concepts", "Rows"], DATA.queries.map((q) => [`Q${q.id}`, q.title, q.concepts.join(", "), String(q.total)]),
    [600, 4700, CONTENT_W - 6000, 700], { size: 16 }),
  ...DATA.queries.filter((q) => SHOWN_QUERIES.includes(q.id)).flatMap((q) => [
    h2(`Q${q.id}. ${q.title}`),
    codeBlock(q.sql + ";"),
    p([t(`Output – ${q.total} row(s)${q.total > q.rows.length ? `, first ${q.rows.length} shown` : ""}:`, { italics: true, size: 19 })], { spacing: { before: 100, after: 60 } }),
    resultTable(q.cols, q.rows),
  ]),
  pageBreak(),
];

const sec8short = [
  ...sec8.slice(0, 4), // heading, intro, 8.1 overview table
  p([t("The complete code of every function, procedure and trigger is in "), code("sql/02_functions_procedures.sql"), t(" and "), code("sql/03_triggers.sql"), t("; the two components at the heart of the monthly cycle are shown below.")]),
  h2("8.2 Procedure with Cursor – generate_monthly_payroll"),
  codeBlock(F[5]),
  p([b("How the cursor is used: "), code("cur_emp"), t(" is declared over the active employees. Each FETCH returns one employee; the loop computes LOP days, earned basic and every active component with the three functions, writes one PAYROLL row and its PAYROLL_DETAIL lines, and skips employees already processed, so a second run creates nothing.")]),
  outOf(tx.generate), outOf(tx.gen_rows),
  h2("8.3 Trigger – trg_leave_approved"),
  codeBlock(T[1]),
  p("Approving Coco Gauff’s sick leave for 15–16 October writes the leave days into ATTENDANCE automatically:"),
  outOf(tx.att_after),
  ...sec8.slice(sec8.findIndex((x) => x === sec8h85)), // 8.5 calling procedures from the app (renumbered below)
];

// ------------------------------------------------------------------ document
const portrait = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } };
const landscape = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } };
const footer = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], size: 18, color: "000000" })] })] }) };

const doc = new Document({
  creator: TEAM.map((x) => x[0]).join(", "),
  title: FINAL ? "Employee Payroll Management System – Final Report (Review III)" : "Employee Payroll Management System – Review II",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: GREEN, font: FONT }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "000000", font: FONT }, paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  features: { updateFields: true },
  sections: [
    { properties: portrait, children: titlePage },
    { properties: portrait, footers: footer, children: [...sec1, ...sec2, ...sec3] },
    { properties: landscape, footers: footer, children: sec4 },
    { properties: landscape, footers: footer, children: sec5img },
    { properties: portrait, footers: footer, children: FINAL
      ? [...sec5text, ...sec6short, ...sec7short, ...sec8short, ...sec9, ...sec10]
      : [...sec5text, ...sec6, ...sec7, ...sec8, ...sec9, ...sec10] },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, process.env.OUT_NAME || (FINAL ? "Payroll_DBMS_Final_Report_Review3.docx" : "Payroll_DBMS_Review2_Report.docx"));
  fs.writeFileSync(out, buf);
  console.log("wrote", out);
});
