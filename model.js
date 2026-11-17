/*
 * NeuroHome pricing model — the data and the math, no UI.
 *
 * One file that both the browser page (index.html) and Node scripts load, so every model built on it
 * (clinics, expanded telehealth, ...) prices from the same cost library and the same calc().
 *
 *   Browser: <script src="model.js"></script>  ->  window.NHModel
 *   Node:    const NHModel = require('./model.js')
 *
 * Shape
 *   COMPONENTS  the cost library. One entry per labor role (per hour) or merchandise item (per unit).
 *               kind: 'labor' | 'merch'. cost: our cost per unit. retail: what one unit sells for alone (null = not sold alone).
 *               costFrom: 'wsPct' means the cost is GLOBALS.wsPct % of the unit (a $ of retail or list price).
 *               assumed: true = no source; a guess to replace. flag: true = the recorded cost looks wrong.
 *   GLOBALS     cost-of-sale and target settings.
 *   SECTIONS    product groups, each with an optional margin floor (%).
 *   PRODUCTS    every sellable item: { sec, name, price, lines: [[componentKey, qty, why?], ...] }.
 *   calc()      price -> per-part cost, labor/merch totals, gross profit, margin, cost of sale, status.
 *
 * Prices: neurohome-app lib/pricing (catalogue and registries), read 2026-11-17.
 * Costs:  neurohome-journey Plans v5.0 (2026-08-20); neurohome-app CLAUDE.md notes for the green panel, green handheld, coach.
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.NHModel = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const META = {
    asOf: '2026-11-17',
    prices: 'neurohome-app lib/pricing (catalogue.ts and registry/*), read 2026-11-17',
    costs: 'neurohome-journey sources/plans.html v5.0 (2026-08-20); neurohome-app CLAUDE.md (green panel $318, green handheld $247, coach $40/hr)',
  };

  /* ---------- Cost library ---------- */
  const COMPONENTS = {
    // Labor, per hour
    pt:      { kind: 'labor', sec: 'Labor rates', short: 'PT', label: 'Physical therapist (PT)', unit: 'hr', cost: 70, retail: 240, src: 'Plans v5.0: PRN 1099. Sells at $120 per 30 min.' },
    coord:   { kind: 'labor', sec: 'Labor rates', short: 'Coordinator (PTA)', label: 'Coordinator (PTA)', unit: 'hr', cost: 40, retail: 100, src: 'No cost on record; set equal to coach.', assumed: true },
    coach:   { kind: 'labor', sec: 'Labor rates', short: 'Coach', label: 'Coach', unit: 'hr', cost: 40, retail: 100, src: 'App notes 2026-11-02 ($40/hr). Sells at $50 per 30 min.' },
    md:      { kind: 'labor', sec: 'Labor rates', short: 'Physician (Dr. Jared)', label: 'Physician (Dr. Jared)', unit: 'hr', cost: 500, retail: 500, src: 'Priced at cost by design (Jake, 2026-09-26).' },
    kyle:    { kind: 'labor', sec: 'Labor rates', short: 'Dr. Kyle', label: 'Dr. Kyle (owner)', unit: 'hr', cost: 0, retail: 500, src: 'Owner time; no cash cost recorded. Enter an opportunity cost if wanted.', assumed: true },
    evaSup:  { kind: 'labor', sec: 'Labor rates', short: 'Eva support', label: 'Eva support line, per family', unit: 'family', cost: 0, retail: null, src: 'Business-hours support. Not costed anywhere.', assumed: true },
    // Kit and devices, per unit
    panel:   { kind: 'merch', sec: 'Kit & devices', short: 'Green panel', label: 'Green Light LED Panel', unit: 'ea', cost: 318, retail: 850, src: 'App notes (was $315 in the cost model).' },
    gHand:   { kind: 'merch', sec: 'Kit & devices', short: 'Green handheld', label: 'Green Light LED Handheld', unit: 'ea', cost: 247, retail: 650, src: 'App notes (was $250).' },
    rHand:   { kind: 'merch', sec: 'Kit & devices', short: 'Red handheld', label: 'Red Light LED Handheld', unit: 'ea', cost: 120, retail: 450, src: 'Plans v5.0 (RL12-B.1).' },
    glasses: { kind: 'merch', sec: 'Kit & devices', short: 'Glasses', label: 'Color therapy glasses, one pair', unit: 'pair', cost: 20, retail: 30, src: 'Plans v5.0: GloFX, $20 a pair. The kit ships two pairs.' },
    oils:    { kind: 'merch', sec: 'Kit & devices', short: 'Oils', label: 'Essential oils set', unit: 'ea', cost: 15, retail: 30, src: 'Plans v5.0 (ArtNaturals Top 6).' },
    vib:     { kind: 'merch', sec: 'Kit & devices', short: 'Vibration tool', label: 'Vibration tool', unit: 'ea', cost: 40, retail: 80, src: 'Plans v5.0 (SensoryBuzz).' },
    saebo:   { kind: 'merch', sec: 'Kit & devices', short: 'SaeboStim', label: 'SaeboStim', unit: 'ea', cost: 250, retail: 560, src: 'Plans v5.0 inventory cost. Direct from Saebo is $279.' },
    pads:    { kind: 'merch', sec: 'Kit & devices', short: 'Electrode pads', label: 'Electrode pads, 10-pack', unit: 'pack', cost: 15, retail: null, src: 'Plans v5.0 (TensCare, bulk landed).' },
    laser:   { kind: 'merch', sec: 'Kit & devices', short: '3B laser', label: '3B laser', unit: 'ea', cost: 4000, retail: 8000, src: 'Plans v5.0 (on hold in that model).' },
    hub:     { kind: 'merch', sec: 'Kit & devices', short: 'Hub', label: 'NeuroSage Hub, per month', unit: 'mo', cost: 0, retail: 50, src: 'Carried at $0. Hosting and AI inference not costed.', assumed: true },
    // Labs, per panel
    gut:     { kind: 'merch', sec: 'Labs', short: 'Gut Zoomer', label: 'Gut Zoomer', unit: 'ea', cost: 550, retail: 600, src: 'All-in cost to clinic (Plans v5.0).' },
    oat:     { kind: 'merch', sec: 'Labs', short: 'Organic Acids', label: 'Organic Acids', unit: 'ea', cost: 400, retail: 450, src: 'Plans v5.0.' },
    tox:     { kind: 'merch', sec: 'Labs', short: 'Total Tox', label: 'Total Tox Burden', unit: 'ea', cost: 700, retail: 775, src: 'Plans v5.0.' },
    neural:  { kind: 'merch', sec: 'Labs', short: 'Neural Zoomer+', label: 'Neural Zoomer Plus', unit: 'ea', cost: 450, retail: 500, src: 'Plans v5.0.' },
    myco:    { kind: 'merch', sec: 'Labs', short: 'Mycotoxins', label: 'Mycotoxins', unit: 'ea', cost: 427, retail: 475, src: 'Back-solved from the cost + 10% ruling ($470).', assumed: true },
    // Supplements
    intrakid:{ kind: 'merch', sec: 'Supplements', short: 'Intrakid', label: 'Intrakid, one month', unit: 'ea', cost: 45, retail: 115, src: 'Plans v5.0 ($90 for 2 months).' },
    gutFeel: { kind: 'merch', sec: 'Supplements', short: 'Gut Feeling', label: 'Gut Feeling Powder, one month', unit: 'ea', cost: 80, retail: 165, src: 'Plans v5.0 ($160 for 2 months).' },
    bena:    { kind: 'merch', sec: 'Supplements', short: 'benaGene', label: 'benaGene Lozenges, one month', unit: 'ea', cost: 30, retail: 59, src: 'Plans v5.0 ($60 for 2 months).' },
    adrena:  { kind: 'merch', sec: 'Supplements', short: 'AdrenaCalm', label: 'AdrenaCalm-SE, one bottle', unit: 'ea', cost: 65, retail: 50, src: 'Kit Composition v0.12 ($65 a bottle). Above its $50 retail: check the invoice.', flag: true },
    suppCr:  { kind: 'merch', sec: 'Supplements', short: 'Supplement credit', label: 'Supplement credit, per $1 of retail', unit: '$', costFrom: 'wsPct', retail: 1, src: 'Spent at retail prices; costs the wholesale % setting.' },
    suppList:{ kind: 'merch', sec: null, short: 'Supplement (list-priced)', label: 'Supplement at list price', unit: '$ of list', costFrom: 'wsPct', retail: 1, hidden: true, src: 'No recorded cost; costs the wholesale % setting.' },
  };

  /* ---------- Settings ---------- */
  const GLOBALS = {
    payPct: 3,     // card + financing fees, % of price
    commPct: 0,    // sales commission, % of price (enter yours)
    targetPct: 50, // margin target for sections with no floor
    wsPct: 50,     // supplement wholesale as % of retail, for SKUs with no recorded cost
  };

  /* ---------- Sections ---------- */
  const SECTIONS = [
    { id: 'v2c', label: 'Clinical (v2)', chip: 'Programs v2', floor: 60, floorWhy: 'Clinical and Guided floor 60% (Matthew for Jake, 2026-10-29)' },
    { id: 'v2g', label: 'Guided (v2)', chip: 'Programs v2', floor: 60, floorWhy: 'Clinical and Guided floor 60%' },
    { id: 'v2w', label: 'Wellness (v2), 12-week first quarter', chip: 'Programs v2', floor: 70, floorWhy: 'Wellness floor 70%' },
    { id: 'v2wm', label: 'Wellness (v2), each month after', chip: 'Programs v2', floor: 70, floorWhy: 'Wellness floor 70%' },
    { id: 'v2a', label: 'v2 add-on', chip: 'Programs v2' },
    { id: 'v1c', label: 'Clinical (v1, honoured on old offers)', chip: 'Programs v1', floor: 60, floorWhy: 'Same 60% floor' },
    { id: 'v1g', label: 'Guided (v1)', chip: 'Programs v1', floor: 60, floorWhy: 'Same 60% floor' },
    { id: 'v1w', label: 'Wellness (v1)', chip: 'Programs v1', floor: 70, floorWhy: 'Same 70% floor' },
    { id: 'pre', label: 'Pre-Intensive and Eva', chip: 'Pre-Intensive & Eva' },
    { id: 'cc', label: 'Continuing Care, per quarter', chip: 'Continuing Care' },
    { id: 'time', label: 'Care-team time', chip: 'Time & physician' },
    { id: 'phys', label: 'Physician review', chip: 'Time & physician' },
    { id: 'labs', label: 'Labs', chip: 'Labs' },
    { id: 'kit', label: 'Kit, devices and Hub', chip: 'Kit & devices' },
    { id: 'supp', label: 'Supplements, sold each', chip: 'Supplements' },
  ];

  /* ---------- Products ---------- */
  const KIT_THERAPIST = [['panel', 1], ['gHand', 1], ['rHand', 1], ['glasses', 2], ['oils', 1], ['vib', 1], ['saebo', 1], ['pads', 1]];
  const KIT_SIX = [['panel', 1], ['gHand', 1], ['rHand', 1], ['glasses', 2], ['oils', 1], ['vib', 1]];
  const CORE_FOUR_2MO = [['intrakid', 2], ['gutFeel', 2], ['bena', 2], ['adrena', 2]];
  const WEEK0_TWO = ['coach', 2, 'Week 0: two 60-min setup calls'];

  const OTHER_SUPPLEMENTS = [['Gut Feeling Travel Sachets', '185.00'], ['Gut Feeling Capsules', '185.00'], ['benaGene Capsules', '49.00'], ['AdrenaStim-SE KR-73', '46.98'], ['Advanced TUDCA', '89.95'], ['Argentyn 23 Sinus Relief Spray', '22.99'], ['B12 Max K-56', '27.98'], ['Calcium D-Glucarate', '85.99'], ['CT-Zyme', '56.95'], ['BC-ATP', '76.95'], ['Biotoxin Binder', '76.95'], ['Bowel Mover', '51.95'], ['Carboxy', '89.95'], ['CT-Minerals', '56.95'], ['HM-ET Binder', '87.95'], ['KL-Support', '61.95'], ['Lymphactiv', '51.95'], ['Para 1', '46.95'], ['Para 2', '53.95'], ['Para 3', '53.95'], ['Para 4', '62.95'], ['Dopaflo K-49', '35.98'], ['Dopatone Active K-41', '47.98'], ['Gabatone Active K-39', '45.98'], ['HistDAO', '61.99'], ['MegaSporeBiotic', '66.25'], ['Quicksilver Melatonin', '45.00'], ['NeurO2 K-45', '49.98'], ['NeuroFlam-NT K-77', '64.98'], ['Organic Spore Powder', '125.25'], ['OptiMag Neuro', '78.99'], ['Oxicell-SE KR-70', '49.98'], ['Serotone Active K-38', '67.98'], ['Tributyrin 350 Active K-132', '56.98'], ['Tro Just Blue', '27.00'], ['Tro+', '34.00'], ['ViraDChem Binder', '67.95'], ['Monolaurin-Avail', '47.75'], ['AC-Glutathione K-88', '62.98'], ['Liqua-D K-87', '21.98'], ['Brain-E DHA Liquid K-53', '59.98'], ['Creatine Monohydrate 450 g', '32.75'], ['Phyto Brain-E K-54', '89.98'], ['All Thiamine', '16.99'], ['S-Acetyl Glutathione', '74.99'], ['Carnitine Synergy', '78.75'], ['Folinic Acid Lozenges', '20.00'], ['Resvero-SE Active K-125', '75.98'], ['Repairvite-SE K-98', '51.98'], ['Silvercillin 16 oz', '72.00'], ['MitoActive', '89.95'], ['Myc-P', '79.99'], ['Elim-a-cand', '79.99'], ['Crypto-Plus', '79.99'], ['Nitric Balance K-62', '51.98'], ['Core Nutrients', '89.95']];

  function buildProducts() {
    const P = [];
    const add = (sec, name, price, lines, extra) => P.push(Object.assign({ sec, name, price, lines }, extra || {}));

    // v2 Clinical: 5 days, 8 weeks, 40 sessions; session 1 a 60-min assessment; a 60-min closing call in week 9.
    for (const [m, price] of [[60, 14500], [90, 18400], [120, 22350]]) {
      const h = (60 + 39 * m + 60) / 60;
      add('v2c', `${m}-minute sessions`, price, [['pt', h, `60-min assessment + 39 × ${m} min + 60-min closing call`], WEEK0_TWO, ...KIT_THERAPIST, ['gut', 1], ['oat', 1], ['hub', 2, 'Hub, months 1–2']],
        { sub: '40 sessions over 8 weeks, PT on every call', note: 'A coach is assigned to Clinical families but is never on a call; that time is not costed here. The Dr. Jared bundle ($2,000) is its own line.' });
    }
    // v2 Guided: Mondays PT (60 + 7 × 30 + 60 min = 5.5 h) with the coach on; the coach the other days at the chosen length.
    const GV2 = { 4: { 60: 10850, 90: 12150, 120: 13450 }, 5: { 60: 11700, 90: 13450, 120: 15150 } };
    for (const d of [4, 5]) for (const m of [60, 90, 120]) {
      const coachH = (540 + 8 * (d - 1) * m) / 60;
      add('v2g', `${d} days a week, ${m}-minute sessions`, GV2[d][m], [['pt', 5.5, 'Mondays: 60-min assessment, 7 × 30-min check-ins, 60-min closing'], ['coord', coachH, `Mondays 9 h + 8 wk × ${d - 1} days × ${m} min`], WEEK0_TWO, ...KIT_THERAPIST, ['gut', 1], ['oat', 1], ['hub', 2, 'Hub, months 1–2']],
        { sub: `${d - 1} coach days after Monday, 8 weeks`, note: 'Coach-led days are costed at the coordinator (PTA) rate.' });
    }
    const WQ = { 1: { 45: 4400, 60: 4850, 90: 5750 }, 2: { 45: 5750, 60: 6600, 90: 8400 }, 3: { 45: 7050, 60: 8400, 90: 11050 } };
    const WM = { 1: { 45: 460, 60: 600, 90: 900 }, 2: { 45: 920, 60: 1200, 90: 1800 }, 3: { 45: 1380, 60: 1800, 90: 2700 } };
    for (const s of [1, 2, 3]) for (const m of [45, 60, 90])
      add('v2w', `${s}× a week, ${m} min`, WQ[s][m], [['coach', 12 * s * m / 60, `12 wk × ${s} × ${m} min`], WEEK0_TWO, ...KIT_SIX, ['hub', 3, 'Hub, the quarter']], { sub: 'Six-item kit included' });
    for (const s of [1, 2, 3]) for (const m of [45, 60, 90])
      add('v2wm', `${s}× a week, ${m} min`, WM[s][m], [['coach', 4 * s * m / 60, `4 wk × ${s} × ${m} min`], ['hub', 1]], { sub: 'Coaching only; invoiced by hand' });
    add('v2a', 'Dr. Jared bundle', 2000, [['md', 1, 'One Dr. Jared hour'], ['suppCr', 1500, '$750 a month × 2 months, spent at retail']],
      { sub: 'Physician hour + $1,500 supplement credit', note: 'Assumes the whole credit is spent. Credit that expires unspent (90 days after the plan) raises the margin.' });

    // v1 (honoured for families holding v1 offers)
    for (const [n, price] of [[24, 10000], [32, 11400], [40, 12850]]) {
      const h = (n / 4) * 1.5 + (n * 3 / 4);
      add('v1c', `PT ${n / 8}× a week`, price, [['pt', h, `${n / 4} × 90 min (wk 1–2) + ${n * 3 / 4} × 60 min`], ['md', 1, 'Physician hour'], WEEK0_TWO, ...KIT_THERAPIST, ['gut', 1], ...CORE_FOUR_2MO, ['hub', 2]], { sub: `${n} sessions` });
    }
    for (const [c, price] of [[16, 8000], [24, 8550], [32, 9050]])
      add('v1g', `PT 1 + coordinator ${c / 8}× a week`, price, [['pt', 6, '8 × 45 min'], ['coord', c * 0.75, `${c} × 45 min`], ['md', 0.5, '30-min written assessment'], WEEK0_TWO, ...KIT_THERAPIST, ['gut', 1], ...CORE_FOUR_2MO, ['hub', 2]], { sub: `8 PT + ${c} coordinator sessions` });
    for (const [n, price] of [[8, 3900], [16, 4650], [20, 5000], [24, 5350]])
      add('v1w', `${n} coach sessions`, price, [['coach', n * 0.75, `${n} × 45 min`], WEEK0_TWO, ...KIT_SIX, ['hub', 2]]);

    add('pre', 'Pre-Intensive', 5400, [['coach', 1, 'Week 0 onboarding call'], ['coach', 4, '8 × 30-min check-ins'], ['md', 1, 'Physician hour'], ['gut', 1], ['oat', 1], ['tox', 1], ['neural', 1], ...CORE_FOUR_2MO, ['panel', 1], ['hub', 2]],
      { sub: 'All four labs, physician hour, core four, green panel', note: 'Labs, the physician hour and supplements are about 85% of the cost and are each priced near cost elsewhere. The package price has not moved since the labs were added.' });
    add('pre', 'Eva', 1200, [['evaSup', 1], ['hub', 12, 'Hub access, assumed 12 months']], { sub: 'Hub access, no sessions', note: 'Support line and Hub costs are not recorded anywhere; enter them in the library.' });

    for (const mins of [60, 90]) for (const k of ['24-3', '24-1', '18-3', '18-1', '12-3', '12-1', '6-3', '6-1', '3-3', '3-1']) {
      const [s, a] = k.split('-').map(Number), f = mins / 60;
      add('cc', `${s} sessions + ${a} PT assessment${a > 1 ? 's' : ''}, ${mins} min`, s * 100 * f + a * 240 * f, [['coord', s * f, `${s} × ${mins}-min coordinator sessions`], ['pt', a * f, `${a} × ${mins}-min PT assessments`]]);
    }

    add('time', 'PT time, 30 minutes', 120, [['pt', 0.5]]);
    add('time', 'Coach time, 30 minutes', 50, [['coach', 0.5]]);
    add('time', 'Dr. Jared time, 30 minutes', 250, [['md', 0.5]], { atCost: true });
    add('time', 'Dr. Kyle time, 30 minutes', 250, [['kyle', 0.5]]);
    add('time', 'Extra weekly support session', 500, [['coach', 6, 'Assumed 8 × 45 min over the program']], { note: 'The catalogue says "one extra weekly support session" without a count; 8 weeks is assumed.' });
    add('phys', 'Written report', 250, [['md', 0.5]], { atCost: true });
    add('phys', 'Full hour, live', 500, [['md', 1]], { atCost: true });
    add('phys', 'Upgrade written report to full hour', 250, [['md', 0.5]], { atCost: true });

    for (const [k, n] of [['gut', 'Gut Zoomer'], ['oat', 'Organic Acids'], ['tox', 'Total Tox Burden'], ['neural', 'Neural Zoomer Plus'], ['myco', 'Mycotoxins']])
      add('labs', n, COMPONENTS[k].retail, [[k, 1]], { atCost: true, note: 'Priced at cost + about 10% by design (Jake, 2026-11-02 and 11-03).' });

    add('kit', 'Green Light LED Panel', 850, [['panel', 1]]);
    add('kit', 'Green Light LED Handheld', 650, [['gHand', 1]]);
    add('kit', 'Red Light LED Handheld', 450, [['rHand', 1]]);
    add('kit', 'Blue color therapy glasses', 30, [['glasses', 1]]);
    add('kit', 'Red color therapy glasses', 30, [['glasses', 1]]);
    add('kit', 'Essential oils', 30, [['oils', 1]]);
    add('kit', 'Vibration tool', 80, [['vib', 1]]);
    add('kit', 'SaeboStim', 560, [['saebo', 1]], { note: 'Electrode pads are handled by hand and not sold.' });
    add('kit', '3B laser', 8000, [['laser', 1]]);
    add('kit', 'Hub, monthly after month 2', 50, [['hub', 1]]);

    add('supp', 'Intrakid', 115, [['intrakid', 1]]);
    add('supp', 'Gut Feeling Powder', 165, [['gutFeel', 1]]);
    add('supp', 'benaGene Lozenges', 59, [['bena', 1]]);
    add('supp', 'AdrenaCalm-SE KR-73', 50, [['adrena', 1]]);
    for (const [n, listed] of OTHER_SUPPLEMENTS) {
      const list = Math.round(Number(listed) * 100) / 100;
      add('supp', n, Math.ceil(list), [['suppList', list]], { sub: `List $${listed}, sold rounded up` });
    }
    return P;
  }

  /* ---------- Math ---------- */
  function unitCost(comp, g) { return comp.costFrom === 'wsPct' ? g.wsPct / 100 : comp.cost; }

  /**
   * Price one product against a cost library and settings.
   * Returns per-line costs, per-part totals (same part on two lines summed), labor/merch totals,
   * gross profit and margin, cost of sale, what is left for overhead and profit, and status vs. the floor.
   */
  function calc(p, components, g, sections) {
    components = components || COMPONENTS; g = g || GLOBALS; sections = sections || SECTIONS;
    const lines = p.lines.map(([k, q, why]) => {
      const c = components[k];
      if (!c) throw new Error(`Unknown component "${k}" in "${p.name}"`);
      const u = unitCost(c, g);
      return { k, c, q, why, u, cost: u * q, retail: c.retail == null ? null : c.retail * q };
    });
    const parts = {};
    for (const l of lines) { const x = parts[l.k] || (parts[l.k] = { q: 0, cost: 0 }); x.q += l.q; x.cost += l.cost; }
    const sum = kind => lines.filter(l => l.c.kind === kind).reduce((a, l) => a + l.cost, 0);
    const labor = sum('labor'), merch = sum('merch');
    const cogs = labor + merch, gp = p.price - cogs, gm = gp / p.price;
    const cos = p.price * (g.payPct + g.commPct) / 100, left = gp - cos;
    const standalone = lines.every(l => l.retail != null) ? lines.reduce((a, l) => a + l.retail, 0) : null;
    const sec = sections.find(s => s.id === p.sec);
    const floor = sec && sec.floor != null ? sec.floor : g.targetPct;
    let status;
    if (p.atCost) status = ['info', 'At cost by design'];
    else if (gm * 100 >= floor) status = ['good', `Meets ${floor}%`];
    else if (gm * 100 >= floor - 5) status = ['warn', `Within 5 pts of ${floor}%`];
    else status = ['bad', `Below ${floor}%`];
    return { lines, parts, labor, merch, cogs, gp, gm, cos, left, standalone, floor, status };
  }

  /** A deep copy of the cost library, for a page or a scenario that edits costs without touching the defaults. */
  function cloneComponents() { return JSON.parse(JSON.stringify(COMPONENTS)); }

  return { META, COMPONENTS, GLOBALS, SECTIONS, PRODUCTS: buildProducts(), unitCost, calc, cloneComponents };
});
