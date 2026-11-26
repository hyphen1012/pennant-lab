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
 // JSON persistence loses the browser's shared job/desk object reference.
 const restoredFlow=flowGet();if(restoredFlow?.active&&restoredFlow.jobs[restoredFlow.active]?.state)game.offseasonDesk=restoredFlow.jobs[restoredFlow.active].state;
 const injuryNotice=()=>{const e=game.pendingEvent;return e?.type==='injury'&&e.teamId===team.id&&Number.isSafeInteger(e.playerId)&&typeof e.date==='string'?e:null;};
 const careerNotice=()=>{const e=careerCurrentEvent(),p=e&&getPlayer(e.id),q=p?.retirePlan;return e&&p&&q?.year===game.year&&q.teamId===team.id?{e,p,q}:null;};
 const inbox=()=>{
  const injury=injuryNotice(),rare=pendingRareNews()[0],career=careerNotice();
  return {injury:injury?{eventKey:String(injury.playerId)+':'+injury.date,playerId:injury.playerId,date:injury.date,days:injury.days}:null,
   rare:rare?{eventKey:rare.id,year:rare.year,date:rare.date,category:rare.category}:null,
   rookie:game.pendingDraftReveal?{year:game.pendingDraftReveal.year,entries:game.pendingDraftReveal.entries.map(r=>{const p=getPlayer(r.id),stage=r.revealed?2:r.revealStage||0;return {id:r.id,name:p?.name,pos:p?.pos,stage,abilities:stage===2&&p?Object.fromEntries(seasonSkillKeys(p).map(k=>[k,p[k]])):null};})}:null,
   decade:game.pendingDecade??null,opening:game.pendingCeremonyIntro==='opening',
   career:career?{playerId:career.p.id,stage:career.e.type,options:['consult','plan'].includes(career.e.type)?farewellChoices(career.p).map(([key,label,cost])=>({key,label,cost})):[]}:null};
 };
 const commercialJobs=['fan-fest','tv','fanclub','sponsor','broadcast','naming','opening-promo'];
 const annualSupported=['awards-all','settlement','movement-declarations','draft','roster-cut','renewal1','renewal2','autumn','winter',...commercialJobs,'movement-market','booking','self','winter-return','camp','exhibition','opening-promo','offdesk-opening'];
 const draftPending=d=>d.picks.find(x=>x.teamId===team.id&&(x.recoveryPending||x.recoveryCelebration));
 const draftOwnRow=d=>d.picks.find(x=>x.teamId===team.id&&x.status==='rights');
 const candidateView=c=>({id:c.id,name:secretProspect(c.player)?'????':c.player.name,pos:c.player.pos,type:c.type,category:playerTitleTheme(c.player)?.name||null});
 const draftView=d=>{
  if(!d||d.year!==game.year)return null;
  const g=draftLotteryGroup(d),row=draftPending(d)||draftOwnRow(d),c=row&&draftCandidate(d,row.candidateId),questions=RECRUIT_QUESTIONS[row?.conversation?.answers?.length||0];
  const options=['scout','first','later'].includes(d.phase)?draftOptions(d,team).filter(scoutVisible).map(candidateView):[];
  return {phase:d.phase,round:d.round,rareIntro:!!d.rareIntro,announcement:!!d.announcement,canNominate:d.phase==='first'?d.active.includes(team.id):d.phase==='later'&&draftLaterOrder(d)[d.cursor]===team.id,
   candidates:options,lottery:d.phase==='lottery'&&g?{stage:d.pendingLottery.stage,candidateId:g.cid,own:g.ids.includes(team.id),tickets:g.ids.length,...(d.pendingLottery.stage==='revealed'?{winner:g.winner}:{})}:null,
   negotiation:d.phase==='negotiate'&&c?{...candidateView(c),status:row.status,recoveryPending:!!row.recoveryPending,recoveryCelebration:!!row.recoveryCelebration,answers:row.conversation?.answers||[],question:row.status==='rights'&&questions?{options:questions.options.map(x=>({key:x[0],label:x[1]}))}:null}:null,
   picks:d.picks.map(x=>({round:x.round,teamId:x.teamId,candidateId:x.candidateId,status:x.status,pos:x.pos,name:secretProspect(draftCandidate(d,x.candidateId)?.player)?'????':x.name}))};
 };
 const renewalView=()=>{
  const d=renewalData(team);if(!d)return null;
  return {round:d.round,confirmed:d.confirmed,waiting:!!d.waiting,rows:d.rows.map(r=>{const p=getPlayer(r.id);return {id:r.id,name:p?.name,pos:p?.pos,status:r.status,current:r.current,assessment:r.assessment,desired:r.desired,offer:r.offer,editable:renewalEditable(d,r),bonuses:r.bonuses,options:p?renewalBonusOptions(p).map(([key,target,amount,label])=>({key,target,amount,label})):[],history:r.history};})};
 };
 const trainingView=phase=>{
  const report=annualReport(phase);
  if(report)return {phase,report:{start:report.start,end:report.end,cost:report.cost,rows:(report.rows||[]).filter(r=>r.teamId===team.id),entries:(report.entries||[]).filter(r=>r.teamId===team.id),club:report.clubs?.find(c=>c.teamId===team.id)}};
  if(phase==='winter')return {phase,assignments:winterPlan(team),eligible:winterEligible(team).map(p=>({id:p.id,name:p.name,pos:p.pos})),destinations:WINTER_DEST.map(([key,label,league,cost,effect])=>({key,label,league,cost,effect})),cost:winterCost(winterPlan(team))};
  return {phase,players:annualPlayers(team,phase).map(p=>({id:p.id,name:p.name,pos:p.pos,injured:!!p.injury,focus:['balanced',...seasonSkillKeys(p)],menu:annualMenu(team,p,phase)}))};
 };
 const commercialView=(f,j)=>{
  const s=j.state;if(!s)return null;
  if(j.id==='sponsor')return {job:j.id,stage:s.stage,year:s.year,candidates:s.candidates.map(c=>({id:c.id,name:c.name,industry:c.industry,annual:c.annual})),selected:s.selected,contract:s.stage==='result'?sponsorContract(team,s.year):null};
  return {job:j.id,stage:s.stage,year:s.year,due:s.due,plan:s.plan,players:s.players,name:s.name,fee:s.fee,perk:s.perk,color:s.color,font:s.font,delta:s.delta,choice:s.choice,report:s.report,result:s.result,
   ...(['fan-fest','opening-promo'].includes(j.id)?{plans:(j.id==='fan-fest'?FAN_FEST_PLANS:OPENING_PROMO_PLANS).map((p,index)=>({index,name:p.name,cost:p.cost}))}:{}),
   ...(j.id==='tv'?{eligible:own(team).filter(p=>!retirementScheduled(p)).map(p=>({id:p.id,name:p.name,pos:p.pos}))}:{}),
   ...(j.id==='fanclub'?{perks:FAN_PERKS.map(([key,label,cost])=>({key,label,cost})),estimate:fanEstimate(team,s)}:{}),
   ...(j.id==='broadcast'?{base:commerceBase(team),chance:broadcastChance(s.delta),contract:commerceData(team).broadcasts[s.year]||null}:{}),
   ...(j.id==='naming'?{options:NAMING_OPTIONS,contract:commerceNaming(team,s.year)}:{})};
 };
 const marketView=f=>{
  const j=f.jobs['movement-market'],d=movementData(),x=j?.state;
  if(!j||!['active','ready'].includes(j.status))return null;
  const active=f.active===j.id;
  const rows=active&&!x.news&&['fa','return'].includes(x.view)?offdeskMarketRows(d,x.view).map(r=>{
   const p=getPlayer(r.id),o=d.offers[r.id],v=faTalk(d,r);
   return {id:r.id,name:p.name,pos:p.pos,kind:r.kind,demand:r.demand,category:playerTitleTheme(p)?.name||null,outcome:faOutcome(d,r),canApproach:faCanApproach(d,r),offer:o?{status:o.status,salary:o.salary,years:o.years,due:o.due,counter:o.counter,replyUntil:o.replyUntil,seen:!!o.seen}:null,talk:v?{round:v.round,turn:v.turn,max:v.max,salary:v.salary,years:v.years,role:v.role,speech:v.speech,trust:v.trust,satisfaction:v.satisfaction,caution:v.caution}:null};
  }):[];
  return {active,news:x?x.news:'eve',room:active?x.view:null,specialResults:active&&x.view==='news'&&x.news==='results'?(d.eventRows||[]).filter(r=>playerTitleTheme(getPlayer(r.id))).map(r=>({id:r.id,name:getPlayer(r.id).name,category:playerTitleTheme(getPlayer(r.id)).name,outcome:faOutcome(d,r),seen:!!x.faNewsSeen?.includes(r.id)})):[],cpuDone:!!d?.cpuDone,deadline:d?.faClock?.deadline,rows,
   unread:d?faUnreadRows(d).length:0,waiting:d?Object.values(d.offers).filter(o=>o.status==='waiting').length:0,counter:d?Object.values(d.offers).filter(o=>o.status==='counter').length:0,
   deals:active&&d?(d.deals||[]).filter(a=>a.from===team.id||a.to===team.id).map(a=>({id:a.id,kind:a.kind,from:a.from,to:a.to,salary:a.salary,years:a.years,rank:a.rank,comp:a.comp,compMode:a.compMode,compOptions:d.cpuDone?movementCompOptions(d,a).map(p=>({id:p.id,name:p.name,pos:p.pos})):[]})):[],
   free:active&&x.view==='other'&&!x.news&&!d.cpuDone?movementPool(d).filter(r=>r.kind==='free').map(r=>({id:r.id,name:getPlayer(r.id).name,demand:r.demand})):[]};
 };
 const preView=f=>{
  const phase=f.active,j=f.jobs[phase];
  if(!['booking','self','winter-return','camp','exhibition'].includes(phase))return null;
  if(phase==='winter-return'){
   const r=game.annualTraining?.results?.[(game.year-1)+':winter'];
   return {phase,report:r?.returned?{rows:r.rows||[],entries:(r.entries||[]).filter(e=>e.teamId===team.id)}:null};
  }
  if(['booking','camp'].includes(phase)){
   const p=annualPlan(team,'camp'),sites=campChoice(team),r=annualReport('camp');
   return {phase,sites,step:p.step||0,paid:!!p.paid,cost:campCost(sites),visit:p.visit||null,visitPending:!!p.visitPending,options:CAMP_SITES.map(([key,label,cost])=>({key,label,cost})),report:r?{rows:r.rows,clubs:r.clubs,cost:r.cost,sites:r.sites}:null};
  }
  const r=annualReport(phase);
  if(phase==='exhibition')return {phase,policy:annualPlan(team,phase).exhibition,meeting:!!j.state.reportMeeting,report:r?{games:r.games.filter(g=>g.home===team.id||g.away===team.id),rows:r.rows,leagueGames:r.games.length}:null};
  return {phase,...trainingView(phase),support:!!j.state.reportSelfSupport,supportOptions:Object.entries(CLUB_SUPPORT).filter(([k,p])=>p.phase?.includes('self')).map(([key,p])=>({key,label:p.label,cost:p.cost,eligible:clubSupportEligible(team,key,'self')}))};
 };
 const annualView=()=>{
  const f=flowGet(),d=movementData();
  if(!f)return {mode:null,canStart:game.day===143&&game.calendarIndex===game.calendar.days.length&&!game.financeCrisis&&!flowInbox()&&!game.pendingMonth&&!game.pendingReview&&!pendingMilestoneNews().length&&!flowForeignResponse()};
  const tasks=Object.values(f.jobs).map(j=>({id:j.id,start:j.start,status:j.status,supported:annualSupported.includes(j.id)}));
  return {mode:f.mode,date:f.date,active:f.active,tasks,preseason:preView(f),market:marketView(f),commerce:commercialJobs.includes(f.active)?commercialView(f,f.jobs[f.active]):null,canAdvance:!f.active&&!flowInbox()&&!game.financeCrisis&&!flowBlocking(f),renewal:['renewal1','renewal2'].includes(f.active)?renewalView():null,training:['autumn','winter'].includes(f.active)?trainingView(f.active):null,draft:f.active==='draft'?draftView(game.draft):null,roster:f.active==='roster-cut'?{projection:draftRosterProjection(game.draft,team),selected:draftCutIds(game.draft,team),eligible:draftCutOptions(game.draft,team).map(p=>({id:p.id,name:p.name,pos:p.pos,salary:p.salary,warnings:draftCutReasons(p)}))}:null,requests:f.active==='movement-declarations'?(d?.requests||[]).filter(r=>r.from===team.id).map(r=>({id:r.id,kind:r.kind,status:r.status,demand:r.demand,offer:r.offer})):[]};
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
  }else if(kind==='rookie-reveal'){
   const b=game.pendingDraftReveal,r=b?.entries.find(x=>x.id===input.playerId);if(!r||b.year!==game.year-1||r.revealed||(r.revealStage||0)>=2)throw Error('rookie reveal unavailable');r.revealStage=(r.revealStage||0)+1;
  }else if(kind==='rookie-finish'){
   if(!game.pendingDraftReveal||game.pendingDraftReveal.entries.some(r=>!r.revealed&&(r.revealStage||0)<2))throw Error('rookie report unfinished');game.pendingDraftReveal=null;
  }else if(kind==='decade'){
   if(game.pendingDecade==null||String(game.pendingDecade)!==input.eventKey)throw Error('decade acknowledgement unavailable');game.lastDecadeViewed=game.pendingDecade;game.pendingDecade=null;game.decadeSection=null;
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
    else if(d.announcement){if(k!=='announcement')throw Error('draft announcement required');d.announcement=null;}
    else if(pending){if(k!=='dismiss'||input.playerId!==pending.candidateId)throw Error('draft recovery decision required');pending.recoveryPending=false;pending.recoveryCelebration=false;}
    else if(k==='start'&&d.phase==='scout'){
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
  if(game.day>=143||game.financeCrisis||flowGet()||game.pendingCeremonyIntro==='opening'||game.pendingDraftReveal||game.pendingDecade!=null)throw Error('pilot season boundary');
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
   // Preserve all previously exposed keys. New kinds are genuine own-club
   // album events, not sharing actions or another club's headline.
   if(!['award','facility','championship','league-championship','retirement','farewell','club-record'].includes(e.kind)&&!e.featKey&&!e.recordKey&&!e.anniversary&&!(e.id.startsWith('news:')&&memorialNewsEligible(e,team)))continue;
   const key='memorial:'+e.id;
   if(!entries.has(key))entries.set(key,{key,label:e.title.slice(0,160),eligible:true});
  }
  // Special news and the ordinary record edition sometimes describe the
  // same achievement. Reuse the ordinary key rather than granting twice.
  const news=(game.milestoneNews||[]).filter(e=>e.teamId===team.id);
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
   if(k.startsWith('record:')){
    // Existing record update keys include the official day; use that evidence.
    const recordKey=k.slice(('record:'+e.playerId+':').length);
    if(news.some(n=>n.year===e.year&&n.playerId===e.playerId&&n.recordKey===recordKey))continue;
    continue; // do not create an unverified historical record identity
   }
   if(k.startsWith('career:')){
    const c=k.slice(('career:'+e.playerId+':').length);
    if(news.some(n=>n.playerId===e.playerId&&n.careerKey===c))continue;
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
   if(exact(command,['annual','job'])&&['open','complete'].includes(command.annual)&&['awards-all','settlement','movement-declarations','draft','roster-cut','renewal1','renewal2','autumn','winter','fan-fest','tv','fanclub','sponsor','broadcast','naming','booking','self','winter-return','camp','exhibition','opening-promo','offdesk-opening'].includes(command.job))return run('annual',state,{choice:command.annual,job:command.job,verifiedVip});
   if(exact(command,['annual','playerId'])&&command.annual==='cut'&&Number.isSafeInteger(command.playerId))return run('annual',state,{choice:'cut',playerId:command.playerId,verifiedVip});
   if(command?.annual==='preseason'){
    const k=command.decision,base=['annual','decision'];
    let valid=['confirm-sites','kickoff','visit-finish','run','finish'].includes(k)&&exact(command,base);
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
    const simple=['start','intro','announcement','pass','cpu','delegate','reveal','next-draw','next-round','finish'];
    const player=['nominate','dismiss','withdraw','delegate-contract'];
    let valid=simple.includes(k)&&exact(command,base)||player.includes(k)&&exact(command,[...base,'playerId'])&&Number.isSafeInteger(command.playerId);
    if(k==='ticket')valid=exact(command,[...base,'ticket'])&&Number.isSafeInteger(command.ticket)&&command.ticket>=0&&command.ticket<12;
    if(k==='reply')valid=exact(command,[...base,'playerId','answer'])&&Number.isSafeInteger(command.playerId)&&typeof command.answer==='string'&&command.answer.length<=40;
    if(k==='offer')valid=exact(command,[...base,'playerId','level','role'])&&Number.isSafeInteger(command.playerId)&&[0,1,2].includes(command.level)&&['chance','develop'].includes(command.role);
    if(!valid)throw Error('invalid draft command');
    return run('annual',state,{choice:'draft',decision:k,playerId:command.playerId,ticket:command.ticket,answer:command.answer,level:command.level,role:command.role,verifiedVip});
   }
   if(exact(command,['annual','playerId','decision'])&&command.annual==='movement'&&Number.isSafeInteger(command.playerId)&&['allow','deny'].includes(command.decision))return run('annual',state,{choice:'movement',playerId:command.playerId,decision:command.decision,verifiedVip});
   if(exact(command,['annual','playerId','decision','multiplier'])&&command.annual==='movement'&&Number.isSafeInteger(command.playerId)&&command.decision==='retain'&&[1,1.15].includes(command.multiplier))return run('annual',state,{choice:'movement',playerId:command.playerId,decision:command.decision,multiplier:command.multiplier,verifiedVip});
   if(exact(command,['acknowledge','eventKey'])&&['injury','rare','decade'].includes(command.acknowledge)&&typeof command.eventKey==='string'&&command.eventKey.length<=512)return run('ack',state,{kind:command.acknowledge,eventKey:command.eventKey});
   if(exact(command,['career','playerId','options'])&&command.career==='accept'&&Number.isSafeInteger(command.playerId)&&Array.isArray(command.options)&&command.options.length<=5&&command.options.every(x=>typeof x==='string'))return run('career',state,{choice:'accept',playerId:command.playerId,options:command.options});
   if(exact(command,['career','playerId'])&&command.career==='dismiss'&&Number.isSafeInteger(command.playerId))return run('career',state,{choice:'dismiss',playerId:command.playerId});
   if(exact(command,['acknowledge','playerId'])&&command.acknowledge==='rookie-reveal'&&Number.isSafeInteger(command.playerId))return run('ack',state,{kind:'rookie-reveal',playerId:command.playerId});
   if(exact(command,['acknowledge'])&&['month','milestones','rookie-finish','opening'].includes(command.acknowledge))return run('ack',state,{kind:command.acknowledge});if(!exact(command,['step'])||command.step!==1)throw Error('pilot accepts one calendar day or explicit report acknowledgement');return run('advance',state,{verifiedVip:rights?.verified===true&&rights.vip===true});},
  actions:state=>run('actions',state),achievements:state=>run('achievements',state).map(e=>e.key.startsWith('memorial:')?{...e,key:'memorial:'+createHash('sha256').update(e.key).digest('hex')}:e),view:state=>run('view',state),
  applyAction(state,action){if(!['medical','manager','retirement','draft-revival','foreign-revival','lottery','fa-retention','fa-sign'].includes(action?.route))throw Error('pilot route unavailable');return run('apply',state,{action:{route:action.route,eventKey:action.eventKey}});}
 });
}
module.exports={createHeadlessEngine};
