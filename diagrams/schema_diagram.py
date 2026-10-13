"""Relational schema diagram (tables, PK/FK, reference arrows)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch

W, H = 150, 92
fig, ax = plt.subplots(figsize=(W * 0.16, H * 0.16))
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.set_aspect("equal")
ax.axis("off")

ROW, HEAD, FS = 2.3, 3.0, 9
tables = {
    "department": (4, 84, [("dept_id", "PK"), ("dept_name", "UQ"), ("location", ""),
                           ("head_emp_id", "FK"), ("created_on", "")]),
    "designation": (4, 52, [("desig_id", "PK"), ("title", "UQ"), ("pay_grade", ""),
                            ("basic_salary", ""), ("annual_leave_quota", "")]),
    "employee": (40, 88, [("emp_id", "PK"), ("first_name", ""), ("last_name", ""), ("email", "UQ"),
                          ("phone", "UQ"), ("gender", ""), ("dob", ""), ("date_of_joining", ""),
                          ("pan_no", "UQ"), ("bank_account_no", "UQ"), ("ifsc_code", ""), ("status", ""),
                          ("dept_id", "FK"), ("desig_id", "FK"), ("reports_to", "FK")]),
    "attendance": (80, 88, [("attendance_id", "PK"), ("emp_id", "FK"), ("att_date", ""),
                            ("check_in", ""), ("check_out", ""), ("status", "")]),
    "leave_request": (80, 64, [("leave_id", "PK"), ("emp_id", "FK"), ("leave_type", ""),
                               ("start_date", ""), ("end_date", ""), ("reason", ""), ("status", ""),
                               ("applied_on", ""), ("approved_by", "FK")]),
    "payroll": (40, 44, [("payroll_id", "PK"), ("emp_id", "FK"), ("pay_month", ""), ("pay_year", ""),
                         ("working_days", ""), ("lop_days", ""), ("basic_salary", ""),
                         ("total_allowances", ""), ("total_deductions", ""), ("gross_salary", ""),
                         ("net_salary", ""), ("status", ""), ("generated_on", ""), ("payment_date", ""),
                         ("payment_mode", ""), ("transaction_ref", "UQ")]),
    "payroll_detail": (80, 30, [("payroll_id", "PK, FK"), ("component_id", "PK, FK"), ("amount", "")]),
    "salary_component": (116, 30, [("component_id", "PK"), ("component_name", "UQ"),
                                   ("component_type", ""), ("calc_method", ""), ("value", ""),
                                   ("is_taxable", ""), ("is_active", "")]),
}
TW = 28
pos = {}  # (table, col) -> (left_x, right_x, y)

for name, (x, top, cols) in tables.items():
    h = HEAD + ROW * len(cols)
    ax.add_patch(Rectangle((x, top - h), TW, h, fc="white", ec="#1F3B5C", lw=1.4, zorder=2))
    ax.add_patch(Rectangle((x, top - HEAD), TW, HEAD, fc="#1F3B5C", ec="#1F3B5C", lw=1.4, zorder=3))
    ax.text(x + TW / 2, top - HEAD / 2, name.upper(), color="white", ha="center", va="center",
            fontsize=FS + 1, weight="bold", zorder=4)
    for i, (col, tag) in enumerate(cols):
        y = top - HEAD - ROW * (i + 0.5)
        if "PK" in tag:
            ax.add_patch(Rectangle((x, y - ROW / 2), TW, ROW, fc="#FFF4D6", ec="none", zorder=2.5))
        ax.text(x + 1, y, col, ha="left", va="center", fontsize=FS, zorder=4,
                weight="bold" if "PK" in tag else "normal",
                style="italic" if "FK" in tag and "PK" not in tag else "normal")
        if tag:
            ax.text(x + TW - 1, y, tag, ha="right", va="center", fontsize=FS - 1, zorder=4,
                    color="#B00020" if "FK" in tag else "#555555", weight="bold")
        pos[(name, col)] = (x, x + TW, y)


def route(src_t, src_c, dst_t, dst_c, lane, src_side, dst_side):
    """Orthogonal FK connector: leave the source column on src_side, run along x=lane,
    enter the referenced key on dst_side."""
    sl, sr, sy = pos[(src_t, src_c)]
    dl, dr, dy = pos[(dst_t, dst_c)]
    sx = sl if src_side == "L" else sr
    dx = dl if dst_side == "L" else dr
    pts = [(sx, sy), (lane, sy), (lane, dy)]
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color="#2E6DB4", lw=1.2, zorder=1, solid_joinstyle="round")
    ax.plot([sx], [sy], "o", color="#2E6DB4", ms=4, zorder=5)
    ax.add_patch(FancyArrowPatch((lane, dy), (dx, dy), arrowstyle="-|>", mutation_scale=13,
                                 lw=1.2, color="#2E6DB4", zorder=5, shrinkA=0, shrinkB=0))


route("employee", "dept_id", "department", "dept_id", 36.5, "L", "R")
route("department", "head_emp_id", "employee", "emp_id", 34, "R", "L")
route("employee", "desig_id", "designation", "desig_id", 35, "L", "R")
route("employee", "reports_to", "employee", "emp_id", 70, "R", "R")
route("payroll", "emp_id", "employee", "emp_id", 72, "R", "R")
route("leave_request", "approved_by", "employee", "emp_id", 74, "L", "R")
route("leave_request", "emp_id", "employee", "emp_id", 76, "L", "R")
route("attendance", "emp_id", "employee", "emp_id", 78, "L", "R")
route("payroll_detail", "payroll_id", "payroll", "payroll_id", 75, "L", "R")
route("payroll_detail", "component_id", "salary_component", "component_id", 112, "R", "L")

ax.text(84, 8, "PK = primary key    FK = foreign key    UQ = unique", fontsize=FS + 1)
ax.text(84, 5, "Dot = referencing (FK) column;  arrow = referenced primary key", fontsize=FS + 1)
ax.set_title("Relational Schema - Employee Payroll Management System", fontsize=16, weight="bold")
fig.savefig("relational_schema.png", dpi=150, bbox_inches="tight", facecolor="white")
print("saved relational_schema.png")
