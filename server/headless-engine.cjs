// LIMITED staging pilot: run the checked-in actual game engine before its DOM
// startup marker. Not a general browser emulator or a complete game service.
// No user source, imported snapshot or arbitrary command is accepted. The
// Node VM provides bounded execution, NOT a security sandbox for untrusted JS.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{randomInt,createHash}=require('node:crypto');
function createHeadlessEngine(){
 const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1],marker="  const appRoot=document.querySelector('#app');";
 if(!inline||inline.split(marker).length!==2)throw Error('game source startup marker changed');
 let source=inline.slice(0,inline.indexOf(marker));
 const seedAnchor='((Date.now()^0x53e719f1)>>>0)||1937';
 if(source.split(seedAnchor).length!==2||!source.includes('(() => {'))throw Error('game seed/closure anchor changed');
 source=source.replace(seedAnchor,'SERVER_SEED');
 const hash=createHash('sha256').update(source).digest('hex');
 const pre=`const document={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}};
 const window={addEventListener(){},scrollTo(){}},localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 const setTimeout=()=>0,clearTimeout=()=>{};
 `;
 const tail=`
 save=()=>true;render=()=>{};showToast=()=>{};ui.page='game';ui.tab='business';ui.businessSub='care';
 const input=JSON.parse(SERVER_INPUT),op=input.op;
 if(op==='new'){
  buildFresh();game.started=true;game.clubLogoSeed=SERVER_SEED;
  // buildFresh consumes the PRNG; preserve the post-generation cursor.
  if(input.team!==undefined){const former=myTeam(),target=getTeam(input.team),nextFans=clubFanCount(target);former.fans=clubFanCount(former);game.selectedId=input.team;game.fans=nextFans;}
  ensureGameExtras();
  if(input.identity){const t=myTeam();ui.clubDraft={...input.identity,slot:activeSlot,id:t.id};applyIdentity(t);}
  game.ceremonyStage=null;game.calendarFlow=null;game.pendingCeremonyIntro=null;
  return JSON.stringify(game);
 }
 game=input.state;ensureGameExtras();
 const team=myTeam();
 // A single trusted undo entry, never populated from a client command.
 // Any successful unrelated mutation (including reward application) invalidates it.
 const rosterEdit=op==='club'&&(['lineup','fielding','lineup-recommend','lineup-move','lineup-replace'].includes(input.choice)||input.choice==='order'&&input.kind==='lineup');
 const rosterUndo=op==='club'&&input.choice==='lineup-undo';
 if(!['view','actions','achievements','free-page','player-page'].includes(op)&&!rosterUndo)delete game.canonicalRosterUndo;
 const undoAvailable=()=>{
  const u=game.canonicalRosterUndo,b=u?.before;
  return !!(u&&u.team===team.id&&u.year===game.year&&u.day===game.day&&u.after===roster190Fingerprint(team)&&b&&Array.isArray(b.lineup)&&b.lineup.length<=9&&b.fieldingRoles&&new Set(b.lineup).size===b.lineup.length&&Object.keys(b.fieldingRoles).length===b.lineup.length&&new Set(Object.values(b.fieldingRoles)).size===b.lineup.length&&b.lineup.every(id=>FIELD_POSITIONS.includes(b.fieldingRoles[id])&&firstHitters(team).some(p=>p.id===id&&availableForGame(p))));
 };
 // JSON persistence loses the browser's shared job/desk object reference.
 const restoredFlow=flowGet();if(restoredFlow?.active&&restoredFlow.jobs[restoredFlow.active]?.state)game.offseasonDesk=restoredFlow.jobs[restoredFlow.active].state;
 const injuryNotice=()=>{const e=game.pendingEvent;return e?.type==='injury'&&e.teamId===team.id&&Number.isSafeInteger(e.playerId)&&typeof e.date==='string'?e:null;};
 const careerNotice=()=>{const e=careerCurrentEvent(),p=e&&getPlayer(e.id),q=p?.retirePlan;return e&&p&&q?.year===game.year&&q.teamId===team.id?{e,p,q}:null;};
 const rareInbox=e=>{
  if(!e)return null;
  const p=getPlayer(e.playerId),prospect=['foreign-discovery','tournament'].includes(e.kind)||String(e.id).includes(':tournament:')||String(e.id).includes(':university:');
  const known=!!p&&!prospect&&!game.pendingDraftReveal&&!flowForeignResponse()&&rareCinemaKnown(p);
  return {eventKey:e.id,year:e.year,date:e.date,category:e.category,hidden:!known,title:known?e.title:null,body:known?e.body:null,player:known?{id:p.id,name:p.name,pos:p.pos,age:p.age,teamId:p.teamId,specialCategory:p.specialCategory||null,originCategory:p.originCategory||null,appearanceSeed:p.appearanceSeed??null,pastLifeAppearance:p.pastLifeAppearance||null}:null};
 };
 const inbox=()=>{
  const injury=injuryNotice(),rare=pendingRareNews()[0],career=careerNotice();
  const review=game.pendingReview,g=review&&game.games.find(x=>x.id===review.gameId&&x.year===review.year);
  const crisis=game.financeCrisis,monthly=game.pendingMonth&&game.monthlyArchive?.find(m=>m.year===game.pendingMonth.year&&m.id===game.pendingMonth.id&&m.teamId===team.id),milestones=archivedMilestones()?(game.milestoneNews||[]).filter(m=>game.pendingMilestoneIds.includes(m.id)):[];
  return {monthly:monthly?{month:monthly.month,date:monthly.date,wins:monthly.wins,losses:monthly.losses,ties:monthly.ties,cash:monthly.cashAtClose,finance:monthly.actualFinance?{revenue:monthly.actualFinance.revenue,payroll:monthly.actualFinance.payroll,net:monthly.actualFinance.net}:null,matches:(monthly.matches||[]).map(m=>({date:m.date,opponent:m.opponent,rs:m.rs,ra:m.ra}))}:null,milestones:milestones.slice(0,80).map(m=>({title:m.title,date:m.date})),milestoneCount:milestones.length,review:g?{gameId:String(g.id),date:g.date,home:g.home,away:g.away,homeScore:g.homeScore,awayScore:g.awayScore}:null,
   finance:crisis&&crisis.teamId===team.id?{year:crisis.year,date:crisis.date,shortfall:crisis.shortfall,status:crisis.status,loanAvailable:false}:null,injury:injury?{eventKey:String(injury.playerId)+':'+injury.date,playerId:injury.playerId,date:injury.date,days:injury.days}:null,
   rare:rareInbox(rare),
   rookie:game.pendingDraftReveal?{year:game.pendingDraftReveal.year,entries:game.pendingDraftReveal.entries.map(r=>{const p=getPlayer(r.id),stage=r.revealed?2:r.revealStage||0;const hidden=!!p&&secretProspect(p)&&stage!==2;return {id:r.id,name:hidden?'????':p?.name,pos:p?.pos,stage,hidden,specialCategory:p?.specialCategory||null,originCategory:p?.originCategory||null,appearanceSeed:stage===2?p?.appearanceSeed:null,age:stage===2?p?.age:null,pastLifeAppearance:stage===2?p?.pastLifeAppearance||null:null,abilities:stage===2&&p?Object.fromEntries(seasonSkillKeys(p).map(k=>[k,p[k]])):null};})}:null,
   decade:game.pendingDecade??null,opening:game.pendingCeremonyIntro==='opening',
   career:career?{playerId:career.p.id,stage:career.e.type,options:['consult','plan'].includes(career.e.type)?farewellChoices(career.p).map(([key,label,cost])=>({key,label,cost})):[]}:null};
 };
 const canManage=()=>team.cash>=0&&!game.financeCrisis&&!flowInbox()&&!game.pendingMonth&&!game.pendingReview&&!pendingMilestoneNews().length&&!flowForeignResponse()&&!game.ceremonyStage&&!flowGet()?.active&&game.pendingCeremonyIntro!=='opening';
 const canStep=()=>!!calendarNextDay()&&game.day<143&&!game.financeCrisis&&!flowGet()&&game.pendingCeremonyIntro!=='opening'&&!game.pendingDraftReveal&&game.pendingDecade==null&&!pendingRareNews().length&&!game.pendingMilestoneIds?.length&&!game.pendingEvent&&!game.pendingMonth&&!game.pendingReview&&!careerEventPending()&&!flowForeignResponse();
 const archivedMonth=()=>!!(game.pendingMonth&&game.monthlyArchive?.some(m=>m.year===game.pendingMonth.year&&m.id===game.pendingMonth.id));
 const archivedMilestones=()=>!!game.pendingMilestoneIds?.length&&game.pendingMilestoneIds.every(id=>(game.milestoneNews||[]).some(m=>m.id===id));
 const archivedReview=()=>!!(game.pendingReview&&game.games.some(g=>g.id===game.pendingReview.gameId&&g.year===game.pendingReview.year&&(g.home===team.id||g.away===team.id)));
 const canCalendar=()=>!!calendarNextDay()&&game.day<143&&!game.financeCrisis&&!flowGet()&&game.pendingCeremonyIntro!=='opening'&&!game.pendingDraftReveal&&game.pendingDecade==null&&!pendingRareNews().length&&!game.pendingEvent&&!careerEventPending()&&!flowForeignResponse()&&(!game.pendingMonth||!game.pendingMonth.explicit&&archivedMonth())&&(!game.pendingReview||!game.pendingReview.explicit&&archivedReview())&&(!game.pendingMilestoneIds?.length||archivedMilestones());
 const deferRoutine=()=>{
  if(game.pendingMonth&&!game.pendingMonth.explicit&&archivedMonth())game.pendingMonth=null;
  if(game.pendingReview&&!game.pendingReview.explicit&&archivedReview())game.pendingReview=null;
  if(archivedMilestones()){game.pendingMilestoneIds=[];game.milestoneResume=false;game.milestoneEdition=null;game.milestonePage=0;}
 };
 // Bounded, read-only presentation of actual saved results. No new simulation.
 const reportClub=id=>{const t=getTeam(id);return t?{id:t.id,name:t.name,short:t.short,league:t.league,color:t.color,letter:t.letter,emblem:t.emblem||null}:null;};
 const reportName=id=>{const p=getPlayer(id);return p?{name:p.name,specialCategory:p.specialCategory||null,originCategory:p.originCategory||null}:null;};
 const committedReplay=g=>{
  if(!Array.isArray(g.inningsA)||!Array.isArray(g.inningsH))return null;
  const steps=watchReplaySteps(g);
  if(steps.length>160)return null;
  const clean=steps.map(x=>({inning:x.inning,side:x.side,teamId:x.teamId,runs:x.runs,phase:x.phase,runsAfter:x.runsAfter??null,play:x.play?{kind:x.play.kind,batterName:x.play.batterName,runs:x.play.runs,rbi:x.play.rbi??null,fieldTeamId:x.play.fieldTeamId??null,title:watchScoringTitle(x.play)}:null}));
  const valid=clean.every(x=>Number.isInteger(x.inning)&&x.inning>=1&&x.inning<=30&&[g.home,g.away].includes(x.teamId)&&['end','score','strike'].includes(x.phase)&&Number.isInteger(x.runs)&&x.runs>=0&&(x.phase==='end'||Number.isInteger(x.runsAfter)&&x.runsAfter>=0&&x.runsAfter<=x.runs));
  const sum=id=>clean.filter(x=>x.phase==='end'&&x.teamId===id).reduce((n,x)=>n+x.runs,0);
  return valid&&sum(g.home)===g.homeScore&&sum(g.away)===g.awayScore?clean:null;
 };
 const matchReport=g=>{
  if(!g||g.home!==team.id&&g.away!==team.id)return null;
  const box=(rows,keys)=>(rows||[]).slice(0,80).map(x=>({id:x.id,teamId:x.teamId,player:reportName(x.id),...Object.fromEntries(keys.filter(k=>Number.isFinite(x[k])).map(k=>[k,x[k]]))}));
  return {gameId:String(g.id),year:g.year,day:g.day,date:g.date,home:reportClub(g.home),away:reportClub(g.away),homeScore:g.homeScore,awayScore:g.awayScore,inningsH:(g.inningsH||[]).slice(0,30),inningsA:(g.inningsA||[]).slice(0,30),events:(g.events||[]).slice(0,8).map(String),replay:committedReplay(g),spHome:reportName(g.spHome),spAway:reportName(g.spAway),
   box:g.box?{bat:box(g.box.bat,['ab','h','hr','rbi','bb','sb']),pitch:box(g.box.pitch,['outs','pitches','h','er','k','bb','w','l','sv'])}:null,
   moves:Array.isArray(g.managerMoves)?g.managerMoves.slice(0,80).map(m=>({inning:m.inning,side:m.side,team:reportClub(m.teamId)?.short||'',type:m.type,inName:m.inName,outName:m.outName,role:m.role,reason:m.reason,pitchCount:m.pitchCount})):null};
 };
 const paperReport=p=>{
  if(!p||!Array.isArray(p.articles)||!p.articles.length)return null;
  const w=p.weekly;
  return {date:p.date,kind:p.kind,reason:p.reason,layout:p.layout,articles:p.articles.slice(0,8).map(a=>({tag:a.tag,headline:a.headline,body:a.body,stat:a.stat,league:a.league})),nextDate:p.nextDate,nextOpponent:p.nextOpponent,
   weekly:w&&w.teamId===team.id?{start:w.start,end:w.end,teamName:w.teamName,record:w.record,scores:(w.scores||[]).slice(0,14),cash:w.cash,leagues:w.leagues}:null};
 };
 const latestPaper=()=>{const p=(game.dailyBulletins||[]).at(-1);return p?.year===game.year?paperReport(p):null;};
 const archiveAvailable=()=>!game.pendingDraftReveal&&!flowForeignResponse()&&!pendingRareNews().length&&!flowGet();
 if(op==='report-page'){
  if(!archiveAvailable())throw Error('archive unavailable during confidential event');
  const source=input.kind==='matches'?game.games:(game.dailyBulletins||[]);
  const matches=x=>(!input.year||x.year===input.year)&&(input.kind==='matches'?(x.home===team.id||x.away===team.id):Array.isArray(x.articles)&&x.articles.length>0);
  let total=0,items=[];
  for(let i=source.length-1;i>=0;i--){const x=source[i];if(!matches(x))continue;if(total>=input.offset&&items.length<input.limit)items.push(input.kind==='matches'?matchReport(x):paperReport(x));total++;}
  if(input.offset>total)throw Error('archive offset out of range');
  const end=input.offset+items.length;return JSON.stringify({kind:input.kind,year:input.year,offset:input.offset,total,nextOffset:end<total?end:null,items});
 }
 const headquartersView=()=>{
  const next=game.day<143?game.schedule[game.day]?.find(m=>m.home===team.id||m.away===team.id):null;
  const opp=next?getTeam(next.home===team.id?next.away:next.home):null;
  const last=gameByTeam(team.id),lastOpp=last?getTeam(last.home===team.id?last.away:last.home):null;
  const previous=game.calendar.days[game.calendarIndex-1];
  return {archiveAvailable:archiveAvailable(),lastDay:previous?{date:previous.date,type:previous.type,reason:previous.reason,gameNo:previous.gameNo??null}:null,dateText:getDayText(),fans:game.fans,salary:payroll(team),rank:rankings(team.league).findIndex(t=>t.id===team.id)+1,opponent:opp?.short||null,standings:Object.fromEntries(['E','W'].map(l=>[l,rankings(l).map(t=>({id:t.id,short:t.short,league:t.league,wins:t.wins,losses:t.losses,ties:t.ties,rs:t.rs,ra:t.ra}))])),canStep:canStep(),canCalendar:canCalendar(),goals:Object.fromEntries(['date','weekly','month','season'].map(kind=>[kind,calendarGoalFor(kind,game.calendar.days,game.calendarIndex)])),latestMonth:(game.monthlyArchive||[]).filter(m=>m.teamId===team.id).slice(-1).map(m=>({month:m.month,date:m.date,wins:m.wins,losses:m.losses,ties:m.ties}))[0]||null,latestMilestones:(game.milestoneNews||[]).slice(-5).map(m=>({date:m.date,title:m.title})),lastReport:!game.pendingDraftReveal&&!flowForeignResponse()&&!flowGet()?matchReport(last):null,latestPaper:!game.pendingDraftReveal&&!flowForeignResponse()&&!pendingRareNews().length&&!flowGet()?latestPaper():null,last:last&&lastOpp?{year:last.year,day:last.day,opponent:lastOpp.name,ours:last.home===team.id?last.homeScore:last.awayScore,theirs:last.home===team.id?last.awayScore:last.homeScore}:null};
 };
 const tradeAvailable=()=>canManage()&&gmTradeOpen()&&!game.pendingDraftReveal&&!flowForeignResponse();
 const tradePlayer=p=>({id:p.id,name:p.name,pos:p.pos,age:p.age,overall:rating(p),salary:p.salary});
 if(op==='trade-page'){
  if(!tradeAvailable())throw Error('trade unavailable');
  const u=getTeam(input.clubId);if(!u||u.id===team.id)throw Error('invalid trade club');
  if(input.mode==='list')return JSON.stringify({mode:'list',clubId:u.id,out:own(team).filter(p=>gmTradeEligible(p,team)).map(tradePlayer),in:own(u).filter(p=>gmTradeEligible(p,u)).map(tradePlayer)});
  const q=gmTradeQuote(u.id,input.out,input.in,input.fee);
  return JSON.stringify({mode:'quote',clubId:u.id,ok:q.ok,reason:q.ok?null:q.reason,fee:input.fee,outIds:input.out,inIds:input.in,delta:q.ok?q.delta:null});
 }
 const freeVisible=()=>!game.pendingDraftReveal&&!flowForeignResponse();
 const freeList=()=>freeAgents().filter(p=>!p.retired);
 const freeRow=p=>({id:p.id,name:p.name,pos:p.pos,age:p.age,overall:rating(p),salary:p.salary,cost:signingCost(p)});
 if(op==='free-page'){
  if(!freeVisible())throw Error('free market projection unavailable');
  const q=input.query.normalize('NFKC').toLowerCase().trim();
  const matches=freeList().filter(p=>!q||String(p.name).normalize('NFKC').toLowerCase().includes(q));
  if(input.offset>matches.length)throw Error('free page offset out of range');
  const items=matches.slice(input.offset,input.offset+input.limit).map(freeRow),end=input.offset+items.length;
  return JSON.stringify({offset:input.offset,total:matches.length,nextOffset:end<matches.length?end:null,items});
 }
 if(op==='player-page'){
  if(!freeVisible())throw Error('player history unavailable before reveal');
  const p=own(team).find(p=>p.id===input.playerId);if(!p)throw Error('own player required');
  const pitch=isPitch(p),statKeys=Object.keys(newStats(pitch));
  const validYear=r=>Number.isSafeInteger(r?.year)&&r.year>=2027&&r.year<=game.year;
  const uniqueRows=rows=>[...new Map(rows.filter(validYear).map(r=>[r.year,r])).values()];
  const official=careerRows(p,game.year).filter(validYear),farm=uniqueRows(p.farmHistory||[]);
  if(p.farmYear===game.year&&!farm.some(r=>r.year===game.year)&&(p.farmStats?.g||p.farmTrainingDays))farm.push({year:game.year,teamId:p.farmClubId,stats:p.farmStats,trainingDays:p.farmTrainingDays});
  const overall=uniqueRows(p.overallHistory||[]),abilities=uniqueRows(p.abilityHistory||[]),titles=(p.titles||[]).filter(validYear);
  const indexed=rows=>new Map(rows.map(r=>[r.year,r])),o=indexed(official),f=indexed(farm),g=indexed(overall),a=indexed(abilities),t=new Map();
  for(const r of titles){if(!t.has(r.year))t.set(r.year,[]);t.get(r.year).push({title:String(r.title).slice(0,120),league:r.league==='E'||r.league==='W'?r.league:null});}
  const years=[...new Set([...o.keys(),...f.keys(),...g.keys(),...a.keys(),...t.keys()])].sort((x,y)=>y-x);
  if(input.offset>years.length)throw Error('history offset out of range');
  const stats=st=>Object.fromEntries(statKeys.filter(k=>Number.isFinite(st?.[k])).map(k=>[k,st[k]]));
  const resultRow=r=>r?{teamId:r.teamId??null,team:getTeam(r.teamId)?.short||null,stats:stats(r.stats)}:null;
  const items=years.slice(input.offset,input.offset+input.limit).map(year=>{const ab=a.get(year),v=g.get(year)?.overall??ab?.overall;return {year,official:resultRow(o.get(year)),farm:resultRow(f.get(year)),overall:Number.isFinite(v)?v:null,abilities:ab?Object.fromEntries(['stuff','control','breaking','stamina','contact','power','speed','defense','arm','talent'].filter(k=>Number.isFinite(ab.abilities?.[k])).map(k=>[k,ab.abilities[k]])):null,titles:(t.get(year)||[]).slice(0,64),titlesMore:Math.max(0,(t.get(year)||[]).length-64)};});
  const end=input.offset+items.length;
  return JSON.stringify({playerId:p.id,offset:input.offset,total:years.length,nextOffset:end<years.length?end:null,items,officialTotal:stats(careerTotals(official,pitch)),farmTotal:stats(careerTotals(farm,pitch)),hasFarm:farm.length>0,memo:String(p.memo||'').slice(0,2000)});
 }
 const managerProfile=m=>({id:m.id,name:m.name,age:m.age,style:m.style,leadership:m.leadership,tendency:Object.fromEntries(MANAGER_TACTICS.map(([k])=>[k,m.tendency?.[k]??50])),ratings:managerRatings(m),salary:m.salary,contractYears:m.contractYears});
 const managerRecent=m=>{const matches=game.games.filter(g=>g.year===game.year&&(g.home===team.id||g.away===team.id)).slice(-15),moves=matches.flatMap(g=>(g.managerMoves||[]).filter(x=>x.teamId===team.id&&x.managerId===m.id).map(x=>({gameNo:g.day,inning:x.inning,side:x.side,inName:x.inName,outName:x.outName,label:managerMoveLabel(x)})));return {games:matches.length,total:moves.length,items:moves.slice(-6).reverse()};};
 const clubView=()=>{
  // Avoid leaking the signed roster before the mandatory arrival/result scene.
  if(!freeVisible())return null;
  const stadium=stadiumState(team),manager=team.manager,flow=flowGet(),free=freeList();
  return {canManage:canManage(),tradeAvailable:tradeAvailable(),date:flow?.date||calendarNextDay()?.date||game.calendar.endDate,rosterLimit:ROSTER_MAX,farmLimit:FARM_LIMIT,farmMode:farmClub(team).mode,
   roster:own(team).map(p=>({id:p.id,name:p.name,pos:p.pos,age:p.age,salary:p.salary,tier:p.farmTier===2?2:1,injured:!!p.injury,energy:p.energy,overall:rating(p),abilities:Object.fromEntries(seasonSkillKeys(p).map(k=>[k,p[k]])),focus:p.trainFocus||'balanced',canFarmMove:p.farmTier===2?firstPlayers(team).length<FARM_LIMIT&&!p.injury:farmCanDemote(team,p),fielding:team.lineup.includes(p.id)?team.fieldingRoles?.[p.id]||null:null,subPos:p.subPos||null,hand:p.hand,batHand:p.batHand,talent:p.talent,appearanceSeed:p.appearanceSeed,specialCategory:p.specialCategory||null,originCategory:p.originCategory||null,pastLifeAppearance:p.pastLifeAppearance?{seed:p.pastLifeAppearance.seed,baseCategory:p.pastLifeAppearance.baseCategory}:null,injuryDays:p.injury?.daysLeft||0,affinity:p.affinity,batStats:Object.fromEntries(['ab','h','hr','rbi','sb','g','w','l','outs','er','k','sv'].map(k=>[k,p.stats?.[k]||0]))})),
   freeCount:free.length,free:free.slice(0,80).map(freeRow),
   managerCandidates:[1,2,3].map(slot=>{const m=makeManager(team.id,game.year,slot);return {slot,...managerProfile(m),fee:r2(m.salary*.3),current:m.id===manager?.id};}),
   lineup:team.lineup.slice(),rotation:team.rotation.slice(),rotationCandidates:own(team).filter(p=>p.pos==='SP'&&p.farmTier!==2&&availableForGame(p)).map(p=>p.id),fieldingRoles:{...team.fieldingRoles},fieldingOptions:team.lineup.map(id=>({id,roles:FIELD_POSITIONS.filter(role=>canAssignFieldingRole(team,id,role))})),
   lineupUndoAvailable:canManage()&&undoAvailable(),
   lineupWarnings:{missing:Math.max(0,9-team.lineup.length),off:team.lineup.filter(id=>fieldingTier(getPlayer(id),team.fieldingRoles[id])==='off')},
   lineupCandidates:firstHitters(team).filter(availableForGame).map(p=>({id:p.id,roles:FIELD_POSITIONS.filter(role=>!roster190Candidate(team,role,p)),reasons:Object.fromEntries(FIELD_POSITIONS.map(role=>[role,roster190Candidate(team,role,p)]))})),
   facilities:[...Object.entries(INFRA_LABELS),...Object.entries(STADIUM_KEYS)].map(([key,label])=>{const lv=Object.hasOwn(INFRA_LABELS,key)?infraLevel(team,key):stadium[key];return {key,label,level:lv,upkeep:facilityUpkeep(key,lv),nextCost:lv<20?facilityCost(key,lv):null,nextUpkeep:lv<20?facilityUpkeep(key,lv+1):null};}),
   prices:stadium.prices.slice(),capacity:STADIUM_CAPACITY[stadium.park],canPrice:stadiumCanPrice(team),payroll:payroll(team),reserve:cpuReserve(team),forecast:cpuForecast(team),travel:clubLifeData(team).travel,travelCosts:CLUB_TRAVEL.slice(),
   manager:manager?{...managerProfile(manager),recent:managerRecent(manager),risk:managerRiskMessage(manager),tenure:managerTenure(team),salary:manager.salary,trust:manager.trust,discontent:manager.discontent,renewAvailable:managerTenure(team)<7&&manager.contractYears===1&&game.day>=98&&manager.renewedYear!==game.year,renewFee:r2(manager.salary*.2),orders:MANAGER_TACTICS.map(([key,label,attack,safe])=>({key,label,attack,safe,value:team.gmOrders?.[key]||'auto',tendency:manager.tendency?.[key]??50,effective:managerDecision(team,key)}))}:null,
   support:Object.entries(CLUB_SUPPORT).filter(([,p])=>!p.phase).map(([key,p])=>({key,label:p.label,cost:p.cost,eligible:clubSupportEligible(team,key,'')})),
   standings:game.teams.map(t=>({id:t.id,name:t.name,league:t.league,wins:t.wins,losses:t.losses,ties:t.ties,rs:t.rs,ra:t.ra})),
   latest:game.games.slice(-6).map(g=>({date:g.date,home:g.home,away:g.away,homeScore:g.homeScore,awayScore:g.awayScore}))};
 };
 const foreignView=()=>{
  const m=game.foreignMarket?.year===game.year?foreignHydrate(game.foreignMarket):null;
  const canOperate=!(game.financeCrisis||flowInbox()||game.pendingMonth||game.pendingReview||pendingMilestoneNews().length||game.ceremonyStage||flowGet()?.active||game.pendingCeremonyIntro==='opening');
  const responsePending=flowForeignResponse();
  if(!m)return {initialized:false,candidates:[],negotiation:null,canOperate,responsePending};
  const conv=m.negotiations[team.id];
  const project=(c,stage=0)=>{
   const p=c.player,hidden=secretProspect(p)&&stage!==2,r=foreignReport(m,team,c),tasks=foreignTasks(m,team,c);
   return {id:c.id,name:hidden?'????':p.name,pos:p.pos,age:hidden?null:p.age,country:c.country,category:playerTitleTheme(p)?.name||null,specialCategory:p.specialCategory||null,originCategory:p.originCategory||null,hidden,appearanceSeed:hidden?null:p.appearanceSeed,kind:c.kind,status:c.status,tasks,canBegin:c.status==='available'&&foreignRoom(team,c),confidence:r.confidence,estimate:hidden?null:{low:r.low,high:r.high},abilities:Object.fromEntries(Object.entries(r.values).map(([k,v],i)=>[k,stage===2||stage===1&&i<2?{value:p[k]}:hidden?null:{low:v.low,high:v.high,estimate:v.estimate}])),stats:hidden?null:foreignStats(m,c)};
  };
  const c=conv&&m.candidates.find(x=>x.id===conv.candidateId),q=conv?.status==='talk'?FOREIGN_QUESTIONS[conv.answers?.length||0]:null;
  const opened=conv?.resultOpened===true,stage=opened&&conv.status==='signed'?conv.revealStage||0:0;
  const result=['signed','refused','rival','rival-pending','overseas'].includes(conv?.status);
  const status=result&&!opened?'response':conv?.status;
  return {initialized:true,canOperate,responsePending,budget:foreignBudget(team),used:foreignUsed(m,team),supportOptions:Object.entries(FOREIGN_SUPPORT).map(([key,x])=>({key,label:x.label,cost:x.cost})),research:Object.entries(FOREIGN_TASKS).map(([key,[label,cost]])=>({key,label,cost})),candidates:conv?[]:m.candidates.filter(c=>scoutVisible(c)&&c.status==='available').map(c=>project(c)),
   negotiation:c?{candidate:{...project(c,stage),status:result&&!opened?'pending':c.status,canBegin:false},status,opened,stage,interest:conv.interest,interpreter:!!conv.interpreter,interpreterCost:FOREIGN_INTERPRETER_COST,answerCount:conv.answers?.length||0,question:q?{text:conv.interpreter?q.q:q.gist,options:q.options.map(([key,label])=>({key,label}))}:null,support:conv.support,offerLevel:conv.offerLevel,offers:conv.status==='talk'&&conv.answers?.length===3?[0,1,2].map(level=>{const o=foreignOffer(m,c,level,conv.support);return {...o,affordable:foreignAffordable(team,o)};}):[],due:conv.dueDate,ready:conv.status==='waiting'&&!conv.waitDays,counter:conv.status==='counter'?{originalSalary:conv.counter.originalSalary,amount:conv.counter.amount,salary:conv.counter.revised.salary,affordable:foreignRoom(team,c)&&foreignAffordable(team,conv.counter.revised)}:null,result:opened&&result?{winner:conv.winner,offer:conv.offer,recovery:foreignRecoveryAllowed(m,team,c,conv)}:null}:null};
 };
 const commercialJobs=['fan-fest','tv','fanclub','sponsor','broadcast','naming','opening-promo'];
 const annualSupported=['awards-all','settlement','movement-declarations','draft','roster-cut','renewal1','renewal2','autumn','winter',...commercialJobs,'movement-market','booking','self','winter-return','camp','exhibition','opening-promo','offdesk-opening'];
 const draftPending=d=>d.picks.find(x=>x.teamId===team.id&&(x.recoveryPending||x.recoveryCelebration));
 const draftOwnRow=d=>d.picks.find(x=>x.teamId===team.id&&x.status==='rights');
 const candidateView=(c,d,detail=false)=>{
  const p=c.player,hidden=secretProspect(p),base={id:c.id,name:hidden?'????':p.name,pos:p.pos,type:c.type,category:playerTitleTheme(p)?.name||null,specialCategory:p.specialCategory||null,originCategory:p.originCategory||null,hidden};
  if(!detail)return base;
  const r=hidden?null:draftReport(d,team,c),tasks=scoutTasks(d,team,c);
  return {...base,school:hidden?null:c.school,age:hidden?null:p.age,appearanceSeed:hidden?null:p.appearanceSeed,report:r?{low:r.low,high:r.high,confidence:r.confidence,values:r.values,preference:r.preference,abroad:r.abroad}:null,tasks,hints:hidden?[]:draftInterviewHints(d,team,c),canResearch:c.status==='available'&&scoutVisible(c)&&draftResearchUsed(d,team)<draftScoutBudget(team)&&draftResearchLevel(d,team,c)<3};
 };
 const draftView=d=>{
  if(!d||d.year!==game.year)return null;
  const g=draftLotteryGroup(d),row=draftPending(d)||draftOwnRow(d),c=row&&draftCandidate(d,row.candidateId),questions=RECRUIT_QUESTIONS[row?.conversation?.answers?.length||0];
  const options=['scout','first','later'].includes(d.phase)?draftOptions(d,team).filter(scoutVisible).map(c=>candidateView(c,d,true)):[];
  const priority=['再来','PARALLEL','STAR','転生','異界転生','星煌転生','LEGEND','伝説転生','IMMORTAL','輪廻転生'],rare=d.rareIntro?d.candidates.filter(c=>playerTitleTheme(c.player)).sort((a,b)=>priority.indexOf(playerTitleTheme(b.player).name)-priority.indexOf(playerTitleTheme(a.player).name))[0]:null,ann=d.announcement,annRow=ann?.rows[ann.cursor];
  return {phase:d.phase,round:d.round,rareIntro:!!d.rareIntro,introCandidate:rare?candidateView(rare,d):null,announcement:!!ann,announcementRow:annRow?{round:annRow.round,team:getTeam(annRow.teamId)?.name,teamId:annRow.teamId,candidate:annRow.candidateId===null?null:candidateView(draftCandidate(d,annRow.candidateId),d),contested:!!annRow.contested,cursor:ann.cursor,total:ann.rows.length}:null,researchUsed:draftResearchUsed(d,team),researchBudget:draftScoutBudget(team),canNominate:d.phase==='first'?d.active.includes(team.id):d.phase==='later'&&draftLaterOrder(d)[d.cursor]===team.id,
   candidates:options,lottery:d.phase==='lottery'&&g?{stage:d.pendingLottery.stage,candidateId:g.cid,candidate:candidateView(draftCandidate(d,g.cid),d),clubs:g.ids.map(id=>({id,name:getTeam(id)?.name||'球団'})),own:g.ids.includes(team.id),tickets:g.ids.length,...(d.pendingLottery.stage==='revealed'?{winner:g.winner,winnerName:getTeam(g.winner)?.name||'球団'}:{})}:null,
   negotiation:d.phase==='negotiate'&&c?{...candidateView(c,d,true),status:row.status,feedback:row.feedback||null,offers:row.status==='rights'?[0,1,2].map(level=>({...draftOffer(c,level,'develop'),level})):[],recoveryPending:!!row.recoveryPending,recoveryCelebration:!!row.recoveryCelebration,answers:row.conversation?.answers||[],question:row.status==='rights'&&questions?{text:questions.q,options:questions.options.map(x=>({key:x[0],label:x[1]}))}:null}:null,
   picks:d.picks.map(x=>({round:x.round,teamId:x.teamId,candidateId:x.candidateId,status:x.status,pos:x.pos,name:secretProspect(draftCandidate(d,x.candidateId)?.player)?'????':x.name}))};
 };
 const renewalView=()=>{
  const d=renewalData(team);if(!d)return null;
  return {round:d.round,confirmed:d.confirmed,waiting:!!d.waiting,unresolved:renewalUnresolved(d).length,rows:d.rows.map(r=>{const p=getPlayer(r.id);return {id:r.id,name:p?.name,pos:p?.pos,status:r.status,revisit:!!r.revisit,current:r.current,assessment:r.assessment,desired:r.desired,offer:r.offer,editable:renewalEditable(d,r),bonuses:r.bonuses,options:p?renewalBonusOptions(p).map(([key,target,amount,label])=>({key,target,amount,label})):[],history:r.history};})};
 };
 const trainingView=phase=>{
  const report=annualReport(phase);
  if(report)return {phase,report:{start:report.start,end:report.end,cost:report.cost,rows:(report.rows||[]).filter(r=>r.teamId===team.id),entries:(report.entries||[]).filter(r=>r.teamId===team.id),club:report.clubs?.find(c=>c.teamId===team.id)}};
  if(phase==='winter')return {phase,assignments:winterPlan(team),eligible:winterEligible(team).map(p=>({id:p.id,name:p.name,pos:p.pos})),destinations:WINTER_DEST.map(([key,label,league,cost,effect])=>({key,label,league,cost,effect})),cost:winterCost(winterPlan(team))};
  return {phase,players:annualPlayers(team,phase).map(p=>({id:p.id,name:p.name,pos:p.pos,injured:!!p.injury,focus:['balanced',...seasonSkillKeys(p)],menu:annualMenu(team,p,phase)}))};
 };
 const commercialView=(f,j)=>{
  const s=j.state;if(!s)return null;
  if(j.id==='sponsor')return {job:j.id,stage:s.stage,year:s.year,candidates:s.candidates.map(c=>({id:c.id,name:c.name,industry:c.industry,annual:c.annual})),selected:s.selected,risk:sponsorRisk(s.selected.length),annual:sponsorAnnual(s.candidates.filter(c=>s.selected.includes(c.id))),contract:s.stage==='result'?sponsorContract(team,s.year):null};
  return {job:j.id,stage:s.stage,year:s.year,due:s.due,plan:s.plan,players:s.players,name:s.name,fee:s.fee,perk:s.perk,color:s.color,font:s.font,since:s.since,delta:s.delta,choice:s.choice,report:s.report,result:s.result,
   ...(['fan-fest','opening-promo'].includes(j.id)?{plans:(j.id==='fan-fest'?FAN_FEST_PLANS:OPENING_PROMO_PLANS).map((p,index)=>({index,name:p.name,cost:p.cost,desc:p.desc,title:p.title||p.name,photo:p.photo??null,gain:p.gain??null}))}:{}),
   ...(j.id==='tv'?{eligible:own(team).filter(p=>!retirementScheduled(p)).map(p=>({id:p.id,name:p.name,pos:p.pos}))}:{}),
   ...(j.id==='fanclub'?{perks:FAN_PERKS.map(([key,label,cost])=>({key,label,cost})),estimate:fanEstimate(team,s),contract:s.stage==='result'?commerceData(team).clubs[s.year]||null:null}:{}),
   ...(j.id==='broadcast'?{base:commerceBase(team),chance:broadcastChance(s.delta),contract:commerceData(team).broadcasts[s.year]||null}:{}),
   ...(j.id==='naming'?{options:NAMING_OPTIONS,contract:commerceNaming(team,s.year)}:{})};
 };
 const marketView=f=>{
  const j=f.jobs['movement-market'],d=movementData(),x=j?.state;
  if(!j||!['active','ready'].includes(j.status))return null;
  const active=f.active===j.id;
  const playerInfo=p=>({id:p.id,name:p.name,pos:p.pos,age:p.age,teamId:p.teamId,salary:p.salary,overall:rating(p),specialCategory:p.specialCategory||null,originCategory:p.originCategory||null,appearanceSeed:p.appearanceSeed,pastLifeAppearance:p.pastLifeAppearance?{seed:p.pastLifeAppearance.seed,baseCategory:p.pastLifeAppearance.baseCategory}:null,abilities:Object.fromEntries(seasonSkillKeys(p).map(k=>[k,p[k]]))});
  const roomOptions=!active&&!f.active&&j.status==='ready'?(x?.news==='opening-wait'?[]:!x||x.news?['news']:d?.cpuDone?['other']:['fa','return','other'].filter(k=>k==='other'||offdeskMarketActionable(d,k).length)):[];
  const other=active&&x?.view==='other'&&!x.news&&!d.cpuDone;
  const rows=active&&!x.news&&['fa','return'].includes(x.view)?offdeskMarketRows(d,x.view).map(r=>{
   const p=getPlayer(r.id),o=d.offers[r.id],v=faTalk(d,r);
   const unread=faUnread(o),round=o?.status==='counter'?2:1,bounds=faSalaryBounds(d,r,{round});
   return {...playerInfo(p),kind:r.kind,demand:r.demand,cost:movementOfferCost(r,r.demand),bounds,unread,canSubmit:!!v&&v.turn>=2&&!unread&&movementCanSign(d,r,team,v.salary)&&(round!==2||v.salary>=o.counter),category:playerTitleTheme(p)?.name||null,outcome:faOutcome(d,r),canApproach:faCanApproach(d,r),offer:o?{status:o.status,salary:o.salary,years:o.years,due:o.due,counter:o.counter,replyUntil:o.replyUntil,seen:!!o.seen}:null,talk:v?{round:v.round,turn:v.turn,max:v.max,salary:v.salary,years:v.years,role:v.role,speech:v.speech,trust:v.trust,satisfaction:v.satisfaction,caution:v.caution}:null};
  }):[];
  return {active,roomOptions,news:x?x.news:'eve',room:active?x.view:null,newsRows:active&&x.view==='news'&&['opening','results'].includes(x.news)?(d.eventRows||[]).map(r=>({id:r.id,name:getPlayer(r.id)?.name,kind:r.kind,from:r.from,outcome:x.news==='results'?faOutcome(d,r):null})):[],specialResults:active&&x.view==='news'&&x.news==='results'?(d.eventRows||[]).filter(r=>playerTitleTheme(getPlayer(r.id))).map(r=>({...playerInfo(getPlayer(r.id)),category:playerTitleTheme(getPlayer(r.id)).name,outcome:faOutcome(d,r),seen:!!x.faNewsSeen?.includes(r.id)})):[],cpuDone:!!d?.cpuDone,deadline:d?.faClock?.deadline,rows,
   unread:d?faUnreadRows(d).length:0,waiting:d?Object.values(d.offers).filter(o=>o.status==='waiting').length:0,counter:d?Object.values(d.offers).filter(o=>o.status==='counter').length:0,
   deals:active&&d?(d.deals||[]).filter(a=>a.from===team.id||a.to===team.id).map(a=>({id:a.id,name:a.id?getPlayer(a.id)?.name:null,players:(a.ids||[]).map(id=>getPlayer(id)?.name||'選手'),kind:a.kind,from:a.from,to:a.to,salary:a.salary,years:a.years,rank:a.rank,comp:a.comp,compMode:a.compMode,compOptions:d.cpuDone?movementCompOptions(d,a).map(p=>({id:p.id,name:p.name,pos:p.pos})):[]})):[],
   free:other?movementPool(d).filter(r=>r.kind==='free').map(r=>({id:r.id,name:getPlayer(r.id).name,pos:getPlayer(r.id).pos,demand:r.demand,cost:movementOfferCost(r,r.demand),offer:d.offers[r.id]?.status||null})):[],tradeClubs:other?game.teams.map(t=>({id:t.id,name:t.name,players:movementTradePool(t,d).map(p=>({id:p.id,name:p.name,pos:p.pos,age:p.age,overall:rating(p),salary:p.salary,category:playerTitleTheme(p)?.name||null,exchange:t.id===team.id&&p.age>=23&&p.age<=32&&!playerTitleTheme(p)&&(p.stats?.g||0)<=65&&!d.deals.some(x=>x.kind==='exchange'&&(x.from===team.id||x.to===team.id))}))})):[]};
 };
 const preView=f=>{
  const phase=f.active,j=f.jobs[phase];
  if(!['booking','self','winter-return','camp','exhibition'].includes(phase))return null;
  if(phase==='winter-return'){
   const r=game.annualTraining?.results?.[(game.year-1)+':winter'];
   return {phase,report:r?.returned?{rows:(r.rows||[]).filter(x=>x.teamId===team.id),entries:(r.entries||[]).filter(e=>e.teamId===team.id)}:null};
  }
  if(['booking','camp'].includes(phase)){
   const p=annualPlan(team,'camp'),sites=campChoice(team),r=annualReport('camp');
   return {phase,sites,step:p.step||0,paid:!!p.paid,cost:campCost(sites),visit:p.visit||null,visitPending:!!p.visitPending,options:CAMP_SITES.map(([key,label,cost,,effect])=>({key,label,cost,effect})),report:r?{rows:(r.rows||[]).filter(x=>x.teamId===team.id||x.teamId==null),clubs:(r.clubs||[]).filter(x=>x.teamId===team.id),cost:r.cost,sites:r.sites}:null};
  }
  const r=annualReport(phase);
  if(phase==='exhibition')return {phase,policy:annualPlan(team,phase).exhibition,meeting:!!j.state.reportMeeting,meetingDone:!!j.state.reportMeetingDone,digestSeen:!!j.state.digestSeen,report:r?{clubs:game.teams.map(t=>({id:t.id,name:t.name,short:t.short,league:t.league,color:t.color,letter:t.letter,emblem:t.emblem||null})),games:r.games.filter(g=>g.home===team.id||g.away===team.id).map(g=>({date:g.date,home:g.home,away:g.away,homeScore:g.homeScore,awayScore:g.awayScore,noContest:!!g.noContest})),rows:(r.rows||[]).filter(x=>x.teamId===team.id),leagueGames:r.games.length}:null};
  return {phase,...trainingView(phase),support:!!j.state.reportSelfSupport,supportOptions:Object.entries(CLUB_SUPPORT).filter(([k,p])=>p.phase?.includes('self')).map(([key,p])=>({key,label:p.label,cost:p.cost,eligible:clubSupportEligible(team,key,'self')}))};
 };
 const annualFinanceView=()=>{
  const tot=game.financeLedger?.clubs?.[team.id]||{},periods=game.financeLedger?.periods||[],q={ticket:0,food:0,goods:0};
  for(const p of periods){const v=p.clubs?.[team.id]?.stadium;if(v)for(const k of Object.keys(q))q[k]+=Number(v[k])||0;}
  const sponsorOff=sponsorReceived(team,game.year,'off'),sponsor=r2((tot.sponsorship||0)+sponsorOff),co=commerceTotals(team,game.year,'off'),commerce=r2((tot.commerceIncome||0)+co.income),vip=r2((tot.vipIncome||0)+vipOffTotal(team,game.year)),revenue=r2((tot.revenue||0)+sponsorOff+co.income+vipOffTotal(team,game.year)),transfer=clubTransferYear(team,game.year);
  const pay=tot.payroll||0,bonus=tot.performanceBonus||0,maint=tot.maintenance||0,op=tot.stadiumOperating||0,invest=tot.investment||0,overhead=tot.overhead||0,rewards=tot.rewards||0,extras=clubLifeSpend(team,game.year),cc=r2((tot.commerceCost||0)+co.cost);
  const income=r2(revenue+transfer.income),expense=r2(pay+maint+op+invest+cc+overhead+rewards+extras+transfer.cost),net=r2(revenue+transfer.income-pay-maint-op-invest-cc-overhead-rewards-extras-transfer.cost);
  return {income,expense,net,operating:r2(net+invest),cash:team.cash,incomeRows:[['入場料収入',r2(q.ticket/1e8)],['飲食売上',r2(q.food/1e8)],['グッズ売上',r2(q.goods/1e8)],['スポンサー収入',sponsor],['放映権・命名権・ファンクラブ等',commerce],['VIP増収',vip],['その他の収入',r2(revenue-(q.ticket+q.food+q.goods)/1e8-sponsor-commerce-vip)],['移籍金受取',transfer.income]],expenseRows:[['選手・監督基本報酬',r2(pay-bonus)],['出来高報酬',bonus],['施設維持費',maint],['球場試合運営費',op],['強化投資',invest],['営業・ファンクラブ経費',cc],['球団職員・遠征・管理・定期更新等',overhead],['自動報奨金・還元',rewards],['任意支援・待遇改善・大規模修繕',extras],['補強費',transfer.cost]]};
 };
 const annualAwardsView=()=>({awards:(game.awards||[]).filter(a=>a.year===game.year).map(a=>{const p=getPlayer(a.playerId),t=getTeam(a.teamId);return {title:a.title,league:a.league,teamId:a.teamId,team:t?.name||'球団',stat:awardStatLabel(a),player:p?{id:p.id,name:p.name,pos:p.pos,age:p.age,teamId:p.teamId,talent:p.talent,...Object.fromEntries(seasonSkillKeys(p).map(k=>[k,p[k]])),appearanceSeed:p.appearanceSeed,specialCategory:p.specialCategory||null,originCategory:p.originCategory||null,pastLifeAppearance:p.pastLifeAppearance?{seed:p.pastLifeAppearance.seed,baseCategory:p.pastLifeAppearance.baseCategory}:null}:null};}),milestones:(game.milestoneNews||[]).filter(e=>e.year===game.year).slice(-80).map(e=>({title:e.title,date:e.date,teamId:e.teamId??null}))});
 const annualView=()=>{
  const f=flowGet(),d=movementData();
  if(!f)return {mode:null,canStart:game.day===143&&game.calendarIndex===game.calendar.days.length&&!game.financeCrisis&&!flowInbox()&&!game.pendingMonth&&!game.pendingReview&&!pendingMilestoneNews().length&&!flowForeignResponse()};
  const tasks=Object.values(f.jobs).map(j=>({id:j.id,start:j.start,status:j.status,supported:annualSupported.includes(j.id)}));
  return {mode:f.mode,date:f.date,active:f.active,tasks,awardReport:f.active==='awards-all'?annualAwardsView():null,financeReport:f.active==='settlement'?annualFinanceView():null,preseason:preView(f),market:marketView(f),commerce:commercialJobs.includes(f.active)?commercialView(f,f.jobs[f.active]):null,canAdvance:!f.active&&!flowInbox()&&!game.financeCrisis&&!flowBlocking(f),renewal:['renewal1','renewal2'].includes(f.active)?renewalView():null,training:['autumn','winter'].includes(f.active)?trainingView(f.active):null,draft:f.active==='draft'?draftView(game.draft):null,roster:f.active==='roster-cut'?{projection:draftRosterProjection(game.draft,team),selected:draftCutIds(game.draft,team),eligible:draftCutOptions(game.draft,team).map(p=>({id:p.id,name:p.name,pos:p.pos,salary:p.salary,warnings:draftCutReasons(p)}))}:null,requests:f.active==='movement-declarations'?(d?.requests||[]).filter(r=>r.from===team.id).map(r=>({id:r.id,kind:r.kind,status:r.status,demand:r.demand,offer:r.offer})):[]};
 };
 const medical=()=>own(team).filter(p=>rosterTreatmentEligible(p)&&p.injury&&typeof p.injury.date==='string').map(p=>({route:'medical',year:game.year,eventKey:String(p.id)+':'+p.injury.date,label:p.name+' 特別治療',playerId:p.id,date:p.injury.date}));
 // Same eligibility as the checked-in manager staff continuation handler:
 // seven years, late season, one continuation per year, own club only.
 const manager=()=>{const m=team.manager;if(!m||managerTenure(team)<7||game.day<98||m.tenureContinuedYear===game.year||game.financeCrisis)return [];return [{route:'manager',year:game.year,eventKey:String(m.id),label:m.name+' 監督慰留'}];};
 // Match the live career-event handler: only the current own-club consultation.
 const retirement=()=>{const e=careerCurrentEvent(),p=e&&getPlayer(e.id),q=p?.retirePlan;if(game.financeCrisis||e?.type!=='consult'||!p||p.teamId!==team.id||q?.year!==game.year||q.teamId!==team.id||q.status!=='consult')return [];return [{route:'retirement',year:game.year,eventKey:String(p.id),label:p.name+' 引退慰留'}];};
 // All offers and candidate IDs originate in the server-owned world.
 const recruitment=()=>{
  if(game.financeCrisis)return [];
  const rows=[],add=(route,id,label)=>rows.push({route,year:game.year,eventKey:String(id),label:String(label).slice(0,160)});
  const d=game.draft,m=game.foreignMarket,move=movementData();
  if(game.ceremonyStage==='draft'&&d?.year===game.year&&!d.rareIntro&&!d.announcement){
   for(const row of d.picks||[]){const c=draftCandidate(d,row.candidateId);if(c&&draftRecoveryAllowed(d,team,row,c)&&(!draftPending(d)||draftPending(d)===row))add('draft-revival',c.id,(secretProspect(c.player)?'????':c.player.name)+' ドラフト交渉復活');}
   if(lotteryRewardAllowed(d,team.id))add('lottery',draftLotteryGroup(d).cid,'ドラフト抽選');
  }
  if(m?.year===game.year){
   const conv=m.negotiations?.[team.id],c=m.candidates.find(x=>x.id===conv?.candidateId);
   if(c&&foreignRecoveryAllowed(m,team,c,conv))add('foreign-revival',c.id,(secretProspect(c.player)?'????':c.player.name)+' 外国人交渉復活');
  }
  if(move&&!move.closed&&game.ceremonyStage==='movement-declarations'){
   for(const r of move.requests){const p=getPlayer(r.id);if(p?.teamId===team.id&&r.from===team.id&&r.year===game.year&&['fa','posting','overseas-fa'].includes(r.kind)&&r.status==='refused'&&Number.isFinite(r.offer)&&r.offer>0&&team.cash>=r.offer)add('fa-retention',r.id,p.name+' '+movementRequestLabel(r.kind)+' 残留');}
  }
  // Refused, still-open FA/return offers only; no displacement of a rival deal.
  if(move&&!move.closed&&!move.cpuDone&&game.ceremonyStage==='movement-market'){
   for(const row of movementPool(move)){
    const o=move.offers[row.id],p=getPlayer(row.id);
    if(p&&['fa','return'].includes(row.kind)&&o?.status==='refused'&&movementCanSign(move,row,team,o.salary))add('fa-sign',row.id,p.name+' FA交渉復活');
   }
  }
  return rows;
 };
 if(op==='actions')return JSON.stringify([...medical(),...manager(),...retirement(),...recruitment()]);
 if(op==='apply'){
  if(['draft-revival','foreign-revival','lottery','fa-retention','fa-sign'].includes(input.action.route)){
   const a=recruitment().find(x=>x.route===input.action.route&&x.eventKey===input.action.eventKey);
   if(!a)throw Error('recruitment reward unavailable');
   const id=Number(a.eventKey),d=game.draft,m=game.foreignMarket,move=movementData();
   let result;
   if(a.route==='draft-revival'){
    const row=d.picks.find(x=>x.teamId===team.id&&x.candidateId===id),c=draftCandidate(d,id);
    if(!applyDraftRecovery(d,team,row,c,true))throw Error('draft recovery failed');
    result={candidateId:id,status:row.status};
   }else if(a.route==='foreign-revival'){
    const c=m.candidates.find(x=>x.id===id),conv=m.negotiations[team.id];
    if(!applyForeignRecovery(m,team,c,conv,true))throw Error('foreign recovery failed');
    result={candidateId:id,status:conv.status};
   }else if(a.route==='lottery'){
    if(!applyLotteryReward(d,team.id,true))throw Error('lottery failed');
    result={candidateId:id,stage:d.pendingLottery.stage,winner:draftLotteryGroup(d).winner};
   }else if(a.route==='fa-retention'){
    const r=move.requests.find(x=>x.id===id&&x.from===team.id);
    r.status='retained';result={playerId:id,status:r.status,kind:r.kind};
   }else{
    const row=movementPool(move).find(x=>x.id===id),o=move.offers[id];
    if(!movementSign(move,row,team,o.salary,o.years))throw Error('FA signing failed');
    o.status='signed';result={playerId:id,status:o.status};
   }
   return JSON.stringify({state:game,result});
  }
  if(input.action.route==='retirement'){
   const a=retirement().find(x=>x.eventKey===input.action.eventKey);
   if(!a)throw Error('retirement continuation unavailable');
   const e=careerCurrentEvent(),p=getPlayer(e.id);
   p.retirePlan.status='continued';careerEventDone(e);
   return JSON.stringify({state:game,result:{playerId:p.id,continuedThrough:game.year+1}});
  }
  if(input.action.route==='manager'){
   const a=manager().find(x=>x.eventKey===input.action.eventKey);
   if(!a)throw Error('manager continuation unavailable');
   team.manager.tenureContinuedYear=game.year;
   return JSON.stringify({state:game,result:{managerId:team.manager.id,continuedThrough:game.year+1}});
  }
  const a=medical().find(x=>x.eventKey===input.action.eventKey&&input.action.route==='medical');
  if(!a)throw Error('medical action unavailable');
  const p=getPlayer(a.playerId),before=p.injury.daysLeft;
  // Shared production mutation supports both the roster and popup, while
  // applySpecialTreatment additionally requires the actual pending popup.
  if(!applyRosterTreatment(p)||p.injury.daysLeft!==Math.ceil(before/2))throw Error('real medical mutation failed');
  return JSON.stringify({state:game,result:{before,after:p.injury.daysLeft,date:a.date}});
 }
 if(op==='ack'){
  const kind=input.kind;
  // Only acknowledge archived monthly reports or defer already-recorded
  // milestone news. Never discard injury/rare notices or resolve a crisis.
  if(kind==='month'){
   if(!game.pendingMonth||!game.monthlyArchive?.some(m=>m.year===game.pendingMonth.year&&m.id===game.pendingMonth.id))throw Error('monthly report not archived');
   game.pendingMonth=null;
  }else if(kind==='milestones'){
   if(!game.pendingMilestoneIds?.length)throw Error('no milestone notices');
   if(!archivedMilestones())throw Error('milestone notices not archived');
   game.pendingMilestoneIds=[];game.milestoneResume=false;game.milestoneEdition=null;game.milestonePage=0;
   }else if(kind==='injury'){
   const e=injuryNotice();
   if(game.financeCrisis||!e||input.eventKey!==String(e.playerId)+':'+e.date||!game.injuryArchive?.some(x=>x.playerId===e.playerId&&x.teamId===e.teamId&&x.date===e.date))throw Error('injury acknowledgement unavailable');
   game.pendingEvent=null;
  }else if(kind==='rare'){
   const e=pendingRareNews()[0];
   if(game.financeCrisis||!e||input.eventKey!==e.id)throw Error('rare acknowledgement unavailable');
   game.pendingRareIds=(game.pendingRareIds||[]).filter(id=>id!==e.id&&!(game.rareNews||[]).some(x=>x.id===id&&rareObsoleteCutin(x)));
   if(!pendingRareNews().length)game.rareResume=false;
  }else if(kind==='review'){
   const r=game.pendingReview,g=r&&game.games.find(x=>x.id===r.gameId&&x.year===r.year);
   if(game.financeCrisis||!g||String(g.id)!==input.eventKey||g.home!==team.id&&g.away!==team.id)throw Error('review acknowledgement unavailable');game.pendingReview=null;
  }else if(kind==='rookie-reveal'){
   const b=game.pendingDraftReveal,r=b?.entries.find(x=>x.id===input.playerId);if(game.financeCrisis||pendingRareNews().length||game.pendingEvent||careerEventPending()||!r||b.year!==game.year-1||r.revealed||(r.revealStage||0)>=2)throw Error('rookie reveal unavailable');r.revealStage=(r.revealStage||0)+1;
  }else if(kind==='rookie-finish'){
   if(game.financeCrisis||pendingRareNews().length||game.pendingEvent||careerEventPending()||!game.pendingDraftReveal||game.pendingDraftReveal.year!==game.year-1||game.pendingDraftReveal.entries.some(r=>!r.revealed&&(r.revealStage||0)<2))throw Error('rookie report unfinished');game.pendingDraftReveal=null;
  }else if(kind==='decade'){
   if(game.financeCrisis||pendingRareNews().length||game.pendingEvent||careerEventPending()||game.pendingDraftReveal||game.pendingDecade==null||String(game.pendingDecade)!==input.eventKey)throw Error('decade acknowledgement unavailable');game.lastDecadeViewed=game.pendingDecade;game.pendingDecade=null;game.decadeSection=null;
  }else if(kind==='opening'){
   if(flowGet()||game.day!==0||game.pendingCeremonyIntro!=='opening')throw Error('opening acknowledgement unavailable');game.pendingCeremonyIntro=null;
  }else throw Error('unsupported acknowledgement');
  return JSON.stringify(game);
 }
 if(op==='career'){
  const notice=careerNotice();
  if(game.financeCrisis||game.pendingEvent||pendingRareNews().length||!notice||notice.p.id!==input.playerId)throw Error('career decision unavailable');
  const {e,p,q}=notice;
  if(input.choice==='accept'){
   if(!['consult','plan'].includes(e.type)||q.status!=='consult'||p.teamId!==team.id)throw Error('career decision unavailable');
   const selected=input.options,allowed=farewellChoices(p);
   if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.some(k=>!allowed.some(x=>x[0]===k)))throw Error('invalid farewell options');
   const cost=r2(allowed.filter(x=>selected.includes(x[0])).reduce((n,x)=>n+x[2],0));
   if(!refCharge(team,cost))throw Error('insufficient farewell budget');
   q.options=selected.slice();q.status='accepted';q.cost=cost;
   pushNews(p.name+'が今季限りの引退を表明。'+(q.options.length?'球団は'+q.options.map(k=>FAREWELL_OPTIONS.find(x=>x[0]===k)[1]).join('・')+'を準備します。':''),e.date);e.type='thanks';
  }else if(input.choice==='dismiss'&&['thanks','farewell'].includes(e.type))careerEventDone(e);
  else throw Error('career decision unavailable');
  return JSON.stringify(game);
 }
 if(op==='finance'){
  const crisis=game.financeCrisis;
  if(!crisis||crisis.teamId!==team.id||crisis.status!=='pending')throw Error('finance decision unavailable');
  // Original game deliberately does not enable loans until actual proof and
  // repayment terms exist. Preserve the saved world and terminal state.
  crisis.status='gameover';return JSON.stringify(game);
 }
 if(op==='club'){
  if(!canManage())throw Error('club operation blocked by required event');
  const k=input.choice,p=input.playerId===undefined?null:getPlayer(input.playerId);
  if((rosterEdit||rosterUndo)&&!freeVisible())throw Error('lineup unavailable before reveal');
  const beforeRoster=rosterEdit?roster190Capture(team):null;
  const beforeFingerprint=rosterEdit?roster190Fingerprint(team):null;
  if(k==='lineup-undo'){
   if(!undoAvailable()||!roster190Restore(team,game.canonicalRosterUndo.before))throw Error('lineup undo unavailable');
   delete game.canonicalRosterUndo;
  }else if(k==='identity'){
   ui.clubDraft={...input.identity,slot:activeSlot,id:team.id};applyIdentity(team);
  }else if(k==='lineup'||k==='rotation'){
   const arr=k==='lineup'?team.lineup:team.rotation,i=input.slot;
   if(!p||p.teamId!==team.id||p.farmTier===2||!availableForGame(p)||(k==='lineup'?isPitch(p):p.pos!=='SP')||i>=arr.length||arr[i]===p.id)throw Error('invalid lineup selection');
   const old=arr[i],other=arr.indexOf(p.id);if(other>=0)arr[other]=old;arr[i]=p.id;
   if(k==='lineup')syncLineupFielding(team);
  }else if(k==='lineup-recommend'||k==='lineup-move'||k==='lineup-replace'){
   if(!freeVisible())throw Error('lineup unavailable before reveal');
   if(k==='lineup-recommend'){
    const recommended=managerRecommendedLineup(team);
    if(roster190Fingerprint(team)===roster190Fingerprint(recommended))throw Error('lineup unchanged');
    team.lineup=recommended.lineup;team.fieldingRoles=recommended.fieldingRoles;
   }else if(k==='lineup-move'){
    if(!roster190MoveOrder(team,input.slot,input.target))throw Error('invalid lineup move');
   }else if(!roster190Replace(team,input.key,input.playerId))throw Error('invalid lineup replacement');
  }else if(k==='order'){
   const arr=input.kind==='lineup'?team.lineup:team.rotation;
   if(input.slot>=arr.length||input.target>=arr.length||input.slot===input.target)throw Error('invalid order exchange');
   [arr[input.slot],arr[input.target]]=[arr[input.target],arr[input.slot]];
  }else if(k==='fielding'){
   if(!p||p.teamId!==team.id||!assignFieldingRole(team,p.id,input.key))throw Error('fielding assignment unavailable');
  }else if(k==='farm-move'){
   if(!farmManualMove(team,p))throw Error('farm movement unavailable');
  }else if(k==='farm-mode'){
   farmClub(team).mode=input.value;if(input.value==='auto')farmBalance(team);repairTeam(team);
  }else if(k==='focus'){
   if(!p||p.teamId!==team.id||!['balanced',...seasonSkillKeys(p)].includes(input.key))throw Error('invalid training focus');p.trainFocus=input.key;
  }else if(k==='memo'){
   if(!freeVisible()||!p||p.teamId!==team.id)throw Error('own player memo unavailable');p.memo=input.value;
  }else if(k==='facility'){
   const ok=Object.hasOwn(INFRA_LABELS,input.key)?(input.direction===1?infraUpgrade(team,input.key):infraDowngrade(team,input.key)):stadiumResize(team,input.key,input.direction);
   if(!ok)throw Error('facility change unavailable');
  }else if(k==='prices'){
   if(!stadiumSetPrices(team,input.values))throw Error('price change unavailable');
  }else if(k==='travel'){
   clubLifeData(team).travel=input.value;
  }else if(k==='support'){
   if(!CLUB_SUPPORT[input.key]||CLUB_SUPPORT[input.key].phase||!clubSupportSpend(team,input.key,''))throw Error('club support unavailable');
  }else if(k==='sign'){
   if(!freeVisible()||!p||!freeAgents().includes(p)||p.retired||own(team).length>=ROSTER_MAX)throw Error('free agent unavailable');
   signPlayer(p.id);if(p.teamId!==team.id)throw Error('free agent signing unavailable');
  }else if(k==='release'){
   if(!p||p.teamId!==team.id)throw Error('release unavailable');
   releasePlayer(p.id);if(p.teamId!==null)throw Error('release unavailable');
  }else if(k==='season-trade'){
   if(!tradeAvailable())throw Error('trade unavailable');const q=gmTradeExecute(input.clubId,input.out,input.in,input.fee);if(!q.ok)throw Error(q.reason);
  }else if(k==='manager-hire'){
   const m=makeManager(team.id,game.year,input.slot),prior=team.manager,fee=r2(m.salary*.3);
   if(prior?.id===m.id||team.cash<fee)throw Error('manager hiring unavailable');
   team.cash=r2(team.cash-fee);team.manager=m;
   game.managerHistory.push({year:game.year,teamId:team.id,text:(prior?.name||'前監督')+'から'+m.name+'へ交代（'+m.contractYears+'年契約）'});
   pushNews(team.short+'が'+m.name+'新監督の就任を発表。');
  }else if(k==='manager-renew'){
   const m=team.manager;if(!m||managerTenure(team)>=7||m.contractYears!==1||game.day<98||m.renewedYear===game.year)throw Error('manager renewal unavailable');
   if(m.discontent>=75){
    if(m.resignationNoticeYear===game.year)throw Error('manager already refused');
    m.resignationNoticeYear=game.year;pushNews('【契約更改】'+m.name+'監督が続投要請を拒否。');
   }else{
    const fee=r2(m.salary*.2);if(team.cash<fee)throw Error('manager renewal budget');
    team.cash=r2(team.cash-fee);m.contractYears++;m.renewedYear=game.year;m.discontent=clamp(m.discontent-12,0,100);m.trust=clamp(70-m.discontent*.6,10,95);
    game.managerHistory.push({year:game.year,teamId:team.id,text:m.name+'監督と来季の契約更改に合意'});pushNews('【契約更改】'+team.short+'が'+m.name+'監督の来季続投を発表。');
   }
  }else if(k==='manager-order'){
   if(!team.manager||!MANAGER_TACTICS.some(t=>t[0]===input.key))throw Error('manager order unavailable');(team.gmOrders??={})[input.key]=input.value;
  }else throw Error('invalid club operation');
  if(rosterEdit&&beforeFingerprint!==roster190Fingerprint(team))game.canonicalRosterUndo={team:team.id,year:game.year,day:game.day,before:beforeRoster,after:roster190Fingerprint(team)};
  return JSON.stringify(game);
 }
 if(op==='foreign'){
  const f=flowGet(),k=input.choice;
  if(game.financeCrisis||flowInbox()||game.pendingMonth||game.pendingReview||pendingMilestoneNews().length||game.ceremonyStage||f?.active||game.pendingCeremonyIntro==='opening')throw Error('foreign market blocked by required event');
  if(k==='init'){
   if(game.foreignMarket?.year===game.year)throw Error('foreign market already initialized');
   foreignHydrate(ensureForeignMarket());return JSON.stringify(game);
  }
  const m=game.foreignMarket?.year===game.year?foreignHydrate(game.foreignMarket):null;if(!m)throw Error('foreign market unavailable');
  const conv=m.negotiations[team.id],c=m.candidates.find(x=>x.id===(conv?conv.candidateId:input.playerId));
  if(!c||!conv&&!scoutVisible(c))throw Error('foreign candidate unavailable');
  const date=f?.date||calendarNextDay()?.date||game.calendar.endDate;
  if(k==='research'&&!conv){if(!foreignResearch(m,team,c,input.key))throw Error('foreign research unavailable');}
  else if(k==='begin'&&!conv){if(!foreignBegin(m,team,c))throw Error('foreign negotiation unavailable');}
  else if(!conv)throw Error('foreign negotiation unavailable');
  else if(k==='interpreter'){if(!foreignHireInterpreter(team,conv))throw Error('foreign interpreter unavailable');}
  else if(k==='reply'){if(!foreignReply(m,team,c,conv,input.key))throw Error('foreign reply unavailable');}
  else if(k==='support'){if(conv.status!=='talk'||conv.answers.length!==3||!Object.hasOwn(FOREIGN_SUPPORT,input.key))throw Error('foreign support unavailable');conv.support[input.key]=input.enabled;conv.offerLevel=null;}
  else if(k==='offer'){if(conv.status!=='talk'||conv.answers.length!==3||!foreignAffordable(team,foreignOffer(m,c,input.level,conv.support)))throw Error('foreign offer unavailable');conv.offerLevel=input.level;}
  else if(k==='submit'){if(conv.offerLevel==null||!foreignSubmit(m,team,c,conv,conv.offerLevel))throw Error('foreign submission unavailable');}
  else if(k==='open'){
   if(conv.resultOpened)throw Error('foreign result already opened');
   if(conv.status==='waiting'&&(conv.waitDays!==0||!foreignSettle(m,team,c,conv,date)))throw Error('foreign response not ready');
   if(['talk','waiting','counter'].includes(conv.status))throw Error('foreign response not ready');conv.resultOpened=true;
  }else if(k==='counter'){if(!foreignCounterReply(m,team,c,conv,input.accept,date))throw Error('foreign counter unavailable');}
  else if(k==='reveal'){if(conv.status!=='signed'||!conv.resultOpened||conv.revealStage>=2)throw Error('foreign reveal unavailable');conv.revealStage++;}
  else if(k==='finish'){
   if(!conv.resultOpened||['talk','waiting','counter'].includes(conv.status)||conv.status==='signed'&&conv.revealStage<2)throw Error('foreign result unfinished');
   if(conv.status==='rival-pending'&&!finalizeForeignRival(m,team,c,conv))throw Error('foreign rival settlement failed');
   delete m.negotiations[team.id];
  }else throw Error('foreign command unavailable');
  return JSON.stringify(game);
 }
 if(op==='annual'){
  vipStatusProvider=()=>({verified:true,vip:input.verifiedVip===true});
  if(game.financeCrisis||flowInbox()||game.pendingMonth||game.pendingReview||pendingMilestoneNews().length||flowForeignResponse())throw Error('annual inbox unresolved');
  let f=flowGet();
  if(input.choice==='start'){
   if(f||game.day!==143||game.calendarIndex!==game.calendar.days.length||!game.postseason||!Array.isArray(game.awards))throw Error('annual start unavailable');
   if(!ensureSeasonFinanceClosed())throw Error('season finance not closed');
   f=flowInit();if(!f||f.mode!=='off')throw Error('annual flow unavailable');flowRefresh(f);
  }else{
   if(!f||!['off','pre'].includes(f.mode))throw Error('annual flow unavailable');
   if(input.choice==='day'){
    // Never bypass a ready event, and never cross into an unsupported rollover.
    const m=f.jobs['movement-market'];
    if(m?.status==='ready'&&(!m.state||['eve','opening','results'].includes(m.state.news)))throw Error('market news acknowledgement required');
    if(f.mode==='off'&&f.date>=String(game.year+1)+'-01-31'&&Object.values(f.jobs).some(j=>j.status!=='done'))throw Error('annual market exceeded defensive date bound');
    if(!flowDay(f))throw Error('annual date blocked');
   }else if(input.choice==='open'){
    const j=f.jobs[input.job];
    if(!annualSupported.includes(input.job)||input.job==='movement-market')throw Error('annual event unavailable');
    const opened=commercialJobs.includes(input.job)?(input.job==='sponsor'?sponsorAction('sponsor-open',{dataset:{}}):commerceAction('commerce-open',{dataset:{value:input.job}})):flowOpen(f,j);
    if(!opened)throw Error('annual event unavailable');
    if(j.id==='movement-declarations')movementInit();
    if(['renewal1','renewal2'].includes(j.id))renewalData(team,true);
    if(j.id!=='offdesk-opening')game.pendingCeremonyIntro=null;
   }else if(input.choice==='complete'){
    const j=f.jobs[f.active];
    if(!j||j.id!==input.job||!annualSupported.includes(j.id))throw Error('annual event unavailable');
    if(commercialJobs.includes(j.id)||['movement-market','booking','self','winter-return','camp','exhibition','offdesk-opening'].includes(j.id))throw Error('explicit result confirmation required');
    if(j.id==='movement-declarations'&&movementData()?.requests.some(r=>r.from===team.id&&['request','refused'].includes(r.status)))throw Error('movement decision required');
    if(j.id==='draft'&&(game.draft?.phase!=='done'||game.draft.announcement||game.draft.rareIntro))throw Error('draft unfinished');
    if(j.id==='roster-cut'){
     const d=game.draft;if(d?.phase!=='done'||d.cutConfirmed||draftRosterProjection(d,team).excess||!draftPlanCPU(d)||game.teams.some(t=>draftRosterProjection(d,t).excess))throw Error('roster projection exceeds limit');
     d.cutConfirmed=true;
    }
    if(['renewal1','renewal2'].includes(j.id)){
     const d=renewalData(team);if(!d||d.confirmed||renewalUnresolved(d).length)throw Error('renewal unfinished');
     if(!renewalFinish(team))throw Error('renewal confirmation failed');
    }
    if(['autumn','winter'].includes(j.id)&&!annualReport(j.id))throw Error('training report required');
    flowComplete(f,j);
   }else if(input.choice==='preseason'){
    const phase=f.active,j=f.jobs[phase],k=input.decision;
    if(!j||j.status!=='active'||!['booking','self','winter-return','camp','exhibition'].includes(phase))throw Error('preseason event unavailable');
    const p=annualPlan(team,'camp',false);
    if(k==='site'&&['booking','camp'].includes(phase)){
     const sites=campChoice(team,true),plan=annualPlan(team,'camp',true);
     if(plan.paid||plan.step||!CAMP_SITES.some(s=>s[0]===input.value))throw Error('camp selection unavailable');
     if(input.group==='farm'&&CAMP_SITES.indexOf(campSite(input.value))<CAMP_SITES.indexOf(campSite(sites.first)))throw Error('farm site exceeds first team tier');
     sites[input.group]=input.value;
     if(CAMP_SITES.indexOf(campSite(sites.farm))<CAMP_SITES.indexOf(campSite(sites.first)))sites.farm=sites.first;
    }else if(k==='confirm-sites'&&['booking','camp'].includes(phase)){
     const plan=annualPlan(team,'camp',true),sites=campChoice(team,true);
     if(plan.paid||plan.step||!refCharge(team,campCost(sites)))throw Error('camp purchase unavailable');
     plan.paid=true;plan.cost=campCost(sites);plan.step=1;
     if(phase==='booking')flowComplete(f,j);
    }else if(k==='kickoff'&&phase==='camp'){
     if(!p.paid||p.step!==1||annualReport('camp'))throw Error('camp kickoff unavailable');
     p.step=2;j.state.waiting='visit';j.state.due=annualDate('camp');if(j.state.due<=f.date)j.state.due=calendarOffsetDate(f.date,1);flowPark(f,j,'waiting');
    }else if(k==='visit'&&phase==='camp'){
     if(p.step!==2||p.visitPending||annualReport('camp'))throw Error('camp visit unavailable');
     p.visit=input.value;p.visitPending=true;
     if(input.value==='inside'||input.value==='outside')game.fans+=input.value==='inside'?250:500;
     if(input.value==='meeting')game.fieldRating=clamp(game.fieldRating+2,0,100);
     if(input.value==='outside')game.fieldRating=clamp(game.fieldRating-2,0,100);
    }else if(k==='visit-finish'&&phase==='camp'){
     if(p.step!==2||!p.visitPending)throw Error('camp visit unfinished');p.visitPending=false;p.step=3;
     j.state.waiting='visit';j.state.due=annualDate('camp');if(j.state.due<=f.date)j.state.due=calendarOffsetDate(f.date,1);flowPark(f,j,'waiting');
    }else if(k==='policy'&&phase==='exhibition'){
     if(j.state.reportMeeting||annualReport(phase))throw Error('exhibition policy locked');annualPlan(team,phase,true).exhibition=input.value;
    }else if(k==='self-back'&&phase==='self'){
     if(!j.state.reportSelfSupport||annualReport(phase))throw Error('self training review unavailable');j.state.reportSelfSupport=false;
    }else if(k==='digest'&&phase==='exhibition'){
     if(!annualReport(phase)||j.state.digestSeen)throw Error('exhibition digest unavailable');j.state.digestSeen=true;
    }else if(k==='support'&&phase==='self'){
     if(!j.state.reportSelfSupport||annualReport(phase)||!CLUB_SUPPORT[input.value]?.phase?.includes('self')||!clubSupportSpend(team,input.value,'self'))throw Error('training support unavailable');
    }else if(k==='run'&&['self','camp','exhibition'].includes(phase)){
     if(annualReport(phase)||phase==='camp'&&p.step!==3)throw Error('preseason run unavailable');
     if(phase==='self'&&!j.state.reportSelfSupport)j.state.reportSelfSupport=true;
     else if(phase==='exhibition'&&!j.state.reportMeetingDone){j.state.reportMeeting=true;j.state.reportMeetingDone=true;}
     else{j.state.reportMeeting=false;j.state.waiting=true;j.state.due=annualDate(phase,true);if(j.state.due<=f.date)j.state.due=calendarOffsetDate(f.date,1);flowPark(f,j,'waiting');}
    }else if(k==='finish'){
     if(phase==='winter-return'){
      const r=game.annualTraining?.results?.[(game.year-1)+':winter'];if(!r?.returned)throw Error('winter return report missing');
     }else if(!['self','camp','exhibition'].includes(phase)||!annualReport(phase))throw Error('preseason report missing');
     if(phase==='exhibition'&&!j.state.digestSeen)throw Error('exhibition digest confirmation required');
     flowComplete(f,j);
    }else throw Error('preseason decision unavailable');
   }else if(input.choice==='market'){
    const j=f.jobs['movement-market'],k=input.decision;
    if(!j)throw Error('market unavailable');
    if(k==='open'){
     if(!flowOpen(f,j,input.room))throw Error('market room unavailable');
     game.pendingCeremonyIntro=null;
    }else{
     const x=j.state,d=movementData();
     if(f.active!==j.id||j.status!=='active'||!x?.open||!d||d.closed)throw Error('market room unavailable');
     if(k==='news'){
      if(x.view!=='news'||!['eve','opening','results'].includes(x.news))throw Error('market news unavailable');
      // Same persisted transitions as offdesk-news-eve/open/results, without DOM event guards.
      if(x.news==='eve')x.news='opening-wait';
      else if(x.news==='opening'){x.marketOpened??=f.date;faClock(d,x);faOpeningDraw(f.date);x.news=null;}
      else {if((d.eventRows||[]).some(r=>playerTitleTheme(getPlayer(r.id))&&!x.faNewsSeen?.includes(r.id)))throw Error('special market result acknowledgement required');x.news=null;}
      x.open=false;flowPark(f,j,'ready');
     }else if(k==='special-result'){
      if(x.view!=='news'||x.news!=='results'||!(d.eventRows||[]).some(r=>r.id===input.playerId&&playerTitleTheme(getPlayer(r.id)))||x.faNewsSeen?.includes(input.playerId))throw Error('special result unavailable');
      (x.faNewsSeen??=[]).push(input.playerId);
     }else if(k==='home'){
      if(x.news)throw Error('market news acknowledgement required');
      flowPark(f,j,'ready');
     }else if(k==='close'){
      if(x.news||x.view!=='other'||d.cpuDone||faUnreadRows(d).length||Object.values(d.offers).some(o=>['waiting','counter'].includes(o.status)))throw Error('market negotiations unfinished');
      movementCPU(d);if(!d.cpuDone)throw Error('market close rejected');
      x.news='results';x.view=null;x.faFocus=null;x.faStage=0;game.offseasonMarketEnd={year:game.year,date:f.date};flowPark(f,j,'ready');
     }else if(k==='finish'){
      if(x.news||x.view!=='other'||!d.cpuDone||faUnreadRows(d).length)throw Error('market results unfinished');
      d.closed=true; // existing movement-market-finish final compensation transition
      flowComplete(f,j);
     }else if(k==='comp'){
      if(x.news||x.view!=='other'||!d.cpuDone)throw Error('compensation unavailable');
      const deal=d.deals.find(a=>a.id===input.playerId);
      if(!deal||!movementChooseComp(d,deal,input.otherId))throw Error('compensation rejected');
     }else if(k==='free'){
      if(x.news||x.view!=='other'||d.cpuDone)throw Error('free agent unavailable');
      const row=movementPool(d).find(r=>r.kind==='free'&&r.id===input.playerId);
      if(!row||!movementBid(d,row,input.salary))throw Error('free agent offer rejected');
     }else if(k==='trade'){
      if(x.news||x.view!=='other'||d.cpuDone)throw Error('trade unavailable');
      const a=getPlayer(input.playerId),b=getPlayer(input.otherId),u=getTeam(b?.teamId);
      if(!u||!movementTrade(d,team,u,a,b))throw Error('trade rejected');
     }else if(k==='exchange'){
      if(x.news||x.view!=='other'||d.cpuDone||!movementExchange(d,team,input.playerId))throw Error('exchange rejected');
     }else{
      if(x.news||!['fa','return'].includes(x.view)||d.cpuDone)throw Error('FA negotiation unavailable');
      const row=offdeskMarketRows(d,x.view).find(r=>r.id===input.playerId),o=row&&d.offers[row.id];
      if(!row)throw Error('FA player unavailable');
      if(k==='ack'){
       if(!faUnread(o))throw Error('FA reply unavailable');o.seen=true;
      }else{
       if(!faCanApproach(d,row)||faUnread(o))throw Error('FA negotiation unavailable');
       if(k==='talk'||k==='salary'){
        if(k==='salary'){const b=faSalaryBounds(d,row,faTalk(d,row,true));if(input.million<b.min||input.million>b.max)throw Error('FA salary exceeds available funds');}
        if(!faTalkCommand(d,row,k==='salary'?'million:'+input.million:input.key))throw Error('FA dialogue rejected');
       }else if(k==='years'){
        const v=faTalk(d,row,true);v.years=input.years;
       }else if(k==='submit'){
        if(!faSubmitTalk(d,row,x))throw Error('FA offer rejected');
       }else if(k==='withdraw'){
        if(o?.status!=='counter')throw Error('FA counter unavailable');o.status='refused';o.seen=true;o.resolved=x.date;
       }else throw Error('FA operation unavailable');
      }
     }
    }
   }else if(input.choice==='commerce'){
    const job=f.active,j=f.jobs[job],s=j?.state,k=input.decision;
    if(!commercialJobs.includes(job)||j.status!=='active'||!s)throw Error('commerce stage unavailable');
    if(job==='sponsor'){
     const action={start:'sponsor-start',toggle:'sponsor-toggle',confirm:'sponsor-confirm',finish:'sponsor-finish',back:'sponsor-back'}[k];
     if(!action||!sponsorAction(action,{dataset:{value:input.value}}))throw Error('sponsor decision rejected');
    }else if(k==='name'){
     if(job!=='fanclub'||s.stage!=='selection')throw Error('fanclub name unavailable');
     s.name=input.value;
    }else{
     const action={start:'commerce-start',back:'commerce-back',finish:'commerce-finish',confirm:'commerce-confirm',decline:'commerce-decline',park:'commerce-schedule-finish',plan:'commerce-plan',player:'commerce-player',fee:'commerce-fee',perk:'commerce-perk',color:'commerce-color',font:'commerce-font',delta:'commerce-delta',choice:'commerce-choice',live:'commerce-live-finish',tv:'commerce-tv-finish',opening:'commerce-opening-live-finish'}[k];
     const allowed={plan:['fan-fest','opening-promo'],player:['tv'],fee:['fanclub'],perk:['fanclub'],color:['fanclub'],font:['fanclub'],delta:['broadcast'],choice:['naming'],live:['fan-fest'],tv:['tv'],opening:['opening-promo'],park:['fan-fest','tv','opening-promo'],decline:['fan-fest','tv','opening-promo']};
     if(!action||allowed[k]&&!allowed[k].includes(job))throw Error('commerce decision unavailable');
     if(k==='player'&&!s.players.includes(input.value)&&s.players.length>=5)throw Error('TV roster full');
     if(!commerceAction(action,{dataset:{value:String(input.value??'')}}))throw Error('commerce decision rejected');
    }
   }else if(input.choice==='renewal'){
    if(!['renewal1','renewal2'].includes(f.active)||game.ceremonyStage!=='renewal')throw Error('renewal stage unavailable');
    const d=renewalData(team,true),k=input.decision,row=d.rows.find(x=>x.id===input.playerId);
    if(d.confirmed)throw Error('renewal already confirmed');
    if(k==='bulk')renewalBulk(d,input.mode);
    else if(k==='submit'){if(!d.rows.some(r=>renewalEditable(d,r)))throw Error('no editable renewal');if(input.bonus)reportRenewalBonuses(d);renewalSubmitAll(d);}
    else if(k==='offer'){
     if(!row||!renewalEditable(d,row))throw Error('renewal offer unavailable');
     const allowed=renewalBonusOptions(getPlayer(row.id));
     if(new Set(input.bonuses).size!==input.bonuses.length||input.bonuses.some(key=>!allowed.some(x=>x[0]===key)))throw Error('invalid renewal bonus');
     row.bonuses=input.bonuses.slice();if(!renewalOffer(d,row,input.salary))throw Error('renewal offer rejected');
    }else if(k==='release'){if(!renewalRelease(d,row))throw Error('renewal release rejected');}
    else if(k==='restore'){if(row?.status!=='released')throw Error('renewal restore rejected');row.status=row.history.at(-1)?.status==='pending'?'pending':'unoffered';}
    else if(k==='retire'){if(!renewalRetire(d,row))throw Error('renewal retirement rejected');}
    else if(k==='next'){
     if(f.active!=='renewal1'||d.rows.some(r=>r.status==='unoffered'||r.status==='retire-intent')||!renewalNextRound(d))throw Error('renewal second round unavailable');
     flowComplete(f,f.jobs.renewal1);
    }else if(k==='final-release'){
     if(f.active!=='renewal2'||d.round!==2||d.rows.some(r=>r.status==='unoffered'||r.status==='retire-intent')||!renewalUnresolved(d).length)throw Error('final release unavailable');
     for(const row of renewalUnresolved(d))if(!renewalRelease(d,row))throw Error('final release rejected');
    }else throw Error('renewal operation unavailable');
   }else if(input.choice==='training'){
    const phase=f.active,j=f.jobs[phase],k=input.decision;
    if(!['autumn','winter','self'].includes(phase)||game.ceremonyStage!==phase||annualReport(phase)||!j?.state?.open)throw Error('training operation unavailable');
    if(k==='menu'&&['autumn','self'].includes(phase)&&!j.state.reportSelfSupport){
     const p=annualPlayers(team,phase).find(p=>p.id===input.playerId);
     if(!p||!['balanced',...seasonSkillKeys(p)].includes(input.focus)||p.injury&&input.intensity!=='rest')throw Error('training menu unavailable');
     annualPlan(team,phase,true).menus[p.id]={focus:input.focus,intensity:input.intensity};
    }else if(k==='assign'&&phase==='winter'){
     const p=winterEligible(team).find(p=>p.id===input.playerId),plan=winterPlan(team,true);
     if(!p||input.destination!=='none'&&!winterDest(input.destination))throw Error('winter destination unavailable');
     if(input.destination==='none')delete plan[p.id];else{if(!plan[p.id]&&Object.keys(plan).length>=4)throw Error('winter roster full');plan[p.id]=input.destination;}
     if(winterCost(plan)>team.cash)throw Error('winter budget insufficient');
     annualPlan(team,'winter',true).destinations=plan;
    }else if(k==='run'&&phase!=='self'){
     if(!ensureSeasonFinanceClosed())throw Error('season finance not closed');
     if(phase==='winter'){if(!annualRunPhase('winter'))throw Error('winter dispatch unavailable');}
     else{const x=j.state;x.waiting=true;x.due=annualDate(phase,true);if(x.due<=f.date)x.due=calendarOffsetDate(f.date,1);flowPark(f,j,'waiting');}
    }else throw Error('training operation unavailable');
   }else if(input.choice==='draft'){
    const d=game.draft,k=input.decision;
    if(f.active!=='draft'||game.ceremonyStage!=='draft'||d?.year!==game.year)throw Error('draft stage unavailable');
    const pending=draftPending(d);
    if(d.rareIntro){if(k!=='intro')throw Error('draft intro required');d.rareIntro=false;}
    else if(d.announcement){if(k==='announcement')d.announcement=null;else if(k==='announcement-next')draftAdvanceAnnouncement(d);else throw Error('draft announcement required');}
    else if(pending){if(k!=='dismiss'||input.playerId!==pending.candidateId)throw Error('draft recovery decision required');pending.recoveryPending=false;pending.recoveryCelebration=false;}
    else if(k==='research'&&['scout','first','later'].includes(d.phase)){
     const c=draftCandidate(d,input.playerId);
     if(!c||!scoutVisible(c)||c.status!=='available'||draftResearchUsed(d,team)>=draftScoutBudget(team)||draftResearchLevel(d,team,c)>=3)throw Error('draft research unavailable');
     const tasks=scoutTasks(d,team,c),key=input.key;
     if(!Object.hasOwn(SCOUT_TASKS,key)||tasks.includes(key))throw Error('draft research already performed');
     d.scoutTasks??={};d.scoutTasks[team.id]??={};d.scoutTasks[team.id][c.id]=[...tasks,key];d.research??={};d.research[team.id]??={};d.research[team.id][c.id]=draftResearchLevel(d,team,c)+1;
    }else if(k==='start'&&d.phase==='scout'){
     draftStart(d);if(d.candidates.some(c=>playerTitleTheme(c.player))&&!d.rareIntroSeen){d.rareIntroSeen=true;d.rareIntro=true;}
    }else if(k==='nominate'||k==='pass'||k==='cpu'){
     const id=k==='nominate'?input.playerId:null,phase=d.phase,round=d.round,pickStart=d.picks.length,passStart=d.passed.length;
     if(phase==='first'){
      if(k==='cpu'?d.active.includes(team.id):!d.active.includes(team.id))throw Error('draft turn unavailable');
      if(!draftFirst(d,id,k==='cpu'))throw Error('nomination rejected');
     }else if(phase!=='later'||k==='cpu'||!draftLater(d,id))throw Error('nomination rejected');
     draftQueueAnnouncements(d,phase,round,pickStart,passStart);
    }else if(k==='ticket'||k==='delegate'){
     if(!draftDraw(d,k==='ticket'?input.ticket:null,k==='ticket'?'manual':'delegate'))throw Error('lottery draw rejected');
    }else if(k==='reveal'){
     if(!draftOpenTicket(d))throw Error('lottery reveal rejected');
    }else if(k==='next-draw'){
     if(!draftNextDraw(d))throw Error('lottery next rejected');
    }else if(k==='next-round'&&d.phase==='first-result'){
     const pickStart=d.picks.length,passStart=d.passed.length;draftNextFirst(d);draftQueueAnnouncements(d,'later',d.round,pickStart,passStart);
    }else if(k==='reply'||k==='offer'||k==='withdraw'||k==='delegate-contract'){
     const row=draftOwnRow(d);
     if(d.phase!=='negotiate'||!row||row.candidateId!==input.playerId)throw Error('draft negotiation unavailable');
     if(k==='reply'){if(!draftReply(d,row,input.answer))throw Error('draft reply rejected');}
     else if(k==='offer'){if(!draftOfferResponse(d,row,input.level,input.role))throw Error('draft offer rejected');if(row.status==='refused')row.recoveryPending=true;}
     else if(k==='withdraw')draftWithdraw(d,row);
     else draftAutoNegotiation(d,row);
    }else if(k==='finish'){if(!draftFinalize(d))throw Error('draft unfinished');}
    else throw Error('draft operation unavailable');
   }else if(input.choice==='cut'){
    if(f.active!=='roster-cut'||game.ceremonyStage!=='roster-cut'||!draftToggleCut(game.draft,team,input.playerId))throw Error('roster cut rejected');
   }else if(input.choice==='movement'){
    if(f.active!=='movement-declarations'||game.ceremonyStage!=='movement-declarations')throw Error('movement stage unavailable');
    const r=movementData()?.requests.find(x=>x.id===input.playerId&&x.from===team.id);
    if(!r||!['request','refused'].includes(r.status))throw Error('movement request unavailable');
    const before=JSON.stringify(r),action={allow:'movement-allow',deny:'movement-deny',retain:'movement-retain'}[input.decision];
    movementAction(action,{dataset:{id:String(r.id),value:String(input.multiplier??1)}});
    if(JSON.stringify(r)===before)throw Error('movement decision rejected');
   }else throw Error('unsupported annual operation');
  }
  return JSON.stringify(game);
 }
 if(op==='advance'){
  // Verified entitlement is supplied by the authority, not a command or save.
  vipStatusProvider=()=>({verified:true,vip:input.verifiedVip===true});
  if(input.routine===true){
   if(!canCalendar())throw Error('calendar boundary');
   deferRoutine();
  }
  if(game.day>=143||game.financeCrisis||flowGet()||game.pendingCeremonyIntro==='opening'||game.pendingDraftReveal||game.pendingDecade!=null)throw Error('pilot season boundary');
  if(pendingRareNews().length||game.pendingMilestoneIds?.length||game.pendingEvent||game.pendingMonth||game.pendingReview||careerEventPending()||flowForeignResponse())throw Error('pilot event acknowledgement required');
  if(checkFinanceCrisis(calendarNextDay()?.date||game.calendar.endDate))return JSON.stringify(game);
  const e=processCalendarDay();if(!e)throw Error('calendar ended');
  collectMilestoneNews(e);scoutDiscoveryDaily(e);rareDaily(e);careerDecisionTick(e);
  if(input.routine===true)deferRoutine();
  checkFinanceCrisis(calendarNextDay()?.date||game.calendar.endDate);
  return JSON.stringify(game);
 }
 if(op==='achievements'){
  const entries=new Map();
  const win=(year,day)=>{if(Number.isSafeInteger(year)&&year>=2027&&Number.isSafeInteger(day)&&day>=1&&day<=143){const key='win:'+year+':'+day;entries.set(key,{key,label:'試合勝利 '+year+' / '+day,eligible:true,art:{year,kind:'win'}});}};
  for(const g of game.games)if((g.home===team.id&&g.homeScore>g.awayScore)||(g.away===team.id&&g.awayScore>g.homeScore))win(g.year,g.day);
  // Existing memorial album is generated from actual game records. Only
  // own-club entries with a supported source and explicit team ID qualify.
  for(const e of memorialEntries()){
   if(e.teamId!==team.id||typeof e.id!=='string'||typeof e.title!=='string'||e.id.length>512||!e.title)continue;
   if(e.kind==='win'){
    const m=/^win:(\\d{4,}):(\\d+):(\\d+)$/.exec(e.id);
    if(m&&Number(m[2])===team.id)win(Number(m[1]),Number(m[3]));
    continue;
   }
   // Preserve all previously exposed keys. New kinds are genuine own-club
   // album events, not sharing actions or another club's headline.
   if(!['award','facility','championship','league-championship','retirement','farewell','club-record'].includes(e.kind)&&!e.featKey&&!e.recordKey&&!e.anniversary&&!(e.id.startsWith('news:')&&memorialNewsEligible(e,team)))continue;
   const key='memorial:'+e.id;
   if(!entries.has(key))entries.set(key,{key,label:e.title.slice(0,160),eligible:true,art:{year:e.year,kind:e.anniversary?'anniversary':['facility','championship','league-championship','award','retirement','farewell','club-record'].includes(e.kind)?e.kind:'record'}});
  }
  // Special news and the ordinary record edition sometimes describe the
  // same achievement. Reuse the ordinary key rather than granting twice.
  const careerNews=new Set((game.milestoneNews||[]).filter(e=>e.teamId===team.id&&e.careerKey).map(e=>e.playerId+':'+e.careerKey));
  const addRare=(key,title)=>{key='memorial:'+key;if(!entries.has(key))entries.set(key,{key,label:title.slice(0,160),eligible:true});};
  for(const e of game.rareNews||[]){
   if(typeof e.id!=='string'||e.id.length>480||typeof e.title!=='string'||!e.title||!e.category||!Number.isSafeInteger(e.year)||!e.id.startsWith(e.year+':'))continue;
   if(e.kind==='foreign-discovery'){
    // Own scout discovery is a genuine server event; only its public title.
    if(e.scoutTeamId===team.id&&e.id===e.year+':foreign-discovery:'+e.playerId)addRare('rare:'+e.id,e.title);
    continue;
   }
   if(e.teamId!==team.id||!Number.isSafeInteger(e.playerId))continue;
   const k=e.id.slice(String(e.year).length+1);
   if(k.startsWith('awards:'))continue; // actual annual title entries already qualify
   if(k.startsWith('feat:')){addRare('news:'+e.id,e.title);continue;}
   if(k.startsWith('record:'))continue; // use original official record-update evidence only
   if(k.startsWith('career:')){
    const c=k.slice(('career:'+e.playerId+':').length);
    if(careerNews.has(e.playerId+':'+c))continue;
    addRare('news:'+e.id,e.title);continue;
   }
   const stat=k.match(/^stat:(\\d+):([a-z]+):(\\d+)$/);
   if(stat&&Number(stat[1])===e.playerId){
    const equivalent={'w:20':'season20w','k:200':'season200k','h:200':'season200h'}[stat[2]+':'+stat[3]];
    if(equivalent){addRare('news:'+e.year+':season-feat:'+e.playerId+':'+equivalent,e.title);continue;}
    addRare('rare:'+e.id,e.title);continue;
   }
   if(k==='debut:'+e.playerId||k==='awakening:'+e.playerId||k.startsWith('lineage:'+e.playerId+':'))addRare('rare:'+e.id,e.title);
  }
  return JSON.stringify([...entries.values()]);
 }
 if(op==='view')return JSON.stringify({year:game.year,day:game.day,calendarIndex:game.calendarIndex,team:{id:team.id,name:team.name,short:team.short,league:team.league,color:team.color,letter:team.letter,emblem:team.emblem||null,wins:team.wins,losses:team.losses,ties:team.ties,cash:team.cash},gmName:game.gmName||'GM',games:game.games.length,headquarters:headquartersView(),inbox:inbox(),club:clubView(),foreign:foreignView(),annual:annualView(),vipIncome:r2((game.financeLedger?.clubs?.[team.id]?.vipIncome||0)+vipOffTotal(team,game.year)),retirementEligible:retirement().length===1,medical:medical().length,managerEligible:manager().length===1,acknowledgements:{month:!!(game.pendingMonth&&game.monthlyArchive?.some(m=>m.year===game.pendingMonth.year&&m.id===game.pendingMonth.id)),milestones:!!game.pendingMilestoneIds?.length},blocked:!!(game.financeCrisis||pendingRareNews().length||game.pendingMilestoneIds?.length||game.pendingEvent||game.pendingMonth||game.pendingReview||careerEventPending()||flowForeignResponse()||game.day>=143)});
 throw Error('unsupported pilot operation');
 `;
 const compiled=new vm.Script(pre+source.replace('(() => {','(() => {')+tail+'})();',{filename:'pennant-lab-headless-pilot.js'});
 function validateWorld(state){
  if(!state||typeof state!=='object'||state.started!==true||!Array.isArray(state.teams)||!Array.isArray(state.players)||!Array.isArray(state.games))throw Error('invalid server world');
  const seed=state.seed;if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('invalid server seed');return seed;
 }
 function execute(seed,input){
  const context={SERVER_SEED:seed||1,SERVER_INPUT:input};
  const result=compiled.runInNewContext(context,{timeout:10000,microtaskMode:'afterEvaluate',contextCodeGeneration:{strings:false,wasm:false}});
  if(typeof result!=='string')throw Error('engine did not return a state');
  return JSON.parse(result);
 }
 function run(op,state,extra={}){
  const seed=op==='new'?randomInt(1,0xffffffff):validateWorld(state);
  return execute(seed,JSON.stringify({op,state,...extra}));
 }
 // Serialize a large persisted world only once; retain independent VM contexts
 // so view normalization cannot affect action eligibility or vice versa.
 function readProjection(state){
  const seed=validateWorld(state),encoded=JSON.stringify(state);
  return {game:execute(seed,'{"op":"view","state":'+encoded+'}'),actions:execute(seed,'{"op":"actions","state":'+encoded+'}')};
 }
 const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
 // Accept only the original editor's fields and enumerated designs; no HTML,
 // image uploads, CSS, client state, random seed or additional game attributes.
 const identityKeys=['gmName','name','short','letter','color','accent','shape','pattern','font','motif'];
 const boundedText=(v,max)=>typeof v==='string'&&Array.from(v.trim()).length<=max&&v.length<=max*2&&!/[\u0000-\u001f\u007f]/.test(v);
 const validIdentity=v=>exact(v,identityKeys)&&boundedText(v.gmName,22)&&boundedText(v.name,30)&&boundedText(v.short,8)&&boundedText(v.letter,3)&&[v.color,v.accent].every(c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c))&&['circle','square','shield','diamond','hex'].includes(v.shape)&&['solid','split','stripe','rim'].includes(v.pattern)&&['bold','serif','italic','mono'].includes(v.font)&&['letter','star','vortex','wing','comet','swan','mountain','gear','moon','spark','wave','crest','bolt'].includes(v.motif);
 const validTrade=(v)=>Number.isSafeInteger(v.clubId)&&v.clubId>=0&&v.clubId<12&&[v.out,v.in].every(ids=>Array.isArray(ids)&&ids.length<=3&&ids.every(id=>Number.isSafeInteger(id)&&id>0))&&v.out.length+v.in.length>0&&new Set([...v.out,...v.in]).size===v.out.length+v.in.length&&Number.isFinite(v.fee)&&Math.abs(v.fee)<=30&&Math.round(v.fee*100)/100===v.fee;
 return Object.freeze({
  sourceHash:hash,readProjection,
  newWorld(command){
   if(exact(command,[]))return run('new',null);
   if((!exact(command,['team'])&&!(exact(command,['team','identity'])&&validIdentity(command.identity)))||!Number.isSafeInteger(command.team)||command.team<0||command.team>11)throw Error('invalid pilot team or identity');
   return run('new',null,{team:command.team,identity:command.identity});
  },
  advance(state,command,rights){
   const verifiedVip=rights?.verified===true&&rights.vip===true;
   if(exact(command,['annual'])&&['start','day'].includes(command.annual))return run('annual',state,{choice:command.annual,verifiedVip});
   if(exact(command,['annual','job'])&&['open','complete'].includes(command.annual)&&['awards-all','settlement','movement-declarations','draft','roster-cut','renewal1','renewal2','autumn','winter','fan-fest','tv','fanclub','sponsor','broadcast','naming','booking','self','winter-return','camp','exhibition','opening-promo','offdesk-opening'].includes(command.job))return run('annual',state,{choice:command.annual,job:command.job,verifiedVip});
   if(exact(command,['annual','playerId'])&&command.annual==='cut'&&Number.isSafeInteger(command.playerId))return run('annual',state,{choice:'cut',playerId:command.playerId,verifiedVip});
   if(exact(command,['finance','confirmed'])&&command.finance==='gameover'&&command.confirmed===true)return run('finance',state);
   if(command?.club==='season-trade'){
    if(!exact(command,['club','clubId','out','in','fee','confirmed'])||command.confirmed!==true||!validTrade(command))throw Error('invalid confirmed trade');
    return run('club',state,{choice:command.club,clubId:command.clubId,out:command.out,in:command.in,fee:command.fee});
   }
   if(command?.club){
    const k=command.club,base=['club'],pid=Number.isSafeInteger(command.playerId)&&command.playerId>0;
    let valid=false;
    const slot=v=>Number.isSafeInteger(v)&&v>=0&&v<9;
    if(k==='identity')valid=exact(command,[...base,'identity','confirmed'])&&command.confirmed===true&&validIdentity(command.identity);
    if(k==='lineup'||k==='rotation')valid=pid&&slot(command.slot)&&exact(command,[...base,'playerId','slot']);
    if(k==='order')valid=exact(command,[...base,'kind','slot','target'])&&['lineup','rotation'].includes(command.kind)&&slot(command.slot)&&slot(command.target);
    if(k==='lineup-undo')valid=exact(command,base);
    if(k==='lineup-recommend')valid=exact(command,[...base,'confirmed'])&&command.confirmed===true;
    if(k==='lineup-move')valid=exact(command,[...base,'slot','target'])&&slot(command.slot)&&slot(command.target)&&command.slot!==command.target;
    if(k==='lineup-replace')valid=pid&&exact(command,[...base,'playerId','key'])&&['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(command.key);
    if(k==='fielding')valid=pid&&exact(command,[...base,'playerId','key'])&&['C','1B','2B','3B','SS','LF','CF','RF','DH'].includes(command.key);
    if(k==='farm-move')valid=pid&&exact(command,[...base,'playerId']);
    if(k==='farm-mode')valid=exact(command,[...base,'value'])&&['auto','manual'].includes(command.value);
    if(k==='focus')valid=pid&&exact(command,[...base,'playerId','key'])&&typeof command.key==='string'&&command.key.length<=20;
    if(k==='memo')valid=pid&&exact(command,[...base,'playerId','value'])&&typeof command.value==='string'&&command.value.length<=2000&&Array.from(command.value).every(ch=>{const code=ch.charCodeAt(0);return code>=32&&code!==127||[9,10,13].includes(code);});
    if(k==='facility')valid=exact(command,[...base,'key','direction'])&&['training','indoor','medical','draft','foreign','park','food','goods'].includes(command.key)&&[-1,1].includes(command.direction);
    if(k==='prices')valid=exact(command,[...base,'values'])&&Array.isArray(command.values)&&command.values.length===5&&command.values.every(v=>Number.isSafeInteger(v)&&v>=500&&v<=20000&&v%100===0);
    if(k==='travel')valid=exact(command,[...base,'value'])&&[0,1,2,3].includes(command.value);
    if(k==='support')valid=exact(command,[...base,'key'])&&typeof command.key==='string'&&command.key.length<=30;
    if(['sign','release'].includes(k))valid=pid&&exact(command,[...base,'playerId','confirmed'])&&command.confirmed===true;
    if(k==='manager-hire')valid=exact(command,[...base,'slot','confirmed'])&&[1,2,3].includes(command.slot)&&command.confirmed===true;
    if(k==='manager-renew')valid=exact(command,[...base,'confirmed'])&&command.confirmed===true;
    if(k==='manager-order')valid=exact(command,[...base,'key','value'])&&typeof command.key==='string'&&command.key.length<=20&&['auto','attack','safe'].includes(command.value);
    if(!valid)throw Error('invalid club command');
    return run('club',state,{choice:k,playerId:command.playerId,slot:command.slot,target:command.target,kind:command.kind,key:command.key,value:command.value,values:command.values,direction:command.direction,identity:command.identity});
   }
   if(command?.foreign){
    const k=command.foreign,base=['foreign'],pid=Number.isSafeInteger(command.playerId)&&command.playerId>0;
    let valid=['init','interpreter','submit','open','reveal','finish'].includes(k)&&exact(command,base);
    if(k==='begin')valid=pid&&exact(command,[...base,'playerId']);
    if(k==='research')valid=pid&&exact(command,[...base,'playerId','key'])&&['field','analysis','interview'].includes(command.key);
    if(k==='reply')valid=exact(command,[...base,'key'])&&typeof command.key==='string'&&command.key.length<=30;
    if(k==='support')valid=exact(command,[...base,'key','enabled'])&&['interpreter','housing'].includes(command.key)&&typeof command.enabled==='boolean';
    if(k==='offer')valid=exact(command,[...base,'level'])&&[0,1,2].includes(command.level);
    if(k==='counter')valid=exact(command,[...base,'accept'])&&typeof command.accept==='boolean';
    if(!valid)throw Error('invalid foreign command');
    return run('foreign',state,{choice:k,playerId:command.playerId,key:command.key,enabled:command.enabled,level:command.level,accept:command.accept});
   }
   if(command?.annual==='preseason'){
    const k=command.decision,base=['annual','decision'];
    let valid=['confirm-sites','kickoff','visit-finish','run','finish','self-back','digest'].includes(k)&&exact(command,base);
    if(k==='site')valid=exact(command,[...base,'group','value'])&&['first','farm'].includes(command.group)&&['usa','miyazaki','ginowan','naha','korea','taiwan','ishigaki','miyako','kagoshima','ehime','amami','club','none'].includes(command.value);
    if(k==='visit')valid=exact(command,[...base,'value'])&&['inside','outside','rest','meeting'].includes(command.value);
    if(k==='policy')valid=exact(command,[...base,'value'])&&['balanced','first','youth'].includes(command.value);
    if(k==='support')valid=exact(command,[...base,'value'])&&['drinks','training'].includes(command.value);
    if(!valid)throw Error('invalid preseason command');
    return run('annual',state,{choice:'preseason',decision:k,group:command.group,value:command.value,verifiedVip});
   }
   if(command?.annual==='market'){
    const k=command.decision,base=['annual','decision'],id=n=>Number.isSafeInteger(n)&&n>0;
    let valid=['news','home','close','finish'].includes(k)&&exact(command,base);
    if(k==='open')valid=exact(command,[...base,'room'])&&['news','fa','return','other'].includes(command.room);
    if(['ack','submit','withdraw','exchange','special-result'].includes(k))valid=exact(command,[...base,'playerId'])&&id(command.playerId);
    if(k==='talk')valid=exact(command,[...base,'playerId','key'])&&id(command.playerId)&&['listen','winning','chance','trust','vision','legacy','salary:90','salary:100','salary:115','salary:130','salary:145'].includes(command.key);
    if(k==='salary')valid=exact(command,[...base,'playerId','million'])&&id(command.playerId)&&Number.isSafeInteger(command.million)&&command.million>=5;
    if(k==='years')valid=exact(command,[...base,'playerId','years'])&&id(command.playerId)&&Number.isSafeInteger(command.years)&&command.years>=1&&command.years<=10;
    if(k==='free')valid=exact(command,[...base,'playerId','salary'])&&id(command.playerId)&&Number.isFinite(command.salary)&&command.salary>=.05&&command.salary<=5;
    if(['trade','comp'].includes(k))valid=exact(command,[...base,'playerId','otherId'])&&id(command.playerId)&&id(command.otherId)&&command.playerId!==command.otherId;
    if(!valid)throw Error('invalid market command');
    return run('annual',state,{choice:'market',decision:k,room:command.room,playerId:command.playerId,otherId:command.otherId,key:command.key,million:command.million,years:command.years,salary:command.salary,verifiedVip});
   }
   if(command?.annual==='commerce'){
    const k=command.decision,base=['annual','decision'],v=command.value;
    let valid=['start','back','finish','confirm','decline','park','live','tv','opening'].includes(k)&&exact(command,base);
    if(exact(command,[...base,'value'])){
     if(k==='name')valid=typeof v==='string'&&v.trim().length>0&&v.length<=30&&!/[\u0000-\u001f]/.test(v);
     else if(k==='toggle')valid=typeof v==='string'&&v.length<=100;
     else if(k==='perk')valid=['pin','towel','uniform','none'].includes(v);
     else if(k==='fee')valid=[-500,500].includes(v);
     else if(k==='player')valid=Number.isSafeInteger(v)&&v>0;
     else if(k==='plan')valid=[0,1,2].includes(v);
     else if(k==='delta'||k==='font')valid=[0,1,2,3].includes(v);
     else if(k==='color')valid=[0,1,2,3,4,5].includes(v);
     else if(k==='choice')valid=[-1,0,1,2].includes(v);
    }
    if(!valid)throw Error('invalid commerce command');
    return run('annual',state,{choice:'commerce',decision:k,value:v,verifiedVip});
   }
   if(command?.annual==='renewal'){
    const k=command.decision,base=['annual','decision'];
    let valid=['next','final-release'].includes(k)&&exact(command,base)||['release','restore','retire'].includes(k)&&exact(command,[...base,'playerId'])&&Number.isSafeInteger(command.playerId);
    if(k==='bulk')valid=exact(command,[...base,'mode'])&&['assessment','middle','desired'].includes(command.mode);
    if(k==='submit')valid=exact(command,[...base,'bonus'])&&typeof command.bonus==='boolean';
    if(k==='offer')valid=exact(command,[...base,'playerId','salary','bonuses'])&&Number.isSafeInteger(command.playerId)&&Number.isFinite(command.salary)&&command.salary>=.05&&command.salary<=15&&Array.isArray(command.bonuses)&&command.bonuses.length<=12&&command.bonuses.every(x=>typeof x==='string'&&x.length<=40);
    if(!valid)throw Error('invalid renewal command');
    return run('annual',state,{choice:'renewal',decision:k,playerId:command.playerId,salary:command.salary,bonuses:command.bonuses,mode:command.mode,bonus:command.bonus,verifiedVip});
   }
   if(command?.annual==='training'){
    const k=command.decision,base=['annual','decision'];
    let valid=k==='run'&&exact(command,base);
    if(k==='menu')valid=exact(command,[...base,'playerId','focus','intensity'])&&Number.isSafeInteger(command.playerId)&&typeof command.focus==='string'&&command.focus.length<=20&&['rest','light','normal','hard'].includes(command.intensity);
    if(k==='assign')valid=exact(command,[...base,'playerId','destination'])&&Number.isSafeInteger(command.playerId)&&['none','aus','south','taiwan','dubai'].includes(command.destination);
    if(!valid)throw Error('invalid training command');
    return run('annual',state,{choice:'training',decision:k,playerId:command.playerId,focus:command.focus,intensity:command.intensity,destination:command.destination,verifiedVip});
   }
   if(command?.annual==='draft'){
    const k=command.decision,base=['annual','decision'];
    const simple=['start','intro','announcement','announcement-next','pass','cpu','delegate','reveal','next-draw','next-round','finish'];
    const player=['nominate','dismiss','withdraw','delegate-contract'];
    let valid=simple.includes(k)&&exact(command,base)||player.includes(k)&&exact(command,[...base,'playerId'])&&Number.isSafeInteger(command.playerId);
    if(k==='research')valid=exact(command,[...base,'playerId','key'])&&Number.isSafeInteger(command.playerId)&&['field','analysis','interview'].includes(command.key);
    if(k==='ticket')valid=exact(command,[...base,'ticket'])&&Number.isSafeInteger(command.ticket)&&command.ticket>=0&&command.ticket<12;
    if(k==='reply')valid=exact(command,[...base,'playerId','answer'])&&Number.isSafeInteger(command.playerId)&&typeof command.answer==='string'&&command.answer.length<=40;
    if(k==='offer')valid=exact(command,[...base,'playerId','level','role'])&&Number.isSafeInteger(command.playerId)&&[0,1,2].includes(command.level)&&['chance','develop'].includes(command.role);
    if(!valid)throw Error('invalid draft command');
    return run('annual',state,{choice:'draft',decision:k,playerId:command.playerId,key:command.key,ticket:command.ticket,answer:command.answer,level:command.level,role:command.role,verifiedVip});
   }
   if(exact(command,['annual','playerId','decision'])&&command.annual==='movement'&&Number.isSafeInteger(command.playerId)&&['allow','deny'].includes(command.decision))return run('annual',state,{choice:'movement',playerId:command.playerId,decision:command.decision,verifiedVip});
   if(exact(command,['annual','playerId','decision','multiplier'])&&command.annual==='movement'&&Number.isSafeInteger(command.playerId)&&command.decision==='retain'&&[1,1.15].includes(command.multiplier))return run('annual',state,{choice:'movement',playerId:command.playerId,decision:command.decision,multiplier:command.multiplier,verifiedVip});
   if(exact(command,['acknowledge','eventKey'])&&['injury','rare','decade','review'].includes(command.acknowledge)&&typeof command.eventKey==='string'&&command.eventKey.length<=512)return run('ack',state,{kind:command.acknowledge,eventKey:command.eventKey});
   if(exact(command,['career','playerId','options'])&&command.career==='accept'&&Number.isSafeInteger(command.playerId)&&Array.isArray(command.options)&&command.options.length<=5&&command.options.every(x=>typeof x==='string'))return run('career',state,{choice:'accept',playerId:command.playerId,options:command.options});
   if(exact(command,['career','playerId'])&&command.career==='dismiss'&&Number.isSafeInteger(command.playerId))return run('career',state,{choice:'dismiss',playerId:command.playerId});
   if(exact(command,['acknowledge','playerId'])&&command.acknowledge==='rookie-reveal'&&Number.isSafeInteger(command.playerId))return run('ack',state,{kind:'rookie-reveal',playerId:command.playerId});
   if(exact(command,['acknowledge'])&&['month','milestones','rookie-finish','opening'].includes(command.acknowledge))return run('ack',state,{kind:command.acknowledge});if(exact(command,['calendar'])&&command.calendar==='day')return run('advance',state,{verifiedVip,routine:true});if(!exact(command,['step'])||command.step!==1)throw Error('pilot accepts one calendar day or explicit report acknowledgement');return run('advance',state,{verifiedVip:rights?.verified===true&&rights.vip===true});},
  // Trusted persisted state, minimal public projection without a VM run or
  // allocation of the historical world. Never return player or prospect data.
  preview(state){
   const t=state?.teams?.find(t=>t.id===state.selectedId);
   if(!t||state.started!==true)throw Error('invalid canonical preview');
   const e=t.emblem;
   return {year:state.year,day:state.day,gmName:state.gmName||'GM',team:{id:t.id,name:t.name,short:t.short,league:t.league,color:t.color,letter:t.letter,emblem:e?{accent:e.accent,shape:e.shape,pattern:e.pattern,font:e.font,motif:e.motif}:null,wins:t.wins,cash:t.cash}};
  },
  tradePage(state,command){
   if(!command||!(command.mode==='list'&&exact(command,['mode','clubId'])&&Number.isSafeInteger(command.clubId)&&command.clubId>=0&&command.clubId<12||command.mode==='quote'&&exact(command,['mode','clubId','out','in','fee'])&&validTrade(command)))throw Error('invalid trade page');
   return run('trade-page',state,command);
  },
  reportPage(state,command){
   if(!exact(command,['kind','year','offset','limit'])||!['matches','papers'].includes(command.kind)||!Number.isSafeInteger(command.year)||command.year!==0&&(command.year<2027||command.year>state.year)||!Number.isSafeInteger(command.offset)||command.offset<0||!Number.isSafeInteger(command.limit)||command.limit<1||command.limit>(command.kind==='matches'?1:3))throw Error('invalid report page');
   return run('report-page',state,command);
  },
  playerPage(state,command){
   if(!exact(command,['playerId','offset','limit'])||!Number.isSafeInteger(command.playerId)||command.playerId<1||!Number.isSafeInteger(command.offset)||command.offset<0||!Number.isSafeInteger(command.limit)||command.limit<1||command.limit>10)throw Error('invalid player history page');
   return run('player-page',state,command);
  },
  freePage(state,command){
   if(!exact(command,['offset','limit','query'])||!Number.isSafeInteger(command.offset)||command.offset<0||!Number.isSafeInteger(command.limit)||command.limit<1||command.limit>80||typeof command.query!=='string'||command.query.length>80||/[\u0000-\u001f]/.test(command.query))throw Error('invalid free page');
   return run('free-page',state,command);
  },
  actions:state=>run('actions',state),achievements:state=>run('achievements',state).map(e=>e.key.startsWith('memorial:')?{...e,key:'memorial:'+createHash('sha256').update(e.key).digest('hex')}:e),view:state=>run('view',state),
  applyAction(state,action){if(!['medical','manager','retirement','draft-revival','foreign-revival','lottery','fa-retention','fa-sign'].includes(action?.route))throw Error('pilot route unavailable');return run('apply',state,{action:{route:action.route,eventKey:action.eventKey}});}
 });
}
module.exports={createHeadlessEngine};
