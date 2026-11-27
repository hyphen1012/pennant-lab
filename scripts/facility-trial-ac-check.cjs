const fs=require('node:fs'),a=require('node:assert/strict'),{applyTrialAB}=require('./facility-trial-ab.cjs'),{applyTrialAC}=require('./facility-trial-ac.cjs');
const input=fs.readFileSync('index.html','utf8');
function fixture(html,isX){
 const start=html.indexOf('<script>'),finish=html.indexOf('</script>',start),inline=html.slice(start+8,finish),end=inline.indexOf("  const appRoot=document.querySelector('#app');");a.ok(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 const rows=[];for(const t of game.teams){const x=stadiumState(t);x.food=x.goods=20;const cash=t.cash;
 for(const lv of [15,16,17,18,19,20]){x.park=lv;const v=stadiumDemand(t,null,'2027-06-06',1);rows.push({id:t.id,lv,cash:t.cash,attendance:v.attendance,ticket:v.ticket,food:v.food,goods:v.goods,operating:v.operating,capacity:v.capacity,reserve:cpuReserve(t),upkeep:stadiumUpkeep(t),cost:facilityCost('park',lv)});}
 if(t.cash!==cash)throw Error('sales quote changed cash');
 }${isX?"const t=game.teams[0],x=stadiumState(t);x.park=20;x.food=10;if(trialXPremium(t,x,'food')!==0)throw Error('supporting shop guard');":""}return rows;`;
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const w=fixture(applyTrialAB(input),true),x=fixture(applyTrialAC(input),true);a.equal(w.length,72);a.equal(x.length,w.length);
a.deepEqual(w,x,'all-club actual economics unchanged');
function holdFixture(html){
 const inline=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>')),end=inline.indexOf("  const appRoot=document.querySelector('#app');");a.ok(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 // Isolate capital policy without inventing an actual financed upgrade.
 const rows=[];const base=matureParkTarget;matureParkTarget=t=>stadiumState(t).park<20?50:0;
 for(const t of game.teams){const x=stadiumState(t);for(const lv of [15,16,17,18,19,20]){x.park=lv;for(const cash of [20,50,70,100,200]){t.cash=cash;rows.push({id:t.id,lv,cash,hold:parkCapitalHold(t,50)});}}}matureParkTarget=base;return rows;`;
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const old=holdFixture(applyTrialAB(input)),next=holdFixture(applyTrialAC(input));a.equal(old.length,360);let raised=0;
for(let i=0;i<old.length;i++){const p=old[i],q=next[i];a.equal(p.id,q.id);a.equal(p.lv,q.lv);a.equal(p.cash,q.cash);a.ok(q.hold<=Math.max(0,q.cash-50));if([18,19].includes(q.lv)&&q.cash>50){a.ok(q.hold>p.hold);raised++;}else a.equal(q.hold,p.hold);}
a.ok(raised>0);console.log('PASS AC: unchanged economics, bounded mature capital hold, no grant, no low-level impact');
