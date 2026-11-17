// The Margin Book page: renders NHModel (model.js). No prices or costs live here.
(() => {
const M = window.NHModel;
const C = M.cloneComponents();
const SOURCED = Object.fromEntries(Object.entries(C).filter(([, c]) => c.costFrom == null).map(([k, c]) => [k, c.cost]));
const G0 = { ...M.GLOBALS };
let G = { ...G0 };
const SECTIONS = M.SECTIONS, P = M.PRODUCTS;
const calc = p => M.calc(p, C, G, SECTIONS);
const unitCost = k => M.unitCost(C[k], G);

/* ---------- Persistence (this browser only) ---------- */
const KEY = 'nh-margin-book-v1';
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s) { Object.assign(G, s.G || {}); for (const [k, v] of Object.entries(s.costs || {})) if (C[k] && C[k].costFrom == null && Number.isFinite(v)) C[k].cost = v; }
} catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ G, costs: Object.fromEntries(Object.entries(C).filter(([, c]) => c.costFrom == null).map(([k, c]) => [k, c.cost])) })); } catch (e) {} };

/* ---------- Formatting ---------- */
const $ = id => document.getElementById(id);
const usd = (n, dp) => { const neg = n < 0; const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 }); return (neg ? '−$' : '$') + s; };
const money = n => usd(n, Math.abs(n) < 100 && n % 1 !== 0 ? 2 : 0);
const pct = x => (x * 100).toFixed(1) + '%';
const qty = q => Number.isInteger(q) ? String(q) : q.toFixed(q * 4 % 1 === 0 ? 2 : 1).replace(/\.?0+$/, '');
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

const CHIPS = ['All', ...[...new Set(SECTIONS.map(s => s.chip))]];
let chip = 'All';
try { const c = localStorage.getItem(KEY + '-chip'); if (c && CHIPS.includes(c)) chip = c; } catch (e) {}
const open = new Set();

function renderChips() {
  $('chips').innerHTML = CHIPS.map(c => `<button type="button" class="chip" aria-pressed="${c === chip}" data-chip="${esc(c)}">${esc(c)}</button>`).join('');
}
function bar(r, price) {
  const seg = [[r.labor, 'var(--labor)'], [r.merch, 'var(--merch)'], [r.cos, 'var(--cos)'], [Math.max(0, r.left), 'var(--margin)']];
  const tot = Math.max(price, r.cogs + r.cos);
  return `<div class="bar" aria-hidden="true">${seg.map(([v, c]) => `<span style="width:${(v / tot * 100).toFixed(2)}%;background:${c}"></span>`).join('')}</div>`;
}
function detail(p, r) {
  const rows = r.lines.map(l => `<tr>
    <td>${esc(l.c.label)}${l.c.flag ? ' <span class="flag">check</span>' : ''}${l.why ? `<div class="sub">${esc(l.why)}</div>` : ''}</td>
    <td><span class="kind ${l.c.kind}">${l.c.kind === 'labor' ? 'Labor' : 'Merch'}</span></td>
    <td class="num">${qty(l.q)} ${esc(l.c.unit)}</td>
    <td class="num">${money(l.u)}</td>
    <td class="num">${money(l.cost)}</td>
    <td class="num">${l.retail == null ? '<span class="muted">not sold alone</span>' : money(l.retail)}</td></tr>`).join('');
  const bundle = r.standalone != null && r.lines.length > 1
    ? `<div><span>Parts bought separately</span><span class="num">${money(r.standalone)}</span></div><div class="muted"><span>Package vs. parts</span><span class="num">${r.standalone ? pct(p.price / r.standalone - 1) : ''}</span></div>` : '';
  return `<div class="bk"><div class="bk-grid">
    <div style="min-width:0;overflow-x:auto"><table>
      <thead><tr><th>Part</th><th>Type</th><th>Qty</th><th>Our unit cost</th><th>Our cost</th><th>Sells alone for</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">Labor ${money(r.labor)} · Merchandise ${money(r.merch)}</td><td class="num">${money(r.cogs)}</td><td class="num">${r.standalone != null ? money(r.standalone) : ''}</td></tr></tfoot>
    </table></div>
    <div class="wf">
      <div><span>Price</span><span class="num">${money(p.price)}</span></div>
      <div><span><i class="sw" style="background:var(--labor)"></i>Labor cost</span><span class="num">−${money(r.labor).replace('−', '')}</span></div>
      <div><span><i class="sw" style="background:var(--merch)"></i>Merchandise cost</span><span class="num">−${money(r.merch).replace('−', '')}</span></div>
      <div class="tot"><span>Gross profit · ${pct(r.gm)}</span><span class="num ${r.gp < 0 ? 'neg' : ''}">${money(r.gp)}</span></div>
      <div><span><i class="sw" style="background:var(--cos)"></i>Cost of sale (${G.payPct + G.commPct}%)</span><span class="num">−${money(r.cos)}</span></div>
      <div class="tot"><span>Left for overhead & profit · ${pct(r.left / p.price)}</span><span class="num ${r.left < 0 ? 'neg' : ''}">${money(r.left)}</span></div>
      ${bundle}
    </div></div>
    ${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}</div>`;
}
function cell(k, x) {
  if (!x) return '<span class="dash">·</span>';
  const c = C[k];
  const qline = c.kind === 'labor' ? (c.unit === 'hr' ? `${qty(x.q)} h` : '') : (c.costFrom ? '' : (x.q !== 1 ? `× ${qty(x.q)}` : ''));
  return `${money(x.cost)}${qline ? `<span class="cq">${qline}</span>` : ''}`;
}
function render() {
  const q = $('q').value.trim().toLowerCase(), sort = $('sort').value;
  const shown = SECTIONS.filter(s => chip === 'All' || s.chip === chip);
  let html = '', counts = { good: 0, warn: 0, bad: 0, info: 0 }, n = 0;
  const all = P.map((p, i) => ({ p, i, r: calc(p) }));
  const secLabel = id => SECTIONS.find(s => s.id === id).label;
  const matchQ = x => shown.some(s => s.id === x.p.sec) && (!q || x.p.name.toLowerCase().includes(q) || secLabel(x.p.sec).toLowerCase().includes(q));
  // Columns: every labor role and every merchandise item used by at least one visible row, in library order.
  const used = new Set(all.filter(matchQ).flatMap(x => Object.keys(x.r.parts)));
  const cols = Object.keys(C).filter(k => used.has(k));
  const lab = cols.filter(k => C[k].kind === 'labor'), mer = cols.filter(k => C[k].kind === 'merch');
  const NC = 2 + cols.length + 5;
  const colHead = k => { const c = C[k]; return `<th scope="col" class="c-${c.kind}" title="${esc(c.label)}">${esc(c.short || c.label)}<span class="rate">${c.costFrom ? G.wsPct + '% of retail' : money(unitCost(k)) + '/' + esc(c.unit)}</span></th>`; };
  $('th').innerHTML = `<tr class="bands"><th rowspan="2" scope="col" style="vertical-align:bottom;text-align:left">Item</th><th rowspan="2" scope="col" style="vertical-align:bottom">Price</th>${lab.length ? `<th colspan="${lab.length}" class="b-labor c-labor">Labor cost, by role</th>` : ''}${mer.length ? `<th colspan="${mer.length}" class="b-merch c-merch">Merchandise cost, by item</th>` : ''}<th colspan="5" class="first-tot">Totals</th></tr>
    <tr class="cols">${lab.map(colHead).join('')}${mer.map(colHead).join('')}<th scope="col" class="first-tot">Total cost</th><th scope="col">Gross profit</th><th scope="col">Gross margin</th><th scope="col">After cost of sale</th><th scope="col">vs. target</th></tr>`;
  const block = (items, head) => {
    if (!items.length) return;
    if (head) html += head;
    for (const { p, i, r } of items) {
      n++; counts[r.status[0]]++;
      const ex = open.has(i);
      html += `<tr class="item" data-i="${i}" tabindex="0" aria-expanded="${ex}">
        <td><div class="iname"><span class="caret">›</span><div><div>${esc(p.name)}</div>${p.sub ? `<div class="sub">${esc(p.sub)}</div>` : ''}${sort !== 'cat' ? `<div class="sub">${esc(secLabel(p.sec))}</div>` : ''}${bar(r, p.price)}</div></div></td>
        <td class="num">${money(p.price)}</td>
        ${cols.map(k => `<td class="num c-${C[k].kind}">${cell(k, r.parts[k])}</td>`).join('')}
        <td class="num first-tot">${money(r.cogs)}</td>
        <td class="num ${r.gp < 0 ? 'neg' : ''}">${money(r.gp)}</td>
        <td class="num ${r.gm < 0 ? 'neg' : ''}"><strong>${pct(r.gm)}</strong></td>
        <td class="num ${r.left < 0 ? 'neg' : ''}">${pct(r.left / p.price)}</td>
        <td><span class="pill ${r.status[0]}">${r.status[1]}</span></td></tr>`;
      if (ex) html += `<tr class="detail"><td colspan="${NC}"><div class="detail-in">${detail(p, r)}</div></td></tr>`;
    }
  };
  if (sort === 'cat') {
    for (const s of shown) {
      const items = all.filter(x => x.p.sec === s.id && matchQ(x));
      block(items, `<tr class="grp"><td colspan="${NC}"><span class="grp-in">${esc(s.label)}<span class="floor">${s.floor != null ? esc(s.floorWhy) : `Target ${G.targetPct}% (set above)`}</span></span></td></tr>`);
    }
  } else {
    block(all.filter(matchQ).sort((a, b) => sort === 'gmAsc' ? a.r.gm - b.r.gm : b.r.gp - a.r.gp), '');
  }
  $('tb').innerHTML = html || `<tr><td colspan="${NC}" class="muted">No items match “${esc(q)}”.</td></tr>`;
  $('sum').innerHTML = `<strong>${n}</strong> items shown · <span class="pill good">${counts.good} meet target</span> <span class="pill warn">${counts.warn} within 5 pts</span> <span class="pill bad">${counts.bad} below</span> <span class="pill info">${counts.info} at cost by design</span>`;
}
function renderLib() {
  const secs = ['Labor rates', 'Kit & devices', 'Labs', 'Supplements'];
  $('lib').innerHTML = secs.map(sec => `<div class="lib-card"><h3>${sec}</h3>${Object.entries(C).filter(([, c]) => c.sec === sec && !c.hidden).map(([k, c]) => `
    <div class="lib-row"><div class="lname">${esc(c.label)}${c.assumed ? '<span class="tag">assumed</span>' : ''}${c.flag ? '<span class="tag">check</span>' : ''}</div>
    <div>${c.costFrom ? `<span class="num">${money(unitCost(k))}</span>` : `<label class="in"><span class="muted num">$</span><input type="number" min="0" step="any" id="c-${k}" data-c="${k}" value="${c.cost}" aria-label="${esc(c.label)} cost per ${esc(c.unit)}"><span class="muted num">/${esc(c.unit)}</span></label>`}</div>
    <div class="src">${esc(c.src)}${c.retail != null && !c.costFrom ? ` Sells for ${money(c.retail)}/${esc(c.unit)}.` : ''}</div></div>`).join('')}</div>`).join('');
}
function syncGlobals() { for (const el of document.querySelectorAll('[data-g]')) el.value = G[el.dataset.g]; }

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.g) { const v = parseFloat(t.value); if (Number.isFinite(v)) { G[t.dataset.g] = v; save(); render(); if (t.dataset.g === 'wsPct') renderLib(); } }
  else if (t.dataset.c) { const v = parseFloat(t.value); if (Number.isFinite(v) && v >= 0) { C[t.dataset.c].cost = v; save(); render(); } }
  else if (t.id === 'q') render();
});
$('sort').addEventListener('change', render);
$('chips').addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (!b) return; chip = b.dataset.chip; try { localStorage.setItem(KEY + '-chip', chip); } catch (er) {} renderChips(); render(); });
const toggle = tr => { const i = +tr.dataset.i; open.has(i) ? open.delete(i) : open.add(i); render(); const again = document.querySelector(`tr.item[data-i="${i}"]`); if (again) again.focus(); };
$('tb').addEventListener('click', e => { const tr = e.target.closest('tr.item'); if (tr) toggle(tr); });
$('tb').addEventListener('keydown', e => { const tr = e.target.closest('tr.item'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(tr); } });
$('reset').addEventListener('click', () => { G = { ...G0 }; for (const [k, v] of Object.entries(SOURCED)) C[k].cost = v; save(); syncGlobals(); renderLib(); render(); $('reset').textContent = 'Reset done'; setTimeout(() => { $('reset').textContent = 'Reset to sourced costs'; }, 1500); });

syncGlobals(); renderChips(); renderLib(); render();
})();
