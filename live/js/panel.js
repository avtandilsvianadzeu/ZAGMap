'use strict';
/* Info panel: one selected object (ZAG record, address or building) with provenance. */
const info=$('info');
const posText=(i,x)=>i.kind==='building'?(i.how==='address'?'Building footprint matched from the street address':'Building footprint at the recorded coordinate'):i.kind==='area'?`${PREC[x.prec]||'Approximate'} (shaded area)`:(PREC[x.prec]||x.prec);
const SRC_KIND={journal:'Journal article',conference:'Conference paper',report:'Report',web:'Web page',inst:'Institutional page',enc:'Encyclopedia',
  zag_publication:'ZAG publication',db:'Structure database'};
let curId=null;

function closeInfo(){
  curId=null; info.hidden=true; document.body.classList.remove('has-panel');
  clearHL(); setSel(null); showLine(null); emit('selected',null);
}
function openShell(html){
  info.innerHTML=`<button class="x" aria-label="Close panel" title="Close">✕</button>${html}`;
  info.hidden=false; info.scrollTop=0; document.body.classList.add('has-panel');
  if(phone()){document.body.classList.add('tl-closed');$('tlToggle').setAttribute('aria-expanded',false);}
  info.querySelector('.x').onclick=closeInfo;
  info.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(b.dataset.copy,'Coordinates copied'));
}
async function copyText(t,m){try{await navigator.clipboard.writeText(t);toast(m);}catch(_){toast('Copy is not available here');}}
const kv=(k,v)=>v?`<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`:'';
const srcLine=s=>`<div class="src"><span>${esc(s.title||s.key)}${s.type?`<br><small class="note">${esc(SRC_KIND[s.type]||s.type)}</small>`:''}</span>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Open source ↗</a>`:''}</div>`;

function infoHTML(f){
  const p=f.properties, e=EBY[p.id], st=S.find(s=>s.key===p.story||s.key===p.id), k=kindOf(p);
  const kicker={fac:['ZAG facility','fac'],doc:['ZAG project',''],ref:['Referenced in sources','ref']}[k];
  const where=[p.municipality&&p.municipality!==p.name_en?p.municipality:p.locality,p.year||null].filter(Boolean).join(' · ');
  const inv=(p.zag_involvement_types||[]).map(t=>INV_LABEL[t]||cap(t));
  const bullets=[...inv.map(t=>`<li>${esc(t)}</li>`), p.zag_role?`<li>${esc(p.zag_role)}</li>`:''].join('');
  const about=p.description||'';
  const S2=p.structure||{}, sFields=[['Crosses',S2.crosses],['Carries',S2.carries],['Structure',S2.typ],['Built',S2.built],['Spans',S2.spans],['Length',S2.length_m&&S2.length_m+' m']];
  const more=[p.hist&&`<h3>History and engineering</h3><p>${esc(p.hist)}</p>`,
    p.facts&&p.facts.length&&`<h3>Key figures</h3>${p.facts.map(([a,b])=>kv(a,b)).join('')}`,
    sFields.some(a=>a[1])&&`<h3>Structure</h3>${sFields.map(([a,b])=>kv(a,b)).join('')}`,
    p.people&&p.people.length&&`<h3>Named in the sources</h3><ul>${p.people.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`].filter(Boolean).join('');
  const sources=(p.sources&&p.sources.length)?`<h3>Data sources</h3>`+p.sources.map(srcLine).join(''):'';
  const coord=`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
  return `${p.image?`<img class="hero" alt="" src="${esc(p.image)}">${p.image_credit?`<div class="credit">Image: ${esc(p.image_credit)}</div>`:''}`:''}
  <div class="body">
    <div class="kicker ${kicker[1]}">${kicker[0]}</div>
    <h1>${esc(p.name_en||p.name)}</h1>
    ${p.name_sl&&p.name_sl!==p.name_en?`<p class="sl">${esc(p.name_sl)}</p>`:''}
    ${where?`<p class="where">${esc(where)}</p>`:''}
    <h3>Project type</h3>
    <p><span class="tag">${esc(cap(p.object_type))}</span><span class="tag ${p.evidence_level==='documented'?'ok':'warn'}">${esc({documented:'Documented',referenced:'Referenced',location_only:'Location only'}[p.evidence_level])}</span></p>
    ${bullets?`<h3>ZAG involvement</h3><ul>${bullets}</ul>`:''}
    ${about?`<h3>About</h3><p>${esc(about)}</p>`:''}
    ${sources}
    <h3>Position</h3>
    <div class="kv"><span>Basis</span><span id="epos">${esc(PREC[p.position_precision]||p.position_precision)}</span></div>
    ${p.position_confidence?kv('Confidence',p.position_confidence):''}
    ${kv('WGS84',coord)}
    <p class="note" id="enote">${esc(p.position_note||'')}</p>
    ${p.data_note?`<p class="note">${esc(p.data_note)}</p>`:''}
    <div class="btnrow"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" rel="noopener">Google Maps ↗</a>
      <button class="btn" data-copy="${coord}">Copy coordinates</button></div>
    ${more?`<details style="margin-top:14px"><summary class="note" style="cursor:pointer">More details</summary>${more}</details>`:''}
  </div>`;
}

/* select a ZAG record: panel, pin, camera, and the footprint or line of the structure */
function showInfo(id,opts){
  const f=ZA.byId[id]; if(!f) return;
  const p=f.properties; curId=id; stopTourIfUser(opts);
  openShell(infoHTML(f));
  try{history.replaceState(null,'',location.pathname+location.search+'#'+id);}catch(_){}
  emit('selected',id);
  if(!ready) return;
  const e=EBY[id], x={id,lat:p.latitude,lon:p.longitude,prec:p.position_precision,cat:e?e.cat:'build',addr:p.address};
  setSel({id,ll:[p.longitude,p.latitude],label:p.name_en||p.name,glyph:'pin'});
  showLine(p.line||null);
  if(x.addr) geocodeAddress(x.addr);
  const done=()=>{ if(curId!==id) return;
    locate(x,i=>{ if(curId!==id) return; const m=$('epos'); if(m&&i.state==='done') m.textContent=posText(i,x); const n=$('enote'); if(n&&i.state==='done') n.textContent=[posNote(i,x),p.position_note].filter(Boolean).join(' ');
      if(i.state==='done'&&i.how==='address'&&selMarker) selMarker.setLngLat(i.b&&i.b.c||i.geo.ll);
      if(i.state==='done'&&opts&&opts.onSettled) opts.onSettled(); }); };
  if(p.line&&p.line.length>1){
    const b=p.line.reduce((bb,c)=>bb.extend(c),new maplibregl.LngLatBounds(p.line[0],p.line[0]));
    orbitOn=false; userMoved=false;
    const cam=map.cameraForBounds(b,{padding:padNow(),maxZoom:16});
    moveThen('flyTo',{center:cam?cam.center:[p.longitude,p.latitude],zoom:cam?cam.zoom:15,pitch:is3d?55:0,bearing:is3d?bearingFor(id):0,padding:{top:0,bottom:0,left:0,right:0},duration:reduced?0:2200,essential:true},done);
  } else flyToSite(x,done);
}

/* any address or place found by search */
function showAddress(f){
  const p=f.properties, ll=f.geometry.coordinates, title=p.housenumber?fmtAddr(p):(p.name||fmtAddr(p));
  const isHouse=!!p.housenumber||p.osm_key==='building';
  curId=null; stopTourIfUser();
  openShell(`<div class="body"><div class="kicker ref">Location</div><h1>${esc(title)}</h1>
    <p class="where">${esc([p.osm_value&&!p.housenumber?p.osm_value:'Address',p.city||p.county].filter(Boolean).join(' · '))}</p>
    <h3>Position</h3><div class="kv"><span>Basis</span><span id="epos">Search result</span></div>${kv('WGS84',`${ll[1].toFixed(6)}, ${ll[0].toFixed(6)}`)}
    <p class="note">Search result from OpenStreetMap (Photon). This is not a ZAG record.</p>
    <div class="btnrow"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${ll[1]},${ll[0]}" target="_blank" rel="noopener">Google Maps ↗</a>
    <button class="btn" data-copy="${ll[1].toFixed(6)}, ${ll[0].toFixed(6)}">Copy coordinates</button></div></div>`);
  showLine(null); setSel({id:null,ll,label:title,glyph:'pin'}); orbitOn=false; emit('selected',null);
  const x={lon:ll[0],lat:ll[1],prec:'surveyed',cat:isHouse?'build':'other'};
  moveThen('flyTo',{center:ll,zoom:isHouse?17.6:(p.osm_key==='place'?13:16),pitch:is3d?60:0,bearing:is3d?-20:0,padding:padNow(),speed:1.3,essential:true,maxDuration:reduced?1:9000},
    ()=>locate(x,i=>{ const m=$('epos'); if(m&&i.state==='done') m.textContent=i.kind==='building'?'Building footprint highlighted':'No building footprint at this point'; }));
}

/* a building picked directly on the map */
function showBuildingPick(ll){
  const tok=++hlToken; const b=findBuilding(ll,3); if(tok!==hlToken) return; showBuilding(b);
  map.getSource('unc').setData({type:'FeatureCollection',features:[]}); showLine(null); setSel(null); curId=null; stopTourIfUser();
  openShell(`<div class="body"><div class="kicker ref">Building</div><h1 id="bt">Looking up the nearest address…</h1><p class="where" id="bs"></p>
    <h3>Position</h3>${kv('WGS84',`${ll[1].toFixed(6)}, ${ll[0].toFixed(6)}`)}
    <p class="note">${b?'Footprint from OpenStreetMap building data.':'No footprint found at this point.'} Not a ZAG record unless it is marked as one.</p></div>`);
  fetch(`${PHOTON}/reverse?lon=${ll[0]}&lat=${ll[1]}&limit=1`).then(r=>r.ok?r.json():null).then(j=>{
    if(tok!==hlToken) return; const f=j&&j.features&&j.features[0], t=$('bt'); if(!t) return;
    if(!f){t.textContent='Building';$('bs').textContent='No address found nearby';return;}
    const q=f.properties; t.textContent=q.housenumber?fmtAddr(q):(q.name||fmtAddr(q));
    $('bs').textContent=`Nearest address in OpenStreetMap, ${Math.round(meters(f.geometry.coordinates,ll))} m from the click`;
  }).catch(()=>{const t=$('bt');if(tok===hlToken&&t)t.textContent='Building';});
}
