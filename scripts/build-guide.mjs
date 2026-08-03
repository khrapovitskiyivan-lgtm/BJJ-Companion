// Рендер docs/user-guide.md -> брендовый HTML для печати в PDF (Chrome --print-to-pdf).
// Оформление как v7: navy скруглённая плашка-шапка с белым заголовком, тёмно-navy
// текст, золотые акценты, Segoe UI (системный), формат 110x196мм.
//
// Пайплайн обновления PDF-инструкции бота (public/BJJ-Companion-guide.pdf):
//   1) правишь docs/user-guide.md (кратко, по существу, без em-dash)
//   2) node scripts/build-guide.mjs            # печатает путь к сгенерированному HTML
//   3) печать в PDF в ASCII-путь и копия в public/ (путь репо с кириллицей ломает Chrome):
//        chrome --headless=new --disable-gpu --no-pdf-header-footer \
//          --print-to-pdf="$TMP/guide.pdf" "file://$HTML"
//        cp "$TMP/guide.pdf" public/BJJ-Companion-guide.pdf
//      (chrome.exe: "C:/Program Files/Google/Chrome/Application/chrome.exe")
//   4) бампни ?v=N в GUIDE_URL (src/routes/api.tg-webhook.ts) - Telegram кэширует документ по URL
//   5) деплой (npx vercel --prod --yes --scope ivankhr), curl-проверь размер PDF на проде
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(tmpdir(), "bjj-guide.html");

const md = readFileSync(join(ROOT, "docs", "user-guide.md"), "utf8");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

// Минимальный MD->HTML под наш контролируемый синтаксис: # / ## заголовки,
// **жирный**, маркированные и нумерованные списки, --- разделитель, абзацы.
function mdToHtml(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^#\s+/.test(line)) { out.push(`<h1>${inline(line.replace(/^#\s+/, ""))}</h1>`); i++; continue; }
    if (/^##\s+/.test(line)) { out.push(`<h2>${inline(line.replace(/^##\s+/, ""))}</h2>`); i++; continue; }
    if (/^---\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^-\s+/, ""))}</li>`); i++; }
      out.push(`<ul>${items.join("")}</ul>`); continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`); i++; }
      out.push(`<ol>${items.join("")}</ol>`); continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    const buf = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,2}\s|-\s|\d+\.\s|---\s*$)/.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${buf.map(inline).join(" ")}</p>`);
  }
  return out.join("\n");
}

const body = mdToHtml(md);

// Палитра v7: navy #2B2F6B, золото #C79A4E, тёмно-navy текст #262640.
const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<style>
@page{size:110mm 196mm;margin:10mm 9mm;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:10.5pt;line-height:1.42;color:#262640;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
h1{background:#2B2F6B;color:#fff;font-size:17pt;line-height:1.12;font-weight:600;margin:0 0 9pt;padding:10pt 11pt 11pt;border-radius:7pt;letter-spacing:-0.2pt;}
h2{font-size:12.5pt;font-weight:600;color:#2B2F6B;margin:13pt 0 4pt;padding-bottom:2.5pt;border-bottom:0.8pt solid #C79A4E;}
h2:first-of-type{margin-top:9pt;}
p{margin:0 0 6pt;}
ul,ol{margin:0 0 6pt;padding-left:15pt;}
li{margin:0 0 3pt;}
li::marker{color:#C79A4E;}
strong{font-weight:700;color:#1b1b28;}
hr{border:none;border-top:0.8pt solid #C79A4E;margin:11pt 0 9pt;}
</style></head>
<body>
${body}
</body></html>`;

writeFileSync(OUT, html, "utf8");
console.log("HTML ->", OUT);
console.log("Дальше: печать в PDF через Chrome (см. шапку скрипта), затем cp в public/BJJ-Companion-guide.pdf и бамп ?v=N");
