const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const money = (v) => (v === null || v === undefined || v === "" ? "—" : inr.format(Number(v)));
export const money0 = (v) => (v === null || v === undefined || v === "" ? "—" : inr0.format(Number(v)));

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

export const monthName = (m) => MONTHS[m - 1];

export function date(d) {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export const time = (t) => (t ? String(t).slice(0, 5) : "—");

export function hoursBetween(a, b) {
  if (!a || !b) return null;
  const toMin = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };
  return ((toMin(b) - toMin(a)) / 60).toFixed(1);
}

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function monthRange(month, year) {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return [`${year}-${mm}-01`, `${year}-${mm}-${String(last).padStart(2, "0")}`];
}

export const fullName = (e) => (e ? `${e.first_name} ${e.last_name}` : "—");

/** Pretty-print a generic value coming from a query view. */
export function cell(key, v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (/salary|gross|net|deduction|allowance|amount|total|lost|cost/i.test(key) && !isNaN(Number(v))) return money(v);
  if (/date|_on$/.test(key) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return date(v);
  return String(v);
}
