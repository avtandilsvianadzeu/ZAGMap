'use strict';
/* Layers: overlay sources and layers (uncertainty area, selected footprint, selected alignment, ZAG records)
   and the runtime match of a record to the real structure in the OpenStreetMap vector tiles. */
function addAtlasLayers(){
  for(const t of Object.keys(MARK)) for(const k of ['doc','fac','ref']) map.addImage(`m-${t}-${k}`,markerImage(t,k),{pixelRatio:2});
  const E0={type:'FeatureCollection',features:[]};
  ['unc','hl','sel'].forEach(s=>map.addSource(s,{type:'geojson',data:E0}));
  map.addSource('sites',{type:'geojson',data:E0,cluster:true,clusterRadius:44,clusterMaxZoom:11});
  const firstSym=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id, fonts=['Noto Sans Bold'];
  map.addLayer({id:'unc-f',type:'fill',source:'unc',paint:{'fill-color':'#2F5597','fill-opacity':.10}},firstSym);
  map.addLayer({id:'unc-l',type:'line',source:'unc',paint:{'line-color':'#2F5597','line-width':1.5,'line-dasharray':[3,3],'line-opacity':.8}},firstSym);
  map.addLayer({id:'hl-ext',type:'fill-extrusion',source:'hl',paint:{'fill-extrusion-color':'#2F5597','fill-extrusion-height':['get','h'],'fill-extrusion-base':['get','b'],'fill-extrusion-opacity':.9}},firstSym);
  map.addLayer({id:'hl-line',type:'line',source:'hl',paint:{'line-color':'#FFB000','line-width':3}},firstSym);
  map.addLayer({id:'sel-c',type:'line',source:'sel',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':10}});
  map.addLayer({id:'sel-l',type:'line',source:'sel',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#FFB000','line-width':5}});
  map.addLayer({id:'clu',type:'circle',source:'sites',filter:['has','point_count'],paint:{'circle-color':'#2F5597','circle-radius':['step',['get','point_count'],15,5,18,12,22],'circle-stroke-color':'#fff','circle-stroke-width':2.5}});
  map.addLayer({id:'clu-n',type:'symbol',source:'sites',filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count']],'text-font':fonts,'text-size':12.5,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'pt',type:'symbol',source:'sites',filter:['!',['has','point_count']],layout:{'icon-image':['get','ic'],'icon-allow-overlap':true,'icon-size':['interpolate',['linear'],['zoom'],7,.75,13,.95,17,1.1]}});
  map.addLayer({id:'pt-l',type:'symbol',source:'sites',filter:['!',['has','point_count']],minzoom:9,layout:{'text-field':['get','n'],'text-font':fonts,'text-size':12,'text-offset':[1.3,0],'text-anchor':'left','text-optional':true,'text-max-width':14},paint:{'text-color':'#1C1C1E','text-halo-color':'rgba(255,255,255,.95)','text-halo-width':1.6}});
}
const markerFor=p=>`m-${MARK[p.object_type]?p.object_type:'other'}-${kindOf(p)}`;
function refreshProjects(){
  const feats=visibleFeatures();
  if(ready) map.getSource('sites').setData({type:'FeatureCollection',features:feats.map(f=>({type:'Feature',geometry:f.geometry,properties:{id:f.properties.id,n:f.properties.name_en||f.properties.name,ic:markerFor(f.properties)}}))});
  emit('filtered',{n:feats.length,total:ZA.features.length});
}
function showLine(lines){
  if(!ready) return;
  map.getSource('sel').setData({type:'FeatureCollection',features:lines&&lines.length?[{type:'Feature',properties:{},geometry:{type:'MultiLineString',coordinates:lines}}]:[]});
}

/* ---- match a record to the structure in the OpenStreetMap transportation layer ---- */
const SNAP={bridge:{brunnel:'bridge'},footbridge:{brunnel:'bridge'},'road structure':{brunnel:'bridge'},tunnel:{brunnel:'tunnel'},cableway:{cls:'aerialway'}};
const SNAP_R={surveyed:250,address:250,derived:1000,approximate:1600,locality:1600,settlement:2500,municipality:3000};
const RANK={motorway:4,trunk:3,primary:3,secondary:2,tertiary:1};
function lineDist(pt,ln){const o=pt,p=toXY(pt,o);let m=Infinity;for(let i=0;i<ln.length-1;i++){m=Math.min(m,segDist(p,toXY(ln[i],o),toXY(ln[i+1],o)));}return m;}
function lineLen(ln){let L=0;for(let i=0;i<ln.length-1;i++)L+=meters(ln[i],ln[i+1]);return L;}
function midpoint(ln){const L=lineLen(ln)/2;let a=0;for(let i=0;i<ln.length-1;i++){const d=meters(ln[i],ln[i+1]);if(a+d>=L){const t=d?(L-a)/d:0;return [ln[i][0]+(ln[i+1][0]-ln[i][0])*t,ln[i][1]+(ln[i+1][1]-ln[i][1])*t];}a+=d;}return ln[ln.length-1];}
const linesOf=g=>g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
function snapStructure(p){
  const rule=SNAP[p.object_type]; if(!rule||!map.getSource('openmaptiles')) return null;
  const R=SNAP_R[p.position_precision]||800, pt=[p.longitude,p.latitude];
  const want=((p.structure&&p.structure.carries)||'').match(/\b[A-Z]{0,2}\d{1,4}\b/g)||[];
  const filter=rule.brunnel?['==',['get','brunnel'],rule.brunnel]:['==',['get','class'],rule.cls];
  let feats; try{feats=map.querySourceFeatures('openmaptiles',{sourceLayer:'transportation',filter});}catch(_){return null;}
  const key=f=>[f.properties.ref||'',f.properties.name||'',f.properties.class||''].join('|');
  let best=null;
  for(const f of feats) for(const ln of linesOf(f.geometry)){
    const d=lineDist(pt,ln); if(d>R) continue;
    const refOk=want.length>0&&String(f.properties.ref||'').split(/[;,]/).some(r=>want.includes(r.trim()));
    const score=d-(refOk?4000:0)-(f.properties.name?150:0)-(RANK[f.properties.class]||0)*120;
    if(!best||score<best.score) best={score,d,ln,f,refOk,k:key(f)};
  }
  if(!best) return null;
  const parts=[];
  for(const f of feats){ if(key(f)!==best.k) continue; for(const ln of linesOf(f.geometry)){ if(ln.some(c=>lineDist(c,best.ln)<300)) parts.push(ln); } }
  const all=parts.flat(); const far=all.reduce((m,c)=>Math.max(m,meters(c,pt)),0);
  const lines=parts.length?parts:[best.ln], longest=lines.reduce((m,l)=>lineLen(l)>lineLen(m)?l:m,lines[0]);
  return {lines,mid:midpoint(longest),dist:Math.round(best.d),refOk:best.refOk,props:best.f.properties,extent:far};
}
