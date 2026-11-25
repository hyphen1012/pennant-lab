// Daily wage allocation and first/farm affiliation regression.
const fs=require('node:fs');
const inline=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const end=inline.indexOf("  const appRoot=document.querySelector('#app');");
const harness=`
save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
const ck=(v,m)=>{if(!v)throw Error(m);};const t=myTeam(),u=game.teams.find(x=>x.id!==t.id),p=own(t)[0];const total=game.calendar.days.length;
const a=payroll(t),b=payroll(u),salary=p.salary;wageDailyAccrue(0);p.stats.g=5;p.farmStats.g=7;clubMoveNow(p,u,'2027-04-01','test');wageDailyAccrue(1);wageDailyAccrue(1);p.stats.g+=3;p.farmStats.g+=2;
ck(Math.abs(wageDailyPeriod(t,0,2,total).raw-(2*a-salary)/total)<1e-8,'old club wage');
ck(Math.abs(wageDailyPeriod(u,0,2,total).raw-(2*b+salary)/total)<1e-8,'new club wage');
const rows=gmStintRows(p).rows;ck(rows[0].stats.g===5&&rows[1].stats.g===3&&rows[0].farmStats.g===7&&rows[1].farmStats.g===2,'split both tiers');
ck(wageDailyPeriod(t,0,3,total).estimatedDays===1,'missing legacy day');
game=JSON.parse(JSON.stringify(game));ensureGameExtras();ck(wageDailyPeriod(myTeam(),0,2,total).estimatedDays===0,'save roundtrip');
buildFresh();game.started=true;ensureGameExtras();game.ceremonyStage=null;game.calendarFlow=null;
const original=payroll(myTeam());let e=processCalendarDay();ck(e&&game.wageDaily.days[0][game.selectedId]===original,'real day accrual');
let guard=0;while(!game.financeLedger?.through&&guard++<40){game.pendingMonth=null;game.pendingEvent=null;e=processCalendarDay();ck(e,'first month progression');}
ck(game.financeLedger?.through>0,'first close');const period=game.financeLedger.periods[0];ck(Object.values(period.clubs).every(x=>x.wageEstimatedDays===0&&Number.isFinite(x.playerWage)),'actual monthly allocation all clubs');
const cash=game.teams.map(x=>x.cash);closeFinancePeriod(period.date);ck(JSON.stringify(cash)===JSON.stringify(game.teams.map(x=>x.cash)),'no double payment');
return {dailyWages:'pass',stints:'pass',legacy:'pass',save:'pass',realDays:game.calendarIndex,settlement:'pass'};
`;
const code=inline.slice(0,end).replace("(() => {","return (() => {").replace("((Date.now()^0x53e719f1)>>>0)||1937","1937")+harness+"})();";
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
console.log('PASS daily wages',new Function("document","window","localStorage","setTimeout","clearTimeout",code)(doc,win,ls,()=>0,()=>{}));
