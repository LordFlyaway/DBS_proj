// Builds the Review I project report (Word) for the Employee Payroll Management System.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, ImageRun, TableLayoutType, PageBreak, PageOrientation, LevelFormat, BorderStyle,
  Footer, PageNumber, TableOfContents,
} = require("docx");

const DIAG = path.join(__dirname, "..", "diagrams");
const FONT = "Calibri";
const NAVY = "1F3B5C";

// ---------------------------------------------------------------- helpers
const p = (text, opts = {}) =>
  new Paragraph({ spacing: { after: 120, line: 300 }, alignment: opts.align, children: runs(text, opts) });

function runs(text, opts = {}) {
  if (Array.isArray(text)) return text;
  return [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size, color: opts.color })];
}

const h1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = (text, level = 0) =>
  new Paragraph({ numbering: { reference: "bullets", level }, spacing: { after: 60, line: 280 }, children: runs(text) });
const numbered = (text) =>
  new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60, line: 280 }, children: runs(text) });
const b = (t) => new TextRun({ text: t, bold: true });
const t = (s) => new TextRun(s);
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const border = { style: BorderStyle.SINGLE, size: 4, color: "9AA9BC" };
const borders = { top: border, bottom: border, left: border, right: border };

function table(headers, rows, widths) {
  const total = widths.reduce((a, c) => a + c, 0);
  const cell = (content, w, header) =>
    new TableCell({
      borders,
      width: { size: w, type: WidthType.DXA },
      shading: header ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: (Array.isArray(content) && content[0] instanceof Paragraph)
        ? content
        : [new Paragraph({
            children: Array.isArray(content)
              ? content
              : [new TextRun({ text: String(content), bold: header, color: header ? "FFFFFF" : undefined, size: 20 })],
          })],
    });
  return new Table({
    width: { size: total, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) })),
    ],
  });
}

const caption = (text) =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200 },
    children: [new TextRun({ text, italics: true, size: 20, color: "555555" })] });

function image(file, w, h) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(DIAG, file)),
      transformation: { width: w, height: h } })],
  });
}

// relational schema line: name(PK underlined, FK italic)
function schemaLine(name, cols) {
  const children = [new TextRun({ text: name.toUpperCase(), bold: true }), t(" (")];
  cols.forEach((c, i) => {
    const [col, tag] = c.split(":");
    children.push(new TextRun({
      text: col,
      underline: tag && tag.includes("PK") ? {} : undefined,
      italics: tag && tag.includes("FK"),
      bold: tag && tag.includes("PK"),
    }));
    if (i < cols.length - 1) children.push(t(", "));
  });
  children.push(t(")"));
  return new Paragraph({ spacing: { after: 140, line: 280 }, children });
}

// ---------------------------------------------------------------- content
const titlePage = [
  new Paragraph({ spacing: { before: 1800 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "School of Computer Science Engineering and Information Systems", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
    children: [new TextRun({ text: "BCSE302L – Database Systems | Course Project", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
    children: [new TextRun({ text: "EMPLOYEE PAYROLL MANAGEMENT SYSTEM", bold: true, size: 44, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 },
    children: [new TextRun({ text: "Review I – Problem Analysis & Database Design", size: 28, color: "444444" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [b("Submitted by")] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "<Student Name>  –  <Register Number>", highlight: "yellow" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [b("Under the guidance of")] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "<Faculty Name>", highlight: "yellow" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [t("October 2026")] }),
  pageBreak(),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Contents")] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  p([new TextRun({ text: "(Right-click the table above and choose “Update Field” in Word to refresh page numbers.)", italics: true, size: 18, color: "777777" })]),
  pageBreak(),
];

const intro = [
  h1("1. Introduction and Problem Statement"),
  h2("1.1 Introduction"),
  p("Every organisation must pay its employees accurately and on time every month. Salary is not a single fixed number: it depends on the employee’s designation and basic pay, statutory allowances (HRA, DA), deductions (Provident Fund, Professional Tax, Income Tax/TDS), the number of days actually worked, and approved or unapproved leave. In many small and medium organisations this is still handled in spreadsheets, which leads to calculation errors, duplicate records, no audit trail and no easy way to answer questions such as “What is the total salary cost of the Sales department this month?”."),
  p("The Employee Payroll Management System is a relational database application, hosted on a cloud PostgreSQL database (Supabase), with a web-based admin panel. It stores employee, department, attendance, leave and salary-structure data, and generates monthly payroll and payslips from that data automatically using SQL and PL/pgSQL (procedures, functions, cursors and triggers)."),
  h2("1.2 Problem Statement"),
  p("Design and implement a centralised, consistent and secure database that (a) maintains employee and organisational data, (b) records daily attendance and leave, (c) defines salary components such as allowances and deductions, and (d) computes each employee’s monthly gross and net salary, including loss-of-pay (LOP) for unpaid absences, while enforcing business rules through database constraints and triggers instead of manual checks."),
  h2("1.3 Objectives"),
  bullet("Maintain a single source of truth for employees, departments and designations, with no duplicate or inconsistent data."),
  bullet("Record attendance and leave, and automatically compute loss-of-pay days for each month."),
  bullet("Define configurable salary components (fixed or percentage-based allowances and deductions)."),
  bullet("Generate the monthly payroll for all active employees in one operation, with an itemised payslip."),
  bullet("Enforce data integrity with PK/FK, NOT NULL, UNIQUE, CHECK and DEFAULT constraints and triggers."),
  bullet("Provide an admin web interface connected to the database for interactive INSERT, UPDATE, DELETE and reporting."),
  h2("1.4 Users of the System"),
  table(["User / Role", "Responsibilities in the system"], [
    ["HR Administrator", "Adds and updates departments, designations and employees; records attendance; manages employee status (resigned, terminated)."],
    ["Payroll Officer (Accounts)", "Maintains salary components, runs the monthly payroll, marks salaries as paid and records payment details."],
    ["Reporting Manager", "Approves or rejects leave requests of employees who report to them."],
    ["Employee (read-only view)", "Views own attendance, leave status and payslips; applies for leave."],
  ], [2600, 6426]),
  h2("1.5 Scope"),
  p([b("In scope: "), t("employee master data, department and designation hierarchy, reporting structure, daily attendance, leave requests and approval, salary components, monthly payroll generation, payslip line items, payment records and management reports.")]),
  p([b("Out of scope: "), t("actual bank fund transfers, full income-tax computation under the different tax regimes, recruitment, performance appraisal, and biometric hardware integration. TDS is modelled as a simple percentage deduction.")]),
  pageBreak(),
];

const reqs = [
  h1("2. Requirement Analysis"),
  h2("2.1 Functional Requirements"),
  table(["ID", "Requirement", "Tables involved"], [
    ["FR1", "Add, update, deactivate and view departments, including the department head.", "DEPARTMENT, EMPLOYEE"],
    ["FR2", "Maintain designations with pay grade, basic salary and annual leave quota.", "DESIGNATION"],
    ["FR3", "Register a new employee with personal, statutory (PAN) and bank details, and assign department, designation and reporting manager.", "EMPLOYEE"],
    ["FR4", "Record daily attendance (check-in, check-out, status); only one record per employee per day.", "ATTENDANCE"],
    ["FR5", "Employee applies for leave; manager approves or rejects. Approved leave is reflected in attendance automatically.", "LEAVE_REQUEST, ATTENDANCE"],
    ["FR6", "Define allowances and deductions as a fixed amount or a percentage of basic salary.", "SALARY_COMPONENT"],
    ["FR7", "Generate payroll for a given month and year for every active employee, calculating LOP days, gross and net salary.", "PAYROLL, PAYROLL_DETAIL, ATTENDANCE, LEAVE_REQUEST"],
    ["FR8", "Store an itemised payslip (amount of each component) for every payroll record.", "PAYROLL_DETAIL"],
    ["FR9", "Mark payroll as paid with payment date, mode and transaction reference.", "PAYROLL"],
    ["FR10", "Prevent invalid operations: duplicate payroll for the same month, editing a paid payroll, self-approval of leave.", "All (constraints + triggers)"],
    ["FR11", "Reports: department-wise salary cost, attendance summary, leave balance, top earners, employees under a manager.", "All"],
    ["FR12", "Web admin panel connected to the database for all of the above operations.", "All"],
  ], [800, 5600, 2626]),
  h2("2.2 Non-Functional Requirements"),
  bullet([b("Integrity: "), t("all business rules that can be expressed declaratively are enforced as constraints in the database, not only in the UI.")]),
  bullet([b("Security: "), t("the database is accessed through Supabase with Row Level Security; only authenticated admins can modify data.")]),
  bullet([b("Availability: "), t("cloud-hosted PostgreSQL, so the admin panel works from any browser.")]),
  bullet([b("Auditability: "), t("payroll figures are stored as a monthly snapshot, so past payslips do not change if salary rules change later.")]),
  h2("2.3 Entities and Attributes"),
  p("Seven entity types were identified. Primary keys are shown in bold. Derived attributes are calculated and marked (D); composite attributes are marked (C)."),
  table(["Entity", "Description", "Attributes"], [
    ["DEPARTMENT", "An organisational unit of the company.", [new TextRun({ text: "dept_id", bold: true }), t(", dept_name, location, created_on")]],
    ["DESIGNATION", "A job title with its pay grade and basic pay.", [new TextRun({ text: "desig_id", bold: true }), t(", title, pay_grade, basic_salary, annual_leave_quota")]],
    ["EMPLOYEE", "A person employed by the company.", [new TextRun({ text: "emp_id", bold: true }), t(", name (C: first_name, last_name), email, phone, gender, dob, age (D), date_of_joining, pan_no, bank_account_no, ifsc_code, status")]],
    ["ATTENDANCE", "Attendance of one employee on one day.", [new TextRun({ text: "attendance_id", bold: true }), t(", att_date, check_in, check_out, status, hours_worked (D)")]],
    ["LEAVE_REQUEST", "A leave application and its approval status.", [new TextRun({ text: "leave_id", bold: true }), t(", leave_type, start_date, end_date, no_of_days (D), reason, status, applied_on")]],
    ["SALARY_COMPONENT", "An allowance or deduction rule.", [new TextRun({ text: "component_id", bold: true }), t(", component_name, component_type, calc_method, value, is_taxable, is_active")]],
    ["PAYROLL", "The salary record of one employee for one month.", [new TextRun({ text: "payroll_id", bold: true }), t(", pay_period (C: pay_month, pay_year), working_days, lop_days, basic_salary, total_allowances, total_deductions, gross_salary (D), net_salary (D), status, generated_on, payment (C: payment_date, payment_mode, transaction_ref)")]],
  ], [2000, 2700, 4326]),
  h2("2.4 Relationships and Cardinality"),
  table(["Relationship", "Entities", "Cardinality", "Participation", "Meaning"], [
    ["WORKS_IN", "DEPARTMENT – EMPLOYEE", "1 : N", "Employee total", "Every employee belongs to exactly one department."],
    ["HEADS", "EMPLOYEE – DEPARTMENT", "1 : 1", "Partial both", "A department may have one head; an employee heads at most one department."],
    ["HOLDS", "DESIGNATION – EMPLOYEE", "1 : N", "Employee total", "Every employee has exactly one designation."],
    ["REPORTS_TO", "EMPLOYEE – EMPLOYEE (recursive)", "1 : N", "Partial", "A manager supervises many employees; each employee has at most one manager."],
    ["MARKS", "EMPLOYEE – ATTENDANCE", "1 : N", "Attendance total", "Each attendance row belongs to one employee."],
    ["APPLIES", "EMPLOYEE – LEAVE_REQUEST", "1 : N", "Leave total", "An employee can apply for many leaves."],
    ["APPROVES", "EMPLOYEE – LEAVE_REQUEST", "1 : N", "Partial", "A manager approves many leave requests; a pending request has no approver yet."],
    ["RECEIVES", "EMPLOYEE – PAYROLL", "1 : N", "Payroll total", "An employee receives one payroll record per month."],
    ["INCLUDES", "PAYROLL – SALARY_COMPONENT", "M : N", "Payroll total", "A payroll has many components; a component appears in many payrolls. Attribute: amount."],
  ], [1400, 2050, 1250, 1350, 2976]),
  pageBreak(),
];

const landscapeER = [
  h1("3. ER Diagram"),
  image("er_diagram.png", 900, 516),
  caption("Figure 1 – ER diagram (Chen notation). Underlined: primary key; dashed oval: derived; double line: total participation."),
];

const landscapeSchema = [
  h1("4. Relational Schema"),
  image("relational_schema.png", 860, 543),
  caption("Figure 2 – Relational schema with primary keys and foreign-key references"),
];

const mapping = [
  h2("4.1 Relational Schema (text notation)"),
  p([t("Primary keys are "), new TextRun({ text: "bold and underlined", bold: true, underline: {} }), t("; foreign keys are "), new TextRun({ text: "italic", italics: true }), t(".")]),
  schemaLine("department", ["dept_id:PK", "dept_name", "location", "head_emp_id:FK", "created_on"]),
  schemaLine("designation", ["desig_id:PK", "title", "pay_grade", "basic_salary", "annual_leave_quota"]),
  schemaLine("employee", ["emp_id:PK", "first_name", "last_name", "email", "phone", "gender", "dob", "date_of_joining", "pan_no", "bank_account_no", "ifsc_code", "status", "dept_id:FK", "desig_id:FK", "reports_to:FK"]),
  schemaLine("attendance", ["attendance_id:PK", "emp_id:FK", "att_date", "check_in", "check_out", "status"]),
  schemaLine("leave_request", ["leave_id:PK", "emp_id:FK", "leave_type", "start_date", "end_date", "reason", "status", "applied_on", "approved_by:FK"]),
  schemaLine("salary_component", ["component_id:PK", "component_name", "component_type", "calc_method", "value", "is_taxable", "is_active"]),
  schemaLine("payroll", ["payroll_id:PK", "emp_id:FK", "pay_month", "pay_year", "working_days", "lop_days", "basic_salary", "total_allowances", "total_deductions", "gross_salary", "net_salary", "status", "generated_on", "payment_date", "payment_mode", "transaction_ref"]),
  schemaLine("payroll_detail", ["payroll_id:PK,FK", "component_id:PK,FK", "amount"]),
  h2("4.2 Foreign Keys"),
  table(["Foreign key", "References", "On delete", "Reason"], [
    ["employee.dept_id", "department.dept_id", "Restrict", "Cannot delete a department that still has employees."],
    ["employee.desig_id", "designation.desig_id", "Restrict", "Cannot delete a designation in use."],
    ["employee.reports_to", "employee.emp_id", "Set null", "If a manager leaves, subordinates remain without a manager."],
    ["department.head_emp_id", "employee.emp_id", "Set null", "Department survives if its head is removed."],
    ["attendance.emp_id", "employee.emp_id", "Cascade", "Attendance has no meaning without the employee."],
    ["leave_request.emp_id", "employee.emp_id", "Cascade", "Leave belongs to the employee."],
    ["leave_request.approved_by", "employee.emp_id", "Set null", "Keep the leave record even if the approver leaves."],
    ["payroll.emp_id", "employee.emp_id", "Restrict", "Salary history must never be lost (employees are marked Resigned, not deleted)."],
    ["payroll_detail.payroll_id", "payroll.payroll_id", "Cascade", "Line items are deleted with their payroll."],
    ["payroll_detail.component_id", "salary_component.component_id", "Restrict", "A component used in a payslip cannot be deleted (it is deactivated instead)."],
  ], [2950, 2950, 1050, 2076]),
  h2("4.3 ER to Relational Mapping Steps"),
  numbered([b("Strong entities → tables. "), t("Each of the 7 entities became a table with a surrogate primary key (SERIAL).")]),
  numbered([b("Composite attributes → simple columns. "), t("name → first_name, last_name; pay_period → pay_month, pay_year; payment → payment_date, payment_mode, transaction_ref.")]),
  numbered([b("Derived attributes. "), t("age, hours_worked and no_of_days are not stored; they are calculated in queries or functions. gross_salary and net_salary are stored on purpose as a monthly snapshot, so that old payslips stay correct after salary rules change.")]),
  numbered([b("1:N relationships → FK on the N side. "), t("WORKS_IN → employee.dept_id; HOLDS → employee.desig_id; MARKS, APPLIES, RECEIVES → emp_id in attendance, leave_request and payroll; APPROVES → leave_request.approved_by.")]),
  numbered([b("Recursive 1:N (REPORTS_TO) → self-referencing FK "), t("employee.reports_to → employee.emp_id.")]),
  numbered([b("1:1 relationship (HEADS) → FK with UNIQUE "), t("department.head_emp_id, placed on the DEPARTMENT side because each department has at most one head, so this column has the fewest NULLs.")]),
  numbered([b("M:N relationship (INCLUDES) → new table "), t("payroll_detail(payroll_id, component_id, amount) with a composite primary key made of both foreign keys. The relationship attribute amount becomes a column of this table.")]),
  pageBreak(),
];

const constraints = [
  h1("5. Table Creation and Constraints"),
  p("The full DDL is in sql/01_schema.sql (PostgreSQL / Supabase). The table below summarises the constraints and the business rule each one enforces."),
  table(["Table", "Key constraints", "NOT NULL / UNIQUE / CHECK / DEFAULT"], [
    ["DEPARTMENT", "PK dept_id; FK head_emp_id (UNIQUE)", "dept_name UNIQUE NOT NULL; created_on DEFAULT CURRENT_DATE"],
    ["DESIGNATION", "PK desig_id", "title UNIQUE; pay_grade IN (G1–G5); basic_salary > 0; annual_leave_quota DEFAULT 24, CHECK 0–60"],
    ["EMPLOYEE", "PK emp_id; FK dept_id, desig_id, reports_to", "email, phone, pan_no, bank_account_no UNIQUE; phone matches ^[6-9][0-9]{9}$; PAN format ^[A-Z]{5}[0-9]{4}[A-Z]$; IFSC format; gender IN (M,F,O); status DEFAULT 'Active'; joining age ≥ 18; employee cannot report to self"],
    ["ATTENDANCE", "PK attendance_id; FK emp_id", "UNIQUE (emp_id, att_date); status IN (Present, Absent, Half-Day, Leave) DEFAULT 'Present'; check_out > check_in"],
    ["LEAVE_REQUEST", "PK leave_id; FK emp_id, approved_by", "leave_type IN (Casual, Sick, Earned, Unpaid); end_date ≥ start_date; status DEFAULT 'Pending'; approver ≠ applicant"],
    ["SALARY_COMPONENT", "PK component_id", "component_name UNIQUE; type IN (Allowance, Deduction); calc_method IN (Fixed, Percent); value ≥ 0 and ≤ 100 when Percent; is_taxable, is_active DEFAULT TRUE"],
    ["PAYROLL", "PK payroll_id; FK emp_id", "UNIQUE (emp_id, pay_month, pay_year); month 1–12; lop_days ≤ working_days; net_salary ≥ 0; status DEFAULT 'Generated'; a ‘Paid’ row must have payment_date and payment_mode; transaction_ref UNIQUE"],
    ["PAYROLL_DETAIL", "PK (payroll_id, component_id); both FK", "amount ≥ 0"],
  ], [1900, 2600, 4526]),
  h2("5.1 Normalisation"),
  p("All tables are in Third Normal Form (3NF). Every non-key attribute depends on the whole key and nothing but the key:"),
  bullet("Department and designation details are stored once and referenced by FK, not repeated in every employee row (removes update anomalies)."),
  bullet("Salary component rules are separate from payslip line items, so a change in HRA percentage does not require editing old payslips."),
  bullet("payroll_detail has a composite key, and its only non-key attribute (amount) depends on the full key (payroll and component), so there is no partial dependency."),
  bullet("Age is not stored because it depends on dob and the current date (it would become a transitive or stale value)."),
  pageBreak(),
];

const plan = [
  h1("6. System Architecture and Planned Implementation"),
  h2("6.1 Technology Stack"),
  table(["Layer", "Technology", "Purpose"], [
    ["Database", "PostgreSQL 15 on Supabase (cloud)", "Tables, constraints, SQL queries, PL/pgSQL procedures, functions, cursor and triggers"],
    ["Connectivity", "supabase-js client (JavaScript) / PostgREST API", "Application ↔ database communication; procedures and functions are called through RPC"],
    ["Front end", "Web admin panel (HTML/CSS/JavaScript)", "Forms and tables for HR and payroll operations, reports and payslips"],
    ["Security", "Supabase Auth + Row Level Security", "Only signed-in administrators can modify data"],
  ], [1700, 3300, 4026]),
  h2("6.2 Interactive Flow"),
  p("User operation (web form) → SQL / PL/pgSQL call (supabase-js) → database processing (constraints, triggers, procedures) → database update or retrieval → result shown on the admin panel."),
  h2("6.3 Planned Database Programs (Review II)"),
  table(["Component", "Name", "Business purpose"], [
    ["Procedure", "generate_monthly_payroll(month, year)", "Uses a cursor over all active employees to compute LOP, allowances, deductions, gross and net salary; inserts PAYROLL and PAYROLL_DETAIL rows."],
    ["Procedure", "process_leave(leave_id, approver_id, decision)", "Approves or rejects a leave request after checking the leave balance."],
    ["Function", "fn_lop_days(emp_id, month, year)", "Returns the number of unpaid (loss-of-pay) days in a month."],
    ["Function", "fn_component_amount(component_id, basic)", "Returns the amount of a fixed or percentage component for a given basic salary."],
    ["Function", "fn_leave_balance(emp_id, year)", "Returns the remaining annual leave of an employee."],
    ["Cursor", "inside generate_monthly_payroll", "Processes employees one record at a time."],
    ["Trigger", "trg_leave_approved", "When a leave is approved, inserts ‘Leave’ rows into ATTENDANCE for each day in the range."],
    ["Trigger", "trg_lock_paid_payroll", "Blocks UPDATE or DELETE of a payroll that is already Paid."],
    ["Trigger", "trg_validate_manager", "Ensures reports_to refers to an active employee in the same department."],
  ], [1400, 3300, 4326]),
  h1("7. Conclusion"),
  p("This review defined the problem, users and scope of the Employee Payroll Management System, identified 7 entities and 9 relationships (including a recursive, a 1:1 and an M:N relationship), and converted the ER model into 8 relational tables in Third Normal Form, with complete primary key, foreign key and integrity constraints. The schema has been written as PostgreSQL DDL for Supabase. The next phase will add sample data (at least 10 rows per table), the 15+ SQL queries, the PL/pgSQL procedures, functions, cursor and triggers listed above, and the web admin panel that connects to the database."),
];

// ---------------------------------------------------------------- document
const portrait = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1300, left: 1440, right: 1440 } } };
const landscape = { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } };
const footer = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], size: 18, color: "777777" })] })] }) };

const doc = new Document({
  creator: "Employee Payroll Management System",
  title: "Employee Payroll Management System – Review I",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: NAVY, font: FONT }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0, keepNext: true } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "2E6DB4", font: FONT }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  features: { updateFields: true },
  sections: [
    { properties: portrait, children: titlePage },
    { properties: portrait, footers: footer, children: [...intro, ...reqs] },
    { properties: landscape, footers: footer, children: landscapeER },
    { properties: landscape, footers: footer, children: landscapeSchema },
    { properties: portrait, footers: footer, children: [...mapping, ...constraints, ...plan] },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, "Payroll_DBMS_Review1_Report.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out);
});
