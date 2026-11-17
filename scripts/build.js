#!/usr/bin/env node
// Builds dist/margin-book.html: index.html with model.js and app.js inlined, as one self-contained file.
// That file is what gets published as the Margin Book artifact (an artifact cannot load sibling scripts from the repo).
// The artifact host supplies its own <!doctype>, <html>, <head> and <body>, so the document wrapper is stripped here.
// Usage: node scripts/build.js        -> prints the output path and the commit it was built from.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = read('index.html');

for (const f of ['model.js', 'app.js']) {
  const tag = `<script src="${f}"></script>`;
  if (!html.includes(tag)) throw new Error(`index.html no longer loads ${f} with ${tag}; update scripts/build.js`);
  // "</script" inside inlined JS (even in a comment) would end the script element early; "<\/script" means the same in JS.
  const js = read(f).replace(/<\/script/gi, '<\\/script');
  html = html.replace(tag, () => `<script>\n${js}\n</script>`);
}

// Strip the document wrapper; keep <title>, metas the artifact contract asks for, styles and body content.
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '\n');

let sha = 'uncommitted';
try { sha = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch (e) {}
html = html.replace('<title>', `<!-- Built from neurohome-pricing-model @ ${sha} by scripts/build.js. Edit the repo, not this file. -->\n<title>`);

const out = path.join(root, 'dist', 'margin-book.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out}\nbuilt from ${sha}, ${html.length} bytes`);
