#!/usr/bin/env node
/* Builds data/zag_projects.geojson from live/data.js (legacy records) + tools/position_corrections.json.
  Run: node tools/build_geojson.js
  Rules: nothing is invented. Fields without support in the source stay null. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = {}; eval(fs.readFileSync(path.join(ROOT, 'live/data.js'), 'utf8'));
const Z = window.ZAG;
const CORR = JSON.parse(fs.readFileSync(path.join(__dirname, 'position_corrections.json'), 'utf8'));

const OBJECT_TYPE = { tunnel: 'tunnel', bridge: 'bridge', foot: 'footbridge', road: 'road structure', dam: 'dam / hydropower', cable: 'cableway',
 tower: 'tower / mast', build: 'building', inst: 'institution', quake: 'study area (earthquake)', geo: 'geotechnical site', slide: 'landslide', other: 'other' };
const FACILITY = new Set(['zag', 'zag_logatec', 'zag_gameljne', 'zag_maribor']);   // ZAG's own premises
const PARTNER = new Set(['cestel', 'innorenew', 'ulfgg']);              // named partners, not ZAG sites

// zag_involvement_type is derived from the record's own `role` text (which cites sources); review before publishing.
const INV = [[/weigh-in-motion|health monitoring|monitoring/i, 'monitoring'], [/load test/i, 'structural assessment'],
 [/fire resistance|fire testing|reaction to fire/i, 'fire testing'], [/periodical|inspection of|special inspections|technical inspection/i, 'inspection'],
 [/external control|quality of construction|third party quality control|quality control/i, 'inspection'],
 [/grout|cement|pigment|reuse|secondary raw|paving|material/i, 'materials testing'],
 [/vulnerability|safety analysis|assessment of damage|condition of|analysis of the condition|effect of .* earthquake|seismic risk/i, 'structural assessment'],
 [/geolog|geotech|rockfall|slope|shear|numerical modelling|investigation|cherplan|research/i, 'research']];
const involvement = e => { if (e.cls === 'inst') return null; for (const [re, v] of INV) if (re.test(e.role || '')) return v; return 'other'; };

// text corrections backed by the research pass (operator / registry pages); each must match or the build fails loudly
const TEXT_FIX = [
 ['tomacevo', 'carries', 'H3 northern ring road', 'Road no. 104 (Ljubljana ring road)'],
 ['he_vuhred', 'loc', 'Radlje ob Dravi', 'Podvelka'],
 ['he_arto', 'loc', 'Sevnica', 'Krško'],
 ['pletovarje', 'loc', 'Slovenske Konjice', 'Šentjur'],
 ['pecna_reber', 'sl', 'Pecna', 'Pečna'],
 ['rtp_gorica', 'detail', 'RTP 110/20/10 kV', 'RTP 110/20 kV'],
];
const ENTRIES = JSON.parse(JSON.stringify(Z.entries));
const E = Object.fromEntries(ENTRIES.map(e => [e.id, e]));
const misses = [];
for (const [id, k, from, to] of TEXT_FIX) { const e = E[id]; if (e && typeof e[k] === 'string' && e[k].includes(from)) e[k] = e[k].replace(from, to); else misses.push(id + '.' + k); }
if (E.he_zlatolicje) E.he_zlatolicje.__mw = 126;
for (const e of ENTRIES) for (const k of ['detail', 'role', 'hist', 'zagn', 'note']) if (typeof e[k] === 'string') e[k] = e[k].replace(/\b136 MW\b/g, '126 MW');

const yr = t => { const m = String(t || '').match(/\d{4}/g); if (!m) return [null, null]; const open = /\d{4}\s*[--]\s*$/.test(String(t).trim()); return [+m[0], open ? null : +m[m.length - 1]]; };
const srcOf = e => (e.src || []).map(k => Z.src[k] && { key: k, title: Z.src[k].t, url: Z.src[k].u || (Z.src[k].doi ? 'https://doi.org/' + Z.src[k].doi : null), type: Z.src[k].k }).filter(Boolean);
const feats = [];
function push(p, ll, extra) { feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ll }, properties: Object.assign(p, extra || {}) }); }

for (const e of ENTRIES) {
 const c = CORR[e.id], srcs = srcOf(e), s0 = srcs[0] || {};
 const lat = c ? c.lat : e.lat, lon = c ? c.lon : e.lon;
 const category = FACILITY.has(e.id) ? 'zag_facility' : PARTNER.has(e.id) ? 'partner' : 'zag_project';
 const ev = !srcs.length ? 'location_only' : (category === 'partner' ? 'referenced' : 'documented');
 const p = { id: e.id, category, name: e.n, name_sl: e.sl || null, name_en: e.n, object_type: OBJECT_TYPE[e.cat] || 'other',
  year: e.years || null, built: e.built || null, year_start: yr(e.years)[0], year_end: yr(e.years)[1], municipality: (e.loc || '').split(',').pop().trim() || null, locality: e.loc || null,
  latitude: lat, longitude: lon, zag_involvement_type: involvement(e), zag_role: e.role || null, description: e.detail || null,
  hist: e.hist || null, facts: e.facts || null, people: e.people || null, partners: e.partners || null,
  structure: { crosses: e.crosses || null, carries: e.carries || null, typ: e.typ || null, built: e.opened || e.built || null, spans: e.spans || null, length_m: e.len_m || null },
  image: null, image_credit: null, source_title: s0.title || null, source_url: s0.url || null, source_type: s0.type || null, sources: srcs,
  evidence_level: ev, position_precision: c ? 'surveyed' : e.prec, position_sources: c ? c.sources : [], address: (c && c.addr) || e.addr || null };
 if (c && c.line) { p.line = c.line; p.line_labels = c.line_labels; }
 push(p, [lon, lat]);
}
// public sources for the three records that exist only as Open Day stories (verified 2026-10-03)
const STORY_SRC = {
 nuk: { ev: 'documented', inv: ['structural assessment', 'materials testing'],
  role: 'Condition assessment of Plečnik’s façade before renovation',
  about: 'Interdisciplinary survey of the façade (concrete, brick, stone and steel reinforcement) commissioned by NUK with the Institute for the Protection of Cultural Heritage of Slovenia. Methods reported: ultrasonic tomography, ground-penetrating radar, 3D micro-tomography, analyses of brick and joint mortars, and testing of conservation materials. Technical report due June 2026; full façade renovation planned for 2027.',
  sources: [
   { key: 'zag_nuk_2025', title: 'Raziskava stanja fasade Plečnikovega NUK-a', url: 'https://www.zag.si/raziskava-stanja-fasade-plecnikovega-nuk-a/', type: 'zag_publication' },
   { key: 'rtv_nuk_2025', title: 'Raziskava stanja fasade Plečnikovega NUK-a pred celovito sanacijo, predvideno za leto 2027 (RTV SLO, 19 Dec 2025)', url: 'https://www.rtvslo.si/kultura/dediscina/raziskava-stanja-fasade-plecnikovega-nuk-a-pred-celovito-sanacijo-predvideno-za-leto-2027/767780', type: 'web' },
   { key: 'sta_nuk_2025', title: 'Pred načrtovano obnovo v teku poglobljena raziskava fasade NUK (STA)', url: 'https://www.sta.si/3501494/pred-nacrtovano-obnovo-v-teku-poglobljena-raziskava-fasade-nuk', type: 'web' }] },
 tr3: { ev: 'documented', inv: ['structural assessment', 'BIM'],
  role: 'Partner of the Institute for the Protection of Cultural Heritage of Slovenia in the exhibition KONS-TR³: Konstrukcija nove ere (Galerija TR3, 11 October to 2 December 2023) on the structure of Ravnikar’s Trg republike towers',
  about: 'Exhibition on the structural design of the Trg republike complex by Edvard Ravnikar and Ervin Prelog, prepared by ZVKDS with ZAG as partner.',
  sources: [
   { key: 'zag_kons_tr3', title: 'KONS-TR3: Konstrukcija nove ere', url: 'https://www.zag.si/kons-tr3-konstrukcija-nove-ere/', type: 'zag_publication' },
   { key: 'zag_kons_tr3_inv', title: 'Vabljeni na razstavo KONS-TR3', url: 'https://www.zag.si/vabljeni-na-razstavo-kons-tr3/', type: 'zag_publication' },
   { key: 'outsider_kons', title: 'Vabilo: Razstavi KONS TR³, Konstrukcija nove ere in EDVARD (Outsider, 11 Oct 2023)', url: 'https://outsider.si/vabilo-razstavi-kons-tr%C2%B3-konstrukcija-nove-ere-in-edvard/', type: 'web' }] },
 kpd: { ev: 'referenced', inv: ['research'],
  role: 'Partner in the project CABE, Circular Approaches in the Built Environment (Driving Urban Transitions, 2025-2028), with a demonstration case in Slovenia',
  about: 'CABE develops and pilots urban resource-sharing infrastructures and circular solutions that reuse construction and demolition waste, with demonstration cases planned in Switzerland, Slovenia and Turkey. The former prison (KPD) on Pobreška cesta is the Maribor site presented at the ZAG Open Day.',
  sources: [
   { key: 'zhaw_cabe', title: 'Circular Approaches in the Built Environment (CABE), project page', url: 'https://www.zhaw.ch/en/research/project/76605', type: 'web' },
   { key: 'zag_circular', title: 'Za ZAG krožno gradbeništvo ni samo krilatica', url: 'https://www.zag.si/za-zag-krozno-gradbenistvo-ni-samo-krilatica/', type: 'zag_publication' },
   { key: 'urbact_kpd', title: 'The former prison KPD, Maribor (URBACT Remaking the City)', url: 'https://remakingthecity.urbact.eu/the-former-prison-kpd-maribor-slovenia--44.case', type: 'web' }] }
};
// stories that have no entry (own records)
const byKey = Object.fromEntries(Z.stories.map(s => [s.key, s]));
for (const s of Z.stories) {
 const linked = s.entry && E[s.entry];
 if (linked) { const f = feats.find(f => f.properties.id === s.entry); f.properties.story = s.key; if (!f.properties.year) { f.properties.year = s.year; f.properties.year_start = +s.year || null; f.properties.year_end = +s.year || null; } f.properties.image = 'img/ph/' + s.key + '.webp'; continue; }
 const c = CORR['story_' + s.key];
 const SS = STORY_SRC[s.key] || { sources: [], role: s.den, inv: [], ev: 'location_only', note: null };
 const s0 = SS.sources[0] || {};
 const p = { id: s.key, category: 'zag_project', name: s.en, name_sl: s.sl, name_en: s.en, object_type: 'building',
  year: s.year, built: null, year_start: +s.year || null, year_end: +s.year || null, municipality: s.town, locality: s.loc, latitude: c ? c.lat : s.lat, longitude: c ? c.lon : s.lon,
  zag_involvement_type: SS.inv[0] || null, zag_involvement_types: SS.inv, zag_role: SS.role, description: SS.about || null, image: 'img/ph/' + s.key + '.webp', image_credit: null,
  source_title: s0.title || null, source_url: s0.url || null, source_type: s0.type || null, sources: SS.sources,
  evidence_level: SS.ev, position_precision: c ? 'surveyed' : s.prec, position_sources: c ? c.sources : [], address: s.addr || null, story: s.key };
 push(p, [p.longitude, p.latitude]);
}
if (byKey.kpd) { const f = feats.find(f => f.properties.id === 'kpd'); f.properties.locality = 'Pobreška cesta 20, Maribor'; }
// verified against the ZAG 2019 bulletin (pp. 32-33 as reported; captions "point cloud (lidar + scanner)", "view from unmanned aerial vehicle", ">200 sensors")
const BULLETIN = { key: 'zag_bulletin_2019', title: 'ZAG Bulletin 2019 (English), Digitalisation of the built environment', url: 'https://www.zag.si/wp-content/uploads/2022/08/ZAG-bulletin-2019-ANG-min.pdf', type: 'zag_publication' };
const rav = feats.find(f => f.properties.id === 'ravbarkomanda').properties;
rav.zag_involvement_types = ['monitoring', 'LiDAR', 'UAV']; rav.zag_involvement_type = 'monitoring';
rav.sources.unshift(BULLETIN); rav.source_title = BULLETIN.title; rav.source_url = BULLETIN.url; rav.source_type = BULLETIN.type;
const str = feats.find(f => f.properties.id === 'strunjan').properties;
str.image_credit = 'Mihael Simonič, CC BY-SA 3.0 (Wikimedia Commons)';
for (const f of feats) if (!f.properties.zag_involvement_types) f.properties.zag_involvement_types = f.properties.zag_involvement_type ? [f.properties.zag_involvement_type] : [];
// plain typography: no en/em dashes or arrows in anything shown to users
const plain = v => typeof v === 'string' ? v.replace(/\u2014/g, ', ').replace(/(\w)\u2013(\w)/g, '$1-$2').replace(/ \u2013 /g, ', ').replace(/\u2013/g, '-').replace(/\u2192/g, ' to ').replace(/~(?=\d)/g, 'about ')
  : Array.isArray(v) ? v.map(plain) : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)])) : v;
for (const f of feats) f.properties = plain(f.properties);
const fc = { type: 'FeatureCollection', name: 'zag_projects', crs: undefined,
 _meta: { generated_by: 'tools/build_geojson.js', note: 'involvement type is derived from the role text of each legacy record and needs ZAG review; image credits are not yet verified except where stated.' }, features: feats };
fs.writeFileSync(path.join(ROOT, 'data/zag_projects.geojson'), JSON.stringify(fc, null, 1));
console.log('features', feats.length, 'text-fix misses', misses.join(',') || 'none');
const cnt = k => feats.reduce((a, f) => (a[f.properties[k]] = (a[f.properties[k]] || 0) + 1, a), {});
console.log(cnt('category'), cnt('evidence_level'), cnt('zag_involvement_type'));
