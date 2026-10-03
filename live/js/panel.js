'use strict';
/* Info panel: one selected object (ZAG record, address or building) with provenance. */
const info=$('info');
const srcHost=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch(_){return u;}};
const posText=(i,x)=>i.kind==='building'?(i.how==='address'?'Building footprint matched from the street address':'Building footprint at the recorded coordinate'):i.kind==='area'?`${PREC[x.prec]||'Approximate'} (shaded area)`:(PREC[x.prec]||x.prec);
const SRC_KIND={journal:'Journal article',conference:'Conference paper',report:'Report',web:'Web page',inst:'Institutional page',enc:'Encyclopedia',
  zag_publication:'ZAG publication',db:'Database',data:'Open data',reg:'Regulation',news:'News article'};
let curId=null;

function closeInfo(){
  curId=null; info.hidden=true; if(listEl.hidden) document.body.classList.remove('has-panel'); else renderList();
  clearHL(); setSel(null); showLine(null); emit('selected',null);
}
function openShell(html){
  info.innerHTML=`<button class="x" aria-label="Close panel" title="Close">${ICON.close}</button>${html}`;
  info.hidden=false; info.scrollTop=0; document.body.classList.add('has-panel'); listEl.hidden=true;
  info.querySelector('.x').onclick=closeInfo;
  info.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyText(b.dataset.copy,'Coordinates copied'));
}
async function copyText(t,m){try{await navigator.clipboard.writeText(t);toast(m);}catch(_){toast('Copy is not available here');}}
const kv=(k,v)=>v?`<div class="kv"><span>${esc(k)}</span><span>${esc(v)}</span></div>`:'';
const srcLine=s=>`<div class="src"><span>${esc(s.title||s.key)}${s.type?`<br><small class="note">${esc(SRC_KIND[s.type]||s.type)}</small>`:''}</span>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Open source ${ICON.ext}</a>`:''}</div>`;

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
  const im=ZA.images[p.id], hero=p.image?{src:p.image,credit:p.image_credit?'Photo: '+p.image_credit:null}:im?{src:im.url,credit:`Photo: ${im.author||'unknown author'}, ${im.licence}, via Wikimedia Commons`,page:im.page}:null;
  return `${hero?`<img class="hero" alt="" src="${esc(hero.src)}">${hero.credit?`<div class="credit">${esc(hero.credit)}${hero.page?` (<a href="${esc(hero.page)}" target="_blank" rel="noopener">source</a>)`:''}</div>`:''}`:''}
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
    <div id="bim" class="bim"></div>
    <h3>Position</h3>
    <div class="kv"><span>Basis</span><span id="epos">${esc(PREC[p.position_precision]||p.position_precision)}</span></div>
    ${kv('WGS84',coord)}
    <p class="note" id="enote"></p>
    ${(p.position_sources||[]).length?`<p class="note">Position source: ${p.position_sources.slice(0,3).map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(srcHost(u))}</a>`).join(', ')}</p>`:''}
    <div class="btnrow"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}" target="_blank" rel="noopener">Google Maps ↗</a>
      <button class="btn" data-copy="${coord}">Copy coordinates</button></div>
    ${more?`<details style="margin-top:14px"><summary class="note" style="cursor:pointer">More details</summary>${more}</details>`:''}
  </div>`;
}

/* select a ZAG record: panel, pin, camera, then the footprint (buildings) or the real alignment (bridges, tunnels, cableways) */
function showInfo(id,opts){
  const f=ZA.byId[id]; if(!f) return;
  const p=f.properties; curId=id;
  openShell(infoHTML(f));
  try{history.replaceState(null,'',location.pathname+location.search+'#'+id);}catch(_){}
  emit('selected',id);
  if(!ready) return;
  const e=EBY[id], x={id,lat:p.latitude,lon:p.longitude,prec:p.position_precision,cat:e?e.cat:'build',addr:p.address,tol:(p.position_sources&&p.position_sources.length)?150:1500};
  setSel({id,ll:[p.longitude,p.latitude],label:p.name_en||p.name,glyph:'pin'});
  showLine(p.line?[p.line]:null);
  if(x.addr) geocodeAddress(x.addr);
  const snapable=!!SNAP[p.object_type]&&!p.line;
  const settle=()=>{ if(curId!==id) return;
    locate(x,i=>{ if(curId!==id) return; const m=$('epos'); if(m&&i.state==='done') m.textContent=posText(i,x); const n=$('enote'); if(n&&i.state==='done') n.textContent=posNote(i,x);
      if(i.state==='done'&&i.how==='address'&&selMarker) selMarker.setLngLat(i.b&&i.b.c||i.geo.ll);
      if(i.state==='done'&&i.kind==='building') buildingData(i.b,p); }); };
  if(p.line&&p.line.length>1){ fitLines([p.line],id,settle); }
  else if(snapable){
    // land one zoom level wider than usual so the tiles around an approximate point are loaded, then look for the structure
    const z=Math.min(zoomFor(x),p.position_precision==='surveyed'?15.5:14.2);
    orbitOn=false; userMoved=false;
    moveThen('flyTo',{center:[p.longitude,p.latitude],zoom:z,pitch:is3d?50:0,bearing:0,padding:padNow(),speed:1.3,curve:1.42,essential:true,maxDuration:reduced?1:9000},async()=>{
      if(curId!==id) return; await waitIdle(); if(curId!==id) return;
      const hit=snapStructure(p);
      if(!hit){ settle(); return; }
      showLine(hit.lines); if(selMarker) selMarker.setLngLat(hit.mid);
      map.getSource('unc').setData({type:'FeatureCollection',features:[]});
      const m=$('epos'); if(m) m.textContent='Structure matched in OpenStreetMap';
      const n=$('enote'); if(n) n.textContent=`Alignment of the ${p.object_type} from OpenStreetMap${hit.props.ref?' (ref '+hit.props.ref+')':''}${hit.props.name?', "'+hit.props.name+'"':''}, ${hit.dist} m from the recorded coordinate.${hit.refOk?' The road reference matches the record.':''}`;
      structureData(hit,p);
      fitLines(hit.lines,id,null);
    });
  }
  else flyToSite(x,settle);
}
function fitLines(lines,id,cb){
  const all=lines.flat(), b=all.reduce((bb,c)=>bb.extend(c),new maplibregl.LngLatBounds(all[0],all[0]));
  const cam=map.cameraForBounds(b,{padding:padNow(),maxZoom:16.5}); orbitOn=false; userMoved=false;
  moveThen('flyTo',{center:b.getCenter(),zoom:cam?cam.zoom:15,pitch:is3d?55:0,bearing:is3d?bearingFor(id):0,padding:padNow(),duration:reduced?0:1800,essential:true},cb);
}
/* structure attributes from the matched OpenStreetMap feature */
function structureData(hit,p){
  const m=$('bim'); if(!m) return; const q=hit.props, L=Math.round(hit.lines.reduce((a,l)=>a+lineLen(l),0));
  m.innerHTML=`<h3>Structure data (OpenStreetMap)</h3>${kv('Type',q.brunnel?cap(q.brunnel):q.class==='aerialway'?'Aerialway':cap(q.class))}${kv('Road class',q.brunnel?cap(q.class):null)}${kv('Reference',q.ref)}${kv('Name',q.name)}${kv('Mapped length',L?L+' m':null)}${kv('Subclass',q.subclass)}`;
}
/* building attributes: footprint from OpenStreetMap, then the GURS cadastre (Kataster nepremičnin) for the same spot */
const KN='https://ipi.eprostor.gov.si/wfs-si-gurs-kn/ogc/features/collections/SI.GURS.KN:STAVBE/items';
function ringArea(ring){const o=ring[0];let a=0;for(let i=0;i<ring.length-1;i++){const [x1,y1]=toXY(ring[i],o),[x2,y2]=toXY(ring[i+1],o);a+=x1*y2-x2*y1;}return Math.abs(a)/2;}
async function buildingData(b,p){
  const m=$('bim'); if(!m||!b) return;
  const area=b.g?polys(b.g).reduce((a,poly)=>a+ringArea(poly[0]),0):0;
  m.innerHTML=`<h3>Building data (OpenStreetMap footprint)</h3>${kv('Footprint area',area?Math.round(area)+' m²':null)}${kv('Height in map data',b.hknown&&b.h?Math.round(b.h)+' m':null)}${kv('Gross floor area, estimate',area&&b.hknown&&b.h?Math.round(area*Math.max(1,Math.round(b.h/3)))+' m² ('+Math.max(1,Math.round(b.h/3))+' storeys at 3 m)':null)}`;
  if(!b.c) return;
  const [lon,lat]=b.c, d=0.00025;
  try{
    const r=await within(fetch(`${KN}?f=json&limit=3&bbox=${lon-d},${lat-d},${lon+d},${lat+d}`),8000);
    if(!r||!r.ok||curId!==p.id) return; const j=await r.json(); const ft=(j.features||[])[0]; if(!ft) return;
    const rows=Object.entries(ft.properties||{}).filter(([k,v])=>v!=null&&v!==''&&!/^(geom|the_geom)$/i.test(k)).slice(0,14);
    if(rows.length) m.insertAdjacentHTML('beforeend',`<h3>Cadastre (GURS Kataster nepremičnin)</h3>${rows.map(([k,v])=>kv(k.replace(/_/g,' '),String(v))).join('')}<p class="note">Record nearest to the highlighted footprint, from the GURS OGC API Features service (CC BY 4.0).</p>`);
  }catch(_){}
}

/* any address or place found by search */
function showAddress(f){
  const p=f.properties, ll=f.geometry.coordinates, title=p.housenumber?fmtAddr(p):(p.name||fmtAddr(p));
  const isHouse=!!p.housenumber||p.osm_key==='building';
  curId=null;
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
function showStructurePick(f,ll){
  const q=f.properties, lines=linesOf(f.geometry);
  hlToken++; showBuilding(null); map.getSource('unc').setData({type:'FeatureCollection',features:[]}); curId=null;
  const parts=[]; try{ const key=[q.ref||'',q.name||'',q.class||''].join('|');
    for(const g of map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',filter:['==',['get','brunnel'],q.brunnel||'']})) if([g.properties.ref||'',g.properties.name||'',g.properties.class||''].join('|')===key) for(const ln of linesOf(g.geometry)) if(ln.some(c=>lineDist(c,lines[0])<300)) parts.push(ln); }catch(_){}
  const all=parts.length?parts:lines; showLine(all);
  const name=q.name||(q.brunnel?cap(q.brunnel):'Aerialway')+(q.ref?' '+q.ref:'');
  setSel({id:null,ll,label:name,glyph:'pin'});
  openShell(`<div class="body"><div class="kicker ref">${q.brunnel?cap(q.brunnel):'Aerialway'}</div><h1>${esc(name)}</h1>
    <p class="where">${esc([q.ref?'Ref '+q.ref:'',q.class?cap(q.class):''].filter(Boolean).join(' · '))}</p>
    <div id="bim" class="bim"></div><h3>Position</h3>${kv('WGS84',`${ll[1].toFixed(6)}, ${ll[0].toFixed(6)}`)}
    <p class="note">Structure from OpenStreetMap. Not a ZAG record.</p></div>`);
  structureData({props:q,lines:all},{});
}
function showBuildingPick(ll,feat){
  const tok=++hlToken; const b=feat?buildingFromFeature(feat):findBuilding(ll,3); if(tok!==hlToken) return; showBuilding(b);
  map.getSource('unc').setData({type:'FeatureCollection',features:[]}); showLine(null); setSel(null); curId=null;
  openShell(`<div class="body"><div class="kicker ref">Building</div><h1 id="bt">Looking up the nearest address…</h1><p class="where" id="bs"></p>
    <div id="bim" class="bim"></div><h3>Position</h3>${kv('WGS84',`${ll[1].toFixed(6)}, ${ll[0].toFixed(6)}`)}
    <p class="note">${b?'Footprint from OpenStreetMap building data.':'No footprint found at this point.'} Not a ZAG record.</p></div>`);
  if(b) buildingData(b,{id:null});
  fetch(`${PHOTON}/reverse?lon=${ll[0]}&lat=${ll[1]}&limit=1`).then(r=>r.ok?r.json():null).then(j=>{
    if(tok!==hlToken) return; const f=j&&j.features&&j.features[0], t=$('bt'); if(!t) return;
    if(!f){t.textContent='Building';$('bs').textContent='No address found nearby';return;}
    const q=f.properties; t.textContent=q.housenumber?fmtAddr(q):(q.name||fmtAddr(q));
    $('bs').textContent=`Nearest address in OpenStreetMap, ${Math.round(meters(f.geometry.coordinates,ll))} m from the click`;
  }).catch(()=>{const t=$('bt');if(tok===hlToken&&t)t.textContent='Building';});
}
