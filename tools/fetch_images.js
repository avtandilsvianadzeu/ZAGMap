#!/usr/bin/env node
/* Looks up one freely licensed photo per record on Wikimedia Commons and writes data/images.json
   with the image URL, author, licence and file page, so every photo in the atlas carries its credit.
   Run where the Commons API is reachable (GitHub Actions or a workstation): node tools/fetch_images.js
   Review data/images.json afterwards; a wrong match is removed by deleting its entry. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const fc = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/zag_projects.geojson'), 'utf8'));
const OUT = path.join(ROOT, 'data/images.json');
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const FREE = /^(CC[ -]BY|CC0|Public domain|CC BY)/i;
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
async function search(q) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=8&prop=imageinfo|categories&iiprop=url|extmetadata&iiurlwidth=1200&format=json&origin=*`;
  const r = await fetch(u, { headers: { 'User-Agent': 'ZAG-Digital-Atlas/1.0 (github.com/avtandilsvianadzeu/ZAGMap)' } });
  if (!r.ok) return [];
  const j = await r.json(); return Object.values((j.query || {}).pages || {});
}
(async () => {
  const out = {};
  for (const f of fc.features) {
    const p = f.properties; if (prev[p.id] && prev[p.id].keep) { out[p.id] = prev[p.id]; continue; }
    const terms = [p.name_sl, p.name_en].filter(Boolean);
    let best = null;
    for (const t of terms) {
      for (const pg of await search(t)) {
        const ii = (pg.imageinfo || [])[0]; if (!ii) continue; const m = ii.extmetadata || {};
        const lic = (m.LicenseShortName || {}).value || ''; if (!FREE.test(lic)) continue;
        const hay = norm(pg.title + ' ' + ((m.ImageDescription || {}).value || '') + ' ' + (pg.categories || []).map(c => c.title).join(' '));
        const words = norm(t).split(/\W+/).filter(w => w.length > 3);
        const score = words.filter(w => hay.includes(w)).length / Math.max(1, words.length);
        if (score >= 0.6 && (!best || score > best.score)) best = { score, title: pg.title, url: ii.thumburl || ii.url, page: ii.descriptionurl,
          author: ((m.Artist || {}).value || '').replace(/<[^>]+>/g, '').trim(), licence: lic, licence_url: (m.LicenseUrl || {}).value || null };
      }
      if (best && best.score === 1) break;
    }
    if (best) { out[p.id] = best; console.log(p.id, '->', best.title, '|', best.author, '|', best.licence); }
    else console.log(p.id, '-> no free photo found');
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(Object.keys(out).length, 'images written to data/images.json');
})();
