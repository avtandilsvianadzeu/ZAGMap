'use strict';
/* Locate: geometry, building footprint highlight, geocoding, camera, selection pin */
/* ---------- geometry helpers ---------- */
const R=6371008.8, rad=Math.PI/180;
function meters(a,b){const x=(b[0]-a[0])*rad*Math.cos((a[1]+b[1])/2*rad), y=(b[1]-a[1])*rad; return Math.hypot(x,y)*R;}
function toXY(p,o){return [(p[0]-o[0])*rad*Math.cos(o[1]*rad)*R,(p[1]-o[1])*rad*R];}
function inRing(pt,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];
  if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])) c=!c;}return c;}
function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function polys(g){return g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];}
/* distance in metres from a point to a building footprint, 0 when inside */
function distTo(lngLat,g){
  let best=Infinity;
  for(const poly of polys(g)){
    const rings=poly.map(r=>r.map(c=>toXY(c,lngLat)));
    if(inRing([0,0],rings[0])&&!rings.slice(1).some(h=>inRing([0,0],h))) return 0;
    for(const r of rings) for(let i=1;i<r.length;i++) best=Math.min(best,segDist([0,0],r[i-1],r[i]));
  }
  return best;
}
function centroid(g){ // area-weighted centroid of the largest outer ring
  let best=null,ba=0;
  for(const poly of polys(g)){const r=poly[0],o=r[0];let a=0,cx=0,cy=0;
    for(let i=0;i<r.length-1;i++){const[x1,y1]=toXY(r[i],o),[x2,y2]=toXY(r[i+1],o),k=x1*y2-x2*y1;a+=k;cx+=(x1+x2)*k;cy+=(y1+y2)*k;}
    a/=2; if(Math.abs(a)>ba&&a){ba=Math.abs(a);const mx=cx/(6*a),my=cy/(6*a);best=[o[0]+mx/(R*Math.cos(o[1]*rad))/rad,o[1]+my/R/rad];}}
  if(best) return best;
  let sx=0,sy=0,n=0;for(const poly of polys(g)) for(const c of poly[0]){sx+=c[0];sy+=c[1];n++;}return n?[sx/n,sy/n]:null;}
function circle(c,m,n){n=n||72;const out=[];for(let i=0;i<=n;i++){const a=i/n*2*Math.PI;out.push([c[0]+m*Math.cos(a)/(R*Math.cos(c[1]*rad))/rad,c[1]+m*Math.sin(a)/R/rad]);}return {type:'Polygon',coordinates:[out]};}

/* ---------- building highlight ----------
   Uses the building footprints of the live vector tiles (OpenStreetMap; in Slovenia these largely come from
   the GURS building cadastre). Picks the footprint that contains the point, else the nearest within maxM. */
const within=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
/* wait until the tiles in view are in, but never longer than 8 s (a slow far-horizon tile must not block the highlight) */
function waitIdle(){return within(new Promise(res=>{ if(map.loaded()&&map.areTilesLoaded()) setTimeout(res,60); else map.once('idle',()=>res()); }),8000);}
function findBuilding(lngLat,maxM){
  let feats=[]; try{feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});}catch(_){return null;}
  let best=null, bd=Infinity;
  for(const f of feats){
    const c=centroid(f.geometry); if(!c||meters(c,lngLat)>400) continue;
    const d=distTo(lngLat,f.geometry); if(d<bd){bd=d;best=f;}
  }
  if(!best||bd>maxM) return null;
  const parts=best.id!=null?feats.filter(f=>f.id===best.id):[best];
  return {feature:best,parts,g:best.geometry,dist:bd,id:best.id,h:+(best.properties.render_height||best.properties.height||8),b:+(best.properties.render_min_height||0),c:centroid(best.geometry)};
}
function buildingFromFeature(f){
  let feats=[]; try{feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'building'});}catch(_){}
  const parts=f.id!=null?feats.filter(x=>x.id===f.id):[f]; const best=parts[0]||f;
  return {feature:best,parts:parts.length?parts:[f],g:best.geometry,dist:0,id:best.id,h:+(best.properties.render_height||best.properties.height||8),b:+(best.properties.render_min_height||0),c:centroid(best.geometry)};
}
function showBuilding(b){
  const fc={type:'FeatureCollection',features:b?b.parts.map(f=>({type:'Feature',properties:{h:+(f.properties.render_height||8)+0.6,b:+(f.properties.render_min_height||0)},geometry:f.geometry})):[]};
  map.getSource('hl').setData(fc);
  try{ map.setFilter('building-3d', b&&b.id!=null?['!=',['id'],b.id]:null); map.setFilter('building', b&&b.id!=null?['!=',['id'],b.id]:null);}catch(_){}
}
function clearHL(){ hlToken++; if(!ready) return; showBuilding(null); map.getSource('unc').setData({type:'FeatureCollection',features:[]}); }

/* ---------- geocoding (Photon, OpenStreetMap) ---------- */
const GEO={};
function hnOf(addr){const m=/\s(\d+\s*[a-z]?)\s*,/i.exec(addr);return m?m[1].replace(/\s/g,'').toLowerCase():null;}
function geocodeAddress(addr){
  if(GEO[addr]) return GEO[addr];
  const hn=hnOf(addr), street=addr.split(',')[0].replace(/\s\d+\s*[a-z]?$/i,'').trim().toLowerCase();
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  GEO[addr]=fetch(`${PHOTON}/api/?q=${encodeURIComponent(addr)}&limit=6&bbox=13.3,45.4,16.7,46.9`).then(r=>r.ok?r.json():null).then(j=>{
    if(!j||!j.features) return null;
    const f=j.features.find(f=>{const p=f.properties||{};return hn&&String(p.housenumber||'').replace(/\s/g,'').toLowerCase()===hn&&norm(p.street||p.name).startsWith(norm(street).slice(0,5));});
    return f?{ll:f.geometry.coordinates,props:f.properties}:null;
  }).catch(()=>null);
  return GEO[addr];
}
function fmtAddr(p){if(!p)return '';const l1=[p.street||p.name,p.housenumber].filter(Boolean).join(' ');const l2=[p.postcode,p.city||p.town||p.village||p.locality].filter(Boolean).join(' ');return [l1,l2].filter(Boolean).join(', ');}

/* ---------- camera ---------- */
const UNC={settlement:900,municipality:2500,locality:500,approximate:800,derived:150};
const PREC={surveyed:'Published coordinate',derived:'Derived from river alignment',locality:'Locality centre, approximate',address:'Street address',
  approximate:'Approximate, from the road alignment',settlement:'Settlement centre, approximate',municipality:'Municipality centre, approximate'};
const PRECOK=p=>p==='surveyed'||p==='address';
function zoomFor(x){
  if(x.prec==='address') return 17.3;
  if(x.prec==='surveyed'){return ({tunnel:15.3,dam:16,bridge:16.2,cable:14.8,slide:14.8,build:17,inst:17,tower:16.5,road:15.5,geo:15}[x.cat])||16.2;}
  if(x.prec==='derived') return 16;
  if(x.prec==='municipality') return 12.6;
  return 14;
}
function bearingFor(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))|0;return (Math.abs(h)%70)-35;}
/* camera padding keeps the target clear of the info panel (left, desktop) or the bottom sheet (phone) and the timeline */
function padNow(){
  const open=document.body.classList.contains('has-panel');
  if(phone()) return open?{top:70,bottom:Math.round(innerHeight*0.55),left:20,right:20}:{top:70,bottom:130,left:20,right:20};
  return open?{top:70,bottom:120,left:430,right:70}:{top:70,bottom:120,left:40,right:70};
}
/* camera move + callback when it ends. Stops any running animation first, so the callback cannot catch the stale
   moveend of the interrupted one, and is registered before the move, so an instant move (reduced motion) still reports. */
function moveThen(kind,opts,cb){ map.stop(); if(cb) map.once('moveend',cb); map[kind](opts); }
function flyToSite(x,cb){
  orbitOn=false; userMoved=false;
  const z=zoomFor(x), pitch=is3d?(z>=15?60:50):0, bearing=is3d?bearingFor(x.id||x.key):0;
  moveThen('flyTo',{center:[x.lon,x.lat],zoom:z,pitch,bearing,padding:padNow(),speed:1.3,curve:1.42,essential:true,maxDuration:reduced?1:9000},cb);
}
function home(fast){
  orbitOn=false; clearHL(); setSel(null);
  const cam=map.cameraForBounds(SI_BOUNDS,{padding:padNow()});
  if(!cam) return;
  moveThen('flyTo',{center:cam.center,zoom:cam.zoom+(is3d?0.15:0),pitch:is3d?38:0,bearing:0,padding:{top:0,bottom:0,left:0,right:0},duration:fast||reduced?0:2200,essential:true});
}
function orbit(tok){
  if(!orbitOn||reduced||!is3d||tok!==hlToken) return;
  moveThen('easeTo',{bearing:map.getBearing()+24,duration:16000,easing:t=>t},()=>{ if(!userMoved) orbit(tok); });
}

/* ---------- select a place: pin, uncertainty area, building ---------- */
const GL={bridge:'M-5 2.4a5 5 0 0 1 10 0M-5 2.4h10',ai:'M-5 2.6-1.6-1.2 1.2 1.4 5-3.2',energy:'M-5-1.6q2.5-2.4 5 0t5 0M-5 2.2q2.5-2.4 5 0t5 0',
  geo:'M-5 3.2 0-3.4l5 6.6z',fire:'M0-4.4c2.6 2.4 3.8 3.8 3.8 5.6A3.8 3.8 0 0 1 0 4.6 3.8 3.8 0 0 1-3.8 1.2c0-1.3.7-2.3 1.9-3.4 0 1.3.6 2 1.4 2.2-.3-1.9 0-3.4.5-4.4z',
  mat:'M0-4.2 4-2v4.4L0 4.4-4 2.4V-2z',build:'M-4.8 4V-1.4L0-4.4l4.8 3V4zM-1.8 4V.4h3.6V4',herit:'M-4.8 4V-1h9.6v5M-3.2-1v-1.6h6.4V-1M0-4.6l3.6 2H-3.6z',
  tunnel:'M-4.6 4.2V0a4.6 4.6 0 0 1 9.2 0v4.2M-1.6 4.2V1.6h3.2v2.6',cable:'M-5-2.6h10M0-2.6v2.4M-2.4 0h4.8v3.4h-4.8z',
  quake:'M-5 0h2l1.4-3.4 2 6.4 1.6-4.2 1 1.2h2',inst:'M-3.6-3.6h7.2v7.2h-7.2z',pin:'M0-4.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 1 1 0-6.8z'};
const ico=k=>`<span class="ic" style="--c:${DOMC(k)}"><svg viewBox="-6 -6 12 12"><path d="${GL[k]||GL.inst}" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
function setSel(o){
  if(selMarker){selMarker.remove();selMarker=null;}
  selId=o&&o.id||null;
  if(ready) map.setFilter('pt',selId?['all',['!',['has','point_count']],['!=',['get','id'],selId]]:['!',['has','point_count']]);
  if(ready) map.setFilter('pt-l',selId?['all',['!',['has','point_count']],['!=',['get','id'],selId]]:['!',['has','point_count']]);
  if(!o) return;
  const el=document.createElement('div'); el.className='selpin'; el.style.setProperty('--pc',o.color||'var(--blue)');
  el.innerHTML=`<div class="lbl">${esc(o.label)}</div><div class="lead"></div><div class="dot"></div>`;
  selMarker=new maplibregl.Marker({element:el,anchor:'bottom',offset:[0,0]}).setLngLat(o.ll).addTo(map);
}
/* x: entry or story-like {lat,lon,prec,cat,addr,id}. onPos(info) reports how the position was resolved */
async function locate(x,onPos){
  const tok=++hlToken;
  showBuilding(null);
  const ll=[x.lon,x.lat];
  const unc=UNC[x.prec];
  map.getSource('unc').setData({type:'FeatureCollection',features:unc?[{type:'Feature',properties:{},geometry:circle(ll,unc)}]:[]});
  const wantBuilding=!!x.addr||(x.prec==='surveyed'&&/^(build|inst)$/.test(x.cat));
  let target=ll, how=null, g=null;
  if(x.addr){ onPos&&onPos({state:'busy',text:'Matching the address…'}); g=await within(geocodeAddress(x.addr),6000); if(tok!==hlToken) return;
    if(g&&meters(g.ll,ll)<(x.tol||1500)){target=g.ll;how='address';} }
  if(how==='address'&&meters(target,ll)>25){ await new Promise(r=>moveThen('easeTo',{center:target,duration:reduced?0:900},r)); }
  if(!wantBuilding){ onPos&&onPos({state:'done',kind:unc?'area':'point'}); return; }
  await new Promise(r=>map.isMoving()?map.once('moveend',r):r()); if(tok!==hlToken) return;
  await waitIdle(); if(tok!==hlToken) return;
  const b=findBuilding(target,how==='address'?20:35);
  if(tok!==hlToken) return;
  showBuilding(b);
  onPos&&onPos({state:'done',kind:b?'building':'point',how,dist:g?Math.round(meters(g.ll,ll)):null,b,geo:g});
  // the geocoder answered after the timeout: upgrade to the building at the address once it arrives
  if(x.addr&&!g) geocodeAddress(x.addr).then(g2=>{
    if(!g2||tok!==hlToken||meters(g2.ll,ll)>=(x.tol||1500)) return;
    const b2=findBuilding(g2.ll,20); if(!b2) return;
    showBuilding(b2); onPos&&onPos({state:'done',kind:'building',how:'address',dist:Math.round(meters(g2.ll,ll)),b:b2,geo:g2});
  });
}
function posChip(info,x){
  if(!info||info.state==='busy') return `<span class="chip busy"><span class="spin"></span>${esc(info?info.text:'Locating…')}</span>`;
  if(info.kind==='building') return `<span class="chip ok">Building highlighted${info.how==='address'?' from the street address':''}</span>`;
  if(info.kind==='area') return `<span class="chip warn">${esc(PREC[x.prec]||'Approximate')} · shaded area</span>`;
  return `<span class="chip ${PRECOK(x.prec)?'ok':'warn'}">${esc(PREC[x.prec]||x.prec)}</span>`;
}
function posNote(info,x){
  if(!info||info.state==='busy') return '';
  if(info.kind==='building'){
    const h=info.b&&info.b.h?` The footprint is about ${Math.round(info.b.h)} m tall in the map data.`:'';
    return info.how==='address'
      ? `The building is matched from the street address in OpenStreetMap${info.dist!=null?`, ${info.dist} m from the coordinate in the dataset`:''}.${h}`
      : `The building is the footprint at or nearest to the recorded coordinate.${h}`;
  }
  if(x.addr) return 'The address could not be matched live, so the pin stays on the recorded coordinate and no building is claimed.';
  if(info.kind==='area') return 'This position is a settlement or area centre, not the structure itself. The shaded circle marks the area it stands for.';
  return '';
}

