// Нарезка листов design/ в public/avatars/ для составного аватара («бумажная кукла»):
//  - bodies-sheet.png (5 колонок-поясов x 3 ряда-кимоно, тела безголовые)
//      -> body-{kimono}-{belt}.webp (15 шт, фон остаётся: это нижний слой)
//  - heads-male-sheet.png / heads-female-sheet.png (3x2)
//      -> head-{m|f}{1..6}.webp (12 шт, фон -> прозрачность)
// Фон голов убирается flood-fill от краёв: почти-белые пиксели, связанные с краем,
// получают альфу 0. Глазные белки не связаны с краем и не страдают.
// У мужского листа чёрные линии сетки: режем с внутренним отступом.
// Превью-композит для подбора констант выравнивания: node scripts/slice-avatars.mjs --preview
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const OUT = "public/avatars";
mkdirSync(OUT, { recursive: true });

const KIMONO = ["white", "blue", "black"];
const BELTS = ["white", "blue", "purple", "brown", "black"];

// Параметры композиции (подбираются по превью, затем уходят в Avatar.tsx)
const HEAD_W_FRAC = 0.60;   // ширина головы как доля ширины тела
const HEAD_BOTTOM_PX = 92;  // где низ головы относительно верха тела (px в координатах ячейки тела)

async function bodies() {
  const SRC = "design/bodies-sheet.png";
  const W = 1024, H = 1024, COLS = 5, ROWS = 3;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const left = Math.round((c * W) / COLS);
      const width = Math.round(((c + 1) * W) / COLS) - left;
      const top = Math.round((r * H) / ROWS);
      const height = Math.round(((r + 1) * H) / ROWS) - top;
      await sharp(SRC)
        .extract({ left, top, width, height })
        .webp({ quality: 84 })
        .toFile(`${OUT}/body-${KIMONO[r]}-${BELTS[c]}.webp`);
    }
  }
  console.log("Тела: 15 шт");
}

// Flood-fill от краёв: связанный с краем почти-белый фон -> альфа 0
function removeBg(data, w, h, tol = 48) {
  const visited = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1);
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y);
  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    const nearWhite = data[i] > 255 - tol && data[i + 1] > 255 - tol && data[i + 2] > 255 - tol;
    if (!nearWhite) continue;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
}

async function heads() {
  const SHEETS = [
    { src: "design/heads-male-sheet.png", prefix: "m", inset: 12 },
    { src: "design/heads-female-sheet.png", prefix: "f", inset: 6 },
  ];
  const W = 1024, H = 1024, COLS = 3, ROWS = 2;
  for (const { src, prefix, inset } of SHEETS) {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        n++;
        const left = Math.round((c * W) / COLS) + inset;
        const right = Math.round(((c + 1) * W) / COLS) - inset;
        const top = Math.round((r * H) / ROWS) + inset;
        const bottom = Math.round(((r + 1) * H) / ROWS) - inset;
        const { data, info } = await sharp(src)
          .extract({ left, top, width: right - left, height: bottom - top })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        removeBg(data, info.width, info.height);
        await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
          .webp({ quality: 84 })
          .toFile(`${OUT}/head-${prefix}${n}.webp`);
      }
    }
    console.log(`Головы ${prefix}: 6 шт`);
  }
}

// Превью-композит: тело + голова с текущими константами, чтобы проверить посадку
async function preview() {
  const bodyBuf = await sharp(`${OUT}/body-white-white.webp`).png().toBuffer();
  const bodyMeta = await sharp(bodyBuf).metadata();
  const bw = bodyMeta.width, bh = bodyMeta.height;

  const headW = Math.round(bw * HEAD_W_FRAC);
  const samples = [];
  for (const id of ["m1", "f1", "m3", "f3"]) {
    const headBuf = await sharp(`${OUT}/head-${id}.webp`).resize({ width: headW }).png().toBuffer();
    const headMeta = await sharp(headBuf).metadata();
    const hh = headMeta.height;
    // Канвас: голова торчит над телом, низ головы на HEAD_BOTTOM_PX ниже верха тела
    const overlap = HEAD_BOTTOM_PX;
    const canvasH = hh - overlap + bh;
    const composite = await sharp({
      create: { width: bw, height: canvasH, channels: 4, background: { r: 235, g: 235, b: 235, alpha: 1 } },
    })
      .composite([
        { input: bodyBuf, left: 0, top: hh - overlap },
        { input: headBuf, left: Math.round((bw - headW) / 2), top: 0 },
      ])
      .png()
      .toBuffer();
    samples.push(composite);
  }
  // 4 сэмпла в ряд
  const metas = await Promise.all(samples.map((s) => sharp(s).metadata()));
  const maxH = Math.max(...metas.map((m) => m.height));
  const totalW = metas.reduce((s, m) => s + m.width, 0);
  let x = 0;
  const layers = samples.map((s, i) => {
    const l = { input: s, left: x, top: maxH - metas[i].height };
    x += metas[i].width;
    return l;
  });
  await sharp({ create: { width: totalW, height: maxH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(layers)
    .png()
    .toFile(".superpowers/sdd/avatar-preview.png");
  console.log("Превью: .superpowers/sdd/avatar-preview.png (HEAD_W_FRAC=" + HEAD_W_FRAC + ", HEAD_BOTTOM_PX=" + HEAD_BOTTOM_PX + ")");
}

await bodies();
await heads();
if (process.argv.includes("--preview")) await preview();
