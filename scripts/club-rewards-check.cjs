// Shared rewards, condition and season smoke (deterministic seed).
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const src=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(src);
const end=src.indexOf("  const appRoot=document.querySelector('#app');");
if(end<0)throw Error('startup marker');
const pre=src.slice(0,end).replace('(() => {','return (() => {').replace('((Date.now()^0x53e719f1)>>>0)||1937','1937');
const harness=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
const ck=(v,m)=>{if(!v)throw Error(m);};const t=myTeam();
ck(game.teams.every(t=>t.cash>=18&&t.cash<=24),'initial cash');
ck(clubCondition(t,'training')===100,'condition initial');
clubConditionMonth(t,'2027-03-31');const cond=clubCondition(t,'training');clubConditionMonth(t,'2027-03-31');ck(cond===clubCondition(t,'training'),'condition month idempotence');
clubLifeData(t).condition.training=70;const cash=t.cash,fee=clubRepairPrice(t,'training'),lv=infraLevel(t,'training');
ck(clubRepair(t,'training','2027-03-31'),'repair');
ck(t.cash===r2(cash-fee)&&clubCondition(t,'training')===100&&infraLevel(t,'training')===lv,'repair reconciliation');
let e;while((e=processCalendarDay())){game.pendingMonth=null;game.pendingEvent=null;game.pendingRareIds=[];game.pendingMilestoneIds=[];game.careerEventQueue=[];if(game.financeCrisis)game.financeCrisis=null;}
const rows=clubRewardState().rows;ck(game.day===143&&game.games.length===858&&rows.every(r=>r.paid),'season and paid');
ck(new Set(rows.map(r=>r.teamId)).size===12,'all clubs');
ck(rows.some(r=>r.reason.includes('月間MVP')),'monthly MVP');
const before=t.cash;closeFinancePeriod(game.calendar.endDate);ck(t.cash===before,'settlement idempotence');
const p=own(t)[0],old=p.specialCategory;p.specialCategory='IMMORTAL';ck(clubMoment(p,'test').includes('測定不能'),'IMMORTAL');p.specialCategory='RINNE';ck(clubMoment(p,'test').includes('測定不能'),'RINNE');p.specialCategory=old;
return {games:game.games.length,rewards:rows.length,allstar:rows.filter(r=>r.reason.includes('オールスター')).length,minCash:Math.min(...game.teams.map(t=>t.cash))};})();`;
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
console.log('PASS club rewards',new Function('document','window','localStorage','setTimeout','clearTimeout',pre+harness)(doc,win,ls,()=>0,()=>{}));
