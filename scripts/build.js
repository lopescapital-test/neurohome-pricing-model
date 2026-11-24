#!/usr/bin/env node
// Builds dist/margin-book.html: index.html with model.js and app.js inlined, as one self-contained file.
// That file is what gets published as the Margin Book artifact (an artifact cannot load sibling scripts from the repo).
// The artifact host supplies its own <!doctype>, <html>, <head> and <body>, so the document wrapper is stripped here.
// It also writes docs/margin-book/index.html, the same page as a full document, which GitHub Pages serves.
// Usage: node scripts/build.js          -> writes both files and prints the commit they were built from.
//        node scripts/build.js --check  -> writes nothing; exits 1 if docs/margin-book/index.html is out of date.
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

const inlined = html;

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

// GitHub Pages copy: keeps the document wrapper, carries no commit stamp so it only changes when the page does.
const pagesOut = path.join(root, 'docs', 'margin-book', 'index.html');
const pages = inlined.replace('<title>', '<!-- Built by scripts/build.js from index.html, model.js and app.js. Edit those, not this file. -->\n<title>');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(pagesOut) ? fs.readFileSync(pagesOut, 'utf8') : '';
  // Compare ignoring line endings: git's autocrlf may check the file out with CRLF on Windows.
  if (current.replace(/\r\n/g, '\n') !== pages.replace(/\r\n/g, '\n')) { console.error('docs/margin-book/index.html is out of date: run node scripts/build.js and commit it.'); process.exit(1); }
  console.log('docs/margin-book/index.html is up to date.');
  process.exit(0);
}
fs.mkdirSync(path.dirname(pagesOut), { recursive: true });
fs.writeFileSync(pagesOut, pages);

const out = path.join(root, 'dist', 'margin-book.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out}\n${pagesOut}\nbuilt from ${sha}, ${html.length} bytes`);
