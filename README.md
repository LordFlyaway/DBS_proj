# Employee Payroll Management System

BCSE302L Database Systems course project. The system runs on a PostgreSQL database hosted on **Supabase**, with a role-based **React** web app deployed on **Vercel**: https://dbs-proj-mauve.vercel.app

The company in the sample data, All Caps Pvt. Ltd., is fictional; its staff are named after rappers and sports stars for fun. The data covers 20 employees, 10 departments, and attendance, leave and payroll for August–October 2026.

## What's inside

| Path | Contents |
|---|---|
| `sql/01_schema.sql` | 8 tables with PK, FK, NOT NULL, UNIQUE, CHECK and DEFAULT constraints |
| `sql/02_functions_procedures.sql` | 4 functions and 3 procedures (2 procedures use explicit cursors) |
| `sql/03_triggers.sql` | 4 triggers |
| `sql/04_seed_data.sql` | Sample data (10+ rows per table); payroll is produced by calling the procedures |
| `sql/05_queries.sql` | 19 queries, each saved as a view (generated from `web/src/queries.js`) |
| `sql/06_supabase_auth_rls.sql` | Login ↔ employee link, Row Level Security per role, `api_*` RPC functions |
| `scripts/` | `test_local.mjs` (runs all SQL in an in-memory PostgreSQL) and `setup_db.mjs` (builds the database on Supabase and creates demo logins) |
| `web/` | React + Vite admin app |
| `diagrams/`, `report/`, `slides/` | ER diagram, relational schema, report and deck |

## Roles

| Role | Can do |
|---|---|
| **Admin** (HR) | Manage employees, departments, designations and attendance; approve any leave; run payroll; see the SQL queries page |
| **Payroll** officer | Manage salary components; generate and pay payroll; delete unpaid payroll; see the SQL queries page |
| **Manager** | View their team; approve or reject the team's leave; view team attendance |
| **Employee** | Check in and out; apply for or cancel leave; view their own attendance and payslips |

Every role also has its own dashboard, leave and payslip pages. The **DB activity** panel (top right) shows the SQL, PL/pgSQL, tables and result of every action.

## Setup

1. Create a Supabase project. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: Supabase → **Connect** → *Session pooler* URI, with your database password
   - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: Supabase → **Project Settings → API**
   - `DEMO_PASSWORD`: the password shared by every demo login
2. Build the database (this drops and re-creates everything, so you can also use it to reset the demo):
   ```bash
   cd scripts
   npm install
   npm run setup:db
   ```
3. Run the web app locally:
   ```bash
   cd web
   npm install
   npm run dev
   ```
4. Deploy to Vercel: import the GitHub repo, set **Root Directory** to `web`, and add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

To test the SQL without Supabase, run `cd scripts && npm run test:local`.

## Demo logins

Every employee can log in with their e-mail and `DEMO_PASSWORD`:

| Role | Name | E-mail |
|---|---|---|
| Admin | Daniel Dumile | daniel.dumile@allcaps.example |
| Payroll | Jeffery Williams | jeffery.williams@allcaps.example |
| Manager | Aubrey Graham | aubrey.graham@allcaps.example |
| Employee | LeBron James | lebron.james@allcaps.example |
