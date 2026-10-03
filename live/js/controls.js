'use strict';
/* Controls: header sections, background and 3D switches, layers panel, rotate/tilt tool, zoom, north. */
const layersEl=$('layers');
function syncView(){
  document.querySelectorAll('#bgSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.bg===base));
  $('b3d').setAttribute('aria-pressed',is3d);
  document.querySelectorAll('input[name=lyBg]').forEach(r=>r.checked=r.value===base);
  document.querySelectorAll('input[name=lyViz]').forEach(r=>r.checked=(r.value==='3d')===is3d);
  $('lyBld').checked=bldOn();
  const t={map:'Map © OpenStreetMap contributors via OpenFreeMap, relief: Mapzen / AWS Terrain Tiles',
    sat:'Imagery: Esri World Imagery (capture dates vary by area)',dof:'Orthophoto: GURS DOF025, 2020-2022, CC BY 4.0, via Level2.si'}[base];
  $('srcnote').textContent=t;
}
document.addEventListener('atlas:view',syncView);
document.addEventListener('atlas:selected',e=>{ if(e.detail&&phone()&&!layersEl.hidden){layersEl.hidden=true;$('bLayers').setAttribute('aria-expanded',false);} });
document.querySelectorAll('#bgSeg button').forEach(b=>b.onclick=()=>setBase(b.dataset.bg));
document.querySelectorAll('input[name=lyBg]').forEach(r=>r.onchange=()=>setBase(r.value));
document.querySelectorAll('input[name=lyViz]').forEach(r=>r.onchange=()=>set3d(r.value==='3d'));
$('b3d').onclick=()=>set3d(!is3d);
$('lyBld').onchange=e=>setBuildings(e.target.checked);
$('lyProj').onchange=e=>{ZA.showProj=e.target.checked;refreshProjects();};
$('lyFac').onchange=e=>{ZA.showFac=e.target.checked;refreshProjects();};
$('bLayers').onclick=function(){const o=layersEl.hidden;layersEl.hidden=!o;this.setAttribute('aria-expanded',o);};

document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>{
  if(b.dataset.nav==='about'){$('about').showModal();return;}
  ZA.nav=b.dataset.nav; syncNav(); refreshProjects(); openList();
});
document.querySelectorAll('[data-ic]').forEach(i=>{ i.innerHTML=ICON[i.dataset.ic]||''; });
function syncNav(){document.querySelectorAll('#nav button').forEach(b=>{const on=b.dataset.nav===ZA.nav;b.setAttribute('aria-pressed',on&&b.dataset.nav!=='about');});}
document.addEventListener('atlas:nav',syncNav);

const nudge=d=>{ if(!map) return; orbitOn=false; userMoved=true; map.easeTo({bearing:map.getBearing()+(d.b||0),pitch:Math.max(0,Math.min(80,map.getPitch()+(d.p||0))),duration:350,essential:true}); };
$('rotL').onclick=()=>nudge({b:-30}); $('rotR').onclick=()=>nudge({b:30});
$('tiltU').onclick=()=>{ if(!is3d) set3d(true); nudge({p:12}); }; $('tiltD').onclick=()=>nudge({p:-12});
$('north').onclick=()=>map&&map.easeTo({bearing:0,duration:500});
$('zin').onclick=()=>map&&map.zoomIn(); $('zout').onclick=()=>map&&map.zoomOut();
$('zhome').onclick=()=>{ closeInfo(); closeList(); if(map) home(); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!info.hidden&&document.activeElement===document.body) closeInfo(); });
const fitHeader=()=>document.documentElement.style.setProperty('--hdr',document.querySelector('.hdr').offsetHeight+'px');
fitHeader();
let rz; addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{fitHeader();if(map)map.resize();},150);});
