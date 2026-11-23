const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'Game script must exist');
new vm.Script(inline[1],{filename:'pennant-lab-inline.js'});
assert.match(html,/VERSION 0\.8\.3 · WATCH/);
assert.match(html,/const VERSION = 2;/);
assert.match(html,/managerDecision\(t,'bullpen'\)/);
assert.match(html,/managerDecision\(batTeam,'bunt'\)/);
assert.match(html,/data-action="mgr-offer"/);
assert.match(html,/auto-paused-toolbar/);
assert.match(html,/injury-alert-screen/);
assert.match(html,/managers:game\.teams\.map/);

// Check manager decisions independent of the browser and saved data.
const begin=inline[1].indexOf('  const MANAGER_TACTICS=');
const end=inline[1].indexOf('  const prevEnsure07=ensureGameExtras;',begin);
assert(begin>=0&&end>begin,'Manager functions should be present');
const managerCode=inline[1].slice(begin,end);
const managerApi=vm.runInNewContext('(function(){let game={year:2027,teams:[],managerHistory:[]};\n'
  +managerCode+'\nreturn {game,makeManager,ensureManagers,managerDecision,managerDisagreement,managerDailyRelations};})()',
  {r2:n=>Math.round(n*100)/100,clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),h:s=>String(s),fmtMoney:n=>String(n)});
const first=managerApi.makeManager(2,2027,1);
assert.equal(first.id,'mgr-2-2027-1');
assert.equal(first.name,managerApi.makeManager(2,2027,1).name,'Candidate generation must be stable');
assert.notEqual(first.id,managerApi.makeManager(2,2027,2).id);
const team={id:2};
managerApi.game.teams.push(team);
managerApi.ensureManagers();
assert(team.manager,'Existing saves get an appointed manager');
assert.equal(team.gmOrders.bullpen,'auto');
const native=managerApi.managerDecision(team,'bullpen');
assert.equal(native,team.manager.tendency.bullpen);
team.gmOrders.bullpen='attack';
const attack=managerApi.managerDecision(team,'bullpen');
team.gmOrders.bullpen='safe';
const safe=managerApi.managerDecision(team,'bullpen');
assert(attack>safe,'GM direction must affect tactical choices');
assert(managerApi.managerDisagreement(team)>=0);
team.gmOrders.bullpen='auto';
const before=team.manager.discontent;
managerApi.managerDailyRelations();
assert(team.manager.discontent<=before,'No contradictory orders allows tension to subside');
console.log('PASS: HTML script syntax, v0.6 regression markers, manager creation, GM strategy and relations');

// Responsive watchboard: innings 1–9 plus the running total always fit in one table.
assert.match(html,/\.watch-table\{width:100%;min-width:0;table-layout:fixed/);
assert.doesNotMatch(html,/\.watch-table\{width:100%;min-width:400px/);
const watchStart=inline[1].indexOf('  function watchInningFrames(g)');
const watchEnd=inline[1].indexOf('  function dailyGameScreen(entry)',watchStart);
assert(watchStart>=0&&watchEnd>watchStart,'Watch replay source must exist');
const watchSource=inline[1].slice(watchStart,watchEnd);
function fixtureWatch(innings){
  const g={year:2031,day:20,home:2,away:1,
    inningsA:Array.from({length:innings},(_,i)=>i===0?1:i===10?2:0),
    inningsH:Array.from({length:innings},(_,i)=>i===1?1:i===9?1:0),events:[]};
  const teams=[{id:1,name:'東京',short:'東京',league:'E'},
    {id:2,name:'仙台',short:'仙台',league:'E'}];
  const game={year:2031,selectedId:1,games:[g]};
  const ui={watchGame:{year:2031,day:20,step:99},autoPaused:false};
  const getTeam=id=>teams.find(x=>x.id===id);
  const env={game,ui,getTeam,leagueClass:()=>'',h:x=>String(x),
    teamBadge:t=>t.short,formatCalendarDate:()=> '4月23日'};
  return vm.runInNewContext(watchSource+'\nwatchGameScreen({gameNo:20,date:"2031-04-23"});',env);
}
const regulation=fixtureWatch(9),extra=fixtureWatch(12);
assert.match(regulation,/<th>9<\/th><th>計<\/th>/,'The first scoreboard shows inning 9 and total');
assert.doesNotMatch(regulation,/watch-extra-table/,'No extra-inning table before the 10th');
assert.match(extra,/<th>9<\/th><th>計<\/th>/,'The main scoreboard remains fixed for extra innings');
assert.match(extra,/watch-extra-table/,'Extra innings appear in a second no-scroll table');
assert.match(extra,/<th>10<\/th><th>11<\/th><th>12<\/th>/);

// Cinematic presentation must not write to saved game state or fabricate player performance.
assert.match(html,/function gameDayIntroScreen\(entry,g\)/);
assert.match(html,/function gameSetScreen\(g\)/);
assert.match(html,/function resultHeroCard\(g\)/);
assert.match(html,/function highlightPlayer\(g\)/);
assert.match(html,/game-result-hero/);
assert.match(html,/prefers-reduced-motion:reduce/);
assert.match(html,/phase:'intro'/);
assert.match(html,/phase='final'/);
assert.match(html,/if\(watchOneDay\)ui\.watchGame=\{year:game\.year/);
assert.match(html,/const watchOneDay=oneDay&&entry\.type==='game'/);
assert.match(html,/result-table-wrap/);
assert.match(html,/watch-table result-table/);
assert.match(html,/watch-extra-table/);
assert.match(html,/return oldMatchReview03\(\)\.replace\('<section class="game-result-hero'/);

assert.match(html,/function managerPortrait\(manager,teamId\)/);
assert.match(html,/function managerGradeStrip\(m\)/);
assert.match(html,/function managerRiskMessage\(m\)/);
assert.match(html,/data-action="mgr-order"/);
assert.match(html,/data-action="mgr-renew"/);
assert.doesNotMatch(html,/data-change="manager-order"/);
assert.match(html,/m\.discontent>=75/);
assert.match(html,/辞任の意向/);
assert.match(html,/契約更改を拒否/);


// When contracts expire, high discontent must produce refusal and a caretaker.
// Happy managers renew without an unexpected dismissal.
const yStart=inline[1].indexOf('  const prevNext07=nextSeason;');
const yEnd=inline[1].indexOf('  const prevCalendar07=processCalendarDay;',yStart);
assert(yStart>0&&yEnd>yStart);
const endOfYearSource=inline[1].slice(yStart,yEnd);
function simulateManagerExpiry(discontent){
  const team={id:2,short:'東京',cash:5,manager:{
    name:'旧監督',salary:.2,contractYears:1,discontent
  }};
  const game={year:2031,day:143,teams:[team],managerHistory:[]};
  const news=[];
  const context={game,storageFailure:false,Number,
    r2:n=>Math.round(n*100)/100,
    makeManager:()=>({id:'acting',name:'暫定監督',contractYears:2,salary:.14,discontent:0}),
    pushNews:x=>news.push(x),save(){}};
  vm.runInNewContext('(function(){let nextSeason=function(){game.year++;game.day=0;};'+
    endOfYearSource+' nextSeason();})()',context);
  return {game,news};
}
const refused=simulateManagerExpiry(88);
assert.equal(refused.game.teams[0].manager.name,'暫定監督');
assert.equal(refused.game.teams[0].manager.contractYears,1);
assert.match(refused.game.managerHistory[0].text,/契約更改を拒否/);
assert.equal(refused.news.length,1);
const renewed=simulateManagerExpiry(10);
assert.equal(renewed.game.teams[0].manager.name,'旧監督');
assert.equal(renewed.game.teams[0].manager.contractYears,1);
assert.match(renewed.game.managerHistory[0].text,/契約を更新/);
assert.equal(renewed.news.length,0);

assert.match(html,/GM DESK · MEDICAL INBOX/);
assert.match(html,/GM DESK · MONTHLY INBOX/);
assert.match(html,/gm-medical-player/);
assert.match(html,/gm-month-head/);
assert.match(html,/球団運営スタッフ/);
assert.match(html,/チーム医療スタッフ/);
assert.match(html,/data-action="injury-ack"/);
assert.match(html,/data-action="\$\{history\?'monthly-history-close':'finish-month'\}"/);


// v0.8.3: Avoid revealing a 17-half-inning game before the final out.
// The progress width is computed against the public 9-inning/12-inning rules.
assert.match(html,/waitForDailyDisplay\(mode==='fast'\?720:1900\)/);
assert.match(html,/waitForDailyDisplay\(mode==='fast'\?840:2300\)/);
assert.doesNotMatch(html,/\$\{step\}\/\$\{frames\.length\} 半イニング/);
assert.match(html,/const progress=Math\.min\(100,Math\.round\(step<=18\?step\/18\*95:95\+\(step-18\)\/6\*5\)\)/);
function partialWatch(omitNinthBottom){
  const g={year:2031,day:20,home:2,away:1,
    inningsA:Array(9).fill(0),inningsH:Array(9).fill(0),events:[]};
  if(omitNinthBottom)g.inningsH[8]=null;
  const game={year:2031,selectedId:1,games:[g]};
  const ui={watchGame:{year:2031,day:20,step:7},autoPaused:false};
  const teams=[{id:1,name:'東京',short:'東京',league:'E'},
    {id:2,name:'仙台',short:'仙台',league:'E'}];
  const getTeam=id=>teams.find(x=>x.id===id);
  const env={game,ui,getTeam,leagueClass:()=>'',h:x=>String(x),
    teamBadge:t=>t.short,formatCalendarDate:()=> '4月23日'};
  return vm.runInNewContext(watchSource+'\nwatchGameScreen({gameNo:20,date:"2031-04-23"});',env);
}
const withNinth=partialWatch(false),withoutNinth=partialWatch(true);
const gaugeWidth=markup=>markup.match(/class="watch-progress"><i style="width:(\d+)%"/)?.[1];
assert.equal(gaugeWidth(withNinth),gaugeWidth(withoutNinth),
  'Progress must not reveal whether the bottom of the ninth will be played');
assert(!/\d+\/(?:17|18) 半イニング/.test(withNinth));
assert(!/\d+\/(?:17|18) 半イニング/.test(withoutNinth));
