'use strict';
/* Atlas data: loads data/zag_projects.geojson and applies the active filters (section, layer toggles, timeline year). */
const ZA={features:[],byId:{},images:{},nav:'projects',showProj:true,showFac:true,upTo:null};
const GROUPS={building:'buildings',institution:'buildings',bridge:'bridges',footbridge:'bridges','road structure':'bridges',
  tunnel:'infrastructure','dam / hydropower':'infrastructure',cableway:'infrastructure','tower / mast':'infrastructure'};
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
const INV_LABEL={research:'Research','inspection':'Inspection','structural assessment':'Structural assessment',monitoring:'Monitoring',
  'materials testing':'Materials testing',rehabilitation:'Rehabilitation',BIM:'BIM',digitalisation:'Digitalisation',LiDAR:'LiDAR survey',UAV:'UAV survey',
  'energy assessment':'Energy assessment','fire testing':'Fire testing',other:'Other'};
const kindOf=p=>p.category==='zag_facility'?'fac':p.evidence_level==='documented'?'doc':'ref';

async function loadAtlas(){
  const r=await fetch('../data/zag_projects.geojson'); if(!r.ok) throw new Error('dataset '+r.status);
  const j=await r.json(); ZA.features=j.features; ZA.byId=Object.fromEntries(j.features.map(f=>[f.properties.id,f]));
  try{ const ri=await fetch('../data/images.json'); if(ri.ok) ZA.images=await ri.json(); }catch(_){}
}
function isVisible(p){
  if(p.category==='zag_facility'){ if(!ZA.showFac) return false; } else if(!ZA.showProj) return false;
  if(ZA.nav!=='projects'&&GROUPS[p.object_type]!==ZA.nav) return false;
  if(ZA.upTo!=null&&p.year_start!=null&&p.year_start>ZA.upTo) return false;
  return true;
}
const visibleFeatures=()=>ZA.features.filter(f=>isVisible(f.properties));
