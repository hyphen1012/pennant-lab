const fs=require('node:fs'),assert=require('node:assert/strict');
const {applyTrialR}=require('./facility-trial-r.cjs'),{applyTrialS}=require('./facility-trial-s.cjs');
const html=fs.readFileSync('index.html','utf8');
function evaluate(h){
 const start=h.indexOf('<script>'),finish=h.indexOf('</script>',start),inline=h.slice(start+8,finish),end=inline.indexOf("  const appRoot=document.querySelector('#app');");assert(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 const t=game.teams.find(t=>t.id!==game.selectedId),rows=[];
 for(const k of Object.keys(INFRA_LABELS))infraSet(t,k,20);
 const sx=stadiumState(t);sx.food=sx.goods=20;
 for(const park of [14,17,18,19,20])for(const fans of [10000,400000])for(const cash of [0,40,100,300]){
  sx.park=park;t.fans=fans;t.cash=cash;
  const reserve=cpuReserve(t),before=JSON.stringify(t),hold=parkCapitalHold(t,reserve),target=matureParkTarget(t),cost=facilityCost('park',Math.min(park,19)),plan=parkExpansionPlan(t),after=JSON.stringify(t);
  rows.push({park,fans,cash,reserve,hold,target,cost,plan,unchanged:before===after});
 }
 return rows;`;
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const before=evaluate(applyTrialR(html)),after=evaluate(applyTrialS(html));let changed=0;
for(let i=0;i<before.length;i++){
 const a=before[i],b=after[i];assert(a.unchanged&&b.unchanged);assert.equal(a.reserve,b.reserve);assert.equal(a.cost,b.cost);assert.equal(a.target,b.target);assert.deepEqual(a.plan,b.plan);
 assert(b.hold>=a.hold);assert(b.hold<=Math.max(0,b.cash-b.reserve)+.011);
 if(a.hold===0)assert.equal(b.hold,0);
 if(b.hold>a.hold)changed++;
}
assert(changed>0,'capital allocation never changed');console.log('PASS S: real surplus only, no new funds, identical reserve, price and forecast; changed fixtures',changed);
