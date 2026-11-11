// Run in the tensor.art OC channel tab (Chrome javascript_tool). Scrolls the model grid, keeps KREA_2 LoRAs,
// sorts by uses and shows a numbered thumbnail sheet (top 40). Returns "number:name" lines.
const seen = new Map();
window.scrollTo(0, 0);
await new Promise((r) => setTimeout(r, 800));
for (let i = 0; i < 25; i++) {
  document.querySelectorAll('a[href*="/models/"]').forEach((a) => {
    const text = a.innerText.replace(/\s+/g, ' ').trim();
    const img = a.querySelector('img');
    if (text && !seen.has(a.href)) seen.set(a.href, { text, img: img && img.currentSrc });
  });
  window.scrollBy(0, 1200);
  await new Promise((r) => setTimeout(r, 900));
}
const uses = (s) => {
  const m = s.match(/([\d.]+)([KM]?)\s+[\d.]+[KM]?$/);
  return m ? parseFloat(m[1]) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1) : 0;
};
const list = [...seen]
  .filter(([, v]) => v.img && /^LORA KREA_2/.test(v.text))
  .map(([href, v]) => ({
    href,
    img: v.img,
    uses: uses(v.text),
    name: v.text.normalize('NFKC').replace(/^LORA KREA_2 |EXCLUSIVE |EARLY ACCESS /g, '').slice(0, 40),
  }))
  .sort((a, b) => b.uses - a.uses)
  .slice(0, 40);
document.getElementById('ocsheet')?.remove();
const box = document.createElement('div');
box.id = 'ocsheet';
box.style.cssText =
  'position:fixed;inset:0;z-index:99999;background:#111;display:grid;grid-template-columns:repeat(10,1fr);gap:3px;padding:3px';
list.forEach((r, i) => {
  const d = document.createElement('div');
  d.style.cssText = 'position:relative;height:178px';
  d.innerHTML = `<img src="${r.img}" style="width:100%;height:100%;object-fit:cover"><b style="position:absolute;left:2px;top:2px;background:#000;color:#ff0;font:14px sans-serif;padding:1px 4px">${i + 1}</b>`;
  box.appendChild(d);
});
document.body.appendChild(box);
window.__ocSheet = list;
list.map((r, i) => `${i + 1}:${r.name}`).join('\n');
