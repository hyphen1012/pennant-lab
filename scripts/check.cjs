const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'Game script must exist');
new vm.Script(inline[1],{filename:'pennant-lab-inline.js'});
assert.match(html,/VERSION 0\.9\.37 · NEGOTIATION/);
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
assert.match(html,/oldMatchReview03\(\)\.replace\('<section class="game-result-hero'/);

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
assert.match(html,/MONTHLY MEETING · 球団運営スタッフ/);
assert.match(html,/gm-medical-player/);
assert.match(html,/class="meeting-scene gm-month-report"/);
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
  SS:'#DCE3EB','S+':'#F6D46A',S:'#F1C54B',A:'#F5B1B8',
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
assert.equal(identity.playerVisualTheme({...batter,specialCategory:'PARALLEL',originCategory:'PARADOX'}).category,'異界転生');
assert.equal(identity.playerVisualTheme({...batter,specialCategory:'STAR',originCategory:'RINNE'}).category,'輪廻転生');
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



// v0.9.0 — realistic inning-midpoint relief by accumulated pitch counts,
// score pressure and batter handedness; no withdrawn pitcher can reenter.
assert.match(html,/function managerMidInningPitcherChoice\(team,inning,lead,bases,outs,batter,context\)/);
assert.match(html,/managerMidInningPitcherChoice\(fieldTeam,inning,/);
assert(html.includes('context?.runnerResponsibility?.get(runner?.id)||pitcher'));
assert.match(html,/context\.runnerResponsibility\.set\(fast\.id,inheritedPitcher\)/);
assert.match(html,/pstat\.pitches=\(Number\(pstat\.pitches\)\|\|0\)\+usedPitches/);
assert.match(html,/pstat\.bf=\(Number\(pstat\.bf\)\|\|0\)\+1/);
assert.match(html,/pitchCounts:\{/);
assert.match(html,/pitches:delta\(p,'pitches'\)/);
assert.match(html,/<th>投球回<\/th><th>球数<\/th>/);
assert.match(html,/pitchLoad=pitched/);
const midStart=inline[1].indexOf('  /* v0.9.0 — Pitch counts');
const midEnd=inline[1].indexOf('  /* v0.8.7:',midStart);
assert(midStart>=0&&midEnd>midStart);
const noHitStart=inline[1].indexOf('  function preserveNoHitStart('),noHitEnd=inline[1].indexOf('  function managerPitcherChoice(',noHitStart);
const midAPI=vm.runInNewContext('(function(){'+inline[1].slice(noHitStart,noHitEnd)+inline[1].slice(midStart,midEnd)+
  '\nreturn managerMidInningPitcherChoice;})()',{
  managerDecision:()=>76,managerRatings:()=>({pitch:72}),
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  pitchers:team=>team.pitchers,
  availableForGame:p=>!p.injury,
  effectiveSkill:(p,key)=>p[key]*(p.energy??100)/100,
  derivedBatHand:()=> '左'
});
const starter={id:901,name:'先発投手',pos:'SP',hand:'右',stamina:65,energy:100,stuff:74,control:74,stats:{outs:16}};
const righty={id:902,name:'右中継ぎ',pos:'RP',hand:'右',stamina:49,energy:100,stuff:80,control:80};
const lefty={id:903,name:'左中継ぎ',pos:'RP',hand:'左',stamina:49,energy:100,stuff:80,control:80};
const club={id:7,manager:{id:'m',name:'監督'},pitchers:[starter,righty,lefty]};
const ctx={awayId:7,managerMoves:[],pitching:{7:{current:starter,used:new Set([starter.id])}},
  pitchCounts:{7:new Map([[starter.id,90]])}};
const leftBatter={id:998,name:'左打者',batHand:'左'};
const next=midAPI(club,7,-1,[null,{id:15},null],1,leftBatter,ctx);
assert.equal(next.id,lefty.id,'Same-side matchup should win a close relief decision');
assert.equal(ctx.pitching[7].current.id,lefty.id);
assert.equal(ctx.managerMoves[0].type,'pitch');
assert.equal(ctx.managerMoves[0].pitchCount,90);
assert.equal(ctx.managerMoves[0].midInning,true);
assert.equal(ctx.managerMoves[0].reason,'走者を背負った場面での継投');
assert(ctx.pitching[7].used.has(starter.id)&&ctx.pitching[7].used.has(lefty.id));
assert.equal(midAPI(club,7,-1,[null,{id:15},null],1,leftBatter,ctx).id,lefty.id,
  'A fresh reliever must remain in the game');
ctx.pitchCounts[7].set(lefty.id,40);
assert.equal(midAPI(club,8,-1,[{id:15},{id:16},null],1,
  {...leftBatter,batHand:'右'},ctx).id,righty.id,
  'After workload limit, next unused reliever can enter');
assert.equal(ctx.managerMoves.length,2);
assert(!ctx.managerMoves.some(m=>m.inId===starter.id),'Starter cannot reenter');
assert.equal(midAPI(club,8,-1,[{id:15},{id:16},null],1,leftBatter,ctx).id,righty.id,
  'No further substitution if all relievers already used');
const earlyCtx={...ctx,managerMoves:[],pitching:{7:{current:starter,used:new Set([starter.id])}},
  pitchCounts:{7:new Map([[starter.id,40]])}};
assert.equal(midAPI(club,4,0,[null,null,null],0,leftBatter,earlyCtx).id,starter.id,
  'No premature early-inning mid-inning pitching replacement');
console.log('PASS: pitch-count bullpen, left/right matchup, workload and no pitcher reentry');

// Calendar presentation must not change the persisted save schema or simulate twice.
assert.match(html,/function calendarDateIntroScreen\(entry\)/);
assert.match(html,/const dateIntroDelay=mode==='fast'\?640:1500/);
assert.match(html,/await waitForDailyDisplay\(dateIntroDelay\);\s*ui\.dateIntro=false;ui\.autoDay=null;\s*if\(ui\.pauseRequested\|\|document\.hidden\|\|storageFailure\)break;\s*}\s*const entry=processCalendarDay\(\);/);
assert.match(html,/prefers-reduced-motion:reduce\)\{\.calendar-date-track/);
const dateStart=inline[1].indexOf('  function calendarOffsetDate(');
const dateEnd=inline[1].indexOf('  function dailyNewsScreen(',dateStart);
const dateApi=vm.runInNewContext('(function(){'+inline[1].slice(dateStart,dateEnd)+'\nreturn {calendarOffsetDate,calendarDateIntroScreen};})()',{
  game:{year:2028,playbackMode:'normal'},ui:{autoPaused:false},h:String,formatCalendarDate:String
});
assert.equal(dateApi.calendarOffsetDate('2028-03-01',-1),'2028-02-29');
assert.equal(dateApi.calendarOffsetDate('2027-12-31',1),'2028-01-01');
const dateMarkup=dateApi.calendarDateIntroScreen({date:'2028-03-25',type:'game',gameNo:1});
assert(dateMarkup.includes('開幕戦')&&dateMarkup.includes('2028-03-25'));
assert(!dateMarkup.includes('result-score-row'));
console.log('PASS: date intro civil dates, spoiler-free markup and interruption guard');

assert.match(html,/const previousIntroDelay=mode==='fast'\?320:480/);
assert.match(html,/await waitForDailyDisplay\(\(entry.type==='game'\?baseDelay:5000\)-previousIntroDelay\)/);

assert(!dateMarkup.includes('data-action='),'Date interstitial is display-only');
assert.match(html,/function toggleAutoPause\(\)\{\s*if\(!ui\.busy\|\|ui\.dateIntro\)return;/);
assert.match(html,/if\(ui\.dateIntro\)return;\s*if\(ui\.autoDay\.type==='game'\)/);
console.log('PASS: date interstitial has no pause controls or tap-to-pause');

assert.match(html,/\.calendar-date-track\{animation:calendar-date-slide \.95s /);
assert.match(html,/\.calendar-date-track\.fast\{animation-duration:\.4s\}/);
console.log('PASS: calendar scroll and fade duration match the longer display window');

const reelDates=[...dateMarkup.matchAll(/<span>(2028-03-\d\d)<\/span>/g)].map(m=>m[1]);
assert.deepEqual(reelDates,['2028-03-22','2028-03-23','2028-03-24','2028-03-25','2028-03-26','2028-03-27']);
assert.match(dateMarkup,/calendar-date-previous" aria-hidden="true"><span>2028-03-24/);
assert.match(dateMarkup,/calendar-date-current" role="status"><span>2028-03-25/);
assert.match(html,/translateY\(calc\(-1 \* var\(--date-step\)\)\)/);
assert.match(html,/calendar-date-confirm/);
console.log('PASS: full-row civil date reel and fixed center marker');

const evStart=inline[1].indexOf('  function eventIntroInfo(){'),evEnd=inline[1].indexOf('  function ceremonyView(){',evStart);
const eventApi=vm.runInNewContext('(function(){let game={year:2028,day:143,ceremonyStage:"awards-all",pendingCeremonyIntro:"awards-all"};let ui={};'+inline[1].slice(evStart,evEnd)+'\nreturn {game,ui,eventIntroInfo,eventIntroScreen};})()',{h:String});
assert.equal(eventApi.eventIntroInfo().title,'年間表彰式');
assert.match(eventApi.eventIntroScreen(eventApi.eventIntroInfo()),/data-event="awards-all"/);
eventApi.game.pendingMonth={};assert.equal(eventApi.eventIntroInfo(),null);delete eventApi.game.pendingMonth;
eventApi.game.ceremonyStage='camp';eventApi.game.pendingCeremonyIntro='camp';assert.equal(eventApi.eventIntroInfo().year,2029);
eventApi.game.day=0;eventApi.game.year=2029;eventApi.game.pendingCeremonyIntro='opening';assert.equal(eventApi.eventIntroInfo().title,'新シーズン開幕');
eventApi.game.day=1;assert.equal(eventApi.eventIntroInfo(),null);
console.log('PASS: milestone titles, correct season years and pending-report priority');

assert.match(html,/const tone=phase==='camp'\?'spring':'winter';return `<section class="panel ceremony-panel" data-tone="\$\{tone\}"/);
assert.match(html,/\.ceremony-panel\[data-tone="winter"\]\{--event-accent:#9ac8ef\}/);
assert.match(html,/\.ceremony-panel\[data-tone="spring"\]\{--event-accent:#95d7b2\}/);
console.log('PASS: matching seasonal palettes for title and training panels');

// Calendar target dates are inclusive and stop on the requested civil boundary.
const goalStart=inline[1].indexOf('  function calendarGoalFor('),goalEnd=inline[1].indexOf('  function dailyPlaybackControls(',goalStart);
const goalFor=vm.runInNewContext('(function(){'+inline[1].slice(goalStart,goalEnd)+';return calendarGoalFor;})()',{monthKey:s=>s.slice(0,7)});
const civilDays=['2028-03-30','2028-03-31','2028-04-01','2028-04-02','2028-04-03','2028-04-04'].map(date=>({date}));
assert(!html.includes('data-days="weekend"'),'Removed weekend target is not offered');
assert(!html.includes('週末まで進める'));
assert.match(html,/data-days="weekly">週次報告まで/);
assert.match(html,/data-days="month">月次報告まで/);
assert.equal(goalFor('weekly',civilDays,0),5);
assert.equal(goalFor('month',civilDays,0),2);
assert.equal(goalFor('season',civilDays,0),6);
assert.equal(goalFor('date',civilDays,0),1);
const financeStart=inline[1].indexOf('  function closeFinancePeriod('),financeEnd=inline[1].indexOf('  function finalizeMonth(',financeStart);
const financeApi=vm.runInNewContext('(function(){let game={year:2028,day:40,calendarIndex:25,calendar:{days:Array(100),endDate:"2028-09-30"},teams:[{id:1,league:"E",wins:10,cash:1,manager:{salary:1}}]};const myTeam=()=>game.teams[0],rankings=()=>game.teams;'+inline[1].slice(financeStart,financeEnd)+';return {game,closeFinancePeriod,checkFinanceCrisis};})()',{r2:n=>Math.round(n*100)/100,payroll:()=>20});
const fp=financeApi.closeFinancePeriod('2028-04-30');
assert.equal(fp.clubs[1].revenue,2.55);
assert.equal(fp.clubs[1].payroll,5.25);
assert.equal(financeApi.game.teams[0].cash,-1.7);
assert.equal(financeApi.game.financeCrisis.shortfall,1.7);
financeApi.closeFinancePeriod('2028-04-30');
assert.equal(financeApi.game.teams[0].cash,-1.7,'Monthly settlement is idempotent');
assert.match(html,/const uninterruptedSeason=skip&&kind==='season'/);
assert.match(html,/if\(game\.financeCrisis\)break;/);
console.log('PASS: calendar targets, monthly cash settlement, no duplicate charge and cash crisis');

const weeklyStart=inline[1].indexOf('  function isWeeklyEdition('),weeklyEnd=inline[1].indexOf('  function buildDailyNews(',weeklyStart);
const weeklyApi=vm.runInNewContext('(function(){'+inline[1].slice(weeklyStart,weeklyEnd)+';return {isWeeklyEdition,buildWeeklySummary};})()',{
  game:{year:2028,calendar:{days:[{type:'game',gameNo:1,date:'2028-04-02'}]},teams:[{id:1,name:'自球団',short:'自',league:'E',wins:1,losses:0,ties:0},{id:2,name:'相手',short:'相',league:'W',wins:0,losses:1,ties:0}],games:[{year:2028,day:1,home:1,away:2,homeScore:4,awayScore:2,box:{bat:[{id:10,teamId:1,ab:4,h:2,hr:1,rbi:3}],pitch:[{id:11,teamId:1,outs:27,er:2,k:8,w:1}]}},{year:2028,day:2,date:'2028-04-03',home:2,away:1,homeScore:20,awayScore:0}]},
  calendarOffsetDate:(d,n)=>new Date(Date.parse(d)+n*86400000).toISOString().slice(0,10),
  myTeam:()=>({id:1,name:'自球団'}),getTeam:id=>({short:id===2?'相':'自'}),getPlayer:id=>({name:'選手'+id}),
  rankings:l=>l==='E'?[{id:1,short:'自',wins:1,losses:0,ties:0}]:[{id:2,short:'相',wins:0,losses:1,ties:0}]
});
assert(weeklyApi.isWeeklyEdition('2028-04-03'));
assert(!weeklyApi.isWeeklyEdition('2028-04-02'));
const weekly=weeklyApi.buildWeeklySummary({date:'2028-04-03'});
assert.equal(weekly.gameCount,1);assert.equal(weekly.record.w,1);assert.equal(weekly.record.rs,4);
assert.equal(weekly.hitter.rbi,3);assert.equal(weekly.pitcher.outs,27);
assert.equal(weekly.leagues.W[0].week.l,1);assert.equal(weekly.scores[0].opponent,'相');
assert.match(html,/function newsArchiveScreen\(/);
console.log('PASS: weekly date range, real match statistics and newspaper archive');

assert(!/#DE58BB/i.test(html),'Former magenta rank A color must not appear in the app');
console.log('PASS: warm pink rank A; reserved PARALLEL purple unchanged');

const streakStart=inline[1].indexOf('  function matchStreak('),streakEnd=inline[1].indexOf('  function collectMilestoneNews(',streakStart);
const streakFn=vm.runInNewContext('(function(){'+inline[1].slice(streakStart,streakEnd)+';return matchStreak;})()');
const losses=Array.from({length:4},()=>({home:1,away:2,homeScore:0,awayScore:3}));
assert.equal(streakFn(losses,1).count,4);assert.equal(streakFn(losses,1).result,'loss');
assert.equal(streakFn([...losses,{home:1,away:2,homeScore:1,awayScore:1}],1).count,0);
assert.equal(streakFn([...losses,{home:2,away:1,homeScore:0,awayScore:3}],1).result,'win');
assert.match(html,/if\(oneDay\|\|game\.pendingMonth\|\|\(!skip&&freshNews\.length\)\)break;/);
console.log('PASS: streak counting, ties, home/away and skip-compatible news');

assert.match(html,/function deskTask\(priority,icon,title,description,attrs\)/);
assert.match(html,/assets\/scenes\/home-ballpark\.svg/);
assert.match(html,/assets\/scenes\/front-office\.svg/);
assert.match(html,/padding-box,linear-gradient\(135deg,var\(--duty-edge\)/);
console.log('PASS: location-based clubhouse and semantic duty cards');

assert.match(html,/function meetingPageIndex\(/);
assert.match(html,/meetingPageIndex\(\)!==4/);
assert.match(html,/data-meeting-paper/);
assert.match(html,/function weeklyMailView\(/);
assert.match(html,/data-action="mgr-enter"/);
assert.match(html,/PENNANT OFFICE · 財務管理/);
console.log('PASS: meeting page guard and distinct office media');

for(const outcome of ['win','loss','draw'])assert(html.includes('data-outcome="'+outcome+'"'));
assert.match(html,/meeting-flap\{[^}]*width:50%/);
assert.match(html,/\[data-turn="forward"\]>\.meeting-fixed\{clip-path:inset\(0 50% 0 0\)/);
assert.match(html,/\[data-turn="back"\]>\.meeting-fixed\{clip-path:inset\(0 0 0 50%\)/);
assert.match(html,/\[data-turn="forward"\]>\.meeting-flap\{left:50%;perspective-origin:left center/);
assert.match(html,/\[data-turn="back"\]>\.meeting-flap\{left:0;perspective-origin:right center/);
assert.match(html,/animation:meeting-fixed-release 1\.2s/);
assert(!html.includes('animation:paper-turn '),'Full sheet must no longer rotate');
assert.match(html,/try\{render\(\);\}finally\{ui\.meetingTurn=null;\}/);
console.log('PASS: three result palettes and independent directional half-sheet turns');

const curlStart=inline[1].indexOf('  function meetingCurlStrips('),curlEnd=inline[1].indexOf('  function monthlyReviewScreen(',curlStart);
const curl=vm.runInNewContext('(function(){'+inline[1].slice(curlStart,curlEnd)+';return meetingCurlStrips;})()');
for(const dir of ['forward','back']){
  const markup=curl('test',dir);
  assert.equal((markup.match(/class="meeting-curl-strip"/g)||[]).length,10);
  assert(markup.includes('left:'+(dir==='forward'?0:90)+'%;animation-name:meeting-curl-0'));
  assert(markup.includes('style="left:'+(dir==='forward'?-1000:-900)+'%">test'));
}
assert.match(html,/\.meeting-paper \.meeting-medical-row>\.face-mini\{width:44px;height:44px;min-width:44px;max-width:44px/);
assert.match(html,/\.meeting-row>span:first-child:not\(\.face-mini\)/);
assert.match(html,/class="meeting-row meeting-match-row meeting-table-head"/);
assert.match(html,/class="meeting-row meeting-change-row meeting-table-head"/);
assert.match(html,/@keyframes meeting-curl-9/);
console.log('PASS: curved ten-strip page turns, fixed medical portraits and report columns');

// Cover's centered contents must not inherit the strip paper's zero min-height.
assert.match(html,/\.meeting-paper\{--meeting-sheet-min:clamp\(410px,57vh,650px\);[^}]*min-height:var\(--meeting-sheet-min\)/);
assert.match(html,/\.meeting-cover\{display:flex;min-height:var\(--meeting-sheet-min\)/);
assert.doesNotMatch(html,/\.meeting-cover\{[^}]*min-height:inherit/);
assert.match(html,/\.meeting-curl-strip>\.meeting-paper\{[^}]*min-height:0/);
console.log('PASS: cover shares intrinsic layout height across fixed and curved layers');

{
const careerStart=inline[1].indexOf('  function careerRows('),careerEnd=inline[1].indexOf('  function careerTitles(',careerStart);
const careerApi=vm.runInNewContext('(function(){'+inline[1].slice(careerStart,careerEnd)+';return {careerRows,careerTotals,careerRate,careerInnings,careerCrossings};})()',{newStats:p=>p?{g:0,outs:0,er:0,w:0,k:0,sv:0}:{g:0,ab:0,h:0,hr:0,rbi:0,sb:0}});
const cp={teamId:1,seasonHistory:[{year:2027,stats:{g:100,ab:400,h:120,hr:10}},{year:2027,stats:{g:100,ab:400,h:120,hr:10}}],stats:{g:20,ab:50,h:10,hr:2}};
const ct=careerApi.careerTotals(careerApi.careerRows(cp,2028),false);
assert.equal(ct.h,130);assert.equal(ct.ab,450);assert.equal(careerApi.careerRate(ct,false),'.289');
cp.teamId=-1;assert.equal(careerApi.careerTotals(careerApi.careerRows(cp,2028),false).h,120);
assert.equal(careerApi.careerRows(cp,2028).length,1);
cp.teamId=1;cp.seasonHistory.push({year:2028,stats:cp.stats});assert.equal(careerApi.careerTotals(careerApi.careerRows(cp,2028),false).h,130);
const pt=careerApi.careerTotals([{stats:{outs:300,er:30}},{stats:{outs:2,er:1}}],true);
assert.equal(careerApi.careerRate(pt,true),'2.77');assert.equal(careerApi.careerInnings(pt.outs),'100.2');
assert.equal(careerApi.careerCrossings({h:1001},{h:2},false)[0][1],1000);
assert.equal(careerApi.careerCrossings({h:1001},{h:1},false).length,0);
console.log('PASS: career totals, weighted rates, retired players and threshold crossing');

}

{
const start=inline[1].indexOf('  function detectGameFeats('),end=inline[1].indexOf('  let recordHistoryCache=',start);
const detect=vm.runInNewContext('(function(){'+inline[1].slice(start,end)+';return detectGameFeats;})()');
const game={home:1,away:2,homeScore:1,awayScore:0};
assert.equal(detect(game,[{id:7,teamId:1,h:4,hr:1,doubles:1,triples:1}],[{id:8,teamId:1,g:1,outs:27,h:0,bb:0,bf:27}]).map(x=>x.featKey).join(','),'cycle,perfect');
assert.equal(detect(game,[],[{id:8,teamId:1,g:1,outs:27,h:0,bb:1,bf:28}])[0].featKey,'nohit');
assert.equal(detect(game,[],[{id:8,teamId:1,g:1,outs:27,h:0,bb:0,bf:27},{id:9,teamId:1,g:1,outs:1,h:0,bb:0,bf:1}]).length,0);
assert.equal(detect({...game,awayScore:1},[],[{id:8,teamId:1,g:1,outs:27,h:0,bb:3,bf:30}]).length,0);
assert.match(html,/data-action="book-mode"/);assert.match(html,/function recordRankRows/);
assert.match(html,/function recordBreakingEvents/);assert.match(html,/function preserveNoHitStart/);
assert.match(html,/p\.stats\.fieldQuality/);
console.log('PASS: actual-game special feats, record book and fielding contribution');
}

{
const a=inline[1].indexOf('  function careerRows('),b=inline[1].indexOf('  function recordBookScreen(',a);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+';return {recordRankRows,recordValue,recordEligible};})()',{newStats:()=>({g:0,pa:0,ab:0,h:0,bb:0,hr:0,doubles:0,triples:0}),isPitch:()=>false,getTeam:id=>({league:id<6?'E':'W'})});
const players=[{id:1,teamId:-1,seasonHistory:[{year:2027,teamId:1,stats:{g:100,pa:450,ab:400,h:100,bb:50,hr:20}},{year:2028,teamId:7,stats:{g:100,pa:450,ab:400,h:150,bb:50,hr:30}}]},{id:2,teamId:2,seasonHistory:[],stats:{g:100,pa:450,ab:400,h:140,bb:50,hr:25}}];
assert.equal(api.recordRankRows(players,2029,'career','h')[0].value,250);
assert.equal(api.recordRankRows(players,2029,'career','h','E')[0].p.id,2);
assert.equal(api.recordRankRows(players,2029,'season','h','W','2028')[0].value,150);
assert.equal(api.recordRankRows(players,2029,'season','h','all','2027').length,1);
assert.equal(api.recordEligible({g:143,pa:442,ab:400,h:150},'avg'),false);
assert.equal(api.recordEligible({g:143,pa:443,ab:400,h:150},'avg'),true);
console.log('PASS: historical ranking filters, retired players and qualification');
}

{
const start=inline[1].indexOf('  const SPECIAL_PLAYER_THEMES='),end=inline[1].indexOf('  function playerTitleTheme(',start);
const api=vm.runInNewContext('(function(){'+inline[1].slice(start,end)+';return {achievementTheme,achievementAttrs,achievementKey,SPECIAL_PLAYER_THEMES};})()',{h:String});
for(const [key,category] of [['nohit','LEGEND'],['perfect','RINNE']]){
  const theme=api.achievementTheme(key),special=api.SPECIAL_PLAYER_THEMES[category];
  assert.equal(theme.ring,special.ring);assert.equal(theme.accent,special.accent);
}
const keys=['三冠王','投手三冠','cycle','record'];
const reserved=Object.values(api.SPECIAL_PLAYER_THEMES).flatMap(x=>[x.ring,x.accent]);
assert.equal(new Set(keys.map(k=>api.achievementTheme(k).ring)).size,4);
for(const k of keys){assert(!reserved.includes(api.achievementTheme(k).ring));assert(api.achievementAttrs(k).includes('data-achievement="'+k+'"'));}
assert.equal(api.achievementKey({recordKey:'career:bat:h'}),'record');
assert.equal(api.achievementAttrs(null),'');
assert.equal(api.achievementTheme('本塁打王'),null);
console.log('PASS: distinct achievement palettes and exact LEGEND/RINNE color pairing');
}

{
const a=inline[1].indexOf('  function detectGameFeats('),b=inline[1].indexOf('  let recordHistoryCache=',a);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+';return {detectGameFeats,seasonFeats,compoundTitles};})()');
const game={home:1,away:2,homeScore:10,awayScore:2};
assert.equal(api.detectGameFeats(game,[{id:1,teamId:1,h:5,hr:3,rbi:8}], [{id:2,teamId:1,k:15,g:1,outs:21}]).map(x=>x.featKey).join(','),'game3hr,game5hit,game8rbi,game15k');
assert.equal(api.detectGameFeats(game,[{id:1,teamId:1,h:4,hr:2,rbi:7}], [{id:2,teamId:1,k:14,g:1,outs:21}]).length,0);
assert.equal(api.seasonFeats({id:1,teamId:1,stats:{pa:500,ab:450,h:150,hr:40,sb:40}},false).map(x=>x.featKey).join(','),'fortyforty,triplethree');
assert.equal(api.seasonFeats({id:1,teamId:1,stats:{pa:442,ab:400,h:130,hr:30,sb:30}},false).map(x=>x.featKey).join(','),'thirtythirty');
assert.equal(api.seasonFeats({id:2,teamId:1,stats:{w:20,k:200}},true).map(x=>x.featKey).join(','),'season20w,season200k');
assert.equal(api.compoundTitles(['首位打者','本塁打王'],false).join(','),'二冠王');
assert.equal(api.compoundTitles(['首位打者','本塁打王','打点王','最多安打','盗塁王','最高出塁率'],false).join(','),'三冠王,打撃全六冠');
assert.equal(api.compoundTitles(['最多勝','最多奪三振'],true).join(','),'投手二冠');
console.log('PASS: additional special game records, season achievements and compound crowns');
}

{
const a=inline[1].indexOf('  function snapshotAbilities('),b=inline[1].indexOf('  function captureSeason(',a);
const routeStart=inline[1].indexOf('  function legacyOriginMarket('),routeEnd=inline[1].indexOf('  function legacySeasonValue(',routeStart);
const api=vm.runInNewContext('(function(){'+inline[1].slice(routeStart,routeEnd)+inline[1].slice(a,b)+';return {recordAbilityPeak,peakSnapshots,abilityEvidence,bestAbilitySnapshot,captureRetirement,migrateRetirement};})()',{isPitch:p=>p.pos==='SP',rating:p=>Math.round((p.contact+p.power+p.speed+p.defense+p.arm)/5),getTeam:()=>({name:'Test Club'})});
const p={id:1,teamId:2,pos:'OF',age:25,contact:90,power:89,speed:90,defense:90,arm:90,talent:90};
api.recordAbilityPeak(p,2027,'2027-05-01','game-day');
p.contact=89;p.power=90;api.recordAbilityPeak(p,2027,'2027-05-02','game-day');
assert.equal(p.peakHistory[0].allS,null);
p.contact=90;api.recordAbilityPeak(p,2027,'2027-05-03','game-day');
assert.equal(p.peakHistory[0].allS.date,'2027-05-03');
assert.equal(api.abilityEvidence(p.peakHistory[0].allS,false,90),true);
assert.equal(api.abilityEvidence(p.peakHistory[0].allS,false,100),false);
api.captureRetirement(p,2037,35);p.teamId=-1;api.captureRetirement(p,2038,36);
assert.equal(p.retirement.year,2037);assert.equal(p.retirement.teamId,2);assert.equal(p.retirement.age,35);
const old={id:2,teamId:-1,pos:'OF',seasonHistory:[{year:2031,teamId:3}]};
api.migrateRetirement(old);assert.equal(old.retirement.year,null);assert.equal(old.retirement.lastRecordedYear,2031);
console.log('PASS: retirement identity, same-instant peak evidence and honest legacy migration');
}

{
const a=inline[1].indexOf('  function legacyOriginMarket('),b=inline[1].indexOf('  function refreshLegacyArchive(',a);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+';return {legacyOriginMarket,legacyPeerScores,legacyScore,legacyMajorRecord,legacyQualification,legacyTierPools};})()');
assert.equal(api.legacyOriginMarket({originMarket:'foreign'}),'foreign');
assert.equal(api.legacyOriginMarket({retirement:{originMarket:'foreign'}}),'foreign');
assert.equal(api.legacyOriginMarket({teamId:4}),'domestic');
const rows=Array.from({length:6},(_,i)=>({id:i+1,pos:'OF',teamId:i===0?-1:4,seasonHistory:[{year:2027,stats:{g:143,pa:500,h:100+i*20}}]}));
const peers=api.legacyPeerScores(rows,2028);
assert.equal(peers.get(1)[0].score,0);assert.equal(peers.get(6)[0].score,100);
assert.equal(api.legacyQualification({allSS:true},false).tier,'RINNE');
assert.equal(api.legacyQualification({multiCrown:true},false).tier,'REBIRTH');
assert.equal(api.legacyQualification({},true).tier,'RETURN');
for(const [category,tier] of [['PARALLEL','PARADOX'],['STAR','SUPERNOVA'],['LEGEND','MYTH']]){
  assert.equal(api.legacyQualification({specialCategory:category,multiCrown:true},false).tier,tier);
  assert.equal(api.legacyQualification({specialCategory:category,allSS:true},false).tier,'RINNE');
  assert.equal(api.legacyQualification({specialCategory:category},false).tier,null);
  assert.equal(api.legacyQualification({specialCategory:category},true).tier,'RETURN');
}
assert.equal(api.legacyQualification({specialCategory:'IMMORTAL',allSS:true},false).tier,'RINNE');
assert.equal(api.legacyQualification({specialCategory:'IMMORTAL',multiCrown:true},false).tier,'REBIRTH');
assert.equal(api.legacyQualification({},false).tier,null);
assert.equal(api.legacyMajorRecord({year:2027,recordKey:'season:bat:hr'},[{year:2027,stats:{hr:50}}]),true);
assert.equal(api.legacyMajorRecord({year:2027,recordKey:'season:bat:hr'},[{year:2027,stats:{hr:49}}]),false);
const pool=[{playerId:1,eligibleFrom:2028,tier:'RETURN',route:'draft'},{playerId:2,eligibleFrom:2028,tier:'RINNE',route:'foreign'},{playerId:3,eligibleFrom:2029,tier:'REBIRTH',route:'foreign'}];
assert.equal(api.legacyTierPools(pool,2028).length,2);assert.equal(api.legacyTierPools(pool,2028,'foreign')[0].playerId,2);
assert.equal(api.legacyTierPools(pool,2028,'draft')[0].playerId,1);
assert.equal(api.legacyTierPools(pool,2027).length,0);
assert.equal(api.legacyScore([],[],[],null).score,0);
assert(api.legacyScore(Array.from({length:10},()=>({score:100})),[],[],100).score<=100);
console.log('PASS: role-normalized legacy evaluation, retirement eligibility and independent foreign market route');
}

assert.match(html,/data-rank="SS"/);
assert.match(html,/data-ach-lustre="mythic"/);
assert.match(html,/prefers-reduced-motion:reduce/);
assert.match(html,/function lustrePreview\(/);
console.log('PASS: lustre and reduced-motion presentation hooks');

assert.match(html,/@keyframes astral-spin/);
assert.match(html,/@keyframes desk-beacon/);
assert.match(html,/legacyArchive=\{version:3/);
console.log('PASS: astral motion hooks and legacy cache migration');

{
const a=inline[1].indexOf('  function consolidateRecordEvents('),b=inline[1].indexOf('  function editionHeading(',a);
const c=inline[1].indexOf('  function awardEditionPages('),d=inline[1].indexOf('  function ceremonyPages(',c);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+inline[1].slice(c,d)+';return {consolidateRecordEvents,milestonePages,awardEditionPages};})()');
const events=[{id:'a',year:2028,day:1,recordKey:'career:pitch:outs',playerId:1,recordOld:'190.0',recordPreviousName:'Former'},{id:'b',year:2028,day:2,recordKey:'career:pitch:outs',playerId:2},{id:'c',year:2028,day:3,recordKey:'career:pitch:outs',playerId:1},{id:'d',year:2028,day:4,featKey:'perfect'}];
const list=api.consolidateRecordEvents(events);
assert.equal(list.length,2);assert.equal(list.find(e=>e.recordKey).id,'c');assert.equal(list.find(e=>e.recordKey).updateCount,3);assert.equal(list.find(e=>e.recordKey).recordOld,'190.0');assert.equal(events.length,4);
assert.equal(api.milestonePages(events).map(p=>p.title).join(','),'最高難度記録,歴代記録更新');
const awards=[{league:'E',title:'本塁打王'},{league:'E',title:'最多勝'},{league:'W',title:'守備名手賞（一塁）'},{league:'W',title:'ベストナイン（二塁）'},{league:'W',title:'三冠王'}];
const pages=api.awardEditionPages(awards,events,false);
assert.equal(pages.flatMap(p=>p.items).length,6);
assert.equal(pages.map(p=>p.title).join(','),'最高難度記録 特別表彰,複合タイトル特別表彰,東リーグ · 野手部門,東リーグ · 投手部門,西リーグ · 守備名手賞（GG）,西リーグ · ベストナイン');
const many=Array.from({length:9},(_,i)=>({league:'E',title:'ベストナイン（外野）',playerId:i}));
const nine=api.awardEditionPages(many,[],false);
assert.equal(nine.length,1);assert.equal(nine[0].items.length,9);
const gg=api.awardEditionPages(many.map(a=>({...a,title:'守備名手賞（外野）'})),[],false);
assert.equal(gg.length,1);assert.equal(gg[0].items.length,9);
const manyFeats=Array.from({length:20},(_,i)=>({id:String(i),day:i,featKey:'game5hit'}));
assert.equal(api.milestonePages(manyFeats).length,1);
assert.equal(api.milestonePages(manyFeats)[0].items.length,20);
console.log('PASS: rarity-first edition index, all B9/GG on single pages, consolidated records');
}

assert.match(html,/function editionExitModal\(/);
assert.match(html,/role="alertdialog"/);
assert.match(html,/edition-exit-confirm/);
assert.match(html,/edition-exit-cancel/);
assert.match(html,/\.edition-compact-row \.record-player-info b\{font-size:18px/);
console.log('PASS: enlarged edition typography and exit confirmation hooks');

assert.match(html,/--own-club-color:#ff6666/);
assert.match(html,/\.league-box\.league-east \.stand-line\.mine/);
assert.match(html,/data-own-club=/);
console.log('PASS: independent red club emphasis and 1.3x edition typography');

assert.match(html,/function clubThemeStyle\(/);
assert.match(html,/function clubIdentityEditor\(/);
assert.match(html,/data-action="club-settings-save"/);
assert.match(html,/data-shape=/);
console.log('PASS: editable club identity and contextual color hooks');

assert.match(html,/position:sticky;top:var\(--club-preview-top,8px\)/);
assert.match(html,/function refreshClubEditor\(/);
assert.match(html,/syncClubPreviewOffset\(\)/);
console.log('PASS: scroll-following club preview and in-place design refresh');

{
const a=inline[1].indexOf('  const LEGACY_FEAT_POINTS'),b=inline[1].indexOf('  function legacyMajorRecord(',a);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+';return {legacyScore,legacyRecordNumber,legacyRecordEvidence};})()');
const score=(titles=[],feats=[],year=2027)=>api.legacyScore([],titles,feats,null,year);
const perfect={id:'p',year:2037,featKey:'perfect'},nohit={id:'n',year:2037,featKey:'nohit'};
assert.equal(score([],[perfect]).parts.achievements,12);
assert.equal(score([],[nohit]).parts.achievements,7);
assert.equal(score([],[perfect,perfect]).parts.achievements,12);
assert.equal(score([{year:2037,title:'打撃全六冠'},{year:2037,title:'三冠王'}],[{year:2037,featKey:'打撃全六冠'}]).parts.achievements,15);
assert.equal(score([{year:2037,title:'打撃全六冠'}],[]).parts.awards,0);
const record={year:2037,recordKey:'career:bat:hr',recordOld:'500',stat:'550'};
assert.equal(score([],[record]).parts.records,6);
assert.equal(score([],[record,record]).parts.records,6);
assert.equal(score([],[record]).parts.achievements,0);
assert(score([],[{...record,year:2028}]).parts.records<score([],[record]).parts.records);
assert.equal(api.legacyRecordNumber('194.2','outs'),584);
assert.equal(api.legacyRecordEvidence([{year:2028,recordKey:'career:bat:hr'},{year:2038,recordKey:'career:bat:hr'}])[1].recordAge,10);
assert.equal(score([],[{year:2037,recordKey:'season:pitch:era',recordOld:'2.00',stat:'1.80'}]).parts.records,5);
const result=api.legacyScore(Array.from({length:10},()=>({score:100})),Array.from({length:20},(_,i)=>({year:i,title:'MVP'})),[perfect,nohit,...['hr','h','rbi','sb'].map(metric=>({...record,recordKey:'career:bat:'+metric}))],100,2027);
assert.equal(result.score,100);
assert.equal(Object.keys(result.parts).length,6);
console.log('PASS: six-part scoring, rarity weights, duplicate control and historic record value');
}

{
const a=inline[1].indexOf('  function decadePeriods('),b=inline[1].indexOf('  function decadePlayerLeaders(',a);
const c=inline[1].indexOf('  function decadeAwards('),d=inline[1].indexOf('  function decadeReport(',c);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+inline[1].slice(c,d)+';return {decadePeriods,decadeDue,decadeTeams,decadeAwards};})()');
const seasons=Array.from({length:20},(_,i)=>({year:2027+i,standings:{E:[{id:1,name:'A',rank:1,wins:80,losses:60,ties:3}],W:[{id:2,name:'B',rank:1,wins:70,losses:70,ties:3}]},postseason:{championId:i%2?2:1},awards:[{playerId:7,title:'MVP',league:'E',teamId:1}]}));
assert(!api.decadeDue(seasons.slice(0,9),2035));
assert(api.decadeDue(seasons.slice(0,10),2036));
assert(api.decadeDue(seasons,2046));
assert(!api.decadeDue(seasons.filter(s=>s.year!==2030),2036));
assert.equal(api.decadePeriods(seasons).length,2);
const r=api.decadeTeams(seasons,2027,2036);
assert.equal(r.teams[0].championships,5);assert.equal(r.teams[0].wins,800);assert.equal(r.teams[0].best,10);
assert.equal(r.timeline.length,10);
assert.equal(api.decadeAwards(r.seasons)[0].mvp,10);
assert.equal(api.decadeTeams(seasons.filter(s=>s.year!==2030),2027,2036).teams[0].best,6);
console.log('PASS: fixed decade windows, championship counts, streak gaps and award totals');
}

{
const a=inline[1].indexOf('  function draftHash('),b=inline[1].indexOf('  function draftScoutProfile(',a);
const api=vm.runInNewContext('(function(){'+inline[1].slice(a,b)+';return {draftHash};})()');
assert.equal(api.draftHash(2027,1,2,'lottery'),api.draftHash(2027,1,2,'lottery'));
assert(api.draftHash(2027,1,2,'lottery')>=0&&api.draftHash(2027,1,2,'lottery')<1);
assert.match(html,/function draftFirst\(/);assert.match(html,/function draftOfferResponse\(/);assert.match(html,/function draftRegisterNextSeason\(/);
console.log('PASS: deterministic draft lottery and recruitment hooks');
}


{
const a=inline[1].indexOf('  const RECRUIT_VALUES='),b=inline[1].indexOf('  function draftReport(',a);
const c=inline[1].indexOf('  function draftOffer('),d=inline[1].indexOf('  function draftNegotiateCPU(',c);
const api=vm.runInNewContext('(function(){const t={id:1,cash:10,wins:90,losses:50},r2=n=>Math.round(n*100)/100,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),draftHash=()=>.5,getTeam=()=>t,own=()=>[],draftCandidate=(d,id)=>d.candidates.find(c=>c.id===id);'+inline[1].slice(a,b)+inline[1].slice(c,d)+';return {t,recruitmentProfile,recruitmentInitial,recruitmentReaction,draftReply,draftOfferResponse,draftScoutCost};})()');
const profile=api.recruitmentProfile('a','育成',false,null);
const c1={id:1,player:{pos:'SP'},type:'高校生',preferredTeam:1,preference:'育成',strength:3,threshold:43,overseas:false,status:'rights',personality:profile};
const row={teamId:1,candidateId:1,status:'rights'},draft={year:2027,candidates:[c1]};
assert(!api.draftOfferResponse(draft,row,1,'develop'));
for(const key of profile.preferred)assert(api.draftReply(draft,row,key));
assert(!api.draftReply(draft,row,'growth'));assert(api.draftOfferResponse(draft,row,1,'develop'));assert.equal(row.status,'signed');assert.equal(api.t.cash,9.84);
assert(!api.draftOfferResponse(draft,row,1,'develop'));assert.equal(api.t.cash,9.84);
const c2={...c1,id:2,threshold:69,overseas:true,status:'rights'},bad={teamId:1,candidateId:2,status:'rights',conversation:{context:{},interest:15,answers:[{}, {}, {}]}};draft.candidates.push(c2);
assert(api.draftOfferResponse(draft,bad,2,'develop'));assert.equal(bad.status,'refused');assert.equal(api.t.cash,9.84);
assert(api.recruitmentInitial({priorities:['winning']},{winning:20},1,false)>api.recruitmentInitial({priorities:['winning']},{winning:-20},1,false));
assert(api.recruitmentReaction(profile,{},0,profile.preferred[0])>api.recruitmentReaction(profile,{},0,'winning'));
assert(api.draftScoutCost(4)>api.draftScoutCost(2));
console.log('PASS: shared conversation, club fit, acceptance, refusal, fee safety and scout costs');
}
