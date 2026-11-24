// node scripts/stadium-check.cjs
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new Function(inline);
const end=inline.indexOf("  const appRoot=document.querySelector('#app');");
if(end<0)throw Error('startup marker missing');
const harness=
"const assert=(x,msg)=>{if(!x)throw Error(msg);};save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();game.ceremonyStage=null;const t=myTeam();assert(stadiumScreen(t).includes('STADIUM MANAGEMENT'),'stadium markup');assert(stadiumSetPrices(t,[6500,4500,3100,2000,2000]),'preseason price');let days=0;\n"+
"while(game.day<143&&days<220){const e=processCalendarDay();if(!e)break;game.pendingRareIds=[];game.pendingMilestoneIds=[];game.pendingEvent=null;game.pendingMonth=null;game.pendingReview=null;game.pendingCareer=null;game.ceremonyStage=null;days++;if(game.day===1&&stadiumCanPrice(t)){assert(stadiumSetPrices(t,[6500,4500,3200,2000,2000]),'first midseason price');assert(!stadiumSetPrices(t,[6500,4500,3300,2000,2000]),'second blocked');assert(!stadiumCanPrice(JSON.parse(JSON.stringify(t))),'saved lock');}if(game.financeCrisis)break;}\n"+
"const q=stadiumTotals(stadiumMatches(t));const ledger=game.financeLedger?.clubs[t.id];assert(days===185&&game.day===143&&game.games.length===858,'official season');assert(!game.financeCrisis,'finance crisis');assert(game.games.every(g=>g.stadium&&g.stadium.attendance<=g.stadium.capacity),'match records');assert(q.games>0&&ledger?.stadiumOperating>0,'monthly accounting');assert(!stadiumCanPrice(t),'price locked');const before=t.cash;closeFinancePeriod(game.calendar.days[game.calendarIndex-1].date);assert(t.cash===before,'ledger idempotent');return {days,gameDay:game.day,games:game.games.length,homeGames:q.games,att:q.attendance,ledger,cash:t.cash};";
const code=inline.slice(0,end).replace("(() => {","return (() => {").replace("((Date.now()^0x53e719f1)>>>0)||1937","1937")+harness+"})();";
const document={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}};
const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
const result=new Function("document","window","localStorage","setTimeout","clearTimeout",code)(document,{addEventListener(){}},localStorage,()=>0,()=>{});
console.log('PASS stadium-check',JSON.stringify(result));
