const fs=require('node:fs');

function verifyAnnualTraining(html){
  let script=html.match(/<script>([\s\S]*?)<\/script>/)[1],i=script.indexOf("  const appRoot=document.querySelector('#app');");
  if(i<0)throw Error("bootstrap marker missing");
  script=script.slice(0,i)+"save=function(){return true};window.test={fresh:()=>{buildFresh();ensureGameExtras();game.started=true;ui.page='game';ui.tab='hq';return game},get:()=>game,restore:x=>{game=JSON.parse(x);ensureGameExtras();ui.page='game';ui.tab='hq'},stage:k=>{game.ceremonyStage=k;game.pendingCeremonyIntro=null},screen:annualPhaseScreen,calendar:calendarForSeason,render,ui,step:processCalendarDay,plan:annualPlan,ensureDraft,annualHistoryHTML,report:annualReport};})();";
  const app={innerHTML:""},listeners=[],doc={hidden:false,querySelector:q=>q==="#app"?app:null,querySelectorAll:()=>[],addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture:!!capture}),body:{appendChild(){}},createElement:()=>({style:{},remove(){},setAttribute(){}})},win={scrollTo(){},location:{href:"https://localhost/"}},local={getItem:()=>null,setItem(){},removeItem(){}};
  new Function("window","document","localStorage","setTimeout","clearTimeout",script)(win,doc,local,()=>0,()=>{});
  const api=win.test;let g=api.fresh();function ck(v,m){if(!v)throw Error(m);}
  function dispatch(type,data){const el={dataset:data,value:data.value,classList:{contains:()=>false},closest:q=>q==='[data-action]'&&data.action?el:null};const e={target:el,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;}};for(const x of listeners.filter(l=>l.type===type).sort((a,b)=>Number(b.capture)-Number(a.capture))){if(e.stopped)break;x.fn(e);}}
  const click=(action,data={})=>dispatch("click",{action,...data});
  function clearNotices(){g.pendingMonth=null;g.pendingReview=null;g.pendingEvent=null;g.pendingCeremonyIntro=null;g.pendingDraftReveal=null;g.pendingDecade=null;g.financeCrisis=null;g.rareNews=[];g.milestoneNews=[];}
  g.started=false;api.ui.page="setup";api.ui.selectedTeam=g.selectedId;click("finish-setup");ck(g.ceremonyStage==="self","new game January");click("event-intro-continue",{event:"self"});ck(app.innerHTML.includes("自主トレ"),"self screen");
  let t=g.teams.find(t=>t.id===g.selectedId),p=g.players.find(p=>p.teamId===t.id&&!["SP","RP","CP"].includes(p.pos));const pid=p.id;
  dispatch("change",{change:"annual-intensity",id:String(pid),value:"rest"});click("annual-run");ck(api.report("self").rows.find(x=>x.id===pid).xp===0,"rest");ck(api.report("self").clubs.length===12,"12 teams");let prior=JSON.stringify(g.players.map(p=>p.expPoints));api.restore(JSON.stringify(g));g=api.get();click("annual-run");ck(prior===JSON.stringify(g.players.map(p=>p.expPoints)),"save reload no repeat");
  click("ceremony-next");click("event-intro-continue",{event:"camp"});dispatch("change",{change:"annual-focus",id:String(pid),value:"power"});click("annual-run");ck(g.players.find(p=>p.id===pid).trainFocus==="power","persistent spring focus");click("ceremony-next");click("event-intro-continue",{event:"exhibition"});dispatch("change",{change:"annual-exhibition",value:"youth"});ck(api.plan(g.teams.find(t=>t.id===g.selectedId),"exhibition").exhibition==="youth","policy");
  const stats=JSON.stringify(g.players.map(p=>[p.stats,p.farmStats])),teams=JSON.stringify(g.teams.map(t=>[t.wins,t.losses,t.ties,t.cash]));click("annual-run");const open=api.report("exhibition");ck(open.games.length===36&&open.games.every(x=>!x.noContest),"36 games");ck(stats===JSON.stringify(g.players.map(p=>[p.stats,p.farmStats])),"stats isolation");ck(teams===JSON.stringify(g.teams.map(t=>[t.wins,t.losses,t.ties,t.cash])),"finance isolation");ck(app.innerHTML.includes("試合別・自球団の出場成績"),"game report");click("ceremony-next");click("event-intro-continue",{event:"opening"});ck(!g.ceremonyStage,"opening");
  for(const t of g.teams)t.cash=10000; // financial solvency fixture, not an economic balance test
  let steps=0;while(g.calendarIndex<g.calendar.days.length){clearNotices();const e=api.step();if(!e)throw Error("calendar halt "+g.calendarIndex);steps++;if(steps>300)throw Error("loop");}clearNotices();
  ck(g.day===143&&g.games.length===858,"official schedule");ck(g.teams.every(t=>t.wins+t.losses+t.ties===143),"club counts");ck(g.annualTraining.allstars[g.year]?.players?.length===24,"natural allstar");
  const oldYear=g.year;
  // A signed rookie fixture exercises real registration/reveal and the new-year handoff;
  // the draft negotiation itself is not under test.
  const d=api.ensureDraft(),c=d.candidates.find(c=>!c.player.specialCategory),rookieId=c.id;
  d.phase="done";d.cutConfirmed=true;d.cutPlan={};d.picks=[{status:"signed",candidateId:c.id,teamId:g.selectedId,pos:c.player.pos,round:1,contract:{salary:.1,fee:.1,role:"育成"},report:{values:Object.fromEntries((["SP","RP","CP"].includes(c.player.pos)?["stuff","control","stamina"]:["contact","power","speed","defense","arm"]).map(k=>[k,{low:40,high:70}]))}}];
  api.stage("autumn");click("annual-run");ck(api.report("autumn")?.clubs.length===12,"autumn");
  click("ceremony-next");click("event-intro-continue",{event:"winter"});ck(api.plan(g.teams.find(t=>t.id===g.selectedId),"winter").winter.length<=6,"limit");
  click("annual-clear");ck(api.plan(g.teams.find(t=>t.id===g.selectedId),"winter").winter.length===0,"clear");click("annual-auto");
  let winterStats=JSON.stringify(g.players.map(p=>[p.stats,p.farmStats]));click("annual-run");const winter=api.report("winter");ck(winter?.games?.length===4&&winter.games.every(g=>!g.noContest),"winter games");ck(winterStats===JSON.stringify(g.players.map(p=>[p.stats,p.farmStats])),"winter isolation");
  click("ceremony-next");ck(g.year===oldYear+1&&g.day===0&&g.ceremonyStage==="self","turnover");ck(g.annualTraining.results[oldYear+":winter"]?.games.length===4,"history persists");ck(g.players.some(p=>p.id===rookieId&&p.teamId===g.selectedId),"rookie joined");ck(g.pendingDraftReveal?.entries.some(p=>p.id===rookieId),"rookie reveal");
  clearNotices();click("annual-run");ck(api.report("self").rows.some(p=>p.id===rookieId),"rookie trains");ck(api.report("self").clubs.length===12,"CPU next year");
  api.ui.annualHistoryYear=oldYear;ck(api.annualHistoryHTML().includes("オールスター"),"year filtered history");
  for(let year=2027;year<2127;year++){const cal=api.calendar(year);ck(cal.days.filter(d=>d.type==="game").length===143,"100 calendar years");}
  return {newGame:"pass",saveReload:"pass",officialGames:858,calendarDays:steps,clubGames:143,allstar:"pass",winterGames:4,exhibitionGames:36,yearTransition:g.year,rookieTraining:"pass",yearHistory:"pass",calendarYears:100,CPU:"12 club summaries"};
}

console.log(verifyAnnualTraining(fs.readFileSync('index.html','utf8')));
