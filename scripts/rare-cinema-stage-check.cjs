const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const a=script.indexOf('  function cinemaLayer('),b=script.indexOf('  const rarePanelCinemaV172=',a);assert(a>=0&&b>a);
const api=vm.runInNewContext("const CINEMA_THEMES={'IMMORTAL':['観測不能','eclipse','#d8e8fa'],'輪廻転生':['既視感','cycle','#b397ff'],'LEGEND':['伝説','hall','#e6c984']};const playerTitleTheme=p=>p?.category?{name:p.category,ring:CINEMA_THEMES[p.category][2]}:null;const h=s=>String(s);"+script.slice(a,b)+";({cinemaLayer,rareCinemaArt,rareCinemaMode,events:RARE_CINEMA_EVENTS})");
const p={category:'輪廻転生',pastLifeAppearance:{baseCategory:'IMMORTAL'}},before=JSON.stringify(p);
assert.equal(api.rareCinemaMode(p,false),'cycle');assert.equal(api.rareCinemaMode(p,true),'eternal-cycle');
assert.equal(api.rareCinemaMode({...p,abilitiesHidden:true},true),'cycle');
const kinds=Object.keys(api.events);assert.equal(kinds.length,18);const stages=new Set();
for(const k of kinds){
 const s=api.rareCinemaArt(p,k,true);assert(s.includes('data-rc-set="'+k+'"'));assert(s.includes('data-rc="eternal-cycle"'));
 assert(!api.rareCinemaArt(p,k,false).includes('IMMORTAL'));
 const set=s.slice(s.indexOf('data-rc-set'),s.indexOf('<g class="rc-motion">')).replace('data-rc-set="'+k+'"','data-rc-set=""');stages.add(set);
 assert.equal(api.rareCinemaArt({},k,true),'');
}
assert.equal(stages.size,kinds.length);assert.equal(JSON.stringify(p),before);
assert(api.cinemaLayer('輪廻転生','award',true).includes('data-stage-singularity'));
assert(!api.cinemaLayer('輪廻転生','award',false).includes('data-stage-singularity'));
assert(!api.cinemaLayer('IMMORTAL','award',false).includes('data-stage-singularity'));
assert.match(html,/composite=n==='輪廻転生'&&rareCinemaMode\(p,disclosed\)==='eternal-cycle'/);
assert.match(html,/facts=n==='輪廻転生'&&disclosed&&p\?\.reincarnation/);
assert.match(html,/cinemaLayer\(n,kind,composite\)\+note/);
assert.match(html,/prefers-reduced-motion:reduce\)\{\.club-moment\[data-cinema="eternal-cycle"\][^\n]+animation:none!important/);
console.log('PASS all 18 rare event sets, composite main-stage distinction, lineage disclosure gate, state preservation, reduced motion');
