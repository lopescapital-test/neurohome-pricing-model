// The commission plan agreed in the November 20, 2026 meeting, run against the costs in model.js.
//
//   node docs/reviews/2026-11-comp-plan/agreed-plan.js           summary of the example sales
//   node docs/reviews/2026-11-comp-plan/agreed-plan.js --json    every number the page and deck use, as JSON
//   node docs/reviews/2026-11-comp-plan/agreed-plan.js --html    rewrite the data block in agreed-plan-stress-test.html
//
// Agreed rule: Specialists earn 10% on every sale, first plan or continued, therapy or equipment, paid on the price minus
// three exclusions that never pay commission: labs, physician or clinical-consult time (Dr. Jared, Dr. Kyle or any licensed
// clinician who diagnoses), and supplements (inside a program, sold alone, or as a supplement credit). Supplements instead
// fund the care team pool. Exclusions inside a program come out at our cost; a supplement credit comes out at face value.
// Nothing sold below cost pays commission.
//
// The draft is the board-review deck as presented (Plan A): 15% first plans, 10% continued, 20% of gross margin on
// equipment, 10% of price on supplements, no labs, no rate for the Dr. Jared bundle (shown at 15%). The Pre-Intensive draft
// figure includes the $250 bundle bonus and 1.5% paid-in-full bonus, the most the draft allows.
const fs = require('fs');
const path = require('path');
const M = require(path.join(__dirname, '../../../model.js'));

const RATE = 0.10;
const CARD = 0.03;
const POOL_RATE = 0.10; // share of supplement revenue set aside for the care team pool (placeholder; 5% was also discussed)
const LABS = new Set(['gut', 'oat', 'tox', 'neural', 'myco']);
const CLINICIAN = new Set(['md', 'kyle']);
const SUPPS = new Set(['intrakid', 'gutFeel', 'bena', 'adrena', 'suppList']);
const EXCLUDED = k => LABS.has(k) || CLINICIAN.has(k) || SUPPS.has(k) || k === 'suppCr';

const find = (sec, name) => {
  const p = M.PRODUCTS.find(x => x.sec === sec && x.name === name);
  if (!p) throw new Error(`no product ${sec} / ${name}`);
  return p;
};

/** Split a product into our cost, the excluded (pass-through) amount and the commissionable net. */
function split(p) {
  const r = M.calc(p);
  let labs = 0, clin = 0, supp = 0, credit = 0;
  for (const l of r.lines) {
    if (LABS.has(l.k)) labs += l.cost;
    else if (CLINICIAN.has(l.k)) clin += l.cost;
    else if (SUPPS.has(l.k)) supp += l.cost;
    else if (l.k === 'suppCr') credit += l.q; // a supplement credit is excluded at its face value
  }
  const excluded = labs + clin + supp + credit;
  return { r, labs, clin, supp, credit, excluded, passCost: labs + clin + supp + (credit ? r.lines.filter(l => l.k === 'suppCr').reduce((a, l) => a + l.cost, 0) : 0) };
}

function agreedComm(p, s) {
  if (s.r.lines.every(l => EXCLUDED(l.k))) return 0;   // labs, supplements, physician or clinician time sold on their own
  if (p.price <= s.r.cogs) return 0;                   // nothing sold below cost pays
  return RATE * Math.max(0, p.price - s.excluded);
}

// Example sales: one per kind of sale the plan has to handle.
const EX = [];
function add(id, kind, label, sub, p, draft, opts = {}) {
  const s = split(p);
  const price = opts.price ?? p.price;
  const cogs = opts.cogs ?? s.r.cogs;
  const pass = opts.pass ?? s.passCost;
  const gp = price - cogs;
  const agreed = opts.agreed ?? agreedComm({ ...p, price }, { ...s, r: { ...s.r, cogs } });
  const fees = CARD * price;
  const side = total => ({ total: Math.round(total), ofGP: gp > 0 ? total / gp * 100 : null, left: price - cogs - total - fees, leftPct: (price - cogs - total - fees) / price * 100 });
  EX.push({ id, kind, label, sub, price, cogs, pass, gp, gm: gp / price * 100, fees, excluded: opts.excluded ?? s.excluded,
    draft: { ...side(draft.total), comm: draft.comm, bonus: draft.bonus || 0 }, agreed: side(agreed), pool: opts.pool || 0, note: opts.note || '' });
}

const clin = find('v2c', '60-minute sessions');
add('clin', 'First therapy plan', 'Clinical, 60-minute sessions', 'Clinical v2', clin, { comm: 0.15 * clin.price, total: 0.15 * clin.price });
const guid = find('v2g', '4 days a week, 60-minute sessions');
add('guid', 'First therapy plan', 'Guided, 4 days a week, 60 min', 'Guided Intensive v2', guid, { comm: 0.15 * guid.price, total: 0.15 * guid.price });
const well = find('v2w', '1× a week, 60 min');
add('well', 'First therapy plan', 'Wellness, 1× a week, 60 min', 'Wellness v2, first quarter', well, { comm: 0.15 * well.price, total: 0.15 * well.price });
const pre = find('pre', 'Pre-Intensive');
add('pre', 'First therapy plan, mostly pass-through', 'Pre-Intensive', 'labs, physician hour and supplements inside', pre,
  { comm: 0.15 * pre.price, bonus: 250 + 0.015 * pre.price, total: 0.15 * pre.price + 250 + 0.015 * pre.price });

// Second intensive for a returning family: built from hours only, no kit and no labs. The meeting used $10,000 as the example.
{
  const labour = M.calc(guid).lines.filter(l => ['pt', 'coord', 'coach', 'hub'].includes(l.k)).reduce((a, l) => a + l.cost, 0);
  add('second', 'Second intensive, returning family', 'Second intensive, hours only', 'family already has the kit; $10,000 example', guid,
    { comm: 0.10 * 10000, total: 0.10 * 10000 }, { price: 10000, cogs: labour, pass: 0, excluded: 0, agreed: 0.10 * 10000,
      note: 'Cost is the therapy hours of a Guided 4-day 60-minute plan.' });
}
const cc = find('cc', '12 sessions + 1 PT assessment, 60 min');
add('cc', 'Continued therapy plan', 'Continuing Care, 12 sessions + 1 PT', 'per quarter', cc, { comm: 0.10 * cc.price, total: 0.10 * cc.price });

// Equipment: the tabletop panel (Ark) at the price and landed cost quoted in the meeting. The model still has $850 / $318.
{
  const panel = find('kit', 'Green Light LED Panel');
  const price = 800, cogs = 315 + 65 + 25; // unit + air freight to the US + shipping to the family
  add('ark', 'Equipment', 'Tabletop green light panel (Ark)', 'sold on its own', panel, { comm: 0.20 * (price - cogs), total: 0.20 * (price - cogs) },
    { price, cogs, pass: 0, excluded: 0, note: 'Price $800 and landed cost $405 by air ($315 unit, $65 freight, $25 to the family), from the meeting. By sea, freight is about $25 instead of $65.' });
}
const gf = find('supp', 'Gut Feeling Powder');
add('supp', 'Supplement', 'Gut Feeling Powder', 'sold on its own', gf, { comm: 0.10 * gf.price, total: 0.10 * gf.price }, { pool: POOL_RATE * gf.price });
const ad = find('supp', 'AdrenaCalm-SE KR-73');
add('adrena', 'Supplement, below cost', 'AdrenaCalm-SE', 'sold on its own; costs more than its price', ad, { comm: 0.10 * ad.price, total: 0.10 * ad.price }, { pool: POOL_RATE * ad.price });
const lab = find('labs', 'Gut Zoomer');
add('lab', 'Lab', 'Gut Zoomer', 'sold at cost plus a little', lab, { comm: 0, total: 0 });
const jb = find('v2a', 'Dr. Jared bundle');
add('jared', 'Physician and supplement credit', 'Dr. Jared bundle', '$500 physician hour + $1,500 supplement credit', jb, { comm: 0.15 * jb.price, total: 0.15 * jb.price });

// A typical month, on the deck's own assumptions: 4 families, $48,000 of plans each including $950 of labs, $6,000 of
// equipment with $3,600 of margin, $1,000 of supplements, $55,000 collected.
const month = (() => {
  const collected = 55000, therapy = 48000, labs = 4 * 950, equip = 6000, equipMargin = 3600, supp = 1000;
  const draft = { base: 0, therapy: 0.15 * therapy, equip: 0.20 * equipMargin, supp: 0.10 * supp, bonus: 860 };
  draft.total = draft.therapy + draft.equip + draft.supp + draft.bonus;
  const agreed = { base: 0, therapy: RATE * (therapy - labs), equip: RATE * equip, supp: 0, bonus: 0 };
  agreed.total = agreed.therapy + agreed.equip + agreed.supp + agreed.bonus;
  const fees = CARD * collected;
  return { collected, therapy, labs, equip, equipMargin, supp, fees, draft, agreed, pool: POOL_RATE * supp,
    draftShare: draft.total / collected * 100, agreedShare: agreed.total / collected * 100,
    draftCOS: (draft.total + fees) / collected * 100, agreedCOS: (agreed.total + fees) / collected * 100 };
})();

// What a Specialist earns: the deck's $12,000 average first plan, assumed to include $950 of labs, plus $1,500 of
// equipment per family (the typical month's $6,000 across 4 families).
const earnings = [2, 3, 4, 5, 6, 7].map(n => {
  const therapy = n * 12000;
  const draftA = 0.15 * therapy;
  const agreedTherapy = RATE * n * (12000 - 950);
  const agreedAll = agreedTherapy + RATE * n * 1500;
  return { families: n, therapy, draftA, agreedTherapy, agreedAll, agreedYear: agreedAll * 12 };
});

// Care team pool sizing at different supplement volumes (per month, paid quarterly).
const pool = [1000, 5000, 10000, 50000, 100000].map(rev => ({ monthly: rev, quarter: POOL_RATE * rev * 3 }));

// Every product in the catalogue under the agreed rule, grouped for the deck's "every product" slide.
const catalogue = M.PRODUCTS.map(p => { const s = split(p); return { sec: p.sec, name: p.name, price: p.price, excluded: s.excluded, comm: agreedComm(p, s), cogs: s.r.cogs }; });

const OUT = { rate: RATE, card: CARD, poolRate: POOL_RATE, examples: EX, month, earnings, pool, catalogue };

const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
if (process.argv.includes('--json')) { console.log(JSON.stringify(OUT)); return; }
if (process.argv.includes('--html')) {
  const page = path.join(__dirname, 'agreed-plan-stress-test.html');
  let src = fs.readFileSync(page, 'utf8');
  const re = /(\/\* DATA:START \*\/)[\s\S]*(\/\* DATA:END \*\/)/;
  if (!re.test(src)) throw new Error('DATA markers not found in ' + page);
  src = src.replace(re, (_, a, b) => `${a}\nconst DATA = ${JSON.stringify(OUT)};\n${b}`);
  fs.writeFileSync(page, src);
  console.log('wrote data into', path.basename(page));
  return;
}
for (const e of EX) console.log([e.id, e.label, money(e.price), 'cost', money(e.cogs), 'GP', money(e.gp), 'excluded', money(e.excluded), 'draft', money(e.draft.total), 'agreed', money(e.agreed.total), 'left', e.draft.leftPct.toFixed(1) + '% -> ' + e.agreed.leftPct.toFixed(1) + '%'].join(' | '));
console.log('month', JSON.stringify({ draft: month.draft.total, agreed: month.agreed.total, draftShare: month.draftShare.toFixed(1), agreedShare: month.agreedShare.toFixed(1), draftCOS: month.draftCOS.toFixed(1), agreedCOS: month.agreedCOS.toFixed(1), pool: month.pool }));
for (const e of earnings) console.log('earn', e.families, money(e.draftA), money(e.agreedTherapy), money(e.agreedAll), money(e.agreedYear));
