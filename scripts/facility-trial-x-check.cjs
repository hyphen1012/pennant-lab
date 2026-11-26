const fs=require('node:fs'),a=require('node:assert/strict'),{applyTrialW}=require('./facility-trial-w.cjs'),{applyTrialX}=require('./facility-trial-x.cjs');
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
const w=fixture(applyTrialW(input),false),x=fixture(applyTrialX(input),true);a.equal(w.length,72);a.equal(x.length,w.length);
for(let i=0;i<w.length;i++){const p=w[i],q=x[i];for(const k of ['id','lv','cash','attendance','ticket','capacity','reserve','upkeep','cost'])a.equal(q[k],p[k],k);if(p.lv===15)a.deepEqual(p,q);else{a.ok(q.food>=p.food&&q.goods>=p.goods);a.ok(q.operating>=p.operating);a.ok(q.food+q.goods-q.operating>=p.food+p.goods-p.operating);}}
console.log('PASS X: all 12 clubs, unchanged Lv15/attendance/cost/reserve, additional actual sales and associated expenses, no cash mutation');
