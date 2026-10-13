"""Chen-notation ER diagram for the Employee Payroll Management System."""
import math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse, Rectangle, Polygon

W, H = 200, 112
fig, ax = plt.subplots(figsize=(W * 0.16, H * 0.16))
ax.set_xlim(0, W)
ax.set_ylim(0, H)
ax.set_aspect("equal")
ax.axis("off")

FS = 9
ENT_COLOR, REL_COLOR, ATT_COLOR = "#DCEBFA", "#FCE8C8", "#FFFFFF"
Z_LINE, Z_SHAPE, Z_TEXT = 1, 2, 3

entities = {}


def line(p, q, double=False, style="-"):
    if double:
        dx, dy = q[0] - p[0], q[1] - p[1]
        n = math.hypot(dx, dy) or 1
        ox, oy = -dy / n * 0.35, dx / n * 0.35
        for s in (1, -1):
            ax.plot([p[0] + s * ox, q[0] + s * ox], [p[1] + s * oy, q[1] + s * oy],
                    color="black", lw=1, zorder=Z_LINE, ls=style)
    else:
        ax.plot([p[0], q[0]], [p[1], q[1]], color="black", lw=1, zorder=Z_LINE, ls=style)


def entity(key, label, x, y, w=None, h=4.2):
    w = w or len(label) * 0.78 + 4
    ax.add_patch(Rectangle((x - w / 2, y - h / 2), w, h, fc=ENT_COLOR, ec="black", lw=1.6, zorder=Z_SHAPE))
    ax.text(x, y, label, ha="center", va="center", fontsize=FS + 2, weight="bold", zorder=Z_TEXT)
    entities[key] = (x, y, w, h)
    return (x, y)


def relationship(label, x, y, w=None, h=5.6):
    w = w or max(len(label) * 0.62 + 5, 11)
    pts = [(x - w / 2, y), (x, y + h / 2), (x + w / 2, y), (x, y - h / 2)]
    ax.add_patch(Polygon(pts, closed=True, fc=REL_COLOR, ec="black", lw=1.3, zorder=Z_SHAPE))
    ax.text(x, y, label, ha="center", va="center", fontsize=FS, weight="bold", zorder=Z_TEXT)
    return (x, y)


def attribute(label, x, y, owner, key=False, derived=False, w=None):
    w = w or len(label) * 0.5 + 3
    h = 3.0
    line(owner, (x, y))
    ax.add_patch(Ellipse((x, y), w, h, fc=ATT_COLOR, ec="black", lw=1,
                         ls="--" if derived else "-", zorder=Z_SHAPE))
    t = ax.text(x, y, label, ha="center", va="center", fontsize=FS, zorder=Z_TEXT)
    if key:
        tw = len(label) * 0.43
        ax.plot([x - tw / 2, x + tw / 2], [y - 0.8, y - 0.8], color="black", lw=0.9, zorder=Z_TEXT)
    return (x, y)


def card(ent_key, toward, text):
    """Place a cardinality label just outside the entity box on the line to `toward`."""
    x, y, w, h = entities[ent_key]
    dx, dy = toward[0] - x, toward[1] - y
    t = min((w / 2) / abs(dx) if dx else 1e9, (h / 2) / abs(dy) if dy else 1e9)
    ex, ey = x + dx * t, y + dy * t
    n = math.hypot(dx, dy)
    ex += dx / n * 1.6
    ey += dy / n * 1.6
    ax.text(ex - dy / n * 1.1, ey + dx / n * 1.1, text, ha="center", va="center",
            fontsize=FS + 1, weight="bold", color="#B00020", zorder=Z_TEXT)


def connect(ent_key, rel, text, total=False):
    x, y, _, _ = entities[ent_key]
    line((x, y), rel, double=total)
    card(ent_key, rel, text)


# ------------------------------------------------------------------ entities
EMP = entity("EMP", "EMPLOYEE", 85, 62)
DEPT = entity("DEPT", "DEPARTMENT", 22, 84)
DESIG = entity("DESIG", "DESIGNATION", 22, 42)
ATT = entity("ATT", "ATTENDANCE", 140, 96)
LEAVE = entity("LEAVE", "LEAVE_REQUEST", 150, 62)
PAY = entity("PAY", "PAYROLL", 122, 24)
SAL = entity("SAL", "SALARY_COMPONENT", 178, 24)

# ------------------------------------------------------------- relationships
HEADS = relationship("HEADS", 50, 86)
WORKS = relationship("WORKS_IN", 48, 70)
HOLDS = relationship("HOLDS", 50, 49)
REPORTS = relationship("REPORTS_TO", 85, 90)
MARKS = relationship("MARKS", 118, 86)
APPLIES = relationship("APPLIES", 120, 69)
APPROVES = relationship("APPROVES", 120, 55)
RECEIVES = relationship("RECEIVES", 106, 42)
INCLUDES = relationship("INCLUDES", 150, 24)

connect("DEPT", WORKS, "1")
connect("EMP", WORKS, "N", total=True)
connect("DEPT", HEADS, "1")
connect("EMP", HEADS, "1")
connect("DESIG", HOLDS, "1")
connect("EMP", HOLDS, "N", total=True)
connect("EMP", MARKS, "1")
connect("ATT", MARKS, "N", total=True)
connect("EMP", APPLIES, "1")
connect("LEAVE", APPLIES, "N", total=True)
connect("EMP", APPROVES, "1")
connect("LEAVE", APPROVES, "N")
connect("EMP", RECEIVES, "1")
connect("PAY", RECEIVES, "N", total=True)
connect("PAY", INCLUDES, "M", total=True)
connect("SAL", INCLUDES, "N")

# recursive REPORTS_TO: two lines from EMPLOYEE to the diamond, with role names
ex, ey, ew, eh = entities["EMP"]
line((ex - 4, ey + eh / 2), (REPORTS[0] - 6, REPORTS[1]))
line((ex + 4, ey + eh / 2), (REPORTS[0] + 6, REPORTS[1]))
ax.text(ex - 8.5, ey + 14, "1\n(manager)", ha="center", va="center", fontsize=FS, weight="bold", color="#B00020")
ax.text(ex + 9.5, ey + 16, "N\n(subordinate)", ha="center", va="center", fontsize=FS, weight="bold", color="#B00020")


def polar(owner, angle, r=1.0, rx=22, ry=15):
    a = math.radians(angle)
    return owner[0] + rx * r * math.cos(a), owner[1] + ry * r * math.sin(a)


def att(label, owner, angle, r=1.0, rx=22, ry=15, **kw):
    x, y = polar(owner, angle, r, rx, ry)
    return attribute(label, x, y, owner, **kw)


# ---------------------------------------------------------------- attributes
# DEPARTMENT
D = dict(rx=14, ry=11)
att("dept_id", DEPT, 160, key=True, **D)
att("dept_name", DEPT, 115, **D)
att("location", DEPT, 70, **D)
att("created_on", DEPT, 220, **D)

# DESIGNATION
D = dict(rx=15, ry=11)
att("desig_id", DESIG, 140, key=True, **D)
att("title", DESIG, 185, **D)
att("pay_grade", DESIG, 235, **D)
att("basic_salary", DESIG, 285, **D)
att("annual_leave_quota", DESIG, 330, r=1.15, **D)

# EMPLOYEE (FKs are represented by relationships, not attributes)
attribute("bank_account_no", 59, 93, EMP)
attribute("ifsc_code", 73, 85, EMP)
attribute("status", 63, 59, EMP)
att("emp_id", EMP, 216, r=0.95, key=True)
NAME = att("name", EMP, 228, r=1.55)
attribute("first_name", NAME[0] - 7, NAME[1] - 6, NAME)
attribute("last_name", NAME[0] + 3, NAME[1] - 9, NAME)
att("email", EMP, 240, r=0.95)
att("phone", EMP, 252, r=1.55)
att("gender", EMP, 264, r=0.95)
att("pan_no", EMP, 278, r=1.55)
att("date_of_joining", EMP, 292, r=0.9)
att("dob", EMP, 330, r=1.0)
att("age", EMP, 322, r=1.6, derived=True)

# ATTENDANCE
D = dict(rx=18, ry=10)
att("attendance_id", ATT, 140, key=True, **D)
att("att_date", ATT, 95, **D)
att("check_in", ATT, 50, **D)
att("check_out", ATT, 15, **D)
att("status", ATT, -20, **D)
att("hours_worked", ATT, -55, r=1.1, derived=True, **D)

# LEAVE_REQUEST
D = dict(rx=20, ry=13)
att("leave_id", LEAVE, 115, key=True, **D)
att("leave_type", LEAVE, 75, **D)
att("start_date", LEAVE, 40, **D)
att("end_date", LEAVE, 8, **D)
att("no_of_days", LEAVE, -25, derived=True, **D)
att("reason", LEAVE, -60, **D)
att("status", LEAVE, -95, **D)
att("applied_on", LEAVE, -130, **D)

# PAYROLL
D = dict(rx=24, ry=12)
att("payroll_id", PAY, 100, key=True, **D)
att("generated_on", PAY, 68, **D)
att("status", PAY, 38, **D)
PERIOD = att("pay_period", PAY, 168, **D)
attribute("pay_month", PERIOD[0] - 12, PERIOD[1] + 3, PERIOD)
attribute("pay_year", PERIOD[0] - 12, PERIOD[1] - 3, PERIOD)
att("working_days", PAY, 196, **D)
att("lop_days", PAY, 214, r=1.4, **D)
att("basic_salary", PAY, 230, **D)
att("total_allowances", PAY, 250, r=1.4, **D)
att("gross_salary", PAY, 268, derived=True, **D)
att("total_deductions", PAY, 287, r=1.4, **D)
att("net_salary", PAY, 305, derived=True, **D)
PAYMENT = att("payment", PAY, 330, r=1.1, **D)
attribute("payment_date", PAYMENT[0] - 3, PAYMENT[1] - 8, PAYMENT)
attribute("payment_mode", PAYMENT[0] + 12, PAYMENT[1] - 8, PAYMENT)
attribute("transaction_ref", PAYMENT[0] + 16, PAYMENT[1] - 2, PAYMENT)

# INCLUDES (relationship attribute)
attribute("amount", INCLUDES[0], INCLUDES[1] + 9, INCLUDES)

# SALARY_COMPONENT
D = dict(rx=16, ry=11)
att("component_id", SAL, 125, key=True, **D)
att("component_name", SAL, 80, **D)
att("component_type", SAL, 40, r=1.1, **D)
att("calc_method", SAL, 5, **D)
att("value", SAL, -30, **D)
att("is_taxable", SAL, -70, r=1.0, **D)
att("is_active", SAL, -100, **D)

# ----------------------------------------------------------------- legend
lx, ly = 2, 3
ax.text(lx, ly + 9, "Legend", fontsize=FS + 1, weight="bold")
ax.text(lx, ly + 6, "Underlined = primary key    Dashed oval = derived attribute", fontsize=FS)
ax.text(lx, ly + 3, "Double line = total participation    Oval linked to oval = composite attribute", fontsize=FS)
ax.text(lx, ly, "1 / N / M = cardinality ratio", fontsize=FS)

ax.set_title("ER Diagram - Employee Payroll Management System (Chen Notation)",
             fontsize=16, weight="bold", pad=6)
fig.savefig("er_diagram.png", dpi=150, bbox_inches="tight", facecolor="white")
print("saved er_diagram.png")
