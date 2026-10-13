// (Re)builds the whole database on Supabase and creates demo logins.
//   node setup_db.mjs            -> run all SQL files + demo users
//   node setup_db.mjs --users    -> only (re)create / re-link demo users
// Reads DATABASE_URL and DEMO_PASSWORD from ../.env  (never committed)
import pg from "pg";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const { DATABASE_URL, DEMO_PASSWORD } = process.env;
if (!DATABASE_URL || DATABASE_URL.includes("[YOUR-PASSWORD]")) {
  console.error("DATABASE_URL is missing in .env (paste the Session pooler connection string).");
  process.exit(1);
}
if (!DEMO_PASSWORD) {
  console.error("DEMO_PASSWORD is missing in .env");
  process.exit(1);
}

const FILES = [
  "01_schema.sql",
  "02_functions_procedures.sql",
  "03_triggers.sql",
  "04_seed_data.sql",
  "05_queries.sql",
  "06_supabase_auth_rls.sql",
];

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("connected");

if (!process.argv.includes("--users")) {
  for (const f of FILES) {
    const sql = readFileSync(path.join(ROOT, "sql", f), "utf8");
    try {
      await client.query(sql);
      console.log(`ok   ${f}`);
    } catch (e) {
      console.error(`FAIL ${f}: ${e.message}`);
      await client.end();
      process.exit(1);
    }
  }
}

// Demo login for every employee: e-mail = employee e-mail, shared demo password.
// Inserted straight into Supabase Auth (already confirmed, so no e-mail is sent).
const { rows: emps } = await client.query("SELECT emp_id, email FROM employee ORDER BY emp_id");
let created = 0;
for (const { email } of emps) {
  const exists = await client.query("SELECT id FROM auth.users WHERE lower(email) = lower($1)", [email]);
  if (exists.rowCount) {
    await client.query(
      "UPDATE auth.users SET encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')) WHERE id = $1",
      [exists.rows[0].id, DEMO_PASSWORD]);
    continue;
  }
  await client.query(
    `WITH u AS (
       INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                               raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                               confirmation_token, recovery_token, email_change_token_new, email_change)
       VALUES ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
               lower($1), extensions.crypt($2, extensions.gen_salt('bf')), now(),
               '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
       RETURNING id, email)
     INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
     SELECT gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now()
       FROM u`,
    [email, DEMO_PASSWORD]);
  created++;
}

// Re-link logins to employees (needed after the tables are rebuilt).
const linked = await client.query(
  `UPDATE employee e SET auth_user_id = u.id
     FROM auth.users u
    WHERE lower(u.email) = lower(e.email)`);
console.log(`demo users: ${created} created, ${linked.rowCount} employees linked`);

const { rows } = await client.query(`
  SELECT 'department' t, COUNT(*)::int n FROM department UNION ALL
  SELECT 'designation', COUNT(*) FROM designation UNION ALL
  SELECT 'employee', COUNT(*) FROM employee UNION ALL
  SELECT 'attendance', COUNT(*) FROM attendance UNION ALL
  SELECT 'leave_request', COUNT(*) FROM leave_request UNION ALL
  SELECT 'salary_component', COUNT(*) FROM salary_component UNION ALL
  SELECT 'payroll', COUNT(*) FROM payroll UNION ALL
  SELECT 'payroll_detail', COUNT(*) FROM payroll_detail`);
console.table(rows);
await client.end();
