// Therapy-only commission scenario (November 2026).
//
//   node docs/reviews/2026-11-comp-plan/therapy-only.js           summary per product
//   node docs/reviews/2026-11-comp-plan/therapy-only.js --json    the same, as JSON
//   node docs/reviews/2026-11-comp-plan/therapy-only.js --html    rewrite the line-item section of therapy-only-commission.html
//
// Commission is paid only on the therapy and coaching lines of a sale. Each program is broken into the lines it is built
// from in model.js, and the program price is allocated across those lines:
//   - Non-therapy lines (kit and devices, labs, Dr. Jared's time, supplements and supplement credits) are valued at our cost.
//   - The NeuroSage Hub is valued at its $50 monthly list price, because it has no recorded cost.
//   - The rest of the price is the therapy amount. It is split across the therapy lines in proportion to their list rates
//     (PT $240/hr, coordinator and coach $100/hr, Dr. Kyle $500/hr), which only changes how it is displayed, not the total.
// Commission = rate × therapy amount. A product with no therapy or coaching lines pays nothing.
// The "retail" figures value the carve-out at catalogue retail instead of cost; shown for comparison only.
// The amended plan (A1) is 15% of price net of labs, physician time and supplements (Plan A, first plan).
const fs = require('fs');
const path = require('path');
const M = require(path.join(__dirname, '../../../model.js'));

const CATEGORY = {
  pt: 'Therapy', coord: 'Therapy', coach: 'Coaching', kyle: 'Therapy',
  panel: 'Kit', gHand: 'Kit', rHand: 'Kit', glasses: 'Kit', oils: 'Kit', vib: 'Kit', saebo: 'Kit', pads: 'Kit', laser: 'Kit',
  gut: 'Labs', oat: 'Labs', tox: 'Labs', neural: 'Labs', myco: 'Labs',
  intrakid: 'Supplements', gutFeel: 'Supplements', bena: 'Supplements', adrena: 'Supplements', suppCr: 'Supplements', suppList: 'Supplements',
  md: 'Physician', hub: 'Hub', evaSup: 'Support',
};
const THERAPY = new Set(['pt', 'coord', 'coach', 'kyle']);
const PASS_A1 = new Set(['gut', 'oat', 'tox', 'neural', 'myco', 'intrakid', 'gutFeel', 'bena', 'adrena', 'suppCr', 'suppList', 'md']);
const HUB_VALUE = 50;
const RATE = { first: 0.15, firstNeutral: 0.17, cont: 0.10 };
const CONTINUED = new Set(['v2wm', 'cc']);
const PROGRAMS = ['v2c', 'v2g', 'v2w', 'v2wm', 'pre', 'cc', 'v1c', 'v1g', 'v1w'];

/** Break a product into its lines, value each, and allocate the price. Every dollar of price lands on exactly one line. */
function lineItems(p) {
  const r = M.calc(p);
  const lines = r.lines.map(l => {
    const therapy = THERAPY.has(l.k);
    const value = therapy ? 0 : l.k === 'hub' ? HUB_VALUE * l.q : l.cost;
    const retailValue = therapy ? 0 : l.k === 'hub' ? HUB_VALUE * l.q : (l.retail ?? l.cost);
    return { k: l.k, label: l.c.label, why: l.why || '', q: l.q, unit: l.c.unit, cost: l.cost, category: CATEGORY[l.k] || 'Other', therapy, value, retailValue, weight: therapy ? l.c.retail * l.q : 0 };
  });
  const carved = lines.reduce((a, l) => a + l.value, 0);
  const carvedRetail = lines.reduce((a, l) => a + l.retailValue, 0);
  const hasTherapy = lines.some(l => l.therapy);
  const therapyAmt = hasTherapy ? Math.max(0, p.price - carved) : 0;
  const therapyRetail = hasTherapy ? Math.max(0, p.price - carvedRetail) : 0;
  const wsum = lines.reduce((a, l) => a + l.weight, 0);
  // Whole dollars; the largest therapy line absorbs rounding so the lines add up to the price.
  let assigned = 0, big = null;
  for (const l of lines) {
    if (!l.therapy) continue;
    l.value = Math.round(therapyAmt * l.weight / wsum); assigned += l.value;
    if (!big || l.weight > big.weight) big = l;
  }
  if (big) big.value += Math.round(therapyAmt) - assigned;
  const cont = CONTINUED.has(p.sec);
  const rates = cont ? [RATE.cont] : [RATE.first, RATE.firstNeutral];
  for (const l of lines) l.comm = rates.map(rt => l.therapy ? rt * l.value : 0);
  const a1Out = r.lines.filter(l => PASS_A1.has(l.k)).reduce((a, l) => a + l.cost, 0);
  const amended = (cont ? RATE.cont : RATE.first) * Math.max(0, p.price - a1Out);
  return { sec: p.sec, name: p.name, sub: p.sub || '', price: p.price, lines, carved: p.price - therapyAmt, therapyAmt, therapyRetail, cont, rates,
    comm: rates.map(rt => rt * therapyAmt), commRetail: rates[0] * therapyRetail, amended, neutral: therapyAmt ? amended / therapyAmt : null };
}

// Products with no therapy or coaching lines (Eva: Hub access only) pay nothing and are left out of the breakdown.
const items = M.PRODUCTS.filter(p => PROGRAMS.includes(p.sec) && p.lines.some(([k]) => THERAPY.has(k))).map(lineItems);
const $ = x => (x < 0 ? '−$' : '$') + Math.abs(Math.round(x)).toLocaleString('en-US');
const pc = x => x == null ? '—' : (x * 100).toFixed(1) + '%';

if (process.argv.includes('--json')) { console.log(JSON.stringify(items)); return; }
if (!process.argv.includes('--html')) {
  for (const it of items)
    console.log([it.sec, it.name, $(it.price), 'carved', $(it.carved), 'therapy', $(it.therapyAmt), 'comm', it.comm.map($).join('/'), 'amended', $(it.amended), 'neutral', pc(it.neutral)].join(' | '));
  return;
}

/* ---------- HTML for the page ---------- */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const qty = l => {
  const n = Number.isInteger(l.q) ? l.q : l.q.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return { hr: `${n} hr`, ea: `${n}`, pair: `${n} pair`, pack: `${n} pack`, mo: `${n} mo`, family: `${n}`, '$': `$${n}` }[l.unit] || `${n} ${l.unit}`;
};
const SECTION_LABEL = Object.fromEntries(M.SECTIONS.map(s => [s.id, s.label]));
const rateHead = it => it.cont ? '<th class="n">Commission at 10%</th>' : '<th class="n">At 15%</th><th class="n">At 17%</th>';

function table(it) {
  const row = l => `<tr${l.therapy ? ' class="th"' : ''}><td><strong>${esc(l.label)}</strong>${l.why ? `<br><span class="why">${esc(l.why)}</span>` : ''}</td><td>${l.category}</td><td class="n">${qty(l)}</td><td class="n">${$(l.cost)}</td><td class="n">${$(l.value)}</td>${l.comm.map(c => `<td class="n">${l.therapy ? $(c) : '—'}</td>`).join('')}</tr>`;
  // A subtotal row after the kit lines, which sit together in every program.
  // Subtotal rows after the kit lines and after the supplement lines; each group sits together in every program.
  const SUBTOTAL = { Kit: 'Kit', Supplements: 'Supplements' };
  const subRow = cat => {
    const g = it.lines.filter(l => l.category === cat);
    return `<tr class="sub"><td colspan="3">${SUBTOTAL[cat]} subtotal (${g.length} item${g.length === 1 ? '' : 's'})</td><td class="n">${$(g.reduce((a, l) => a + l.cost, 0))}</td><td class="n">${$(g.reduce((a, l) => a + l.value, 0))}</td>${it.rates.map(() => '<td class="n">—</td>').join('')}</tr>`;
  };
  const rows = it.lines.map((l, i) => row(l) + (SUBTOTAL[l.category] && (it.lines[i + 1] || {}).category !== l.category ? subRow(l.category) : '')).join('');
  const cost = it.lines.reduce((a, l) => a + l.cost, 0);
  return `<div class="scroll"><table class="li"><thead><tr><th>Line item</th><th>Type</th><th class="n">Qty</th><th class="n">Our cost</th><th class="n">Share of price</th>${rateHead(it)}</tr></thead><tbody>${rows}` +
    `<tr class="total"><td colspan="3">Total</td><td class="n">${$(cost)}</td><td class="n">${$(it.price)}</td>${it.comm.map(c => `<td class="n">${$(c)}</td>`).join('')}</tr></tbody></table></div>`;
}

let html = '';
for (const sec of PROGRAMS) {
  const group = items.filter(i => i.sec === sec);
  if (!group.length) continue;
  const cont = group[0].cont;
  html += `<h3 class="grp">${esc(SECTION_LABEL[sec])}</h3>`;
  if (sec === 'cc') {
    // Continuing Care is all therapy: one summary table instead of twenty identical breakdowns.
    html += `<p class="note">Every Continuing Care option is coordinator sessions plus PT assessments, with nothing carved out, so the whole price is commissionable at the continued-plan rate of 10%.</p><div class="scroll"><table><thead><tr><th>Option</th><th class="n">Price</th><th class="n">Coordinator share</th><th class="n">PT share</th><th class="n">Commission at 10%</th></tr></thead><tbody>` +
      group.map(it => { const c = it.lines.find(l => l.k === 'coord'), t = it.lines.find(l => l.k === 'pt'); return `<tr><td>${esc(it.name)}</td><td class="n">${$(it.price)}</td><td class="n">${$(c ? c.value : 0)}</td><td class="n">${$(t ? t.value : 0)}</td><td class="n">${$(it.comm[0])}</td></tr>`; }).join('') + '</tbody></table></div>';
    continue;
  }
  html += group.map((it, i) => `<details${sec === 'v2c' && i === 0 ? ' open' : ''}><summary><span class="nm">${esc(it.name)}</span><span class="sm">${$(it.price)} · therapy ${$(it.therapyAmt)} · ${cont ? `${$(it.comm[0])} at 10%` : `${$(it.comm[0])} at 15%, ${$(it.comm[1])} at 17%`}</span></summary>${table(it)}</details>`).join('');
}

// Summary table, one row per program (Continuing Care left out: all therapy).
const sumRows = items.filter(i => i.sec !== 'cc').map(it => `<tr><td>${esc(SECTION_LABEL[it.sec].replace(/, .*$/, ''))}${it.sec === 'v2wm' ? ' monthly' : it.sec === 'v2w' ? ' quarter' : ''}: ${esc(it.name)}</td><td class="n">${$(it.price)}</td><td class="n">${$(it.carved)}</td><td class="n">${$(it.therapyAmt)}</td><td class="n">${$(it.amended)}</td><td class="n">${$(it.comm[0])}${it.cont ? ' (10%)' : ''}</td><td class="n">${it.cont ? '—' : $(it.comm[1])}</td></tr>`).join('');
const summary = `<div class="scroll"><table><thead><tr><th>Program</th><th class="n">Price</th><th class="n">Non-therapy lines</th><th class="n">Therapy amount</th><th class="n">Amended plan</th><th class="n">Therapy-only, 15%</th><th class="n">Therapy-only, 17%</th></tr></thead><tbody>${sumRows}</tbody></table></div>`;

const page = path.join(__dirname, 'therapy-only-commission.html');
let src = fs.readFileSync(page, 'utf8');
const put = (name, body) => {
  // Greedy, so a stray copy of the END marker can never leave old content behind.
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*(<!-- ${name}:END -->)`);
  if (!re.test(src)) throw new Error(`marker ${name} not found in ${page}`);
  // A function replacement, so dollar amounts like "$247" in the body are not read as "$2" back-references.
  src = src.replace(re, (_, start, end) => `${start}\n${body}\n${end}`);
};
put('SUMMARY', summary);
put('LINES', html);
fs.writeFileSync(page, src);
console.log(`wrote ${items.length} programs into ${path.basename(page)}`);
