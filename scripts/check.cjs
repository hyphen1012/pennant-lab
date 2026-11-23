const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'Game script must exist');
new vm.Script(inline[1],{filename:'pennant-lab-inline.js'});
assert.match(html,/VERSION 0\.8\.9 · BENCH REPORT/);
assert.match(html,/const VERSION = 2;/);
assert.match(html,/managerDecision\(team,'bullpen'\)/);
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
assert.match(html,/const finishedHalves=revealed\.length;/);
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



// v0.8.4: only real logged scoring appearances can become named player
// moments; multiple scoring appearances in a half-inning are revealed in order.
assert.match(html,/result\.scoringPlays=scoringPlays/);
assert.match(html,/scoringPlays\.push\(\{inning,teamId:batTeam\.id/);
assert.match(html,/watchReplaySteps\(g\)/);
assert.match(html,/watchScoringTitle\(play\)/);
assert.match(html,/scoring\?\(mode==='fast'\?900:1700\):interval/);
const baseballTeams=[
  {id:1,name:'東京フェニックス',short:'東京',league:'E'},
  {id:2,name:'長野アルパインズ',short:'長野',league:'W'}
];
function scoringSample(step,withLogs=true){
  const g={year:2031,day:20,home:2,away:1,
    inningsA:[3,...Array(8).fill(0)],
    inningsH:Array(9).fill(0),events:[],
    ...(withLogs?{scoringPlays:[
      {inning:1,teamId:1,batterId:101,batterName:'田中 健',kind:'single',runs:1,rbi:1},
      {inning:1,teamId:1,batterId:102,batterName:'鈴木 翔',kind:'hr',runs:2,rbi:2}
    ]}:{})};
  const game={year:2031,selectedId:1,games:[g]};
  const ui={watchGame:{year:2031,day:20,step},autoPaused:false};
  const getTeam=id=>baseballTeams.find(t=>t.id===id);
  const context={game,ui,getTeam,getPlayer:()=>null,leagueClass:()=>'',h:s=>String(s),
    teamBadge:t=>t.short,formatCalendarDate:()=> '5月16日'};
  return vm.runInNewContext(watchSource+'\nwatchGameScreen({gameNo:20,date:"2031-05-16"});',context);
}
const oneRun=scoringSample(1),twoRun=scoringSample(2),endOfHalf=scoringSample(3);
assert.match(oneRun,/田中 健/);
assert.match(oneRun,/1点タイムリーヒット/);
assert.match(oneRun,/＋1点 · 0 → 1/);
assert.doesNotMatch(oneRun,/鈴木 翔/,'No future scoring batter can leak');
assert.match(twoRun,/鈴木 翔/);
assert.match(twoRun,/2ランホームラン/);
assert.match(twoRun,/＋2点 · 1 → 3/);
assert.match(endOfHalf,/攻撃終了/);
assert.doesNotMatch(endOfHalf,/class="watch-scoring-flash/);
const oldFormat=scoringSample(1,false);
assert.doesNotMatch(oldFormat,/タイムリーヒット/,'Legacy saves must not invent scoring players');
assert.doesNotMatch(oldFormat,/class="watch-scoring-flash/);
const hrNames=vm.runInNewContext(watchSource+
  "\n[watchScoringTitle({kind:'hr',rbi:1}),"+
  "watchScoringTitle({kind:'hr',rbi:3}),"+
  "watchScoringTitle({kind:'hr',rbi:4})];",{
  game:{year:2031,games:[],selectedId:1},ui:{watchGame:{step:0}}
});
assert.equal(hrNames[0],'ソロホームラン');
assert.equal(hrNames[1],'3ランホームラン');
assert.equal(hrNames[2],'満塁ホームラン');



// v0.8.5: one grade palette, displayed-ability mean ring, stable detailed
// fictional SVG artwork, no nested ring, and special-title precedence.
const paletteStart=inline[1].indexOf('  // v0.8.5: one authoritative ability grade');
const paletteEnd=inline[1].indexOf('  // Physical condition is separate',paletteStart);
const faceStart=inline[1].indexOf('  function renderFaceArtwork(p,options={})');
const faceEnd=inline[1].indexOf('  // Existing player portraits receive',faceStart);
assert(paletteStart>=0&&paletteEnd>paletteStart&&faceStart>0&&faceEnd>faceStart);
const portraitSource=inline[1].slice(paletteStart,paletteEnd)+
  '\n'+inline[1].slice(faceStart,faceEnd);
const identity=vm.runInNewContext('(function(){'+portraitSource+
  '\nreturn {grade,gradeBrief,gradeBriefColor,rankColor,playerDisplayedAbilityAverage,'+
  'playerVisualTheme,playerTitleTheme,portrait,faceMini,faceLabel,renderFaceArtwork,'+
  'themedPlayerName};})()',{
  isPitch:p=>['SP','RP','CP'].includes(p.pos),rating:p=>p.overall||73,
  h:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
});
const hexMap={
  SS:'#DCE3EB','S+':'#F6D46A',S:'#F1C54B',A:'#DE58BB',
  B:'#E85062',C:'#E8AA3F',D:'#A1CF47',E:'#43C86B',F:'#41B6E6'
};
for(const [num,rank] of [[100,'SS'],[99,'S+'],[90,'S'],[80,'A'],
  [70,'B'],[60,'C'],[50,'D'],[40,'E'],[0,'F']]){
  assert.equal(identity.grade(num),rank);
  assert.equal(identity.gradeBrief(num),rank);
  assert.equal(identity.gradeBriefColor(num),hexMap[rank]);
  assert.equal(identity.rankColor(num),hexMap[rank]);
}
const batter={id:2001,name:'伊藤 祐樹',age:33,pos:'2B',
  contact:63,power:75,speed:94,defense:73,arm:42,talent:58,overall:73};
const pitcher={id:2002,name:'鈴木 大輝',age:36,pos:'SP',
  stuff:81,control:60,stamina:55,talent:54,overall:65};
assert.equal(identity.playerDisplayedAbilityAverage(batter),73);
assert.equal(identity.playerVisualTheme(batter).ring,hexMap.B);
assert.equal(identity.playerDisplayedAbilityAverage(pitcher),64);
assert.equal(identity.playerVisualTheme(pitcher).ring,hexMap.C);
const portraitHTML=identity.portrait(batter);
assert.match(portraitHTML,/--avatar-color:#E85062/);
assert.match(portraitHTML,/<b>73<\/b>/);
assert.equal((portraitHTML.match(/class="avatar/g)||[]).length,1);
assert.equal((portraitHTML.match(/<svg\b/g)||[]).length,1);
assert.doesNotMatch(portraitHTML,/class="face-mini/,'No nested ring');
assert.match(portraitHTML,/class="face-artwork"/);
assert.equal(identity.renderFaceArtwork(batter),identity.renderFaceArtwork(batter));
assert.notEqual(identity.renderFaceArtwork(batter),identity.renderFaceArtwork(pitcher));
const titled={...batter,specialCategory:'PARALLEL'};
assert.equal(identity.playerVisualTheme(titled).ring,'#B28AFF');
assert.match(identity.themedPlayerName(titled),/PARALLEL/);
assert.match(identity.themedPlayerName(titled),/#B28AFF/);
assert.match(identity.portrait(titled),/special-portrait/);
const immortal={...batter,specialCategory:'IMMORTAL',abilitiesHidden:true};
assert.equal(identity.playerVisualTheme(immortal).average,null);
assert.match(identity.portrait(immortal),/未公開の選手シルエット/);
assert.doesNotMatch(identity.portrait(immortal),/<b>73<\/b>/);
assert.equal(identity.playerVisualTheme(immortal).ring,'#EBF3FF');
assert.equal(identity.playerVisualTheme({...batter,specialCategory:'LEGEND'}).ring,'#FF6175');
assert.equal(identity.playerVisualTheme({...batter,originCategory:'輪廻転生'}).ring,'#E7E7FC');
assert.match(html,/\.avatar\.player-portrait>.face-artwork/);
assert.match(html,/\.manager-portrait>.face-artwork/);
assert.match(html,/\.special-name-tag/);
console.log('PASS: rank colors, average-based single rings, stable SVG faces and title themes');


// v0.8.6: The exact same five-stat ability ring and overall number badge
// must be reusable in lineup, swap, FA, and future draft/foreign markets.
const lineupBadge=identity.faceMini(batter,{overall:true});
const pitcherBadge=identity.faceMini(pitcher,{overall:true});
assert.match(lineupBadge,/class="face-mini [^"]*has-overall"/);
assert.match(lineupBadge,/--avatar-color:#E85062/);
assert.match(lineupBadge,/<b class="portrait-overall">73<\/b>/);
assert.match(pitcherBadge,/--avatar-color:#E8AA3F/);
assert.match(pitcherBadge,/<b class="portrait-overall">65<\/b>/);
assert.doesNotMatch(identity.faceMini(batter),/portrait-overall/);
assert.equal((lineupBadge.match(/<svg\b/g)||[]).length,1);
assert.match(lineupBadge,/viewBox="12 10 96 96"/);
assert.match(identity.renderFaceArtwork(batter),/viewBox="12 10 96 96"/);
assert.match(html,/faceLabel\(p,\{overall:true\}\)/);
assert.match(html,/faceMini\(p,\{overall:true\}\)/);
assert.match(html,/function recruitmentCandidateCard\(p,options=\{\}\)/);
assert.match(html,/class="recruit-candidate"/);
assert.match(html,/\.recruit-contract\{display:grid;/);
assert.match(html,/data-action="\$\{h\(action\)\}"/);
assert.match(html,/\.face-mini\.has-overall .portrait-overall/);
assert.match(html,/\.face-mini\.has-overall>.face-mini-artwork/);
assert.match(html,/showOverall=options\.overall===true&&!theme\.hidden/);
assert.doesNotMatch(identity.faceMini(immortal,{overall:true}),/portrait-overall/,
  'A hidden special prospect must not leak its real overall rating');
assert.match(identity.faceMini(titled,{overall:true}),/--avatar-color:#B28AFF/);
console.log('PASS: close-up faces, mini overall badges in lineup, swap and reusable recruitment cards');



// v0.8.7: Actual pinch hitter substitutions, not just a textual AI choice.
assert.match(html,/function pinchHitterChoice\(team,current,pitcher,slot,bases,inning,context\)/);
assert.match(html,/function managerPinchBatter\(team,batters,indexes,inning,bases,pitcher,context\)/);
assert.match(html,/const top=halfInning\(away,home,awayPitcher,lineupA,indexes,i,null,appear,events,scoringPlays,context\)/);
assert.match(html,/result\.managerMoves=managerMoves/);
assert.match(html,/function managerMoveReport\(g\)/);
assert.match(html,/managerMoveReport\(g\)/);
assert.match(html,/class="manager-activity-row"/);
const pinchBegin=inline[1].indexOf('  /* v0.8.7: GM sets pregame tactics;');
const pinchEnd=inline[1].indexOf('  function halfInning(',pinchBegin);
assert(pinchBegin>0&&pinchEnd>pinchBegin);
const pinchCode=inline[1].slice(pinchBegin,pinchEnd);
const safeClamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const pinchApi=vm.runInNewContext('(function(){'+pinchCode+
  '\nreturn {pinchHitterChoice,managerPinchBatter,liveDefenseScore};})()',{
  managerDecision:(t,key)=>t.gmOrders[key]==='attack'?86:t.gmOrders[key]==='safe'?14:52,
  managerRatings:()=>({field:76}),
  effectiveSkill:(p,key)=>p[key]*((p.energy||100)/100),
  availableForGame:p=>!p.injury,
  fieldingTier:(p,role)=>p.pos===role?'main':'off',
  teamDefenseScore:()=>40,
  syncLineupFielding:t=>t.fieldingRoles,
  FIELD_WEIGHTS:{'2B':1},
  effectiveFielding:(p)=>p.defense||50,
  clamp:safeClamp
});
const currentBatter={id:101,name:'現役選手',pos:'2B',age:34,
  energy:55,contact:43,power:37,defense:45};
const youngBench={id:105,name:'控え若手',pos:'2B',age:22,
  energy:100,contact:76,power:70,defense:81};
const wrongPosition={id:106,name:'守備適性なし',pos:'C',age:25,
  energy:100,contact:90,power:95,defense:90};
const managerFixture={id:2,short:'東京',lineup:[101],
  fieldingRoles:{101:'2B'},manager:{id:'mgr-x',name:'監督甲'},
  gmOrders:{pinch:'attack',youth:'attack'}};
function makeContext(bench=[youngBench,wrongPosition],lead=-1){
  return {awayId:2,activeLineups:{2:[currentBatter]},bench:{2:[...bench]},
    changed:{2:new Set()},pinchUsed:{2:0},scoreDiff:lead,managerMoves:[]};
}
const tacticalContext=makeContext();
const inGameLineup=[currentBatter],battingIndexes={2:0};
const chosen=pinchApi.managerPinchBatter(managerFixture,inGameLineup,battingIndexes,
  8,[currentBatter,null,null],{id:200},tacticalContext);
assert.equal(chosen.id,youngBench.id);
assert.equal(inGameLineup[0].id,youngBench.id);
assert.equal(managerFixture.lineup[0],currentBatter.id,
  'Game-level AI must never rewrite the GM saved batting lineup');
assert.equal(tacticalContext.pinchUsed[2],1);
assert.equal(tacticalContext.bench[2].some(x=>x.id===youngBench.id),false);
assert.equal(tacticalContext.managerMoves[0].inName,'控え若手');
assert.equal(tacticalContext.managerMoves[0].outName,'現役選手');
assert.equal(tacticalContext.managerMoves[0].role,'2B');
assert.equal(tacticalContext.managerMoves[0].managerId,'mgr-x');
assert.equal(pinchApi.managerPinchBatter(managerFixture,inGameLineup,battingIndexes,
  9,[null,null,null],{id:200},tacticalContext).id,youngBench.id,
  'A replaced slot cannot be swapped again later');
assert.equal(pinchApi.liveDefenseScore(managerFixture,inGameLineup),81,
  'Bench defense must really replace starter fielding in later innings');
managerFixture.gmOrders.pinch='safe';
assert.equal(pinchApi.pinchHitterChoice(managerFixture,currentBatter,{id:200},0,
  [null,null,null],9,makeContext()),null,
  'Conservative GM policy must suppress late pinch-hitting');
managerFixture.gmOrders.pinch='attack';
assert.equal(pinchApi.pinchHitterChoice(managerFixture,currentBatter,{id:200},0,
  [null,null,null],6,makeContext()),null,
  'No manager pinch hit before the seventh inning');
assert.equal(pinchApi.pinchHitterChoice(managerFixture,currentBatter,{id:200},0,
  [null,null,null],8,makeContext([],0)),null,
  'A team with no suitable healthy bench hitter cannot substitute');
assert.equal(pinchApi.pinchHitterChoice(managerFixture,currentBatter,{id:200},0,
  [null,null,null],8,makeContext([wrongPosition],-1)),null,
  'A substitute must be eligible to field the displaced position');
console.log('PASS: live manager substitutions, GM policies, safe fielding and historical move logs');



// v0.8.8: test the real runner, defense and non-reentering pitching choices.
assert.match(html,/function managerPitcherChoice\(team,inning,lead,context\)/);
assert.match(html,/function managerPinchRunner\(team,bases,inning,appear,context\)/);
assert.match(html,/function managerDefenseUpgrade\(team,inning,lead,context,appear\)/);
assert.match(html,/managerPitcherChoice\(home,i,homeScore-awayScore,context\)/);
assert.match(html,/managerMoveLabel\(move\)/);
assert.match(html,/appear\.def\.has\(p\.id\)/);
const pitStart=inline[1].indexOf('  /* v0.8.8: inning-by-inning pitching staff.');
const pitEnd=inline[1].indexOf('  /* v0.8.7:',pitStart);
const benchStart=inline[1].indexOf('  /* v0.8.8: In-game runner replacement');
const benchEnd=inline[1].indexOf('  function halfInning(',benchStart);
assert(pitStart>=0&&pitEnd>pitStart&&benchStart>=0&&benchEnd>benchStart);
const freshManagerDecision=(team,key)=>team.gmOrders[key]==='attack'?86:
  team.gmOrders[key]==='safe'?14:52;
const benchV088=vm.runInNewContext('(function(){'+inline[1].slice(pitStart,pitEnd)+
  inline[1].slice(benchStart,benchEnd)+
  '\nreturn {managerPitcherChoice,managerPinchRunner,managerDefenseUpgrade};})()',{
  managerDecision:freshManagerDecision,
  managerRatings:()=>({field:84,pitch:80}),
  clamp:(n,lo,hi)=>Math.max(lo,Math.min(hi,n)),
  pitchers:team=>team.pitchers,
  availableForGame:p=>!p.injury,
  effectiveSkill:(p,key)=>p[key]*(p.energy??100)/100,
  fieldingTier:(p,role)=>p.pos===role?'main':'off',
  effectiveFielding:(p)=>p.defense
});
const st={id:201,name:'先発甲',pos:'SP',stuff:62,control:60,energy:85,stats:{outs:22}};
const rp={id:202,name:'中継ぎ乙',pos:'RP',stuff:81,control:79,energy:94,stats:{outs:0}};
const rp2={id:203,name:'中継ぎ丙',pos:'RP',stuff:78,control:76,energy:91,stats:{outs:0}};
const cp={id:204,name:'守護神丁',pos:'CP',stuff:92,control:88,energy:93,stats:{outs:0}};
const pitTeam={id:2,manager:{id:'manager-z',name:'監督Z'},pitchers:[st,rp,rp2,cp],
  gmOrders:{bullpen:'attack',steal:'attack',defense:'attack'}};
const pitContext={awayId:2,outsBefore:new Map([[201,0],[202,0],[203,0],[204,0]]),
  pitching:{2:{current:st,used:new Set([st.id])}},managerMoves:[]};
const firstPit=benchV088.managerPitcherChoice(pitTeam,7,0,pitContext);
assert.equal(firstPit.id,rp.id);
assert.equal(pitContext.managerMoves[0].type,'pitch');
assert.equal(pitContext.managerMoves[0].outId,st.id);
assert.equal(benchV088.managerPitcherChoice(pitTeam,8,1,pitContext).id,rp.id,
  'Do not unnecessarily replace a fresh reliever');
rp.stats.outs=11;
const lastPit=benchV088.managerPitcherChoice(pitTeam,9,2,pitContext);
assert.equal(lastPit.id,cp.id,'Late one-to-three run lead uses fresh closer');
assert(!pitContext.managerMoves.some((m,i)=>i>0&&m.inId===st.id),
  'Removed starter never re-enters');
assert.equal(pitContext.managerMoves.length,2);
const slow={id:301,name:'遅い野手',pos:'2B',age:35,speed:38,defense:42,energy:100,stats:{g:4}};
const runner={id:302,name:'俊足控え',pos:'2B',age:23,speed:91,defense:84,energy:100,stats:{g:0}};
const defender={id:303,name:'守備名人',pos:'2B',age:27,speed:40,defense:99,energy:100,stats:{g:0}};
const benchTeam={id:3,lineup:[301],fieldingRoles:{301:'2B'},
  manager:{name:'監督Y'},gmOrders:{steal:'attack',defense:'attack'}};
const benchContext={awayId:3,scoreDiff:-1,activeLineups:{3:[slow]},
  bench:{3:[runner,defender]},changed:{3:new Set()},runnerUsed:{3:0},
  defenseUsed:{3:0},managerMoves:[]};
const apear={bat:new Set([301]),pitch:new Set(),run:new Set(),def:new Set()};
const bases=[slow,null,null];
benchV088.managerPinchRunner(benchTeam,bases,8,apear,benchContext);
assert.equal(bases[0].id,runner.id);
assert.equal(benchContext.activeLineups[3][0].id,runner.id);
assert.equal(runner.stats.g,1);
assert(apear.run.has(runner.id));
assert.equal(benchContext.runnerUsed[3],1);
assert.equal(benchContext.managerMoves[0].type,'runner');
assert.equal(benchContext.bench[3].some(p=>p.id===runner.id),false);
assert.equal(benchV088.managerPinchRunner(benchTeam,bases,9,apear,benchContext),undefined,
  'No second replacement of the same batting order slot');
const defContext={awayId:3,scoreDiff:2,activeLineups:{3:[slow]},
  bench:{3:[runner,defender]},changed:{3:new Set()},runnerUsed:{3:0},
  defenseUsed:{3:0},managerMoves:[]};
benchV088.managerDefenseUpgrade(benchTeam,8,2,defContext,apear);
assert.equal(defContext.activeLineups[3][0].id,defender.id);
assert.equal(defender.stats.g,1);
assert(apear.def.has(defender.id));
assert.equal(defContext.managerMoves[0].type,'defense');
assert.equal(benchTeam.lineup[0],slow.id,'GM original lineup stays unchanged');
assert.equal(benchV088.managerDefenseUpgrade(benchTeam,9,2,defContext,apear),undefined);
benchTeam.gmOrders.defense='safe';
const passiveCtx={...defContext,changed:{3:new Set()},defenseUsed:{3:0},
  activeLineups:{3:[slow]},bench:{3:[defender]},managerMoves:[]};
assert.equal(benchV088.managerDefenseUpgrade(benchTeam,8,2,passiveCtx,apear),undefined);
console.log('PASS: manager-controlled bullpen, runner, defensive specialist and no re-entry');



// v0.8.9: Native <details> keeps the first two actual bench moves visible,
// opens/closes the remainder, and never adds a toggle for 0–2 moves.
const reportStart=inline[1].indexOf('  function managerMoveLabel(move){');
const reportEnd=inline[1].indexOf('  function matchReportBody(g){',reportStart);
assert(reportStart>=0&&reportEnd>reportStart);
const reportApi=vm.runInNewContext('(function(){'+inline[1].slice(reportStart,reportEnd)+
  '\nreturn {managerMoveReport,managerMoveLabel};})()',{
  getPlayer:id=>({id,name:'控え'+id}),
  getTeam:id=>({id,short:'東京'}),
  faceMini:p=>'<i class="fake-face">'+p.id+'</i>',
  h:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
});
const reportMove=n=>({type:['pinch','runner','defense','pitch'][n%4],inning:n+6,
  side:'表',teamId:2,inId:100+n,inName:'選手'+n,outName:'旧選手'+n,role:'2B'});
for(const count of [0,1,2,3,4,12]){
  const markup=reportApi.managerMoveReport({managerMoves:Array.from({length:count},(_,n)=>reportMove(n))});
  assert.match(markup,/BENCH REPORT/);
  assert.match(markup,new RegExp(count+'件'));
  const chunks=markup.split('<details class="manager-move-details">');
  const shown=(chunks[0].match(/class="manager-move-row"/g)||[]).length;
  assert.equal(shown,Math.min(count,2),'Only first two changes visible initially');
  if(count>2){
    assert.equal(chunks.length,2,'Exactly one collapsible region');
    assert.doesNotMatch(markup,/<details class="manager-move-details" open/);
    assert.match(chunks[1],/詳細を開く（残り\d+件）/);
    assert.match(chunks[1],/詳細を閉じる/);
    assert.equal((chunks[1].match(/class="manager-move-row"/g)||[]).length,count-2);
    assert.equal((markup.match(/class="manager-move-row"/g)||[]).length,count,
      'All real bench events remain accessible');
  }else{
    assert.equal(chunks.length,1,'No toggle for zero, one or two changes');
    assert.doesNotMatch(markup,/詳細を開く|詳細を閉じる/);
  }
}
assert.equal(reportApi.managerMoveReport({}), '',
  'Old saves without managerMoves should not show a fabricated report');
assert.match(html,/\.manager-move-details\[open\] \.manager-details-open\{display:inline\}/);
assert.match(html,/\.manager-move-details\[open\] \.manager-details-closed\{display:none\}/);
assert.match(html,/\.manager-move-details>summary:focus-visible/);
assert.match(html,/managerMoveReport\(g\)/);
console.log('PASS: BENCH REPORT defaults to two items and expands/collapses native details for 3+');
