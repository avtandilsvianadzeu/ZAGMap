'use strict';
/* Main: creates the map, wires map interactions and routes the URL hash. */
async function boot(){
  if(!window.maplibregl){toast('The map library did not load. Check the connection.',8000);return;}
  let style;
  const dataP=loadAtlas().catch(err=>{toast('The project dataset could not be loaded.',8000);console.error(err);});
  try{ const r=await fetch(STYLE_URL); if(!r.ok) throw 0; style=prep(await r.json()); }
  catch(_){
    toast('The street map could not load, showing satellite only.',6000); base='sat';
    style=prep({version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{}}]});
  }
  style.sky=skyFor();
  map=new maplibregl.Map({container:'map',style,center:[14.99,46.15],zoom:7.1,pitch:0,maxPitch:80,hash:false,
    attributionControl:{compact:true,customAttribution:'Geocoding <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a>'},
    maxBounds:[[11.5,44.6],[18.5,47.7]],fadeDuration:200,canvasContextAttributes:{antialias:true}});
  window.zagMap=map;
  map.on('load',async()=>{
    addAtlasLayers(); ready=true;
    if(is3d) map.setTerrain({source:'dem-terrain',exaggeration:1});
    applyLook(); syncView(); await dataP; refreshProjects();
    const hand=l=>{map.on('mouseenter',l,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',l,()=>map.getCanvas().style.cursor='');};
    ['pt','clu'].forEach(hand);
    map.on('click','pt',ev=>{ev.preventDefault();showInfo(ev.features[0].properties.id);});
    map.on('click','clu',async ev=>{ev.preventDefault();const f=ev.features[0];
      const z=await map.getSource('sites').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom:z+0.3,duration:700});});
    map.on('click',ev=>{
      if(ev.defaultPrevented||map.getZoom()<15.5) return;
      const hit=map.queryRenderedFeatures(ev.point,{layers:['building-3d','building','hl-ext'].filter(l=>map.getLayer(l))});
      if(!hit.length) return;
      orbitOn=false; showBuildingPick([ev.lngLat.lng,ev.lngLat.lat]);
    });
    ['dragstart','wheel','touchstart','mousedown'].forEach(t=>map.on(t,ev=>{if(ev.originalEvent){userMoved=true;orbitOn=false;}}));
    // MapLibre 5.x leaves the terrain elevation frozen after a programmatic flyTo/easeTo, so terrain tiles that arrive
    // after the flight never lift the camera. On real hills that leaves the camera under the ground. Release it.
    map.on('moveend',()=>{ if(map.terrain&&map._elevationFreeze===true&&!map.isMoving()){ map._elevationFreeze=false; map.triggerRepaint(); } });
    map.on('rotate',()=>{$('needle').style.transform=`rotate(${-map.getBearing()}deg)`;});
    map.on('error',ev=>{
      if(!ev||!ev.sourceId) return;
      if(ev.sourceId==='dof'&&base==='dof'&&!boot.dofFailed){boot.dofFailed=true;toast('The GURS orthophoto service did not respond. Showing Esri satellite instead.',6000);setBase('sat');}
      else if(ev.sourceId==='sat'&&base==='sat'&&!boot.satWarned){boot.satWarned=true;toast('Some satellite tiles failed to load.');}
    });
    const h=decodeURIComponent(location.hash.slice(1));
    if(h==='kiosk'){home(true);setTimeout(()=>tourStart(0),1800);}
    else if(ZA.byId[h]){home(true);showInfo(h);}
    else{const s=S.find(x=>x.key===h); if(s){home(true);setTimeout(()=>showInfo(s.entry||s.key),600);} else home(true);}
  });
}
document.documentElement.setAttribute('data-theme','light');
boot();
