// Generates sql/05_queries.sql (one view per query) from web/src/queries.js
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { QUERIES } = await import(pathToFileURL(path.join(ROOT, "web", "src", "queries.js")).href);

let out = `-- =====================================================================
--  Employee Payroll Management System
--  File : 05_queries.sql   (${QUERIES.length} queries, each saved as a view)
--  GENERATED from web/src/queries.js by scripts/gen_queries.mjs - edit there.
--  security_invoker = true: a view runs with the permissions of the user
--  who queries it, so Row Level Security still applies through the view.
-- =====================================================================
`;
for (const q of QUERIES) {
  out += `
-- Q${q.id}. ${q.title}
--      Concepts: ${q.concepts.join(", ")}
DROP VIEW IF EXISTS ${q.view};
CREATE VIEW ${q.view} WITH (security_invoker = true) AS
${q.sql};
`;
}
writeFileSync(path.join(ROOT, "sql", "05_queries.sql"), out);
console.log(`wrote sql/05_queries.sql with ${QUERIES.length} views`);
