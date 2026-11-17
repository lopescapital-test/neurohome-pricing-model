#!/usr/bin/env node
// Prints every product as CSV: price, cost per labor role and per merchandise item, totals and margin.
// Usage: node scripts/export-csv.js > margins.csv      (settings: PAY=3 COMM=10 WS=50 node scripts/export-csv.js)
const M = require('../model.js');
const g = { ...M.GLOBALS };
if (process.env.PAY) g.payPct = +process.env.PAY;
if (process.env.COMM) g.commPct = +process.env.COMM;
if (process.env.WS) g.wsPct = +process.env.WS;
const keys = Object.keys(M.COMPONENTS);
const q = v => `"${String(v).replace(/"/g, '""')}"`;
const sec = id => M.SECTIONS.find(s => s.id === id).label;
console.log(['section', 'item', 'price', ...keys.map(k => `cost_${k}`), 'labor_cost', 'merch_cost', 'total_cost', 'gross_profit', 'gross_margin_pct', 'after_cost_of_sale_pct', 'status'].join(','));
for (const p of M.PRODUCTS) {
  const r = M.calc(p, M.COMPONENTS, g);
  const row = [sec(p.sec), p.name, p.price, ...keys.map(k => r.parts[k] ? r.parts[k].cost.toFixed(2) : ''),
    r.labor.toFixed(2), r.merch.toFixed(2), r.cogs.toFixed(2), r.gp.toFixed(2), (r.gm * 100).toFixed(1), (r.left / p.price * 100).toFixed(1), r.status[1]];
  console.log(row.map(q).join(','));
}
