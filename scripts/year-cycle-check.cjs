// Expands the regular-season endurance harness with actual annual training and transfer functions.
// Explicitly a headless policy comparison, not a UI end-to-end test.
const fs=require('node:fs');
let s=fs.readFileSync('scripts/long-run.cjs','utf8');
function patch(a,b){if(!s.includes(a))throw Error('annual harness anchor missing: '+a);s=s.replace(a,b);}
patch("const economyMode=process.env.NO_RESERVE==='1';","const economyMode=true;const fixedTeam=Number(process.env.FIXED_TEAM??-1);");
patch("let reserveTopUps=0,totalGames=0,totalFarmGames=0,foreignSigned=0,minCash=Infinity;\\n","let reserveTopUps=0,totalGames=0,totalFarmGames=0,foreignSigned=0,minCash=Infinity;\\nconst fixed=TEST_FIXED;const aiManager=managerDecision,aiBudget=rivalBudgetPolicy,aiDraft=draftRanked,aiRecruit=faRecruitLearning;managerDecision=(t,k)=>t.id===fixed?rivalManagerBase(t,k):aiManager(t,k);rivalBudgetPolicy=t=>t.id===fixed?RIVAL_BUDGETS[1]:aiBudget(t);draftRanked=(d,t)=>t.id===fixed?rivalDraftBase(d,t):aiDraft(d,t);faRecruitLearning=(t,k)=>t.id===fixed?0:aiRecruit(t,k);\\n");
patch("'cash shortfall club '+t.id+' '+t.cash","'cash shortfall club '+t.id+' '+t.cash+' calendar '+game.calendarIndex+' payroll '+payroll(t)+' forecast '+cpuForecast(t)");
patch("  let e;while((e=processCalendarDay())){","  const pre={year,mode:'pre',date:year+'-01-01'};cpuCommercialCalendar(pre);commerceOffPay(pre.date);sponsorOffPay(pre.date);\\n  assert(annualRunPhase('self'),'self training');winterReturn();\\n  const t0=myTeam();annualPlan(t0,'camp',true).sites=t0.cash>=cpuReserve(t0)+2?{first:'naha',farm:'club'}:t0.cash>=.56?{first:'club',farm:'club'}:{first:'none',farm:'none'};\\n  assert(annualRunPhase('camp'),'camp');const exhibition=annualRunPhase('exhibition');assert(exhibition?.games?.length===36,'exhibition');financeAudit();\\n  pre.date=calendarOffsetDate(game.calendar.startDate,-1);cpuCommercialCalendar(pre);\\n  let e;while((e=processCalendarDay())){");
patch("  const d=ensureDraft(),m=ensureForeignMarket();auditCandidates(d,m);","  const performance=game.teams.map(t=>({id:t.id,wins:t.wins,losses:t.losses,ties:t.ties,rs:t.rs,ra:t.ra,cash:t.cash}));\\n  const mv=movementInit();game.ceremonyStage='movement-declarations';for(const r of mv.requests.filter(r=>r.from===game.selectedId&&r.status==='request'))movementAction('movement-allow',{dataset:{id:String(r.id)}});game.ceremonyStage=null;\\n  const d=ensureDraft(),m=ensureForeignMarket();auditCandidates(d,m);");
patch("d.cutConfirmed=true;nextSeason();","d.cutConfirmed=true;\\n  for(const t of game.teams)assert(budgetedRenewalPlan(t,mv).confirmed,'budgeted renewal');\\n  game.ceremonyStage=null;assert(annualRunPhase('autumn'),'autumn');assert(winterDispatch(),'winter booking');\\n  movementCPU(mv);mv.closed=true;financeAudit();nextSeason();");
patch("const row={year,games:858,registered:","const row={year,games:858,performance,faDeals:mv.deals.filter(d=>d.kind==='fa'||d.kind==='return').length,registered:");
patch("mode:TEST_RESERVE?'reserve-isolated':'no-reserve'","mode:TEST_FIXED<0?'adaptive':'fixed-target',fixedTeam:TEST_FIXED");
patch('"TEST_RESERVE","TEST_LOG",code)', '"TEST_RESERVE","TEST_LOG","TEST_FIXED",code)');
patch("process.env.NO_RESERVE!=='1',true);","false,true,fixedTeam);");
patch("'test-results/long-run.json'","'test-results/year-cycle-'+fixedTeam+'.json'");
// Record the lowest facility level at every existing cash-audit checkpoint.
patch("function financeAudit(){for(const t of game.teams){","let facilityMin={},firstMax=null,cycleYear=game.year;function facilitySnapshot(){return game.teams.map(t=>({id:t.id,cash:t.cash,levels:CLUB_CONDITION_KEYS.map(k=>Object.hasOwn(INFRA_LABELS,k)?infraLevel(t,k):stadiumState(t)[k])}));}function financeAudit(){const snapshot=facilitySnapshot();for(const t of game.teams){const levels=snapshot.find(c=>c.id===t.id).levels;facilityMin[t.id]=levels.map((v,i)=>Math.min(v,facilityMin[t.id]?.[i]??20));");
patch("forecast '+cpuForecast(t));}}","forecast '+cpuForecast(t));}const maxed=snapshot.filter(c=>c.levels.length===8&&c.levels.every(l=>l===20));if(!firstMax&&maxed.length)firstMax={cycleYear,engineYear:game.year,calendarIndex:game.calendarIndex,day:game.day,clubs:maxed.map(c=>c.id),allClubs:snapshot,minAfterReach:{}};if(firstMax)for(const id of firstMax.clubs){const levels=snapshot.find(c=>c.id===id).levels;firstMax.minAfterReach[id]=levels.map((v,i)=>Math.min(v,firstMax.minAfterReach[id]?.[i]??20));}}");
patch("const year=game.year,begin=Date.now();","cycleYear=game.year;facilityMin={};financeAudit();const year=game.year,begin=Date.now();");
patch("if((run+1)%10===0||run===TEST_YEARS-1){","if((run+1)%10===0||run===TEST_YEARS-1||(TEST_STOP&&firstMax&&year>=firstMax.cycleYear+5)){");
patch("rows.push(row);if(TEST_LOG)console.log(JSON.stringify(row));","rows.push(row);if(TEST_LOG)console.log(JSON.stringify(row));if(TEST_STOP&&firstMax&&year>=firstMax.cycleYear+5)break;");
patch("return {years:rows.length,totalGames","return {firstMax,years:rows.length,totalGames");
patch('"TEST_LOG","TEST_FIXED",code)', '"TEST_LOG","TEST_FIXED","TEST_STOP",code)');
patch("false,true,fixedTeam);","false,true,fixedTeam,process.env.STOP_AFTER_FACILITY==='1');");
patch("const row={year,games:858,performance,","const row={year,games:858,facilityMin,performance,");
// Only this headless test can inject a synthetic verified VIP state.
if(process.env.TEST_VIP==='1'){
 patch("let reserveTopUps=0,totalGames=0,totalFarmGames=0,foreignSigned=0,minCash=Infinity;\\n","let reserveTopUps=0,totalGames=0,totalFarmGames=0,foreignSigned=0,minCash=Infinity;\\nvipStatusProvider=()=>({verified:true,vip:true});\\n");
}
patch("const row={year,games:858,facilityMin,performance,","const row={year,games:858,vipIncome:game.seasonArchive.at(-1)?.vipIncome||0,facilityMin,performance,");
patch("const row={year,games:858,vipIncome:game.seasonArchive.at(-1)?.vipIncome||0,facilityMin,performance,","const row={year,games:858,vipIncome:game.seasonArchive.at(-1)?.vipIncome||0,facilityMin,performance,parkDiagnostics:game.teams.map(t=>({id:t.id,fans:clubFanCount(t),cash:t.cash,forecast:cpuForecast(t),prices:stadiumState(t).prices,plan:parkExpansionPlan(t)})),");
new Function('require','process','console',s)(require,process,console);
