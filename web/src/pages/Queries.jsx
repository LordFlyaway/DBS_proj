import { useState } from "react";
import { supabase } from "../lib/supabase";
import { run } from "../lib/activity";
import { QUERIES } from "../queries";
import { PageHeader, Card, SqlBlock, ErrorBox, Loading } from "../components/ui";
import { cell } from "../lib/format";

export default function Queries() {
  const [selected, setSelected] = useState(QUERIES[0]);
  const [result, setResult] = useState({});
  const [busy, setBusy] = useState(false);

  async function execute(q) {
    setBusy(true);
    const t0 = performance.now();
    try {
      const rows = await run({ action: `Run Q${q.id}`, component: `VIEW ${q.view}`, tables: [], sql: `SELECT * FROM ${q.view};` },
        () => supabase.from(q.view).select("*"));
      setResult((r) => ({ ...r, [q.id]: { rows, ms: Math.round(performance.now() - t0) } }));
    } catch (e) {
      setResult((r) => ({ ...r, [q.id]: { error: e.message } }));
    }
    setBusy(false);
  }

  function pick(q) {
    setSelected(q);
    if (!result[q.id]) execute(q);
  }

  const res = result[selected.id];
  const cols = res?.rows?.[0] ? Object.keys(res.rows[0]) : [];
  return (
    <>
      <PageHeader title="SQL queries" subtitle={`${QUERIES.length} queries, each stored as a view in 05_queries.sql. Pick one to run it live.`} />
      <div className="queries">
        <nav className="query-list" aria-label="Queries">
          {QUERIES.map((q) => (
            <button key={q.id} className={`query-item ${q.id === selected.id ? "active" : ""}`} onClick={() => pick(q)}>
              <span className="query-no">Q{q.id}</span>
              <span>{q.title}</span>
            </button>
          ))}
        </nav>
        <div className="query-main">
          <Card title={`Q${selected.id}. ${selected.title}`}
                actions={<button className="btn btn-primary btn-sm" disabled={busy} onClick={() => execute(selected)}>{busy ? "Running…" : "Run ▶"}</button>}>
            <div className="chips">{selected.concepts.map((c) => <span key={c} className="chip">{c}</span>)}</div>
            <SqlBlock>{selected.sql};</SqlBlock>
          </Card>
          <Card title={res?.rows ? `Result · ${res.rows.length} row(s) · ${res.ms} ms` : "Result"}>
            {!res && (busy ? <Loading text="Running…" /> : <div className="empty">Click “Run” to execute this query.</div>)}
            {res?.error && <ErrorBox>{res.error}</ErrorBox>}
            {res?.rows && (res.rows.length === 0 ? <div className="empty">Query returned no rows.</div> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {res.rows.map((r, i) => (
                      <tr key={i}>{cols.map((c) => <td key={c}>{cell(c, r[c])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
