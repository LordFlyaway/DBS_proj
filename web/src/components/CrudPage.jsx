import { useState } from "react";
import { supabase } from "../lib/supabase";
import { run, notify } from "../lib/activity";
import { useLoad } from "../lib/hooks";
import { sqlInsert, sqlUpdate, sqlDelete, clean } from "../lib/sql";
import { PageHeader, Card, DataTable, Modal, Field, ErrorBox } from "./ui";

/**
 * Generic list + add / edit / delete page for a simple table.
 * fields: [{ key, label, type: text|number|date|select|bool, options?: [{value,label}], required?, hint? }]
 */
export default function CrudPage({ table, pk, title, subtitle, fields, columns, canEdit, orderBy, numeric = [], extraLoad }) {
  const { data, error, reload } = useLoad(async () => {
    const rows = await run({ action: `Load ${table}`, component: "SELECT", tables: [table], sql: `SELECT * FROM ${table} ORDER BY ${orderBy};` },
      () => supabase.from(table).select("*").order(orderBy), null, { silent: true });
    const extra = extraLoad ? await extraLoad() : null;
    return { rows, extra };
  }, [table]);
  const [editing, setEditing] = useState(null);

  async function remove(row) {
    if (!confirm(`Delete this ${table.replace("_", " ")} record?`)) return;
    try {
      await run({ action: `Delete ${table} #${row[pk]}`, component: "DELETE", tables: [table], sql: sqlDelete(table, { [pk]: row[pk] }) },
        () => supabase.from(table).delete().eq(pk, row[pk]).select(), (d) => (d.length ? "1 row deleted" : "0 rows deleted"));
      notify("success", "Deleted");
      reload();
    } catch (e) { notify("error", e.message); }
  }

  const cols = typeof columns === "function" ? columns(data?.extra) : columns;
  const flds = typeof fields === "function" ? fields(data?.extra) : fields;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}>
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing({ mode: "add", row: {} })}>+ Add</button>}
      </PageHeader>
      <ErrorBox>{error}</ErrorBox>
      <Card>
        <DataTable rows={data?.rows} rowKey={(r) => r[pk]} columns={[
          ...cols,
          ...(canEdit ? [{ key: "_act", label: "", align: "right", render: (r) => (
            <div className="row-actions">
              <button className="btn btn-sm" onClick={() => setEditing({ mode: "edit", row: r })}>Edit</button>
              <button className="btn btn-sm btn-danger-ghost" onClick={() => remove(r)}>Delete</button>
            </div>) }] : []),
        ]} />
      </Card>
      {editing && (
        <CrudForm {...editing} table={table} pk={pk} fields={flds} numeric={numeric}
                  onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
      )}
    </>
  );
}

function CrudForm({ mode, row, table, pk, fields, numeric, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.key, row[f.key] ?? (f.type === "bool" ? true : f.default ?? "")])));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const data = clean(form, numeric);
    try {
      if (mode === "add") {
        await run({ action: `Add ${table}`, component: "INSERT", tables: [table], sql: sqlInsert(table, data) },
          () => supabase.from(table).insert(data).select(), (d) => `1 row inserted (${pk} ${d[0][pk]})`);
      } else {
        await run({ action: `Update ${table} #${row[pk]}`, component: "UPDATE", tables: [table], sql: sqlUpdate(table, data, { [pk]: row[pk] }) },
          () => supabase.from(table).update(data).eq(pk, row[pk]).select(), (d) => `${d.length} row updated`);
      }
      notify("success", "Saved");
      onSaved();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <Modal title={mode === "add" ? "Add record" : "Edit record"} onClose={onClose}
           footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="crud-form" disabled={busy}>{busy ? "Saving…" : "Save"}</button></>}>
      <form id="crud-form" className="form-grid" onSubmit={save}>
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            {f.type === "select" ? (
              <select required={f.required} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                {!f.required && <option value="">— none —</option>}
                {f.required && <option value="">Select…</option>}
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "bool" ? (
              <select value={String(form[f.key])} onChange={(e) => setForm({ ...form, [f.key]: e.target.value === "true" })}>
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            ) : (
              <input type={f.type || "text"} step={f.type === "number" ? "0.01" : undefined} required={f.required}
                     value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
        {error && <div className="field-span"><ErrorBox>{error}</ErrorBox></div>}
      </form>
    </Modal>
  );
}
