// Générateur de questions et correcteur 100 % local : aucune IA, aucun réseau, aucun coût.

const STOP_RAW = 'le la les l un une des du de d et ou en à a au aux ce cet cette ces se sa son ses sur sous dans par pour avec sans qui que quoi dont où est sont être été il elle ils elles on nous vous je tu ne n pas plus moins très peut peuvent doit doivent fait faire comme mais donc car ainsi alors aussi entre leur leurs y lorsque quand si tout tous toute toutes même autre autres cela ça celui celle ceux deux chaque lors selon vers chez avoir ont été était sera bien ici dont ceci c qu s m t j';
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(STOP_RAW.split(' ').map(norm));
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const lowFirst = s => (s && s.length > 1 && s[1] === s[1].toLowerCase() ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const shorten = (s, n = 170) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > 40 ? s.lastIndexOf(' ', n) : n) + '…');
const endDot = s => (/[.!?…]$/.test(s) ? s : s + '.');
const strip = s => s.replace(/[\s.;:,]+$/, '').trim();
const words = s => s.split(/\s+/).filter(Boolean);
const vowel = s => /^[aeiouyhàâäéèêëîïôöùûü]/i.test(s);
const rnd = (seed => () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; })(7);
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const BAD_START = /^(il|elle|ils|elles|on|cela|ceci|ce|c['’]|ça|cette|cet|ces|son|sa|ses|leur|leurs|qui|que|dont|mais|donc|ainsi|alors|par|pour|dans|si|lorsque|quand|en|à|au|aux|et|ou|or|car|puis|enfin|d['’]abord|exemple|ex)\b/i;

function parse(text) {
  const blocks = [];
  let cur = { heading: '', sentences: [] };
  blocks.push(cur);
  text.replace(/\r/g, '').split('\n').forEach(raw => {
    const line = raw.replace(/^\s*(?:[•\-–—*·▪◦>]|\d{1,2}[.)])\s+/, '').replace(/\s+/g, ' ').trim();
    if (!line) return;
    const isHeading = line.length < 70 && !/[.;!?]$/.test(line) && !/=/.test(line) && /[a-zà-ÿ]{3}/i.test(line) && (!/:/.test(line) || /:$/.test(line)) && words(line).length <= 9;
    if (isHeading) { cur = { heading: strip(line), sentences: [] }; blocks.push(cur); return; }
    line.replace(/([.!?;])\s+(?=[A-ZÀ-ÖØ-Ý«(0-9])/g, '$1\n').split('\n').map(s => s.trim()).filter(s => s.length > 3).forEach(s => cur.sentences.push(s));
  });
  return blocks.filter(b => b.heading || b.sentences.length);
}

const DEF_RE = /^(.{2,70}?)\s+(est|sont|désigne|désignent|correspond à|correspondent à|représente|représentent|se définit comme|se définissent comme|consiste à|consiste en|signifie)\s+(.{8,})$/i;
const CALL_RE = /^on (appelle|nomme)\s+(.{2,60}?)\s+((?:un|une|le|la|les|l['’]|des)\s?.{6,})$/i;
const COLON_RE = /^([^:=]{2,50})\s*:\s*(.{10,})$/;
const FORMULA_RE = /([^\s=,;:()]{1,12}(?:\s*\([^)]{0,12}\))?)\s*=\s*([^=;,]+?)(?=\s*(?:=|[;,]|\.(?:\s|$)|$))/g;

function findDefs(blocks) {
  const defs = [];
  blocks.forEach(b => b.sentences.forEach(s => {
    const t = strip(s);
    let m = t.match(CALL_RE);
    if (m) return defs.push({ S: strip(m[2]), verb: 'est', D: strip(m[3]), sentence: endDot(cap(t)), kind: 'call' });
    m = t.match(DEF_RE);
    if (m) {
      const S = strip(m[1]), n = words(S).length;
      if (n >= 1 && n <= 8 && !BAD_START.test(S) && !/[=,]/.test(S)) defs.push({ S, verb: m[2].toLowerCase(), D: strip(m[3]), sentence: endDot(cap(t)), kind: 'def' });
      return;
    }
    m = t.match(COLON_RE);
    if (m && words(m[1]).length <= 6 && !BAD_START.test(m[1])) defs.push({ S: strip(m[1]), verb: ':', D: strip(m[2]), sentence: endDot(cap(t)), kind: 'colon' });
  }));
  const seen = new Set();
  return defs.filter(d => { const k = norm(d.S); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

function defQuestion(d) {
  const S = lowFirst(d.S);
  if (d.kind === 'call') return { type: 'libre', q: `Comment appelle-t-on ${lowFirst(d.D)} ?`, a: endDot(cap(d.S)) + ' ' + d.sentence };
  if (d.kind === 'colon') return { type: 'libre', q: `Définis : ${d.S}.`, a: d.sentence };
  if (/^consiste/.test(d.verb)) return { type: 'libre', q: `En quoi consiste ${S} ?`, a: d.sentence };
  if (/(sont|désignent|correspondent|représentent|définissent)/.test(d.verb)) return { type: 'libre', q: `Que sont ${S} ?`, a: d.sentence };
  return { type: 'libre', q: (vowel(S) ? 'Qu’est-ce qu’' : 'Qu’est-ce que ') + S + ' ?', a: d.sentence };
}

function findFormulas(blocks) {
  const out = [], seen = new Set();
  blocks.forEach(b => b.sentences.forEach(s => {
    FORMULA_RE.lastIndex = 0;
    let m;
    while ((m = FORMULA_RE.exec(s))) {
      const lhs = m[1].trim(), rhs = strip(m[2]);
      if (!/[a-zA-Zα-ωΑ-Ω]/.test(lhs) || !/[a-zA-Z0-9α-ωΑ-Ω]/.test(rhs) || rhs.length > 30 || words(rhs).length > 6) continue;
      const k = norm(lhs + rhs) + lhs + rhs;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ type: 'trou', q: `Complète la formule : ${lhs} = ____`, a: `${lhs} = ${rhs}.` + (s.length < 200 && s.length > lhs.length + rhs.length + 12 ? ' ' + endDot(cap(strip(s))) : ''), gap: rhs });
    }
  }));
  return out;
}

function findCloze(blocks, used, CAP = 12) {
  const all = blocks.flatMap(b => b.sentences);
  const freq = new Map();
  all.forEach(s => (s.match(/[\p{L}][\p{L}'’-]{5,}/gu) || []).forEach(w => {
    const k = w.toLowerCase();
    if (STOP.has(norm(k))) return;
    freq.set(k, (freq.get(k) || 0) + 1);
  }));
  const terms = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] * b[0].length - a[1] * a[0].length).map(([w]) => w);
  const out = [];
  for (const term of terms) {
    if (out.length >= Math.max(3, Math.round(CAP / 4))) break;
    const re = new RegExp('(^|[^\\p{L}])(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[^\\p{L}]|$)', 'iu');
    const s = all.find(x => !used.has(x) && x.length >= 40 && x.length <= 220 && re.test(x));
    if (!s) continue;
    used.add(s);
    const m = s.match(re);
    out.push({ type: 'trou', q: endDot(strip(s.replace(re, '$1____'))), a: endDot(cap(strip(s))), gap: m[2] });
  }
  return out;
}

function findExplain(blocks) {
  return blocks.filter(b => b.heading && b.sentences.join(' ').length >= 80).slice(0, 8).map(b => ({
    type: 'explique', q: `Explique avec tes mots : ${b.heading}.`, a: shorten(b.sentences.slice(0, 2).join(' '), 320)
  }));
}

export function generateQuestions(text) {
  const blocks = parse(text || '');
  const CAP = Math.max(10, Math.min(40, Math.round((text || '').length / 250)));
  const defs = findDefs(blocks);
  const used = new Set(defs.map(d => d.sentence));
  const libre = defs.map(defQuestion);
  const qcm = [];
  if (defs.length >= 3) {
    shuffle(defs).slice(0, Math.max(2, Math.round(defs.length / 3))).forEach(d => {
      const others = shuffle(defs.filter(x => x !== d)).slice(0, 3).map(x => cap(x.S));
      const options = shuffle([cap(d.S), ...others]);
      qcm.push({ type: 'qcm', q: `Quelle notion correspond à : « ${shorten(d.D, 140)} » ?`, a: d.sentence, options, correct: options.indexOf(cap(d.S)) });
    });
  }
  const vf = [];
  if (defs.length >= 2) {
    defs.slice(-Math.max(2, Math.round(defs.length / 4))).forEach((d, i) => {
      const verb = d.verb === ':' ? ':' : d.verb;
      if (i % 2 === 0) vf.push({ type: 'vf', q: d.sentence, a: 'Vrai. ' + d.sentence, correct: 0 });
      else {
        const other = defs.find(x => x !== d && norm(x.D) !== norm(d.D));
        if (other) vf.push({ type: 'vf', q: endDot(cap(`${d.S} ${verb} ${lowFirst(other.D)}`)), a: 'Faux. ' + d.sentence, correct: 1 });
      }
    });
  }
  const formulas = findFormulas(blocks).slice(0, 12);
  const cloze = findCloze(blocks, used, CAP);
  const explain = findExplain(blocks);
  const buckets = [libre, formulas, cloze, qcm, vf, explain];
  const out = [], seen = new Set();
  for (let round = 0; out.length < CAP && buckets.some(b => b.length > round); round++) {
    buckets.forEach(b => { const q = b[round]; if (q && out.length < CAP && !seen.has(norm(q.q))) { seen.add(norm(q.q)); out.push(q); } });
  }
  if (out.length < 3) {
    const longest = blocks.flatMap(b => b.sentences).filter(s => s.length > 50).sort((a, b) => b.length - a.length).slice(0, 3 - out.length);
    longest.forEach(s => {
      const w = (s.match(/[\p{L}][\p{L}'’-]{6,}/gu) || []).filter(x => !STOP.has(norm(x))).sort((a, b) => b.length - a.length)[0];
      if (w && !seen.has(norm(s))) { seen.add(norm(s)); out.push({ type: 'trou', q: endDot(strip(s.replace(w, '____'))), a: endDot(cap(strip(s))), gap: w }); }
    });
  }
  return out;
}

// ── Correction locale par mots-clés ──
const stem = w => (w.length > 5 ? w.slice(0, Math.max(5, Math.ceil(w.length * 0.7))) : w);
const same = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

export function gradeAnswer(answer, expected, question) {
  const inQ = new Set(norm(question).split(' ').filter(Boolean).map(stem));
  const orig = (expected || '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const kws = [], seen = new Set();
  orig.forEach(w => {
    const n = norm(w);
    if (!n || STOP.has(n) || seen.has(n)) return;
    if (n.length < 3 && !/\d/.test(n)) return;
    if (/^(vrai|faux)$/.test(n)) return;
    if (inQ.has(stem(n))) return;
    seen.add(n); kws.push({ w, s: stem(n) });
  });
  const key = kws.length > 10 ? [...kws].sort((a, b) => b.w.length - a.w.length).slice(0, 10) : kws;
  const ans = norm(answer).split(' ').filter(Boolean).map(stem);
  const found = key.filter(k => ans.some(a => same(a, k.s)));
  const missing = key.filter(k => !found.includes(k));
  const cov = key.length ? found.length / key.length : (ans.length > 3 ? 0.5 : 0);
  const long = ans.length >= 0.5 * words(norm(expected)).length;
  const level = cov >= 0.85 && long ? 'facile' : cov >= 0.6 ? 'bien' : cov >= 0.3 ? 'difficile' : 'rate';
  const list = missing.slice(0, 4).map(k => k.w).join(', ');
  const feedback = {
    facile: 'Impeccable, tout y est. On repousse loin.',
    bien: 'Bien joué !' + (list ? ' Il te manque juste : ' + list + '.' : ''),
    difficile: 'Tu as une partie. Revois surtout : ' + list + '.',
    rate: 'Pas encore. Relis la correction et retiens : ' + (list || 'l’idée principale') + '.'
  }[level] + ' (Correction par mots-clés : ajuste si besoin.)';
  const attendus = [];
  if (found.length) attendus.push({ label: 'Trouvé : ' + found.slice(0, 6).map(k => k.w).join(', '), ok: true });
  if (missing.length) attendus.push({ label: 'À retenir : ' + missing.slice(0, 6).map(k => k.w).join(', '), ok: false });
  return { level, feedback, attendus };
}
