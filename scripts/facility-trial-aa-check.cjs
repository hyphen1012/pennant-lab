const fs=require('node:fs'),a=require('node:assert/strict'),{applyTrialY}=require('./facility-trial-y.cjs'),{applyTrialAA}=require('./facility-trial-aa.cjs');
const input=fs.readFileSync('index.html','utf8');
function fixture(html,level){
 const start=html.indexOf('<script>'),finish=html.indexOf('</script>',start),inline=html.slice(start+8,finish),end=inline.indexOf("  const appRoot=document.querySelector('#app');");a.ok(end>0);
 const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 const rows=[];for(const t of game.teams){const x=stadiumState(t);x.park=LEVEL;x.food=x.goods=LEVEL;const cash=t.cash,old=x.prices.slice();
 const dates=['2027-06-04','2027-06-06'],sample=()=>dates.map(d=>stadiumDemand(t,null,d,1)),before=sample(),style=cpuEconomy(t).style;
 const changed=cpuPricePlan(t,'2027-01-01'),after=sample();
 const score=arr=>arr.reduce((n,v,i)=>n+(v.ticket+v.food+v.goods-v.operating+(style===2?v.attendance*180:0))*(i===0?5/7:2/7),0);
 if(t.cash!==cash)throw Error('price forecast mutated cash');const prices=x.prices.slice();if(cpuPricePlan(t,'2027-06-06'))throw Error('second price change');
 rows.push({id:t.id,changed,old,prices,cash,before:before.map(v=>({attendance:v.attendance,satisfaction:v.satisfaction})),after:after.map(v=>({attendance:v.attendance,satisfaction:v.satisfaction})),scoreBefore:score(before),scoreAfter:score(after)});}
 return rows;`.replaceAll('LEVEL',String(level));
 const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
 const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
 return new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
}
const y=applyTrialY(input),aa=applyTrialAA(input);for(const lv of [1,14])a.deepEqual(fixture(y,lv),fixture(aa,lv),'low-level policy unchanged');
for(const lv of [15,18,19,20])for(const q of fixture(aa,lv)){a.ok(q.scoreAfter>=q.scoreBefore-1e-6);if(q.changed){a.ok(q.after.every((x,i)=>x.satisfaction>=65&&x.attendance>=q.before[i].attendance*.85));a.ok(q.prices.every((v,i)=>Number.isInteger(v)&&v%100===0&&v>=500&&v<=20000));}}
console.log('PASS AA: unchanged low-level pricing, weighted actual demand never worsens objective, both dates meet satisfaction/attendance guard, no cash grant or repeat pricing');
