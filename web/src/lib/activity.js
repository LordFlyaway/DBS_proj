// "Database activity" log: every operation the UI performs is recorded with the
// SQL / PL/pgSQL it runs, the tables it touches and the result, so the
// User operation -> SQL -> DB -> Result flow can be shown during the demo.
import { useSyncExternalStore } from "react";

let entries = [];
let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l));

export function useActivity() {
  return useSyncExternalStore(subscribe, () => entries);
}
export function useToasts() {
  return useSyncExternalStore(subscribe, () => toasts);
}
export function clearActivity() {
  entries = [];
  emit();
}

let nextId = 1;
export function notify(kind, text) {
  const id = nextId++;
  toasts = [...toasts, { id, kind, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, kind === "error" ? 7000 : 4000);
}

/**
 * Runs a Supabase call and logs it.
 * meta: { action, component, sql, tables[] }   fn: () => supabase promise
 * summarize(data) -> short result text (optional)
 * Returns data; throws an Error with the database message on failure.
 */
export async function run(meta, fn, summarize, { silent = false } = {}) {
  const started = performance.now();
  const { data, error, count } = await fn();
  const ms = Math.round(performance.now() - started);
  const entry = { id: nextId++, at: new Date(), ms, ...meta };
  if (error) {
    entry.ok = false;
    entry.result = cleanError(error);
  } else {
    entry.ok = true;
    entry.result = summarize ? summarize(data, count) : defaultSummary(data, count);
  }
  if (!silent || !entry.ok) {
    entries = [entry, ...entries].slice(0, 60);
    emit();
  }
  if (error) throw new Error(entry.result);
  return data;
}

function defaultSummary(data, count) {
  if (Array.isArray(data)) return `${data.length} row(s)`;
  if (typeof count === "number") return `${count} row(s)`;
  if (data === null || data === undefined) return "OK";
  return String(data);
}

export function cleanError(error) {
  const msg = error.message || String(error);
  if (error.code === "23503") return `Foreign key violation: ${error.details || msg}`;
  if (error.code === "23505") return `Duplicate value (UNIQUE): ${error.details || msg}`;
  if (error.code === "23514") return `CHECK constraint failed: ${msg.replace(/^new row for relation /, "")}`;
  if (error.code === "42501") return `Permission denied by Row Level Security: ${msg}`;
  return msg;
}
