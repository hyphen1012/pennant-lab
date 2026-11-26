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
  buildFresh();game.started=true;game.seed=SERVER_SEED;game.clubLogoSeed=SERVER_SEED;
  ensureGameExtras();game.ceremonyStage=null;game.calendarFlow=null;game.pendingCeremonyIntro=null;
  return JSON.stringify(game);
 }
 game=input.state;ensureGameExtras();
 const team=myTeam();
 const medical=()=>own(team).filter(p=>rosterTreatmentEligible(p)&&p.injury&&typeof p.injury.date==='string').map(p=>({route:'medical',year:game.year,eventKey:String(p.id)+':'+p.injury.date,label:p.name+' 特別治療',playerId:p.id,date:p.injury.date}));
 if(op==='actions')return JSON.stringify(medical());
 if(op==='apply'){
  const a=medical().find(x=>x.eventKey===input.action.eventKey&&input.action.route==='medical');
  if(!a)throw Error('medical action unavailable');
  const p=getPlayer(a.playerId),before=p.injury.daysLeft;
  // Shared production mutation supports both the roster and popup, while
  // applySpecialTreatment additionally requires the actual pending popup.
  if(!applyRosterTreatment(p)||p.injury.daysLeft!==Math.ceil(before/2))throw Error('real medical mutation failed');
  return JSON.stringify({state:game,result:{before,after:p.injury.daysLeft,date:a.date}});
 }
 if(op==='advance'){
  if(game.day>=143||game.financeCrisis)throw Error('pilot season boundary');
  if(game.pendingRareIds?.length||game.pendingMilestoneIds?.length||game.pendingEvent||game.pendingMonth)throw Error('pilot event acknowledgement required');
  const e=processCalendarDay();if(!e)throw Error('calendar ended');
  collectMilestoneNews(e);scoutDiscoveryDaily(e);rareDaily(e);
  return JSON.stringify(game);
 }
 if(op==='achievements'){
  // Narrow initial scope: only completed, actually won own-club games.
  return JSON.stringify(game.games.filter(g=>(g.home===team.id&&g.homeScore>g.awayScore)||(g.away===team.id&&g.awayScore>g.homeScore)).map(g=>({key:'win:'+g.year+':'+g.day,label:'試合勝利 '+g.year+' / '+g.day,eligible:true})));
 }
 if(op==='view')return JSON.stringify({year:game.year,day:game.day,calendarIndex:game.calendarIndex,team:{id:team.id,name:team.name,wins:team.wins,losses:team.losses,ties:team.ties,cash:team.cash},games:game.games.length,medical:medical().length,blocked:!!(game.financeCrisis||game.pendingRareIds?.length||game.pendingMilestoneIds?.length||game.pendingEvent||game.pendingMonth||game.day>=143)});
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
  newWorld(command){if(!exact(command,[]))throw Error('pilot setup accepts no options');return run('new',null);},
  advance(state,command){if(!exact(command,['step'])||command.step!==1)throw Error('pilot accepts one calendar day');return run('advance',state);},
  actions:state=>run('actions',state),achievements:state=>run('achievements',state),view:state=>run('view',state),
  applyAction(state,action){if(action?.route!=='medical')throw Error('pilot route unavailable');return run('apply',state,{action:{route:action.route,eventKey:action.eventKey}});}
 });
}
module.exports={createHeadlessEngine};
