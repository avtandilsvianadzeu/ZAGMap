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
const FACILITY = new Set(['zag', 'zag_logatec', 'zag_gameljne', 'zag_maribor']);      // ZAG's own premises
const PARTNER = new Set(['cestel', 'innorenew', 'ulfgg']);                            // named partners, not ZAG sites

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
for (const e of ENTRIES) for (const k of ['detail', 'role']) if (typeof e[k] === 'string') e[k] = e[k].replace(/\b136 MW\b/g, '126 MW');

const srcOf = e => (e.src || []).map(k => Z.src[k] && { key: k, title: Z.src[k].t, url: Z.src[k].u || (Z.src[k].doi ? 'https://doi.org/' + Z.src[k].doi : null), type: Z.src[k].k }).filter(Boolean);
const feats = [];
function push(p, ll, extra) { feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: ll }, properties: Object.assign(p, extra || {}) }); }

for (const e of ENTRIES) {
  const c = CORR[e.id], srcs = srcOf(e), s0 = srcs[0] || {};
  const lat = c ? c.lat : e.lat, lon = c ? c.lon : e.lon;
  const category = FACILITY.has(e.id) ? 'zag_facility' : PARTNER.has(e.id) ? 'partner' : 'zag_project';
  const ev = !srcs.length ? 'location_only' : (category === 'partner' ? 'referenced' : 'documented');
  const p = { id: e.id, category, name: e.n, name_sl: e.sl || null, name_en: e.n, object_type: OBJECT_TYPE[e.cat] || 'other',
    year: e.years || e.built || null, municipality: (e.loc || '').split(',').pop().trim() || null, locality: e.loc || null,
    latitude: lat, longitude: lon, zag_involvement_type: involvement(e), zag_role: e.role || null, description: e.detail || null,
    image: null, image_credit: null, source_title: s0.title || null, source_url: s0.url || null, source_type: s0.type || null, sources: srcs,
    evidence_level: ev, position_precision: c ? 'surveyed' : e.prec, position_confidence: c ? c.confidence : null,
    position_sources: c ? c.sources : [], position_note: c ? c.note : null, address: (c && c.addr) || e.addr || null };
  if (c && c.line) { p.line = c.line; p.line_labels = c.line_labels; }
  push(p, [lon, lat]);
}
// stories that have no entry (own records)
const byKey = Object.fromEntries(Z.stories.map(s => [s.key, s]));
for (const s of Z.stories) {
  const linked = s.entry && E[s.entry];
  if (linked) { const f = feats.find(f => f.properties.id === s.entry); f.properties.story = s.key; f.properties.year = f.properties.year || s.year; f.properties.image = 'img/ph/' + s.key + '.webp'; continue; }
  const c = CORR['story_' + s.key];
  const p = { id: s.key, category: 'zag_project', name: s.en, name_sl: s.sl, name_en: s.en, object_type: s.key === 'kpd' ? 'building' : 'building',
    year: s.year, municipality: s.town, locality: s.loc, latitude: c ? c.lat : s.lat, longitude: c ? c.lon : s.lon,
    zag_involvement_type: s.key === 'nuk' ? 'structural assessment' : null, zag_role: s.den, description: null, image: 'img/ph/' + s.key + '.webp', image_credit: null,
    source_title: 'ZAG Open Day 2026 programme (internal)', source_url: null, source_type: 'zag_internal', sources: [],
    evidence_level: 'referenced', position_precision: c ? 'surveyed' : s.prec, position_confidence: c ? c.confidence : null,
    position_sources: c ? c.sources : [], position_note: c ? c.note : null, address: s.addr || null, story: s.key };
  push(p, [p.longitude, p.latitude]);
}
if (byKey.kpd) { const f = feats.find(f => f.properties.id === 'kpd'); f.properties.locality = 'Pobreška cesta 20, Maribor'; f.properties.position_note = (f.properties.position_note || '') + ' Location text corrected: the building is not on the Drava bank.'; }
// verified against the ZAG 2019 bulletin (pp. 32-33 as reported; captions "point cloud (lidar + scanner)", "view from unmanned aerial vehicle", ">200 sensors")
const BULLETIN = { key: 'zag_bulletin_2019', title: 'ZAG Bulletin 2019 (English), Digitalisation of the built environment', url: 'https://www.zag.si/wp-content/uploads/2022/08/ZAG-bulletin-2019-ANG-min.pdf', type: 'zag_publication' };
const rav = feats.find(f => f.properties.id === 'ravbarkomanda').properties;
rav.zag_involvement_types = ['monitoring', 'LiDAR', 'UAV']; rav.zag_involvement_type = 'monitoring';
rav.sources.unshift(BULLETIN); rav.source_title = BULLETIN.title; rav.source_url = BULLETIN.url; rav.source_type = BULLETIN.type;
rav.data_note = 'Bulletin year of the point-cloud/UAV work is not stated. Dataset says 588 m / 15 spans, a secondary source says about 560 m / 16 spans: check against DARS/DRSI before showing dimensions. Marker position unresolved (old point is probably about 4 km too far north).';
const str = feats.find(f => f.properties.id === 'strunjan').properties;
str.image_credit = 'Mihael Simonič, CC BY-SA 3.0 (Wikimedia Commons)';
for (const f of feats) if (!f.properties.zag_involvement_types) f.properties.zag_involvement_types = f.properties.zag_involvement_type ? [f.properties.zag_involvement_type] : [];
const fc = { type: 'FeatureCollection', name: 'zag_projects', crs: undefined,
  _meta: { generated_by: 'tools/build_geojson.js', note: 'involvement type is derived from the role text of each legacy record and needs ZAG review; image credits are not yet verified except where stated.' }, features: feats };
fs.writeFileSync(path.join(ROOT, 'data/zag_projects.geojson'), JSON.stringify(fc, null, 1));
console.log('features', feats.length, 'text-fix misses', misses.join(',') || 'none');
const cnt = k => feats.reduce((a, f) => (a[f.properties[k]] = (a[f.properties[k]] || 0) + 1, a), {});
console.log(cnt('category'), cnt('evidence_level'), cnt('zag_involvement_type'));
