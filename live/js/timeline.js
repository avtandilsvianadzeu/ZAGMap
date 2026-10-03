'use strict';
/* Timeline: restrained year axis that filters the project layer, a secondary strip of small cards, and the Open Day tour. */
const AXIS=[1949,1960,1980,2000,2020,2026];
const axisEl=$('axis'), cardsEl=$('cards');
let tlSel=2026;
function buildAxis(){
  axisEl.innerHTML=AXIS.map(y=>`<button data-y="${y}" aria-pressed="${y===tlSel}" title="${y===2026?'All records':'Records with ZAG activity starting up to '+y}"><i></i>${y}</button>`).join('');
  axisEl.querySelectorAll('button').forEach(b=>b.onclick=()=>setYear(+b.dataset.y));
}
function setYear(y){
  tlSel=y; ZA.upTo=y===2026?null:y;
  axisEl.querySelectorAll('button').forEach(b=>{const v=+b.dataset.y;b.setAttribute('aria-pressed',v===y);b.classList.toggle('past',v<=y);});
  refreshProjects();
}
function renderCards(){
  const fs=visibleFeatures().slice().sort((a,b)=>(a.properties.year_start||9999)-(b.properties.year_start||9999)||a.properties.name_en.localeCompare(b.properties.name_en));
  cardsEl.innerHTML=fs.map(f=>{const p=f.properties,inv=(p.zag_involvement_types||[]).map(t=>INV_LABEL[t]||cap(t)).join(', ');
    return `<button class="card" role="listitem" data-id="${esc(p.id)}" aria-current="${p.id===curId}"><span class="y">${esc(p.year||'Undated')}</span><b>${esc(p.name_en)}</b><span class="m">${esc(p.municipality||p.locality||'')}</span><span class="m">${esc(cap(p.object_type))}${inv?' · '+esc(inv):''}</span></button>`;}).join('');
  cardsEl.querySelectorAll('.card').forEach(b=>b.onclick=()=>showInfo(b.dataset.id));
  $('tlCount').textContent=`${fs.length} of ${ZA.features.length} records`;
}
document.addEventListener('atlas:filtered',renderCards);
document.addEventListener('atlas:selected',e=>{cardsEl.querySelectorAll('.card').forEach(b=>b.setAttribute('aria-current',b.dataset.id===e.detail));
  const c=cardsEl.querySelector('.card[aria-current="true"]'); if(c&&c.scrollIntoView) c.scrollIntoView({block:'nearest',inline:'center'});});
$('tlToggle').onclick=function(){const c=document.body.classList.toggle('tl-closed');this.setAttribute('aria-expanded',!c);setTimeout(()=>map&&map.resize(),180);};

/* Open Day tour: the 14 stories in order, one record each */
const TOUR={on:false,i:-1,t:0};
const tourId=i=>{const s=S[i];return ZA.byId[s.entry||s.key]?(s.entry||s.key):null;};
function tourStep(i){
  TOUR.i=(i+S.length)%S.length; const id=tourId(TOUR.i); if(!id){tourStep(TOUR.i+1);return;}
  if(ZA.upTo!=null||ZA.nav!=='projects'){ZA.upTo=null;tlSel=2026;ZA.nav='projects';setYear(2026);emit('nav');}
  showInfo(id,{tour:true,onSettled:()=>{ if(TOUR.on){clearTimeout(TOUR.t);TOUR.t=setTimeout(()=>tourStep(TOUR.i+1),9000);} }});
  $('tour').textContent=`■ Stop tour (${TOUR.i+1}/${S.length})`;
}
function tourStart(i){TOUR.on=true;$('tour').setAttribute('aria-pressed',true);tourStep(i||0);}
function tourStop(){TOUR.on=false;clearTimeout(TOUR.t);$('tour').setAttribute('aria-pressed',false);$('tour').textContent='▶ Open Day tour';}
function stopTourIfUser(opts){ if(TOUR.on&&!(opts&&opts.tour)) tourStop(); }
$('tour').onclick=()=>TOUR.on?tourStop():tourStart(0);
buildAxis();
