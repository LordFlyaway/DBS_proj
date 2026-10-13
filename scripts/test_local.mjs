// Runs the SQL files against an in-memory PostgreSQL (PGlite) to test them
// without touching Supabase.  Usage: node test_local.mjs ["SELECT ..."]
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SQL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sql");
const FILES = [
  "01_schema.sql",
  "02_functions_procedures.sql",
  "03_triggers.sql",
  "04_seed_data.sql",
  "05_queries.sql",
];

const db = new PGlite();
for (const f of FILES) {
  let sql;
  try { sql = readFileSync(path.join(SQL_DIR, f), "utf8"); } catch { console.log(`skip ${f}`); continue; }
  try {
    await db.exec(sql);
    console.log(`ok   ${f}`);
  } catch (e) {
    console.error(`FAIL ${f}: ${e.message}`);
    process.exit(1);
  }
}

const counts = await db.query(`
  SELECT 'department' t, COUNT(*) n FROM department UNION ALL
  SELECT 'designation', COUNT(*) FROM designation UNION ALL
  SELECT 'employee', COUNT(*) FROM employee UNION ALL
  SELECT 'attendance', COUNT(*) FROM attendance UNION ALL
  SELECT 'leave_request', COUNT(*) FROM leave_request UNION ALL
  SELECT 'salary_component', COUNT(*) FROM salary_component UNION ALL
  SELECT 'payroll', COUNT(*) FROM payroll UNION ALL
  SELECT 'payroll_detail', COUNT(*) FROM payroll_detail`);
console.table(counts.rows);

for (const q of process.argv.slice(2)) {
  try {
    const r = await db.query(q);
    console.log(q);
    console.table(r.rows);
  } catch (e) {
    console.error(`ERROR in "${q}": ${e.message}`);
  }
}
