const fs=require('node:fs'),assert=require('node:assert/strict'),{applyTrialK}=require('./facility-trial-k.cjs');
const {applyTrialM}=require('./facility-trial-m.cjs'),{applyTrialO}=require('./facility-trial-o.cjs');
const html=fs.readFileSync('index.html','utf8');
function evaluate(h){
 const start=h.indexOf('<script>'),finish=h.indexOf('</script>',start);assert(start>=0&&finish>start);const inline=h.slice(start+8,finish),end=inline.indexOf("  const appRoot=document.querySelector('#app');");
 assert(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 const t=myTeam(),result=[];t.fans=250000;t.cash=130;
 for(const lv of [1,10,15,16,17,18,19,20]){
 for(const k of Object.keys(INFRA_LABELS))infraSet(t,k,lv);
 const sx=stadiumState(t);sx.park=sx.food=sx.goods=lv;
 const g=stadiumDemand(t,null,'2027-06-04',1),o=clubOverhead(t,1,280);
 result.push({lv,renewal:o.renewal,other:r2(o.total-o.renewal),upkeep:r2(infraAnnual(t)+stadiumUpkeep(t)),operating:g.operating,attendance:g.attendance,ticket:g.ticket,food:g.food,goods:g.goods,reserveFloor:eliteOperatingReserve(10),reserveMargin:eliteOperatingReserve(50),cost:facilityCost('park',Math.min(lv,19)),hold:parkCapitalHold(t,50),target:matureParkTarget(t)});
 }return result;`;
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const before=evaluate(applyTrialM(html)),after=evaluate(applyTrialO(html));
for(let i=0;i<before.length;i++){
 const a=before[i],b=after[i];
 for(const k of ['renewal','other','upkeep','attendance','ticket','food','goods','reserveFloor','reserveMargin','cost','target','operating'])assert.equal(a[k],b[k],k+' Lv'+a.lv);
 assert.equal(b.hold,a.lv>=17&&a.lv<20?Math.round(Math.min(a.target*.75,80*.65)*100)/100:a.hold);assert.ok(b.hold>=a.hold);
}
console.log(JSON.stringify({before,after},null,2));console.log('PASS O late-stage capital earmark, unchanged cash, construction price, operating costs and reserve');
