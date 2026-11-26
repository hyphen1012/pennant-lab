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
  ensureGameExtras();game.ceremonyStage=null;game.calendarFlow=null;game.pendingCeremonyIntro=null;
  return JSON.stringify(game);
 }
 game=input.state;ensureGameExtras();
 const team=myTeam();
 const injuryNotice=()=>{const e=game.pendingEvent;return e?.type==='injury'&&e.teamId===team.id&&Number.isSafeInteger(e.playerId)&&typeof e.date==='string'?e:null;};
 const careerNotice=()=>{const e=careerCurrentEvent(),p=e&&getPlayer(e.id),q=p?.retirePlan;return e&&p&&q?.year===game.year&&q.teamId===team.id?{e,p,q}:null;};
 const inbox=()=>{
  const injury=injuryNotice(),rare=pendingRareNews()[0],career=careerNotice();
  return {injury:injury?{eventKey:String(injury.playerId)+':'+injury.date,playerId:injury.playerId,date:injury.date,days:injury.days}:null,
   rare:rare?{eventKey:rare.id,year:rare.year,date:rare.date,category:rare.category}:null,
   career:career?{playerId:career.p.id,stage:career.e.type,options:['consult','plan'].includes(career.e.type)?farewellChoices(career.p).map(([key,label,cost])=>({key,label,cost})):[]}:null};
 };
 const annualView=()=>{
  const f=flowGet(),d=movementData();
  if(!f)return {mode:null,canStart:game.day===143&&game.calendarIndex===game.calendar.days.length&&!game.financeCrisis&&!flowInbox()&&!game.pendingMonth&&!game.pendingReview&&!pendingMilestoneNews().length&&!flowForeignResponse()};
  const tasks=Object.values(f.jobs).map(j=>({id:j.id,start:j.start,status:j.status,supported:['awards-all','settlement','movement-declarations'].includes(j.id)}));
  return {mode:f.mode,date:f.date,active:f.active,tasks,canAdvance:!f.active&&!flowInbox()&&!game.financeCrisis&&!flowBlocking(f),requests:f.active==='movement-declarations'?(d?.requests||[]).filter(r=>r.from===team.id).map(r=>({id:r.id,kind:r.kind,status:r.status,demand:r.demand,offer:r.offer})):[]};
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
  if(game.ceremonyStage==='draft'&&d?.year===game.year){
   for(const row of d.picks||[]){const c=draftCandidate(d,row.candidateId);if(c&&draftRecoveryAllowed(d,team,row,c))add('draft-revival',c.id,c.player.name+' ドラフト交渉復活');}
   if(lotteryRewardAllowed(d,team.id))add('lottery',draftLotteryGroup(d).cid,'ドラフト抽選');
  }
  if(m?.year===game.year){
   const conv=m.negotiations?.[team.id],c=m.candidates.find(x=>x.id===conv?.candidateId);
   if(c&&foreignRecoveryAllowed(m,team,c,conv))add('foreign-revival',c.id,c.player.name+' 外国人交渉復活');
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
   deferSeasonMilestones(game.pendingMilestoneIds);
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
 if(op==='annual'){
  vipStatusProvider=()=>({verified:true,vip:input.verifiedVip===true});
  if(game.financeCrisis||flowInbox()||game.pendingMonth||game.pendingReview||pendingMilestoneNews().length||flowForeignResponse())throw Error('annual inbox unresolved');
  let f=flowGet();
  if(input.choice==='start'){
   if(f||game.day!==143||game.calendarIndex!==game.calendar.days.length||!game.postseason||!Array.isArray(game.awards))throw Error('annual start unavailable');
   if(!ensureSeasonFinanceClosed())throw Error('season finance not closed');
   f=flowInit();if(!f||f.mode!=='off')throw Error('annual flow unavailable');flowRefresh(f);
  }else{
   if(!f||f.mode!=='off')throw Error('annual flow unavailable');
   if(input.choice==='day'){
    // Never bypass a ready event, and never cross into an unsupported rollover.
    if(f.date>=game.year+'-12-31'||!flowDay(f))throw Error('annual date blocked');
   }else if(input.choice==='open'){
    const j=f.jobs[input.job];
    if(!['awards-all','settlement','movement-declarations'].includes(input.job)||!flowOpen(f,j))throw Error('annual event unavailable');
    if(j.id==='movement-declarations')movementInit();
    game.pendingCeremonyIntro=null;
   }else if(input.choice==='complete'){
    const j=f.jobs[f.active];
    if(!j||j.id!==input.job||!['awards-all','settlement','movement-declarations'].includes(j.id))throw Error('annual event unavailable');
    if(j.id==='movement-declarations'&&movementData()?.requests.some(r=>r.from===team.id&&['request','refused'].includes(r.status)))throw Error('movement decision required');
    flowComplete(f,j);
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
  if(game.day>=143||game.financeCrisis)throw Error('pilot season boundary');
  if(pendingRareNews().length||game.pendingMilestoneIds?.length||game.pendingEvent||game.pendingMonth||game.pendingReview||careerEventPending()||foreignHasCounter())throw Error('pilot event acknowledgement required');
  const e=processCalendarDay();if(!e)throw Error('calendar ended');
  collectMilestoneNews(e);scoutDiscoveryDaily(e);rareDaily(e);careerDecisionTick(e);
  return JSON.stringify(game);
 }
 if(op==='achievements'){
  const entries=new Map();
  const win=(year,day)=>{if(Number.isSafeInteger(year)&&year>=2027&&Number.isSafeInteger(day)&&day>=1&&day<=143){const key='win:'+year+':'+day;entries.set(key,{key,label:'試合勝利 '+year+' / '+day,eligible:true});}};
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
   if(!['award','facility','championship','league-championship','retirement'].includes(e.kind)&&!e.featKey&&!e.recordKey)continue;
   const key='memorial:'+e.id;
   if(!entries.has(key))entries.set(key,{key,label:e.title.slice(0,160),eligible:true});
  }
  return JSON.stringify([...entries.values()]);
 }
 if(op==='view')return JSON.stringify({year:game.year,day:game.day,calendarIndex:game.calendarIndex,team:{id:team.id,name:team.name,wins:team.wins,losses:team.losses,ties:team.ties,cash:team.cash},games:game.games.length,inbox:inbox(),annual:annualView(),vipIncome:r2((game.financeLedger?.clubs?.[team.id]?.vipIncome||0)+vipOffTotal(team,game.year)),retirementEligible:retirement().length===1,medical:medical().length,managerEligible:manager().length===1,acknowledgements:{month:!!(game.pendingMonth&&game.monthlyArchive?.some(m=>m.year===game.pendingMonth.year&&m.id===game.pendingMonth.id)),milestones:!!game.pendingMilestoneIds?.length},blocked:!!(game.financeCrisis||pendingRareNews().length||game.pendingMilestoneIds?.length||game.pendingEvent||game.pendingMonth||game.pendingReview||careerEventPending()||foreignHasCounter()||game.day>=143)});
 throw Error('unsupported pilot operation');
 `;
 const compiled=new vm.Script(pre+source.replace('(() => {','(() => {')+tail+'})();',{filename:'pennant-lab-headless-pilot.js'});
 function run(op,state,extra={}){
  if(op!=='new'&&(!state||typeof state!=='object'||state.started!==true||!Array.isArray(state.teams)||!Array.isArray(state.players)||!Array.isArray(state.games)))throw Error('invalid server world');
  const seed=op==='new'?randomInt(1,0xffffffff):state.seed;
  if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error('invalid server seed');
  const context={SERVER_SEED:seed||1,SERVER_INPUT:JSON.stringify({op,state,...extra})};
  const result=compiled.runInNewContext(context,{timeout:10000,microtaskMode:'afterEvaluate',contextCodeGeneration:{strings:false,wasm:false}});
  if(typeof result!=='string')throw Error('engine did not return a state');
  return JSON.parse(result);
 }
 const exact=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
 return Object.freeze({
  sourceHash:hash,
  newWorld(command){if(exact(command,[]))return run('new',null);if(!exact(command,['team'])||!Number.isSafeInteger(command.team)||command.team<0||command.team>11)throw Error('invalid pilot team');return run('new',null,{team:command.team});},
  advance(state,command,rights){
   const verifiedVip=rights?.verified===true&&rights.vip===true;
   if(exact(command,['annual'])&&['start','day'].includes(command.annual))return run('annual',state,{choice:command.annual,verifiedVip});
   if(exact(command,['annual','job'])&&['open','complete'].includes(command.annual)&&['awards-all','settlement','movement-declarations'].includes(command.job))return run('annual',state,{choice:command.annual,job:command.job,verifiedVip});
   if(exact(command,['annual','playerId','decision'])&&command.annual==='movement'&&Number.isSafeInteger(command.playerId)&&['allow','deny'].includes(command.decision))return run('annual',state,{choice:'movement',playerId:command.playerId,decision:command.decision,verifiedVip});
   if(exact(command,['annual','playerId','decision','multiplier'])&&command.annual==='movement'&&Number.isSafeInteger(command.playerId)&&command.decision==='retain'&&[1,1.15].includes(command.multiplier))return run('annual',state,{choice:'movement',playerId:command.playerId,decision:command.decision,multiplier:command.multiplier,verifiedVip});
   if(exact(command,['acknowledge','eventKey'])&&['injury','rare'].includes(command.acknowledge)&&typeof command.eventKey==='string'&&command.eventKey.length<=512)return run('ack',state,{kind:command.acknowledge,eventKey:command.eventKey});
   if(exact(command,['career','playerId','options'])&&command.career==='accept'&&Number.isSafeInteger(command.playerId)&&Array.isArray(command.options)&&command.options.length<=5&&command.options.every(x=>typeof x==='string'))return run('career',state,{choice:'accept',playerId:command.playerId,options:command.options});
   if(exact(command,['career','playerId'])&&command.career==='dismiss'&&Number.isSafeInteger(command.playerId))return run('career',state,{choice:'dismiss',playerId:command.playerId});
   if(exact(command,['acknowledge'])&&['month','milestones'].includes(command.acknowledge))return run('ack',state,{kind:command.acknowledge});if(!exact(command,['step'])||command.step!==1)throw Error('pilot accepts one calendar day or explicit report acknowledgement');return run('advance',state,{verifiedVip:rights?.verified===true&&rights.vip===true});},
  actions:state=>run('actions',state),achievements:state=>run('achievements',state).map(e=>e.key.startsWith('memorial:')?{...e,key:'memorial:'+createHash('sha256').update(e.key).digest('hex')}:e),view:state=>run('view',state),
  applyAction(state,action){if(!['medical','manager','retirement','draft-revival','foreign-revival','lottery','fa-retention','fa-sign'].includes(action?.route))throw Error('pilot route unavailable');return run('apply',state,{action:{route:action.route,eventKey:action.eventKey}});}
 });
}
module.exports={createHeadlessEngine};
