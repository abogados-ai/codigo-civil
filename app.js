'use strict';
// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const CODES = [
  { id: 'civil', name: 'Código Civil', short: 'Civil', pre: '', sub: 'DFL N° 1 de 2000', self: /^código civil/i },
  { id: 'cpc', name: 'Código de Procedimiento Civil', short: 'CPC', pre: 'cpc_', sub: 'Ley N° 1.552 de 1902', self: /^código de procedimiento civil/i },
  { id: 'cot', name: 'Código Orgánico de Tribunales', short: 'COT', pre: 'cot_', sub: 'Ley N° 7.421 de 1943', self: /^código orgánico de tribunales/i },
  { id: 'penal', name: 'Código Penal', short: 'Penal', pre: 'penal_', sub: 'Ley de 12 de noviembre de 1874', self: /^código penal/i },
  { id: 'cpp', name: 'Código Procesal Penal', short: 'CPP', pre: 'cpp_', sub: 'Ley N° 19.696 de 2000', self: /^código procesal penal/i },
  { id: 'trabajo', name: 'Código del Trabajo', short: 'Trabajo', pre: 'trabajo_', sub: 'DFL N° 1 de 2002', self: /^código del trabajo/i }
];
let CODE = null;                        // código abierto
let favs = {}, notes = {}, recent = [];  // por código
const ck = k => (CODE ? CODE.pre : '') + k;
let fontSize = store.get('fs', 19);
let theme = store.get('theme', 'auto');
const saveFavs = () => store.set(ck('favs'), favs);
const saveNotes = () => store.set(ck('notes'), notes);

function applyPrefs() {
  document.documentElement.style.setProperty('--fs', fontSize + 'px');
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
applyPrefs();

function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1600);
}

// ---------- datos ----------
let ARTS = [], BYNUM = new Map(), BYLOW = new Map(), LIBROS = [];
const numHtml = a => a.n === 'final' ? '<small>Artículo</small>final'
  : a.n === 'transitorio' ? '<small>Artículo</small>transit.'
  : a.n.endsWith(' transitorio') ? `<small>Transitorio</small>${esc(a.n.replace(' transitorio', ''))}`
  : `<small>Artículo</small>${esc(a.n)}`;
const ICON = {
  star: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>',
  starOn: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8L12 3.5 16.5 8"/><path d="M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/></svg>'
};
const label = a => a.n === 'final' ? 'Artículo final' : 'Artículo ' + a.n;
const titleCase = s => {
  s = s.replace(/\s+/g, ' ').trim();
  s = s.charAt(0) + s.slice(1).toLowerCase();
  const fix = { curaduria: 'curaduría', curadurias: 'curadurías', juridicas: 'jurídicas', conyuges: 'cónyuges', deposito: 'depósito', creditos: 'créditos', perdida: 'pérdida', clausula: 'cláusula', menores: 'menores', habitacion: 'habitación' };
  s = s.replace(/[a-zñ]+/g, w => fix[w] || w.replace(/([cgs])ion\b/, '$1ión'));
  return s.replace(/^(título|titulo)\s+([ivxl]+)\b/i, (m, w, r) => 'Título ' + r.toUpperCase());
};

async function load(id) {
  const cfg = CODES.find(c => c.id === id) || CODES[0];
  const res = await fetch('codes/' + cfg.id + '.json');
  const data = await res.json();
  CODE = cfg; ARTS = data; BYNUM = new Map(); BYLOW = new Map(); LIBROS = [];
  favs = store.get(ck('favs'), {}); notes = store.get(ck('notes'), {}); recent = store.get(ck('recent'), []);
  store.set('code', cfg.id);
  document.documentElement.dataset.code = cfg.id;
  document.title = cfg.name;
  let lib = null, tit = null;
  ARTS.forEach((a, i) => {
    a.i = i; a.nt = norm(a.t);
    BYNUM.set(a.n, a);
    const lo = a.n.toLowerCase();
    [lo, lo.replace(/\s+/g, '-'), lo.replace(/-/g, ' ')].forEach(k => { if (!BYLOW.has(k)) BYLOW.set(k, a); });
    if (!lib || lib.name !== a.l) { lib = { name: a.l, titulos: [] }; LIBROS.push(lib); tit = null; }
    const tn = a.ti || a.l;
    if (!tit || tit.name !== tn) { tit = { name: tn, arts: [] }; lib.titulos.push(tit); }
    tit.arts.push(a);
  });
}

// ---------- vistas ----------
const view = $('#view'), titleEl = $('#title'), backBtn = $('#back');
let backTarget = null;

function frame(title, tab, back) {
  titleEl.textContent = title;
  backTarget = back || null;
  backBtn.hidden = !back;
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
}
const snippet = a => esc(a.t.replace(/\n/g, ' ').slice(0, 140));
const artRow = (a, extra = '') => `<a class="row" href="#/art/${encodeURIComponent(a.n)}">
  <span class="num">${numHtml(a)}</span>
  <span class="main"><span class="s" style="margin:0">${extra || snippet(a)}</span></span>
  ${a.d ? '<span class="pill">derogado</span>' : ''}${favs[a.n] ? '<span style="color:var(--accent)">★</span>' : ''}</a>`;
const range = arts => {
  arts = arts.filter(a => a.n !== 'final');
  if (!arts.length) return 'Artículo final';
  const f = arts[0].n, l = arts[arts.length - 1].n;
  return f === l ? 'Artículo ' + f : `Artículos ${f} – ${l}`;
};
const plural = (n, s, p) => n + ' ' + (n === 1 ? s : p);

const flat = () => LIBROS.length === 1;
function vIndice() {
  frame(CODE.name, 'indice');
  const rec = recent.map(n => BYNUM.get(n)).filter(Boolean);
  view.innerHTML = `<button class="btn primary" id="jmp" style="width:100%;margin-bottom:4px">Ir a un artículo…</button>` +
    (rec.length ? `<h2 class="sec">Seguir leyendo</h2><div class="list">${rec.slice(0, 5).map(a => artRow(a)).join('')}</div>` : '') +
    (flat()
      ? `<h2 class="sec">Títulos</h2><div class="list">` + LIBROS[0].titulos.map((t, j) =>
        `<a class="row" href="#/titulo/0/${j}"><span class="main"><div class="t">${esc(titleCase(t.name))}</div>
         <div class="s">${plural(t.arts.length,'artículo','artículos')} · ${esc(range(t.arts))}</div></span><span class="chev">›</span></a>`).join('')
      : `<h2 class="sec">Libros</h2><div class="list">` + LIBROS.map((l, i) => {
        const all = l.titulos.flatMap(t => t.arts);
        return `<a class="row" href="#/libro/${i}"><span class="main"><div class="t">${esc(titleCase(l.name))}</div>
          <div class="s">${plural(l.titulos.length,'título','títulos')} · ${esc(range(all))}</div></span><span class="chev">›</span></a>`;
      }).join('')) + `</div>
  <div class="foot">Texto oficial del ${esc(CODE.name)} de Chile (${esc(CODE.sub)}).<br>Fuente: Biblioteca del Congreso Nacional, LeyChile.<br>Uso personal. Verifica siempre la versión vigente en bcn.cl.</div>`;
}

function bindIndice() { const j = $('#jmp'); if (j) j.onclick = openJump; }
titleEl.onclick = () => { if (location.hash.startsWith('#/art/')) openJump(); };

function vLibro(i) {
  const l = LIBROS[i]; if (!l) return go('#/');
  if (flat()) return go('#/');
  frame(titleCase(l.name).replace(/^(Libro \w+).*/i, '$1'), 'indice', '#/');
  view.innerHTML = `<h2 class="sec">${esc(titleCase(l.name))}</h2><div class="list">` + l.titulos.map((t, j) =>
    `<a class="row" href="#/titulo/${i}/${j}"><span class="main"><div class="t">${esc(titleCase(t.name))}</div>
     <div class="s">${plural(t.arts.length,'artículo','artículos')} · ${esc(range(t.arts))}</div></span><span class="chev">›</span></a>`).join('') + `</div>`;
}

function vTitulo(i, j) {
  const t = LIBROS[i]?.titulos[j]; if (!t) return go('#/');
  frame(esc(t.name.match(/^T[ÍI]TULO\s+\S+/i)?.[0] || 'Título'), 'indice', flat() ? '#/' : `#/libro/${i}`);
  titleEl.textContent = t.name.match(/^T[ÍI]TULO\s+\S+/i)?.[0] || 'Título';
  view.innerHTML = `<h2 class="sec">${esc(titleCase(t.name))}</h2><div class="list">${t.arts.map(a => artRow(a)).join('')}</div>`;
}

// ---------- referencias cruzadas, vista previa, recientes ----------
const NUMP = '\\d+(?:-\\d+)?(?:\\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:-[A-ZÑ]{1,2}\\b|\\s+[A-ZÑ]\\b)?';
const REF = new RegExp('\\b([Aa]rt[ií]culos?)\\s+(' + NUMP + '(?:\\s*(?:,|y|e|o|a)\\s*' + NUMP + ')*)', 'g');
const NUMRE = new RegExp(NUMP, 'g');
const EXTLAW = /^\s*,?\s*(?:del|de la|de los|de)\s+(?:ley|decreto|d\.|constitución|dfl|d\.f\.l|reglamento|estatuto|convenio|tratado|auto acordado)/i;
const EXTCOD = /^\s*,?\s*(?:del|de)\s+(código[^,.;:)]{0,45})/i;
function isExternal(rest) {
  if (EXTLAW.test(rest)) return true;
  const c = rest.match(EXTCOD);
  return !!c && !CODE.self.test(c[1]);
}
function linkRefs(p) {
  return p.replace(REF, (m, w, list, off) => {
    if (isExternal(p.slice(off + m.length, off + m.length + 70))) return m;
    return w + ' ' + list.replace(NUMRE, n => {
      let k = n.trim().replace(/\s+/g, ' '), tail = '';
      if (!BYNUM.has(k)) { const b = k.replace(/\s+[A-ZÑ]$/, ''); if (b !== k && BYNUM.has(b)) { tail = k.slice(b.length); k = b; } }
      return BYNUM.has(k) ? `<a class="ref" data-n="${k}" href="#/art/${encodeURIComponent(k)}">${k}</a>${tail}` : n;
    });
  });
}
function pushRecent(n) { recent = [n, ...recent.filter(x => x !== n)].slice(0, 8); store.set(ck('recent'), recent); }
let slideDir = '';
function stepTo(a, dir) { if (!a) return; slideDir = dir; location.replace('#/art/' + encodeURIComponent(a.n)); }

function closeSheet() { $('#sheet')?.remove(); }
function openSheet(html, onMount) {
  closeSheet();
  const s = document.createElement('div'); s.id = 'sheet';
  s.innerHTML = `<div class="panel">${html}</div>`;
  s.addEventListener('click', e => { if (e.target === s) closeSheet(); });
  document.body.appendChild(s); onMount?.(s);
}
function previewArt(n) {
  const a = BYNUM.get(n); if (!a) return;
  openSheet(`<div class="grab"></div><div class="crumb">${esc(titleCase(a.ti || a.l))}</div>
    <h2>${esc(label(a))}${a.d ? ' <span class="pill">derogado</span>' : ''}</h2>
    <div class="txt">${a.t.split('\n').map(p => `<p>${linkRefs(esc(p))}</p>`).join('')}</div>
    <div class="actions"><button class="btn" id="sx">Cerrar</button><button class="btn primary" id="so">Abrir artículo</button></div>`, s => {
    $('#sx', s).onclick = closeSheet;
    $('#so', s).onclick = () => { closeSheet(); go('#/art/' + encodeURIComponent(n)); };
  });
}
function openJump() {
  openSheet(`<div class="grab"></div><h2 style="font-size:20px">Ir al artículo</h2>
    <input id="jn" class="jump" enterkeyhint="go" autocomplete="off" autocapitalize="off" placeholder="N° (ej: 254, 3 bis, 183-A)">
    <div class="hint" id="jh"></div>
    <div class="actions"><button class="btn" id="sx">Cancelar</button><button class="btn primary" id="so">Ir</button></div>`, s => {
    const i = $('#jn', s), h = $('#jh', s);
    const val = () => i.value.trim().toLowerCase().replace(/^art\w*\.?\s*/, '').replace(/\s+/g, ' ');
    const hit = () => BYLOW.get(val());
    const go2 = () => { const a = hit(); if (a) { closeSheet(); go('#/art/' + encodeURIComponent(a.n)); } else h.textContent = 'No existe ese artículo'; };
    i.oninput = () => { const a = hit(); h.textContent = a ? a.t.replace(/\n/g, ' ').slice(0, 110) + '…' : ''; };
    i.onkeydown = e => { if (e.key === 'Enter') go2(); };
    $('#sx', s).onclick = closeSheet; $('#so', s).onclick = go2;
    setTimeout(() => i.focus(), 50);
  });
}
document.addEventListener('click', e => {
  const r = e.target.closest('a.ref'); if (r) { e.preventDefault(); previewArt(r.dataset.n); return; }
  const p = e.target.closest('.pager a'); if (p && !p.classList.contains('off')) {
    e.preventDefault(); const n = decodeURIComponent(p.getAttribute('href').slice(6));
    stepTo(BYNUM.get(n), p === p.parentNode.firstElementChild ? 'from-l' : 'from-r');
  }
});
// deslizar para cambiar de artículo
let tx = 0, ty = 0, tt = 0;
view.addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
view.addEventListener('touchend', e => {
  if (!location.hash.startsWith('#/art/') || e.target.closest('textarea')) return;
  const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.abs(dx) < 70 || Math.abs(dy) > 50 || Date.now() - tt > 700) return;
  const a = BYNUM.get(decodeURIComponent(location.hash.slice(6)));
  if (a) stepTo(dx < 0 ? ARTS[a.i + 1] : ARTS[a.i - 1], dx < 0 ? 'from-r' : 'from-l');
}, { passive: true });
document.addEventListener('keydown', e => {
  if (!location.hash.startsWith('#/art/') || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const a = BYNUM.get(decodeURIComponent(location.hash.slice(6))); if (!a) return;
  if (e.key === 'ArrowRight') stepTo(ARTS[a.i + 1], 'from-r'); else if (e.key === 'ArrowLeft') stepTo(ARTS[a.i - 1], 'from-l');
});

function vArt(n) {
  const a = BYNUM.get(n); if (!a) return go('#/buscar');
  frame(label(a), 'indice', history.length > 1 ? 'back' : '#/');
  titleEl.textContent = label(a) + ' ▾';
  const prev = ARTS[a.i - 1], next = ARTS[a.i + 1];
  const paras = a.t.split('\n').map(p => `<p>${linkRefs(esc(p))}</p>`).join('');
  pushRecent(a.n);
  const dir = slideDir; slideDir = '';
  view.innerHTML = `<article class="art ${dir}">
    <div class="crumb">${esc(titleCase(a.l))}${a.ti && a.ti !== a.l ? ' · ' + esc(titleCase(a.ti)) : ''}${a.p ? ' · ' + esc(a.p) : ''}</div>
    <h2>${esc(label(a))}${a.d ? ' <span class="pill">derogado</span>' : ''}</h2>
    <div class="txt ${a.d ? 'der' : ''}">${paras}</div>
    <div class="actions ic-row">
      <button class="btn ic ${favs[a.n] ? 'on' : ''}" id="fav" aria-label="Guardar en favoritos" title="Guardar">${favs[a.n] ? ICON.starOn : ICON.star}</button>
      <button class="btn ic" id="cp" aria-label="Copiar texto" title="Copiar">${ICON.copy}</button>
      <button class="btn ic" id="sh" aria-label="Compartir" title="Compartir">${ICON.share}</button>
    </div>
    <label class="k" for="nt">Mi nota</label>
    <textarea id="nt" placeholder="Escribe una nota para este artículo…">${esc(notes[a.n] || '')}</textarea>
  </article>
  <div class="pager">
    <a href="#/art/${prev ? encodeURIComponent(prev.n) : ''}" class="${prev ? '' : 'off'}" data-r>‹ ${prev ? esc(label(prev)) : ''}</a>
    <a href="#/art/${next ? encodeURIComponent(next.n) : ''}" class="${next ? '' : 'off'}" data-r>${next ? esc(label(next)) : ''} ›</a>
  </div>`;
  $('#fav').onclick = e => {
    if (favs[a.n]) delete favs[a.n]; else favs[a.n] = Date.now();
    saveFavs(); const b = e.currentTarget; b.classList.toggle('on', !!favs[a.n]); b.innerHTML = favs[a.n] ? ICON.starOn : ICON.star; toast(favs[a.n] ? 'Guardado en favoritos' : 'Quitado de favoritos');
  };
  const full = `${label(a)} del ${CODE.name}\n\n${a.t}`;
  $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(full); toast('Copiado'); } catch { toast('No se pudo copiar'); } };
  $('#sh').onclick = async () => { try { if (navigator.share) await navigator.share({ text: full }); else { await navigator.clipboard.writeText(full); toast('Copiado'); } } catch {} };
  $('#nt').oninput = e => { const v = e.target.value.trim(); if (v) notes[a.n] = v; else delete notes[a.n]; saveNotes(); };
  window.scrollTo(0, 0);
}

let lastQ = '';
function vBuscar(q = lastQ) {
  frame('Buscar', 'buscar');
  view.innerHTML = `<div class="search"><input id="q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
    placeholder="N° de artículo o palabras (ej: 254, plazo prescripción)" value="${esc(q)}"></div><div id="res"></div>`;
  const input = $('#q'); let timer;
  const run = () => { lastQ = input.value; renderResults(input.value); };
  input.oninput = () => { clearTimeout(timer); timer = setTimeout(run, 120); };
  run();
  if (!q) input.focus();
}

function renderResults(raw) {
  const box = $('#res'); const q = raw.trim();
  if (!q) { box.innerHTML = `<div class="hint">Escribe un número (<b>254</b>, <b>3 bis</b>) o palabras del texto. La búsqueda ignora tildes y mayúsculas.</div>`; return; }
  const out = [];
  const qn = norm(q).replace(/^art(iculo|\.)?\s*/, '').trim();
  const exact = BYLOW.get(qn) || BYLOW.get(qn.replace(/\s+/g, '-'));
  if (exact) out.push(artRow(exact, '<b>Ir al artículo ›</b> ' + snippet(exact)));
  const terms = qn.split(/\s+/).filter(t => t.length > 0);
  if (!terms.length) return;
  let hits = [];
  for (const a of ARTS) {
    if (a === exact) continue;
    if (terms.every(t => a.nt.includes(t))) hits.push(a);
    else if (/^\d+$/.test(qn) && a.n.startsWith(qn)) hits.push(a);
  }
  const phrase = norm(q);
  hits.sort((x, y) => (y.nt.includes(phrase) - x.nt.includes(phrase)) || (x.i - y.i));
  const shown = hits.slice(0, 80);
  const re = new RegExp('(' + terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  for (const a of shown) out.push(artRow(a, highlight(a, terms)));
  box.innerHTML = (exact || hits.length ?
    `<div class="hint">${hits.length + (exact ? 1 : 0)} resultado${hits.length + (exact ? 1 : 0) === 1 ? '' : 's'}${hits.length > 80 ? ' (mostrando 80, afina la búsqueda)' : ''}</div><div class="list">${out.join('')}</div>`
    : `<div class="empty">Sin resultados para “${esc(q)}”</div>`);
}

function highlight(a, terms) {
  const flat = a.t.replace(/\n/g, ' ');
  const nf = norm(flat); // misma longitud que flat (NFD sin marcas conserva índice solo si no hay compuestos)
  let pos = Math.max(0, ...terms.map(t => nf.indexOf(t)).filter(i => i >= 0).slice(0, 1));
  let start = Math.max(0, pos - 40);
  let seg = flat.slice(start, start + 170);
  let html = esc(seg);
  const nseg = norm(seg);
  if (nseg.length === seg.length) {
    const ranges = [];
    terms.forEach(t => { let k = 0; while ((k = nseg.indexOf(t, k)) !== -1) { ranges.push([k, k + t.length]); k += t.length; } });
    ranges.sort((x, y) => x[0] - y[0]);
    let out = '', last = 0;
    for (const [s, e] of ranges) { if (s < last) continue; out += esc(seg.slice(last, s)) + '<mark>' + esc(seg.slice(s, e)) + '</mark>'; last = e; }
    html = out + esc(seg.slice(last));
  }
  return (start > 0 ? '…' : '') + html + (start + 170 < flat.length ? '…' : '');
}

function vGuardados() {
  frame('Guardados', 'guardados');
  const nums = [...new Set([...Object.keys(favs), ...Object.keys(notes)])].filter(n => BYNUM.has(n))
    .sort((x, y) => BYNUM.get(x).i - BYNUM.get(y).i);
  let html = '';
  if (!nums.length) html = `<div class="empty">Aún no tienes artículos guardados.<br>Abre un artículo y toca la estrella ☆, o escribe una nota.</div>`;
  else html = `<div class="list">${nums.map(n => {
    const a = BYNUM.get(n); const nt = notes[n] ? `<div class="s" style="color:var(--accent)">✎ ${esc(notes[n].slice(0, 120))}</div>` : '';
    return `<a class="row" href="#/art/${encodeURIComponent(n)}"><span class="num">${numHtml(a)}</span>
      <span class="main"><div class="s" style="margin:0">${snippet(a)}</div>${nt}</span>${favs[n] ? '<span style="color:var(--accent)">★</span>' : ''}</a>`;
  }).join('')}</div>`;
  html += `<h2 class="sec">Respaldo</h2><div class="actions" style="margin-top:0">
    <button class="btn" id="exp">Exportar</button><label class="btn" style="text-align:center">Importar<input id="imp" type="file" accept="application/json" hidden></label></div>
    <div class="note">Tus favoritos y notas de este código se guardan solo en este dispositivo. Exporta un respaldo de vez en cuando.</div>
    <h2 class="sec">Apariencia</h2><div class="actions" style="margin-top:0">
    <button class="btn" data-th="auto">Auto</button><button class="btn" data-th="light">Claro</button><button class="btn" data-th="dark">Oscuro</button></div>`;
  view.innerHTML = html;
  document.querySelectorAll('[data-th]').forEach(b => { if (b.dataset.th === theme) b.classList.add('on'); b.onclick = () => { theme = b.dataset.th; store.set('theme', theme); applyPrefs(); vGuardados(); }; });
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify({ favs, notes }, null, 1)], { type: 'application/json' });
    const f = new File([blob], 'respaldo-' + CODE.id + '.json', { type: 'application/json' });
    if (navigator.canShare?.({ files: [f] })) navigator.share({ files: [f] }).catch(() => {});
    else { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
  };
  $('#imp').onchange = async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      favs = { ...favs, ...(d.favs || {}) }; notes = { ...notes, ...(d.notes || {}) };
      saveFavs(); saveNotes(); toast('Respaldo importado'); vGuardados();
    } catch { toast('Archivo no válido'); }
  };
}

// ---------- selector de códigos ----------
function vCodigos() {
  frame('Códigos', 'codigos');
  document.documentElement.classList.add('pick');
  view.innerHTML = `<h2 class="sec">Elige un código</h2><div class="list">` + CODES.map(c =>
    `<a class="row code" data-code="${c.id}" href="#/codigo/${c.id}"><span class="badge">${esc(c.short)}</span>
     <span class="main"><div class="t">${esc(c.name)}</div><div class="s">${esc(c.sub)}</div></span>
     ${CODE && CODE.id === c.id ? '<span class="pill">abierto</span>' : '<span class="chev">›</span>'}</a>`).join('') + `</div>
    <div class="foot">Textos oficiales de LeyChile (Biblioteca del Congreso Nacional).<br>Cada código guarda sus propios favoritos y notas.<br>Uso personal. Verifica siempre la versión vigente en bcn.cl.</div>`;
}
async function openCode(id) {
  try { await load(id); buildSide(); } catch { toast('No se pudo cargar el código'); return; }
  if (location.hash === '#/') route(); else go('#/');
}

// ---------- enrutador ----------
function go(h) { location.hash = h; }
// ---------- índice lateral (iPad / pantallas anchas) ----------
const isWide = () => matchMedia('(min-width:1000px)').matches;
const sideKey = 'noside';
function applySide() { document.documentElement.classList.toggle('noside', !!store.get(sideKey, false)); }
applySide();
$('#sb').onclick = () => { store.set(sideKey, !store.get(sideKey, false)); applySide(); setTimeout(syncSide, 0); };
function buildSide() {
  const side = $('#side');
  if (flat()) {
    side.innerHTML = LIBROS[0].titulos.map((t, j) => `<details class="tt flat" data-l="0" data-t="${j}"><summary>${esc(titleCase(t.name))}<small>${esc(range(t.arts))}</small></summary><div class="arts" data-pending="1"></div></details>`).join('');
  } else side.innerHTML = LIBROS.map((l, i) => `<details data-l="${i}"><summary>${esc(titleCase(l.name))}</summary>` +
    l.titulos.map((t, j) => `<details class="tt" data-l="${i}" data-t="${j}"><summary>${esc(titleCase(t.name))}<small>${esc(range(t.arts))}</small></summary><div class="arts" data-pending="1"></div></details>`).join('') +
    `</details>`).join('');
}
if (!window._sideBound) { window._sideBound = true; document.addEventListener('toggle', e => { const d = e.target; if (d.closest && d.closest('#side') && d.open && d.dataset.t !== undefined) fillSide(d); }, true); }
function fillSide(d) {
  const box = d.querySelector('.arts'); if (!box.dataset.pending) return; delete box.dataset.pending;
  const t = LIBROS[+d.dataset.l].titulos[+d.dataset.t];
  box.innerHTML = t.arts.map(a => `<a href="#/art/${encodeURIComponent(a.n)}" data-n="${esc(a.n)}">${esc(a.n === 'final' ? 'final' : a.n)}</a>`).join('');
}
function syncSide() {
  const side = $('#side'); if (!side || !ARTS.length) return;
  side.querySelectorAll('.cur').forEach(x => x.classList.remove('cur'));
  if (!location.hash.startsWith('#/art/')) return;
  const a = BYNUM.get(decodeURIComponent(location.hash.slice(6))); if (!a) return;
  const li = LIBROS.findIndex(l => l.name === a.l); if (li < 0) return;
  const ti = LIBROS[li].titulos.findIndex(t => t.arts.includes(a));
  const ld = side.querySelector(`details[data-l="${li}"]:not([data-t])`); if (ld) ld.open = true;
  const td = side.querySelector(`details[data-l="${li}"][data-t="${ti}"]`); if (!td) return;
  td.open = true; fillSide(td);
  const chip = td.querySelector(`a[data-n="${CSS.escape(a.n)}"]`);
  if (chip) { chip.classList.add('cur'); if (isWide()) chip.scrollIntoView({ block: 'center' }); }
}

function route() {
  const h = decodeURIComponent(location.hash.slice(1)) || '/';
  const p = h.split('/').filter(Boolean);
  const [a, b, c] = p;
  closeSheet();
  document.documentElement.classList.remove('pick');
  if (a === 'codigo') { openCode(b); return; }
  if (a === 'codigos' || !ARTS.length) { vCodigos(); window.scrollTo(0, 0); return; }
  if (!a) { vIndice(); bindIndice(); }
  else if (a === 'libro') vLibro(+b);
  else if (a === 'titulo') vTitulo(+b, +c);
  else if (a === 'art') vArt(p.slice(1).join('/'));
  else if (a === 'buscar') vBuscar();
  else if (a === 'guardados') vGuardados();
  else vIndice();
  if (a !== 'art') window.scrollTo(0, 0);
  syncSide();
}
window.addEventListener('hashchange', route);
backBtn.onclick = () => { if (backTarget === 'back') history.back(); else if (backTarget) go(backTarget); };
$('#aa').onclick = () => { fontSize = fontSize >= 28 ? 16 : fontSize + 2; store.set('fs', fontSize); applyPrefs(); toast('Letra ' + fontSize + ' pt'); };

(async function boot() {
  const q = new URLSearchParams(location.search).get('c');
  const id = [q, store.get('code', null)].find(x => CODES.some(c => c.id === x));
  if (!id) { route(); return; }
  try { await load(id); buildSide(); route(); }
  catch { view.innerHTML = '<div class="empty">No se pudo cargar el texto. Abre la app una vez con internet.</div>'; }
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
