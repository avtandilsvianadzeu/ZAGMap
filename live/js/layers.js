'use strict';
/* Layers: overlay sources and layers on the map (uncertainty area, selected footprint, selected line, ZAG records). */
function iconData(kind){
  const S=64,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');g.lineWidth=6;g.strokeStyle='#fff';
  if(kind==='fac'){g.fillStyle='#1F3A6B';g.beginPath();g.rect(10,10,44,44);g.fill();g.stroke();g.fillStyle='#fff';g.fillRect(24,24,16,16);}
  else if(kind==='doc'){g.fillStyle='#2F5597';g.beginPath();g.arc(32,32,20,0,7);g.fill();g.stroke();}
  else{g.fillStyle='#fff';g.strokeStyle='#586374';g.beginPath();g.arc(32,32,17,0,7);g.fill();g.stroke();}
  return g.getImageData(0,0,S,S);
}
function addAtlasLayers(){
  ['fac','doc','ref'].forEach(k=>map.addImage('i-'+k,iconData(k),{pixelRatio:2}));
  const E0={type:'FeatureCollection',features:[]};
  ['unc','hl','sel'].forEach(s=>map.addSource(s,{type:'geojson',data:E0}));
  map.addSource('sites',{type:'geojson',data:E0,cluster:true,clusterRadius:40,clusterMaxZoom:11});
  const firstSym=(map.getStyle().layers.find(l=>l.type==='symbol')||{}).id, fonts=['Noto Sans Bold'];
  map.addLayer({id:'unc-f',type:'fill',source:'unc',paint:{'fill-color':'#2F5597','fill-opacity':.12}},firstSym);
  map.addLayer({id:'unc-l',type:'line',source:'unc',paint:{'line-color':'#2F5597','line-width':2,'line-dasharray':[2,2],'line-opacity':.9}},firstSym);
  map.addLayer({id:'hl-ext',type:'fill-extrusion',source:'hl',paint:{'fill-extrusion-color':'#2F5597','fill-extrusion-height':['get','h'],'fill-extrusion-base':['get','b'],'fill-extrusion-opacity':.9}},firstSym);
  map.addLayer({id:'hl-line',type:'line',source:'hl',paint:{'line-color':'#FFB000','line-width':3}},firstSym);
  map.addLayer({id:'sel-c',type:'line',source:'sel',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':9}},firstSym);
  map.addLayer({id:'sel-l',type:'line',source:'sel',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#FFB000','line-width':5}},firstSym);
  map.addLayer({id:'clu',type:'circle',source:'sites',filter:['has','point_count'],paint:{'circle-color':'#2F5597','circle-radius':['step',['get','point_count'],14,5,17,12,21],'circle-stroke-color':'#fff','circle-stroke-width':2.5}});
  map.addLayer({id:'clu-n',type:'symbol',source:'sites',filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count']],'text-font':fonts,'text-size':12,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
  map.addLayer({id:'pt',type:'symbol',source:'sites',filter:['!',['has','point_count']],layout:{'icon-image':['match',['get','k'],'fac','i-fac','doc','i-doc','i-ref'],'icon-allow-overlap':true,'icon-size':['interpolate',['linear'],['zoom'],7,.8,14,1,17,1.2]}});
  map.addLayer({id:'pt-l',type:'symbol',source:'sites',filter:['!',['has','point_count']],minzoom:9,layout:{'text-field':['get','n'],'text-font':fonts,'text-size':12,'text-offset':[1.1,0],'text-anchor':'left','text-optional':true,'text-max-width':14},paint:{'text-color':'#1C1C1E','text-halo-color':'rgba(255,255,255,.95)','text-halo-width':1.6}});
}
/* push the filtered records to the map */
function refreshProjects(){
  const feats=visibleFeatures();
  if(ready) map.getSource('sites').setData({type:'FeatureCollection',features:feats.map(f=>({type:'Feature',geometry:f.geometry,properties:{id:f.properties.id,n:f.properties.name_en||f.properties.name,k:kindOf(f.properties)}}))});
  emit('filtered',{n:feats.length,total:ZA.features.length});
}
/* the selected structure's alignment (tunnels, cableways), drawn above terrain */
function showLine(line){
  if(!ready) return;
  map.getSource('sel').setData({type:'FeatureCollection',features:line?[{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:line}}]:[]});
}
