const fs=require('node:fs'),assert=require('node:assert/strict');
const {applyTrialR}=require('./facility-trial-r.cjs'),{applyTrialT}=require('./facility-trial-t.cjs');
const html=fs.readFileSync('index.html','utf8');
function evaluate(h){
 const start=h.indexOf('<script>'),finish=h.indexOf('</script>',start),inline=h.slice(start+8,finish),end=inline.indexOf("  const appRoot=document.querySelector('#app');");assert(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();const t=game.teams.find(t=>t.id!==game.selectedId),x=stadiumState(t),rows=[];
 for(const lv of [10,14,15,17,19,20])for(const fans of [30000,250000,400000]){
  x.park=lv;t.fans=fans;x.prices=STADIUM_DEFAULT.slice();cpuEconomy(t).priceYear=null;x.priceYear=null;
  const old=x.prices.slice(),beforeCash=t.cash,day=Math.max(1,game.day),baseA=stadiumDemand(t,null,'2027-06-04',day),baseB=stadiumDemand(t,null,'2027-06-06',day),baseReserve=cpuReserve(t),cost=facilityCost('park',Math.min(lv,19)),upkeep=stadiumUpkeep(t);
  if(typeof trialTPriceDemand==='function'&&lv>=15){const v=trialTPriceDemand(t,game.year+'-03-01');if(Math.abs(v.attendance-(baseA.attendance*5+baseB.attendance*2)/7)>1e-6||v.satisfaction!==Math.min(baseA.satisfaction,baseB.satisfaction))throw Error('weighted sample mismatch');}
  const did=cpuPricePlan(t,game.year+'-03-01'),prices=x.prices.slice(),a=stadiumDemand(t,null,'2027-06-04',day),b=stadiumDemand(t,null,'2027-06-06',day);
  if(typeof trialTPriceDemand==='function'&&lv>=15&&prices.some((v,i)=>v!==old[i])&&(a.attendance<baseA.attendance*.85||b.attendance<baseB.attendance*.85||a.satisfaction<65||b.satisfaction<65))throw Error('mature pricing guard');
  if(t.cash!==beforeCash||cpuReserve(t)!==baseReserve||facilityCost('park',Math.min(lv,19))!==cost||stadiumUpkeep(t)!==upkeep)throw Error('price decision altered reserve/cost/cash');
  if(cpuPricePlan(t,game.year+'-03-02'))throw Error('annual price guard');
  rows.push({lv,fans,prices,cost,upkeep,baseReserve,did});
 }return rows;`;
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const before=evaluate(applyTrialR(html)),after=evaluate(applyTrialT(html));for(let i=0;i<before.length;i++){const a=before[i],b=after[i];assert.equal(a.cost,b.cost);assert.equal(a.upkeep,b.upkeep);assert.equal(a.baseReserve,b.baseReserve);if(a.lv<15)assert.deepEqual(a,b);}
console.log('PASS T: weighted mature price forecast; unchanged early price decisions, costs, cash and reserve',JSON.stringify({before,after}));
