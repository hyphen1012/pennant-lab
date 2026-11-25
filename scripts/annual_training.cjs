// Current calendar-flow regression; dates and production training functions.
const fs=require('node:fs');
const inline=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],end=inline.indexOf("  const appRoot=document.querySelector('#app');");
const harness=`
const ck=(v,m)=>{if(!v)throw Error(m);};
save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
ui.page='game';ui.tab='hq';game.ceremonyStage='self';game.pendingCeremonyIntro='self';
let f=flowInit();ck(f.mode==='pre'&&f.date===game.year+'-01-01','January clock');
const advanceTo=id=>{let n=0;while(f.jobs[id].status!=='ready'&&n++<100){ck(!f.active,'no active job');f.date=calendarOffsetDate(f.date,1);flowTick(f);}ck(f.jobs[id].status==='ready','ready '+id);ck(f.date>=f.jobs[id].start,'not early '+id);};
const open=id=>{advanceTo(id);ck(flowOpen(f,f.jobs[id]),'open '+id);game.pendingCeremonyIntro=null;};
const complete=id=>{flowComplete(f,f.jobs[id]);ck(f.jobs[id].status==='done'&&!f.active&&!game.ceremonyStage,'complete '+id);};
open('self');const p=own(myTeam()).find(p=>!isPitch(p));annualPlan(myTeam(),'self',true).menus[p.id]={intensity:'rest',focus:'balanced'};
const self=annualRunPhase('self');ck(self.rows.find(x=>x.id===p.id).xp===0&&self.clubs.length===12,'self training');
const xp=JSON.stringify(game.players.map(p=>p.expPoints));game=JSON.parse(JSON.stringify(game));ensureGameExtras();f=flowGet();annualRunPhase('self');ck(xp===JSON.stringify(game.players.map(p=>p.expPoints)),'self reload no repeat');complete('self');
open('camp');const ownClub=myTeam(),savedCash=ownClub.cash;ownClub.cash=0;const noFunds=JSON.stringify(game);ck(annualRunPhase('camp')===null,'unaffordable camp rejected');ck(JSON.stringify(game)===noFunds,'unaffordable camp cannot mutate other clubs or plans');ownClub.cash=savedCash;const camp=annualRunPhase('camp');ck(camp&&camp.clubs.length===12&&camp.rows.length>0,'camp report');const cash=myTeam().cash;annualRunPhase('camp');ck(cash===myTeam().cash,'camp no double charge');complete('camp');
open('exhibition');const stats=JSON.stringify(game.players.map(p=>[p.stats,p.farmStats])),standings=JSON.stringify(game.teams.map(t=>[t.wins,t.losses,t.ties]));const openReport=annualRunPhase('exhibition');ck(openReport.games.length>0&&openReport.games.every(g=>!g.noContest),'exhibition games');
ck(stats===JSON.stringify(game.players.map(p=>[p.stats,p.farmStats]))&&standings===JSON.stringify(game.teams.map(t=>[t.wins,t.losses,t.ties])),'exhibition isolation');complete('exhibition');
// Separate off-season fixture: dispatch is a booking, return is next calendar year.
game.calendarFlow=null;game.ceremonyStage='winter';game.day=143;game.calendarIndex=game.calendar.days.length;
const t=myTeam(),player=own(t).find(p=>p.age<=28&&!p.injury);ck(player,'winter candidate');
const plan=winterPlan(t,true);for(const k of Object.keys(plan))delete plan[k];plan[player.id]='taiwan';
const w=winterDispatch();ck(w&&w.entries.some(x=>x.id===player.id)&&!w.returned,'winter booking');const before=t.cash;winterDispatch();ck(before===t.cash,'no repeat booking');
const year=game.year;game.year++;winterReturn();ck(w.returned&&w.rows.some(x=>x.id===player.id),'next-year return');
const again=JSON.stringify(w);winterReturn();ck(again===JSON.stringify(w),'no repeat return');
// Lightweight calendar smoke through 1000 years, not 1000 simulated seasons.
for(let y=2027;y<3027;y++)ck(calendarForSeason(y).days.filter(d=>d.type==='game').length===143,'calendar '+y);
return {calendarFlow:'pass',self:'pass',camp:'pass',exhibitionGames:openReport.games.length,winter:'pass',calendarYears:1000,fixtureYear:year};
`;
const code=inline.slice(0,end).replace('(() => {','return (() => {').replace('((Date.now()^0x53e719f1)>>>0)||1937','1937')+harness+'})();';
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
console.log('PASS annual calendar training',new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{}));
