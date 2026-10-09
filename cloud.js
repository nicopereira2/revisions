import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const CFG_KEY = 'revisions.supabase';
let client = null, sdk = null;

export function getConfig() {
  let ls = null;
  try { ls = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) {}
  return {
    url: (SUPABASE_URL || (ls && ls.url) || '').trim(),
    key: (SUPABASE_ANON_KEY || (ls && ls.key) || '').trim(),
    fromFile: !!(SUPABASE_URL && SUPABASE_ANON_KEY)
  };
}

export function setConfig(url, key) {
  localStorage.setItem(CFG_KEY, JSON.stringify({ url: url.trim(), key: key.trim() }));
  client = null;
}

export async function getClient() {
  const { url, key } = getConfig();
  if (!url || !key) return null;
  if (!client) {
    sdk = sdk || await import(SDK);
    client = sdk.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'revisions.auth' }
    });
  }
  return client;
}

// One row per user: { user_id, data (jsonb), rev, updated_at }. RLS restricts every query to auth.uid().
export async function fetchDoc(sb, uid) {
  const { data, error } = await sb.from('user_data').select('data, rev, updated_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createDoc(sb, uid, doc) {
  const { data, error } = await sb.from('user_data').insert({ user_id: uid, data: doc, rev: 1 }).select('rev').single();
  if (error) {
    if (error.code === '23505') return null; // already exists (created on another device)
    throw error;
  }
  return data.rev;
}

// Optimistic concurrency: only writes if nobody else saved since baseRev. Returns the new rev, or null on conflict.
export async function updateDoc(sb, uid, doc, baseRev) {
  const { data, error } = await sb.from('user_data')
    .update({ data: doc, rev: baseRev + 1, updated_at: new Date().toISOString() })
    .eq('user_id', uid).eq('rev', baseRev).select('rev');
  if (error) throw error;
  return data && data.length ? data[0].rev : null;
}

// Merge two versions of the user document (local edits vs another device).
export function merge(local, remote) {
  const a = local || {}, b = remote || {};
  const deleted = { ...(b.deleted || {}), ...(a.deleted || {}) };
  const byId = (xs, ys, pick) => {
    const m = new Map();
    (ys || []).forEach(y => m.set(y.id, y));
    (xs || []).forEach(x => { const y = m.get(x.id); m.set(x.id, y ? pick(x, y) : x); });
    return [...m.values()];
  };
  const newer = (x, y) => {
    const rx = x.reps || 0, ry = y.reps || 0;
    if (ry !== rx) return ry > rx ? y : x;
    if ((y.last || '') !== (x.last || '')) return (y.last || '') > (x.last || '') ? y : x;
    return (y.vupd || '') > (x.vupd || '') ? y : x;
  };
  // Variantes : on garde la liste la plus récente, même si l'autre appareil a plus de révisions.
  const pickCard = (x, y) => { const w = newer(x, y), o = w === x ? y : x; return (o.vupd || '') > (w.vupd || '') ? { ...w, vars: o.vars, vRot: o.vRot, lastVar: o.lastVar, vupd: o.vupd } : w; };
  const courses = byId(a.courses, b.courses, x => x).filter(c => !deleted[c.id]);
  const cards = byId(a.cards, b.cards, pickCard).filter(c => !deleted[c.courseId] && !deleted[c.id]);
  const upd = (x, y) => ((y.upd || '') > (x.upd || '') ? y : x);
  const errors = byId(a.errors, b.errors, upd).filter(e => !deleted[e.id]);
  const exos = byId(a.exos, b.exos, x => x).filter(e => !deleted[e.id]);
  const annales = byId(a.annales, b.annales, x => x).filter(e => !deleted[e.id]);
  const weekChecks = { ...(b.weekChecks || {}) };
  Object.entries(a.weekChecks || {}).forEach(([k, v]) => { weekChecks[k] = { ...(weekChecks[k] || {}), ...v }; });
  const log = { ...(b.log || {}) };
  Object.entries(a.log || {}).forEach(([k, v]) => { log[k] = Math.max(log[k] || 0, v); });
  return { ...b, ...a, courses, cards, errors, exos, annales, weekChecks, log, deleted, settings: { ...(b.settings || {}), ...(a.settings || {}) } };
}
