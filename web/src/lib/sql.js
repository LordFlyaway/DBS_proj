// Builds readable SQL text for the activity log (display only - the real
// statement is sent by supabase-js / PostgREST with bound parameters).
const lit = (v) =>
  v === null || v === undefined || v === "" ? "NULL"
    : typeof v === "number" || typeof v === "boolean" ? String(v)
    : `'${String(v).replace(/'/g, "''")}'`;

export function sqlInsert(table, row) {
  const cols = Object.keys(row);
  return `INSERT INTO ${table} (${cols.join(", ")})\nVALUES (${cols.map((c) => lit(row[c])).join(", ")});`;
}

export function sqlUpdate(table, row, where) {
  const sets = Object.entries(row).map(([k, v]) => `${k} = ${lit(v)}`).join(",\n       ");
  return `UPDATE ${table}\n   SET ${sets}\n WHERE ${whereText(where)};`;
}

export function sqlDelete(table, where) {
  return `DELETE FROM ${table} WHERE ${whereText(where)};`;
}

const whereText = (where) => Object.entries(where).map(([k, v]) => `${k} = ${lit(v)}`).join(" AND ");

/** Empty strings from form inputs become NULL; numeric fields become numbers. */
export function clean(row, numeric = []) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === "" || v === undefined) out[k] = null;
    else if (numeric.includes(k)) out[k] = Number(v);
    else out[k] = v;
  }
  return out;
}
