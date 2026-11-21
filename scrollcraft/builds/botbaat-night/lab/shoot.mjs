import { chromium } from 'playwright-core';
import sharp from 'sharp';
import fs from 'node:fs';

const [,, tag = 'desk', W = '1440', H = '900', N = '16', reduced = ''] = process.argv;
const w = +W, h = +H, n = +N;
const out = `lab/${tag}`;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1, hasTouch: w < 760 });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:4500/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const info = await page.evaluate(() => ({
  total: document.documentElement.scrollHeight, vh: innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  acts: [...document.querySelectorAll('.act')].map(a => [a.className.replace('act ', ''), Math.round(a.getBoundingClientRect().height / innerHeight * 100) / 100]),
}));
console.log(JSON.stringify(info));
const max = info.total - info.vh;
const files = [];
for (let i = 0; i < n; i++) {
  const y = Math.round(max * i / (n - 1));
  await page.evaluate(y => scrollTo(0, y), y);
  await page.waitForTimeout(1100);
  const st = await page.evaluate(() => ({ scene: document.getElementById('stage').dataset.scene, clock: document.getElementById('clockH').textContent + ':' + document.getElementById('clockM').textContent, face: document.querySelector('.face.on').dataset.face }));
  console.log(i, y, JSON.stringify(st));
  const f = `${out}/${String(i).padStart(2, '0')}.png`;
  await page.screenshot({ path: f });
  files.push(f);
}
await browser.close();
const tw = Math.round(w / 4), th = Math.round(h / 4) * (w < 760 ? 1 : 1);
const cols = w < 760 ? 8 : 4;
const tw2 = w < 760 ? Math.round(w * 0.45) : Math.round(w * 0.3);
const th2 = Math.round(tw2 * h / w);
const rows = Math.ceil(files.length / cols);
const thumbs = await Promise.all(files.map(f => sharp(f).resize(tw2, th2).toBuffer()));
await sharp({ create: { width: tw2 * cols, height: th2 * rows, channels: 3, background: '#000' } })
  .composite(thumbs.map((b, i) => ({ input: b, left: (i % cols) * tw2, top: Math.floor(i / cols) * th2 })))
  .png().toFile(`${out}/sheet.png`);
console.log('errors:', JSON.stringify(errs));
