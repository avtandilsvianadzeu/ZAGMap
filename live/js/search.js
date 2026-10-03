'use strict';
/* Search: one box, grouped results: projects, buildings, bridges (local records) and locations (Photon geocoder). */
const qIn=$('q'), resEl=$('results');
const norm=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
let qTimer=0, qSeq=0, locItems=[];
function matchLocal(q){
  const n=norm(q), out={projects:[],buildings:[],bridges:[]};
  for(const f of ZA.features){ const p=f.properties;
    const hay=norm([p.name_en,p.name_sl,p.municipality,p.locality,p.address,p.structure&&p.structure.crosses,p.structure&&p.structure.carries].join(' '));
    if(!hay.includes(n)) continue;
    const g=GROUPS[p.object_type]; (g==='buildings'?out.buildings:g==='bridges'?out.bridges:out.projects).push(f);
  }
  return out;
}
function draw(local){
  const sec=(t,items)=>items.length?`<h4>${t}</h4>${items.join('')}`:'';
  const loc=f=>f.map((x,i)=>`<button role="option" data-loc="${i}"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></button>`);
  const rec=fs=>fs.slice(0,6).map(f=>`<button role="option" data-id="${esc(f.properties.id)}"><b>${esc(f.properties.name_en)}</b><small>${esc([cap(f.properties.object_type),f.properties.municipality,f.properties.year].filter(Boolean).join(' · '))}</small></button>`);
  const html=sec('Projects',rec(local.projects))+sec('Buildings',rec(local.buildings))+sec('Bridges',rec(local.bridges))+sec('Locations',loc(locItems));
  resEl.innerHTML=html||'<div class="none">No matches</div>'; resEl.hidden=false;
  resEl.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{pick();showInfo(b.dataset.id);});
  resEl.querySelectorAll('[data-loc]').forEach(b=>b.onclick=()=>{const x=locItems[+b.dataset.loc];pick();showAddress(x.f);});
}
function pick(){resEl.hidden=true;qIn.blur();}
async function geocode(q,seq,local){
  try{ const r=await fetch(`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=5&bbox=13.3,45.4,16.7,46.9&lang=en`); if(!r.ok) return; const j=await r.json();
    if(seq!==qSeq) return;
    locItems=(j.features||[]).map(f=>{const p=f.properties;return{f,title:p.housenumber?fmtAddr(p):(p.name||fmtAddr(p)),sub:[p.osm_value&&!p.housenumber?cap(p.osm_value):'Address',p.city||p.county].filter(Boolean).join(' · ')};});
    draw(local);
  }catch(_){}
}
qIn.addEventListener('input',()=>{
  const q=qIn.value.trim(); clearTimeout(qTimer); const seq=++qSeq; locItems=[];
  if(q.length<2){resEl.hidden=true;return;}
  const local=matchLocal(q); draw(local);
  if(q.length>=3) qTimer=setTimeout(()=>geocode(q,seq,local),450);
});
qIn.addEventListener('keydown',e=>{
  const btns=[...resEl.querySelectorAll('button')]; let i=btns.findIndex(b=>b.getAttribute('aria-selected')==='true');
  if(e.key==='Escape'){resEl.hidden=true;return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault(); if(!btns.length) return; if(i>=0) btns[i].removeAttribute('aria-selected'); i=e.key==='ArrowDown'?(i+1)%btns.length:(i-1+btns.length)%btns.length; btns[i].setAttribute('aria-selected','true'); btns[i].scrollIntoView({block:'nearest'});}
  else if(e.key==='Enter'){const b=btns[Math.max(i,0)]; if(b) b.click();}
});
document.addEventListener('click',e=>{ if(!e.target.closest('.hsearch')) resEl.hidden=true; });
