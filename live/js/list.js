'use strict';
/* List: records of the active section (Projects, Buildings, Bridges, Infrastructure) in the left panel. */
const listEl=$('list'), listBody=$('listBody');
const NAV_T={projects:'All records',buildings:'Buildings',bridges:'Bridges',infrastructure:'Infrastructure'};
function openList(){ info.hidden=true; listEl.hidden=false; document.body.classList.add('has-panel'); renderList(); }
function closeList(){ listEl.hidden=true; if(info.hidden) document.body.classList.remove('has-panel'); }
function renderList(){
  if(listEl.hidden) return;
  const fs=visibleFeatures().slice().sort((a,b)=>a.properties.name_en.localeCompare(b.properties.name_en,'sl'));
  $('listT').textContent=NAV_T[ZA.nav]||'Records'; $('listN').textContent=fs.length;
  listBody.innerHTML=fs.map(f=>{const p=f.properties,k=kindOf(p),inv=(p.zag_involvement_types||[]).map(t=>INV_LABEL[t]||cap(t)).join(', ');
    return `<button class="row" role="listitem" data-id="${esc(p.id)}" aria-current="${p.id===curId}"><span class="ic ${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${MARK[p.object_type]||MARK.other}"/></svg></span><span><b>${esc(p.name_en)}</b><small>${esc([p.municipality||p.locality,p.year].filter(Boolean).join(' · '))}</small><small>${esc(cap(p.object_type))}${inv?' · '+esc(inv):''}</small></span></button>`;}).join('')
    ||'<p class="note" style="padding:14px 16px">No records in this section.</p>';
  listBody.querySelectorAll('.row').forEach(b=>b.onclick=()=>showInfo(b.dataset.id));
}
document.addEventListener('atlas:filtered',renderList);
$('listX').onclick=()=>{closeList();ZA.nav='projects';syncNav();refreshProjects();};
