// Real season engine, no browser rendering. Run: node scripts/club-honors-check.cjs
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
let source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
source=source.slice(0,source.indexOf("  const appRoot=document.querySelector('#app');")).replace('(() => {','return (() => {').replace('((Date.now()^0x53e719f1)>>>0)||1937','1937');
const harness=`
save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
const ck=(v,m)=>{if(!v)throw Error(m);};
ck(game.teams.every(t=>t.cash>=18&&t.cash<=24),'initial cash');
let e;while((e=processCalendarDay())){collectMilestoneNews(e);game.pendingMonth=null;game.pendingEvent=null;game.pendingMilestoneIds=[];game.pendingRareIds=[];game.careerEventQueue=[];game.financeCrisis=null;}
const a=clubRewardState(),ledger=game.financeLedger;
ck(game.day===143&&game.games.length===858,'full season');
ck(a.rows.every(r=>r.paid),'paid rewards');
ck(game.teams.every(t=>own(t).length<=ROSTER_MAX),'roster cap');
for(const t of game.teams){
 const due=r2(a.rows.filter(r=>r.teamId===t.id&&r.paid).reduce((n,r)=>n+r.amount,0));
 ck(r2(ledger.clubs[t.id].rewards||0)===due,'annual reward ledger '+t.id);
 ck(r2(ledger.periods.reduce((n,p)=>n+(p.clubs[t.id].rewards||0),0))===due,'monthly reward ledger '+t.id);
}
const before=game.teams.map(t=>t.cash);
closeFinancePeriod(game.calendar.endDate);ck(game.teams.every((t,i)=>t.cash===before[i]),'duplicate payment');
game=JSON.parse(JSON.stringify(game));ensureGameExtras();closeFinancePeriod(game.calendar.endDate);
ck(game.teams.every((t,i)=>t.cash===before[i]),'restore payment');
const t=myTeam(),p=own(t)[0];p.specialCategory='IMMORTAL';p.originCategory=null;const immortal=clubMoment(p,'功労金');p.specialCategory=null;p.originCategory='RINNE';const rinne=clubMoment(p,'功労金');ck(immortal.includes('測定不能')&&rinne.includes('測定不能')&&immortal!==rinne,'unmeasurable distinction');
const k='training',lv=infraLevel(t,k);clubLifeData(t).condition??={};t.clubLife.condition[k]=80;t.cash=100;const cost=clubRepairPrice(t,k);ck(clubRepair(t,k)&&infraLevel(t,k)===lv&&clubCondition(t,k)===100&&t.cash===r2(100-cost),'repair transaction');ck(!clubRepair(t,k),'duplicate repair');
return {games:game.games.length,rewards:a.rows.length,total:r2(a.rows.reduce((n,r)=>n+r.amount,0)),ledger:true,duplicate:true,restore:true,unmeasurable:true,repair:true};`;
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
const result=new Function('document','window','localStorage','setTimeout','clearTimeout',source+harness+'})();')(doc,win,ls,()=>0,()=>{});
console.log(JSON.stringify(result,null,2));
