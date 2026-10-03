'use strict';
/* Icons: SF-Symbols-style line glyphs (24-unit grid) used in the header, the controls and the map markers. */
const SVG=(d,extra)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}${extra||''}</svg>`;
const ICON={
  projects:SVG('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  buildings:SVG('<path d="M4 20V5l6-2v17M10 9l10 3v8M4 20h16M7 8h1M7 12h1M7 16h1M14 14h1M17 15h1"/>'),
  bridges:SVG('<path d="M2 15h20M4 15V9M20 15V9M4 9q8-6 16 0M8 15v-4M12 15v-5M16 15v-4"/>'),
  infrastructure:SVG('<path d="M3 20h18M6 20V9a6 6 0 0 1 12 0v11M9 20v-5h6v5"/>'),
  about:SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  layers:SVG('<path d="M12 4l9 5-9 5-9-5zM3 14l9 5 9-5"/>'),
  map:SVG('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
  satellite:SVG('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>'),
  cube:SVG('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>'),
  plus:SVG('<path d="M12 5v14M5 12h14"/>'), minus:SVG('<path d="M5 12h14"/>'),
  rotl:SVG('<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4.5h4.5"/>'), rotr:SVG('<path d="M20 12a8 8 0 1 1-3-6.2M20 4v4.5h-4.5"/>'),
  up:SVG('<path d="M5 15l7-7 7 7"/>'), down:SVG('<path d="M5 9l7 7 7-7"/>'),
  home:SVG('<path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/>'), search:SVG('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  close:SVG('<path d="M6 6l12 12M18 6L6 18"/>'), back:SVG('<path d="M15 5l-7 7 7 7"/>'), ext:SVG('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
  pin:SVG('<path d="M12 21s-6-6-6-11a6 6 0 0 1 12 0c0 5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>')
};
/* marker glyphs by object type, drawn in a 24-unit box */
const MARK={
  bridge:'M3 15h18M5 15V10M19 15V10M5 10q7-6 14 0M9 15v-3M15 15v-3', footbridge:'M3 15h18M5 15V10M19 15V10M5 10q7-6 14 0M9 15v-3M15 15v-3','road structure':'M3 15h18M5 15V10M19 15V10M5 10q7-6 14 0',
  tunnel:'M4 19V11a8 8 0 0 1 16 0v8M9 19v-5h6v5', 'dam / hydropower':'M3 8q3-3 6 0t6 0 6 0M3 14q3-3 6 0t6 0 6 0M4 19h16', cableway:'M3 6h18M12 6v4M8 10h8v6H8z',
  'tower / mast':'M12 3v18M7 21l5-18 5 18M9 14h6', building:'M5 20V9l7-5 7 5v11M10 20v-6h4v6M5 20h14', institution:'M4 10h16M6 10v8M10 10v8M14 10v8M18 10v8M4 20h16M4 10l8-5 8 5',
  'study area (earthquake)':'M3 12h4l2-5 3 10 3-8 2 3h4', 'geotechnical site':'M3 18l6-10 4 6 3-3 5 7z', landslide:'M4 6l8 8-4 6M12 14l8 4', other:'M12 4v16M4 12h16'};
function markerImage(type,kind){
  const S=56,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d');
  const col=kind==='fac'?'#1F3A6B':kind==='ref'?'#7A8696':'#2F5597';
  const r=12; g.beginPath(); g.roundRect(4,4,S-8,S-8,r); g.fillStyle=col; g.fill(); g.lineWidth=3; g.strokeStyle='#fff'; g.stroke();
  g.save(); g.translate(10,10); g.scale(1.5,1.5); g.strokeStyle='#fff'; g.lineWidth=1.9; g.lineCap='round'; g.lineJoin='round';
  g.stroke(new Path2D(MARK[type]||MARK.other)); g.restore();
  return g.getImageData(0,0,S,S);
}
