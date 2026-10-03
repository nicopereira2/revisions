// Extract plain text from .txt, .docx or .pdf files, fully client-side.
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

export function kindOf(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith('.txt') || n.endsWith('.md') || file.type.startsWith('text/')) return 'txt';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (n.endsWith('.doc')) return 'doc';
  return null;
}

export async function extractText(file, onProgress) {
  const k = kindOf(file);
  if (k === 'txt') return clean(await file.text());
  if (k === 'docx') return clean(await docxText(await file.arrayBuffer()));
  if (k === 'pdf') return clean(await pdfText(await file.arrayBuffer(), onProgress));
  if (k === 'doc') throw new Error('Ancien format .doc non pris en charge — enregistre-le en .docx.');
  throw new Error('Format non reconnu. Utilise .txt, .docx ou .pdf.');
}

function clean(s) {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// — DOCX: minimal zip reader + WordprocessingML text walk —
async function unzipEntry(buf, wanted) {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier .docx illisible.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), comLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    if (name === wanted) {
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
      const data = new Uint8Array(buf, start, csize);
      if (method === 0) return dec.decode(data);
      if (method !== 8) throw new Error('Compression .docx non prise en charge.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extraLen + comLen;
  }
  throw new Error('Pas de contenu texte dans ce .docx.');
}

async function docxText(buf) {
  const xml = await unzipEntry(buf, 'word/document.xml');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const out = [];
  for (const para of doc.getElementsByTagNameNS(W, 'p')) {
    let line = '';
    const walk = (node) => {
      for (const c of node.childNodes) {
        if (c.namespaceURI === W) {
          if (c.localName === 't') line += c.textContent;
          else if (c.localName === 'tab') line += '\t';
          else if (c.localName === 'br' || c.localName === 'cr') line += '\n';
          else if (c.localName !== 'p') walk(c);
        } else if (c.nodeType === 1) walk(c);
      }
    };
    walk(para);
    out.push(line);
  }
  return out.join('\n');
}

// — PDF: pdf.js text layer —
let pdfjsP;
async function pdfText(buf, onProgress) {
  pdfjsP = pdfjsP || import(PDFJS).then(m => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; });
  const pdfjs = await pdfjsP;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress && onProgress(i, pdf.numPages);
    const tc = await (await pdf.getPage(i)).getTextContent();
    let s = '';
    for (const it of tc.items) { s += it.str; if (it.hasEOL) s += '\n'; else if (it.str && !/\s$/.test(it.str)) s += ' '; }
    pages.push(s);
  }
  const text = pages.join('\n\n');
  if (!text.replace(/\s/g, '')) throw new Error('Ce PDF ne contient pas de texte (c’est sûrement un scan).');
  return text;
}
