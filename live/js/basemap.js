'use strict';
/* Basemap: OpenFreeMap restyling, satellite, terrain, 3D toggles */
const LAND_FILL=/^(park|landuse_|landcover_|water$|aeroway_fill|building$|road_area_pattern)/;

/* road class from layer id */
function roadClass(id){
  if(/rail/.test(id)) return 'rail';
  if(/path_pedestrian/.test(id)) return 'path';
  if(/motorway/.test(id)) return 'mw';
  if(/trunk_primary/.test(id)) return 'tr';
  if(/(^|_)link/.test(id)) return 'tr';
  if(/secondary_tertiary/.test(id)) return 'sec';
  return 'min';
}
/* the look of every basemap layer for (theme, base). Returns {paint:{}, vis:'visible'|'none'} */
function look(L,T,B){
  const p=PAL[T], id=L.id, o={}, sat=B==='sat'||B==='dof'; let vis='visible';
  if(L.type==='background'){o['background-color']=p.land;}
  else if(id==='park'){o['fill-color']=p.park;o['fill-outline-color']=p.park;o['fill-opacity']=.9;}
  else if(id==='park_outline'){o['line-opacity']=0;}
  else if(id==='landuse_residential'){o['fill-color']=p.resid;}
  else if(id==='landcover_wood'){o['fill-color']=p.wood;o['fill-opacity']=1;}
  else if(id==='landcover_grass'){o['fill-color']=p.grass;o['fill-opacity']=1;}
  else if(id==='landcover_ice'){o['fill-color']=p.ice;}
  else if(id==='landcover_sand'){o['fill-color']=p.sand;}
  else if(/^landuse_/.test(id)&&L.type==='fill'){o['fill-color']=p.misc;}
  else if(id==='water'){o['fill-color']=p.water;}
  else if(/^waterway/.test(id)&&L.type==='line'){o['line-color']=p.water;}
  else if(id==='aeroway_fill'){o['fill-color']=p.aero;}
  else if(/^aeroway_/.test(id)){o['line-color']=p.runway;}
  else if(/^(tunnel|road|bridge)_/.test(id)&&L.type==='line'){
    const c=roadClass(id), cas=/_casing$/.test(id);
    if(c==='rail') o['line-color']=p.rail;
    else if(cas) o['line-color']=p[(c==='path'?'min':c)+'C'];
    else o['line-color']=p[c];
    if(/^tunnel_/.test(id)) o['line-opacity']=.55;
    if(sat){
      if(cas||c==='min'||c==='path'||c==='rail') vis='none';
      else o['line-opacity']=c==='mw'?.75:.55;
    }
  }
  else if(id==='building'){o['fill-color']=p.bld;o['fill-outline-color']=p.bldE;}
  else if(id==='building-3d'){o['fill-extrusion-color']=p.bld3;o['fill-extrusion-opacity']=T==='dark'?.92:.88;o['fill-extrusion-vertical-gradient']=true;}
  else if(id==='boundary_2'){o['line-color']=sat?'rgba(255,255,255,.75)':p.border;}
  else if(id==='boundary_3'){o['line-color']=sat?'rgba(255,255,255,.4)':p.border2;}
  else if(id==='hillshade'){o['hillshade-exaggeration']=.5;o['hillshade-shadow-color']=p.hsS;o['hillshade-highlight-color']=p.hsH;o['hillshade-accent-color']=p.hsA;if(sat)vis='none';}
  else if(id==='sat'){vis=B==='sat'?'visible':'none';}
  else if(id==='dof'){vis=B==='dof'?'visible':'none';}
  if(L.type==='symbol'&&L.layout&&L.layout['text-field']&&!/shield/.test(id)){
    const water=/water/.test(id), road=/^highway-name/.test(id), place=/^label_/.test(id);
    if(sat){o['text-color']=water?'#D6EBFF':'#FFFFFF';o['text-halo-color']='rgba(0,0,0,.72)';}
    else{o['text-color']=water?p.wtxt:road?p.rtxt:place?p.place:p.txt;o['text-halo-color']=p.halo;}
    o['text-halo-width']=1.4;
  }
  if(sat&&LAND_FILL.test(id)&&!(id==='building'&&bldOn())) vis='none';
  if(id==='building'&&!bldOn()) vis='none';
  if(id==='building-3d'){ vis=(is3d&&bldOn())?'visible':'none'; if(sat) o['fill-extrusion-opacity']=.6; }
  return {paint:o,vis};
}

/* prepare the OpenFreeMap style before the map is created (no flash of other colours) */
function prep(s){
  s.layers=s.layers.filter(l=>l.id!=='natural_earth');
  delete s.sources.ne2_shaded;
  s.sources['dem-terrain']={type:'raster-dem',tiles:[DEM_URL],tileSize:256,maxzoom:15,encoding:'terrarium',
    attribution:'<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Terrain: Mapzen / AWS Terrain Tiles</a>'};
  s.sources['dem-hill']={type:'raster-dem',tiles:[DEM_URL],tileSize:256,maxzoom:15,encoding:'terrarium'};
  s.sources.dof={type:'raster',scheme:'tms',tiles:[DOF_URL],tileSize:256,minzoom:8,maxzoom:20,attribution:'Orthophoto © GURS (CC BY 4.0), DOF025, via Level2.si'};
  s.sources.sat={type:'raster',tiles:[SAT_URL],tileSize:256,maxzoom:19,
    attribution:'Imagery © <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics'};
  const local=['coalesce',['get','name:latin'],['get','name']];
  s.layers.forEach(l=>{ if(l.layout&&l.layout['text-field']&&JSON.stringify(l.layout['text-field']).includes('name_en')) l.layout['text-field']=local; });
  const bi=s.layers.findIndex(l=>l.type==='background');
  s.layers.splice(bi+1,0,{id:'dof',type:'raster',source:'dof',layout:{visibility:'none'},paint:{'raster-fade-duration':200}});
  s.layers.splice(bi+1,0,{id:'sat',type:'raster',source:'sat',layout:{visibility:'none'},paint:{'raster-fade-duration':200}});
  let wi=s.layers.findIndex(l=>/^waterway/.test(l.id)); if(wi<0) wi=bi+2;
  s.layers.splice(wi,0,{id:'hillshade',type:'hillshade',source:'dem-hill',paint:{'hillshade-exaggeration':.42,'hillshade-illumination-direction':315}});
  // remember original values of every property the looks touch, so switching back restores them
  for(const L of s.layers){
    const keys=new Set();
    for(const T of ['light','dark']) for(const B of ['map','sat','dof']) Object.keys(look(L,T,B).paint).forEach(k=>keys.add(k));
    TOUCHED[L.id]=[...keys]; ORIG[L.id]=Object.fromEntries([...keys].map(k=>[k,(L.paint||{})[k]]));
    const lk=look(L,theme,base); L.paint=Object.assign({},L.paint||{},lk.paint); L.layout=Object.assign({},L.layout||{},{visibility:lk.vis});
  }
  return s;
}
function skyFor(){const p=(base==='sat'||base==='dof')?SATSKY:PAL[theme];return {'sky-color':p.sky,'horizon-color':p.hor,'fog-color':p.fog,'fog-ground-blend':.55,'horizon-fog-blend':.6,'sky-horizon-blend':.75,'atmosphere-blend':0};}
function applyLook(){
  if(!ready) return;
  for(const L of map.getStyle().layers){
    if(!(L.id in TOUCHED)) continue;
    const lk=look(L,theme,base);
    for(const k of TOUCHED[L.id]){ const v=k in lk.paint?lk.paint[k]:ORIG[L.id][k]; try{map.setPaintProperty(L.id,k,v===undefined?null:v);}catch(_){} }
    map.setLayoutProperty(L.id,'visibility',lk.vis);
  }
  try{map.setSky(skyFor());}catch(_){}
  const dk=theme==='dark'||base==='sat'||base==='dof';
  map.setPaintProperty('pt-l','text-color',dk?'#FFFFFF':'#1C1C1E');
  map.setPaintProperty('pt-l','text-halo-color',dk?'rgba(0,0,0,.78)':'rgba(255,255,255,.95)');
  map.setPaintProperty('hl-ext','fill-extrusion-color',(base==='sat'||base==='dof')?'#FFB000':'#2F5597');
}

/* ---------- theme / style controls ---------- */
function setTheme(t){ theme=t; document.documentElement.setAttribute('data-theme',t); applyLook(); }
function bldOn(){ return bldPref!==null?bldPref:base==='map'; }
function setBuildings(on){ bldPref=on; applyLook(); emit('view'); }
function setBase(b){ base=b; applyLook(); emit('view'); }
function set3d(on){
  is3d=on; emit('view');
  if(!ready) return;
  map.setTerrain(on?{source:'dem-terrain',exaggeration:1}:null);
  applyLook();
  if(!on) map.easeTo({pitch:0,bearing:0,duration:700});
  else if(map.getPitch()<20) map.easeTo({pitch:55,duration:900});
}

