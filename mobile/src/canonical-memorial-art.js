// Staging memorial illustration: public achievement title/year only.
// No inferred stats, player portrait, unpublished category or reward action.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PennantMemorialArt=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const kinds=['win','facility','championship','league-championship','award','retirement','farewell','club-record','anniversary','record'];
function model(entry){
 if(!entry||typeof entry.label!=='string'||!entry.label.trim()||entry.label.length>160)throw Error('invalid memorial label');
 const a=entry.art,known=Number.isSafeInteger(a?.year)&&a.year>=2027&&a.year<=999999&&kinds.includes(a.kind);
 return {label:entry.label,year:known?a.year:null,kind:known?a.kind:'record'};
}
function draw(canvas,entry,options={}){
 const e=model(entry),W=1080,H=1350;canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');if(!c)throw Error('canvas unavailable');
 const palette=e.kind==='win'?['#07182c','#224f77','#9cd6f3']:['championship','league-championship','award'].includes(e.kind)?['#21170d','#68481e','#f8d892']:['retirement','farewell'].includes(e.kind)?['#1a1828','#4e435f','#e1cfea']:e.kind==='facility'?['#081d1d','#1d534e','#a8e9d1']:['#0c1024','#38315c','#c7bbff'];
 const [dark,mid,accent]=palette,g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,dark);g.addColorStop(.55,mid);g.addColorStop(1,dark);c.fillStyle=g;c.fillRect(0,0,W,H);
 c.strokeStyle=accent;c.lineWidth=3;c.strokeRect(44,44,W-88,H-88);c.lineWidth=1;c.strokeRect(56,56,W-112,H-112);
 if(options.frame==='foil'){
  const foil=c.createLinearGradient(0,0,W,H);for(const [p,col] of [[0,'#92704b'],[.22,'#fff0c1'],[.42,'#ad8953'],[.65,'#fff4cf'],[1,'#806040']])foil.addColorStop(p,col);
  c.strokeStyle=foil;c.lineWidth=13;c.strokeRect(30,30,W-60,H-60);c.lineWidth=3;c.strokeRect(72,72,W-144,H-144);
  for(const [x,y,sx,sy] of [[78,78,1,1],[W-78,78,-1,1],[78,H-78,1,-1],[W-78,H-78,-1,-1]]){c.save();c.translate(x,y);c.scale(sx,sy);c.lineWidth=5;c.beginPath();c.moveTo(0,92);c.lineTo(0,0);c.lineTo(92,0);c.moveTo(10,64);c.lineTo(64,10);c.stroke();c.restore();}
 }
 const text=(v,y,size,weight=600,color='#fff')=>{c.font=weight+' '+size+'px sans-serif';c.textAlign='center';c.fillStyle=color;c.fillText(v,W/2,y,W-160);};
 text('P E N N A N T  L A B',135,42,700,accent);text('MEMORIAL COLLECTION',186,26,500,accent);
 if(e.year!==null)text(e.year+' SEASON',255,38,700,accent);
 c.save();c.translate(W/2,570);c.strokeStyle=accent;c.globalAlpha=.23;for(let i=0;i<8;i++){c.beginPath();c.ellipse(0,0,155+i*31,155+i*31,0,0,Math.PI*2);c.stroke();}c.globalAlpha=.85;c.lineWidth=6;
 if(e.kind==='win'){c.beginPath();c.moveTo(0,-215);c.lineTo(215,0);c.lineTo(0,215);c.lineTo(-215,0);c.closePath();c.stroke();for(const [x,y] of [[0,-215],[215,0],[0,215],[-215,0]])c.strokeRect(x-16,y-16,32,32);c.beginPath();c.arc(0,0,34,0,Math.PI*2);c.stroke();}
 else if(e.kind==='facility'){for(let i=0;i<5;i++){const h=100+i*52;c.strokeRect(-215+i*90,160-h,65,h);}c.beginPath();c.moveTo(-225,190);c.lineTo(225,190);c.stroke();}
 else if(['championship','league-championship','award'].includes(e.kind)){c.beginPath();c.moveTo(-125,-150);c.lineTo(125,-150);c.quadraticCurveTo(125,30,0,65);c.quadraticCurveTo(-125,30,-125,-150);c.stroke();c.beginPath();c.moveTo(0,65);c.lineTo(0,160);c.moveTo(-90,160);c.lineTo(90,160);c.stroke();for(const s of [-1,1]){c.beginPath();c.moveTo(s*125,-120);c.quadraticCurveTo(s*230,-120,s*170,0);c.lineTo(s*92,0);c.stroke();}}
 else{for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(0,-210);c.lineTo(85,-65);c.lineTo(0,0);c.lineTo(-85,-65);c.closePath();c.stroke();}}
 c.restore();
 const chars=Array.from(e.label),size=chars.length>66?38:chars.length>36?48:58; c.font='700 '+size+'px sans-serif';const rows=[];let row='';for(const ch of chars){if(row&&c.measureText(row+ch).width>W-160){rows.push(row);row=ch;}else row+=ch;}if(row)rows.push(row);
 const finalSize=Math.min(size,Math.floor(290/Math.max(1,rows.length))-10);rows.forEach((v,i)=>text(v,900+i*(finalSize+10),finalSize,700));
 text('ゲーム内記録・記念アート',1235,32,600,accent);text('PARALAB GAMES',1291,25,500,accent);return e;
}
return {model,draw};
});
