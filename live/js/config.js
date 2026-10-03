'use strict';
/* Config: shared helpers, endpoints, palette and state */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CHEV='<svg class="chev" viewBox="0 0 8 13" aria-hidden="true"><path d="M1.5 1l5 5.5-5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BACK='<svg viewBox="0 0 12 20"><path d="M10 1L2 10l8 9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const XI='<svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function toast(m,ms){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),ms||2200);}
const phone=()=>innerWidth<=760;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

const Z=window.ZAG; if(!Z){document.body.textContent='data.js did not load.';throw new Error('data.js missing');}
const S=Z.stories, E=Z.entries, P=Z.projects, SRC=Z.src, DOMS=Z.domains;
const EBY=Object.fromEntries(E.map(e=>[e.id,e]));

/* ---------- endpoints (all keyless) ---------- */
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const DEM_URL='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SAT_URL='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// GURS DOF025 orthophoto (25 cm) published as TMS by Level2.si under CC BY; availability from this origin must be checked, the app falls back to Esri
const DOF_URL='https://gis.level2.si/geoserver/gwc/service/tms/1.0.0/level2%3ADOF025_latest@EPSG%3A3857@jpeg/{z}/{x}/{y}.jpeg';
const PHOTON='https://photon.komoot.io';
const SI_BOUNDS=[[13.375,45.421],[16.610,46.876]];

/* ---------- palette ---------- */
const DCOL={bridge:'#0A84FF',ai:'#7D5BE6',build:'#D98A13',mat:'#22A55C',fire:'#F0483B',geo:'#A0703C',energy:'#13A4BA',herit:'#D63F9B',inst:'#6E7687',tunnel:'#5E5CE6',cable:'#14A3A3',quake:'#C9602F'};
const DOMC=k=>`var(--d-${k||'inst'})`;
const PAL={
 light:{land:'#F6F4EF',park:'#CDE6BD',wood:'rgba(150,200,130,.42)',grass:'rgba(180,215,150,.38)',ice:'#F2F7FA',sand:'#F3EAC8',resid:'rgba(233,228,219,.75)',misc:'#E3ECD3',
  water:'#A5D0F3',aero:'#E6E3DD',runway:'#D3D0CA',
  mw:'#FFCB57',mwC:'#E3A53C',tr:'#FFE9A6',trC:'#E2C37E',sec:'#FFFFFF',secC:'#D5CEC1',min:'#FFFFFF',minC:'#DDD8CF',path:'#FFFFFF',rail:'#B5B0A9',
  bld:'#E4DFD7',bldE:'#D5CFC5',bld3:'#EAE6DF',border:'#9C8FB8',border2:'#C3BCCB',
  txt:'#3A3A3C',place:'#1C1C1E',halo:'rgba(255,255,255,.92)',wtxt:'#3D78B5',rtxt:'#6E6A64',
  hsS:'rgba(95,80,60,.42)',hsH:'rgba(255,255,255,.35)',hsA:'rgba(120,100,80,.25)',
  sky:'#A9CBF2',hor:'#E9EFF5',fog:'#F6F4EF'},
 dark:{land:'#1E1F22',park:'#1D3123',wood:'rgba(45,85,55,.45)',grass:'rgba(50,85,55,.35)',ice:'#2B3036',sand:'#3A3627',resid:'rgba(44,45,49,.75)',misc:'#24302A',
  water:'#17293D',aero:'#2A2B2F',runway:'#3A3B40',
  mw:'#8C6B26',mwC:'#5E481A',tr:'#5E5134',trC:'#40372A',sec:'#4A4B50',secC:'#2E2F33',min:'#3B3C41',minC:'#2A2B2F',path:'#4A4B50',rail:'#5C5C60',
  bld:'#2C2D31',bldE:'#3A3B40',bld3:'#38393E',border:'#8F86A8',border2:'#55505E',
  txt:'#D1D1D6',place:'#F2F2F7',halo:'rgba(20,20,22,.92)',wtxt:'#7FB0E6',rtxt:'#A1A1A6',
  hsS:'rgba(0,0,0,.55)',hsH:'rgba(255,255,255,.07)',hsA:'rgba(0,0,0,.3)',
  sky:'#0B1626',hor:'#1F2835',fog:'#1E1F22'}
};
const SATSKY={sky:'#8FB6E3',hor:'#D9E4EE',fog:'#B9C3C9'};

/* ---------- state ---------- */
let theme=(()=>{const a=document.documentElement.getAttribute('data-theme');return a||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');})();
const emit=(n,d)=>document.dispatchEvent(new CustomEvent('atlas:'+n,{detail:d}));
let base='map', is3d=true, selId=null, bldPref=null;
let map=null, ready=false, ORIG={}, TOUCHED={}, selMarker=null, hlToken=0, orbitOn=false, userMoved=false;
