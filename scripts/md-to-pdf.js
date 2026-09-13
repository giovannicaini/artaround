// Converte un Markdown in PDF con una stampa curata (titoli, tabelle, blocchi
// di codice, interruzioni di pagina) — usato per rigenerare docs/studio-progetto.pdf
// dal relativo .md. Richiede "marked" e "playwright" (non dipendenze del
// progetto: installarle ad hoc con `npm install marked playwright --no-save`
// prima di lanciarlo, se non già presenti).
//
// Uso:
//   node scripts/md-to-pdf.js docs/studio-progetto.md docs/studio-progetto.pdf

const fs = require('fs');
const { marked } = require('marked');
const { chromium } = require('playwright');

const [, , mdPath, pdfPath] = process.argv;
if (!mdPath || !pdfPath) {
  console.error('Uso: node scripts/md-to-pdf.js <input.md> <output.pdf>');
  process.exit(1);
}

const md = fs.readFileSync(mdPath, 'utf-8');

marked.use({ gfm: true, breaks: false });
const bodyHtml = marked.parse(md);

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #1a1a1a;
    max-width: 100%;
  }
  h1, h2, h3, h4 {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    page-break-after: avoid;
  }
  h1 { font-size: 22pt; border-bottom: 3px solid #6d28d9; padding-bottom: 6px; margin-top: 0; }
  h1:not(:first-of-type) { margin-top: 36px; page-break-before: always; }
  h2 { font-size: 15pt; border-bottom: 1px solid #d1d5db; padding-bottom: 3px; margin-top: 28px; color: #5b21b6; }
  h3 { font-size: 12.5pt; margin-top: 20px; color: #374151; }
  p, li { orphans: 3; widows: 3; }
  code {
    font-family: "SFMono-Regular", Consolas, monospace;
    background: #f3f4f6;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.92em;
  }
  pre {
    background: #1e1e2e;
    color: #e2e8f0;
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.45;
    page-break-inside: avoid;
  }
  pre code { background: none; padding: 0; color: inherit; }
  blockquote {
    border-left: 4px solid #a78bfa;
    margin: 12px 0;
    padding: 4px 14px;
    color: #4b5563;
    background: #f5f3ff;
    font-style: italic;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9.5pt;
    margin: 14px 0;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }
  th { background: #ede9fe; color: #4c1d95; }
  tr:nth-child(even) td { background: #faf9ff; }
  hr { border: none; border-top: 1px solid #d1d5db; margin: 24px 0; }
  a { color: #6d28d9; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="font-size:8px; width:100%; text-align:center; color:#9ca3af;">ArtAround — Guida di studio · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await browser.close();
  console.log('PDF generato:', pdfPath);
})();
