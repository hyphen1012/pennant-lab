const fs=require('node:fs'),a=require('node:assert/strict'),{applyTrialAF}=require('./facility-trial-af.cjs'),{applyTrialAG}=require('./facility-trial-ag.cjs');
const input=fs.readFileSync('index.html','utf8');
function fixture(html){
 const start=html.indexOf('<script>'),finish=html.indexOf('</script>',start),inline=html.slice(start+8,finish),end=inline.indexOf("  const appRoot=document.querySelector('#app');");a.ok(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 const costs=[];for(const k of [...new Set(['park','food','goods',...Object.keys(INFRA_LABELS)])])for(let lv=1;lv<=20;lv++)costs.push({k,lv,cost:facilityCost(k,lv),base:r2(draftScoutCost(lv)*(FACILITY_COST_FACTOR[k]??1))});
 const rows=[];for(const t of game.teams){const x=stadiumState(t);x.food=x.goods=20;const cash=t.cash;
 for(const lv of [15,16,17,18,19,20]){x.park=lv;const v=stadiumDemand(t,null,'2027-06-06',1);rows.push({id:t.id,lv,cash:t.cash,attendance:v.attendance,ticket:v.ticket,food:v.food,goods:v.goods,operating:v.operating,capacity:v.capacity,reserve:cpuReserve(t),upkeep:stadiumUpkeep(t)});}if(t.cash!==cash)throw Error('quote mutated cash');}return {rows,costs};`;
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const old=fixture(applyTrialAF(input)),next=fixture(applyTrialAG(input));a.equal(old.rows.length,72);a.equal(next.rows.length,72);a.equal(old.costs.length,next.costs.length);let changed=0;
for(let i=0;i<old.costs.length;i++){const p=old.costs[i],q=next.costs[i];a.equal(q.k,p.k);a.equal(q.lv,p.lv);a.equal(q.base,p.base);
 if(q.k==='park'&&q.lv>=17&&q.lv<20){a.equal(q.cost,Math.round(q.base*.90*100)/100);a.ok(q.cost<p.cost);changed++;}else a.equal(q.cost,p.cost);
 if(i>0&&next.costs[i-1].k===q.k){const prev=next.costs[i-1],oldPrev=old.costs[i-1];if(q.k==='park'&&q.lv>=17&&q.lv<20)a.ok(q.cost>=prev.cost,'changed park tier not monotone: '+JSON.stringify({prev,q}));else if(p.cost>=oldPrev.cost)a.ok(q.cost>=prev.cost,'introduced nonmonotone cost: '+JSON.stringify({prev,q}));else console.log('UNCHANGED BASELINE COST EDGE '+JSON.stringify({key:q.k,lv:q.lv,old:oldPrev.cost,next:p.cost}));}}
a.equal(changed,3);
for(let i=0;i<old.rows.length;i++){const p=old.rows[i],q=next.rows[i];for(const k of ['id','lv','cash','attendance','ticket','food','goods','operating','capacity','upkeep'])a.equal(q[k],p[k],k);a.ok(Number.isFinite(q.reserve)&&q.reserve>=0);}
console.log('PASS AG: exactly three late park construction tiers, monotone costs, unchanged all-club sales and direct upkeep, no cash grant; derived reserve may change');
