// Read-only diagnostics for natural facility endurance; never change a trial result.
const fs=require('node:fs'),assert=require('node:assert/strict');
const r=JSON.parse(fs.readFileSync(process.argv[2]||'test-results/year-cycle--1.json','utf8'));
const sum=a=>a.reduce((x,y)=>x+y,0),round=n=>Math.round(n*100)/100;
const levels=c=>sum(c.levels);
assert(r.rows.length===r.years&&r.reserveTopUps===0&&r.totalGames===858*r.years);
const rows=r.rows.map((row,i)=>{
 assert(row.clubs.length===12&&new Set(row.clubs.map(c=>c.id)).size===12);
 const clubs=row.clubs.map(c=>{
  const e=row.annualEconomy?.find(x=>x.id===c.id),p=row.parkDiagnostics?.find(x=>x.id===c.id);
  const knownOutflow=e?sum(['payroll','maintenance','overhead','stadiumOperating','commerceCost','rewards','optional','investment'].map(k=>e[k]||0)):null;
  return {id:c.id,levels:c.levels,total:levels(c),cash:c.cash,minimumLevels:row.facilityMin?.[c.id]??null,
   annualEconomy:e??null,recordedOperatingSurplus:e?round(e.revenue-knownOutflow+(e.investment||0)):null,
   cashChangeBeforeRollover:e?round(e.cashBeforeRollover-e.openingCash):null,
   unexplainedCashChange:e?round(e.cashBeforeRollover-e.openingCash-e.revenue+knownOutflow):null,
   forecast:p?.forecast??null,reserve:p?.reserve??null,capitalHold:p?.capitalHold??null,parkPlan:p?.plan??null,
   learning:c.learning};
 });
 return {season:i+1,year:row.year,leagueMinCash:row.minCash,best:Math.max(...clubs.map(c=>c.total)),clubs};
});
const first=r.firstMax,idx=first?rows.findIndex(x=>x.year===first.cycleYear):-1;
const report={scope:'Headless actual season engine. Test-controlled club still uses some manual-policy substitutes; not identical AI on all 12 clubs. No test cash injection.',target:50,years:r.years,firstSeason:idx>=0?idx+1:null,firstIds:first?.clubs??[],minCash:r.minCash,
 checkpoints:rows.filter(x=>x.season%10===0||x.season===rows.length||x.season===idx+1||x.season===idx+6),
 firstMax:first??null,followingFive:idx>=0?rows.slice(idx+1,idx+6):[],
 cashScope:'Annual rows mix calendar-year opening through pre-rollover closing, and next-year cash after rollover. Recorded surplus and unexplained cash change are diagnostics, not a reconciled ledger; omitted transfers, repair, recruitment, timing and overlapping recorded payments may affect residual.',
 rows};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/facility-finance-diagnostics.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({years:report.years,firstSeason:report.firstSeason,firstIds:report.firstIds,minCash:report.minCash,checkpoints:report.checkpoints.map(x=>({season:x.season,best:x.best,clubs:x.clubs.map(c=>({id:c.id,total:c.total,cash:c.cash,park:c.levels[5],recordedOperatingSurplus:c.recordedOperatingSurplus,parkRequired:c.parkPlan?.required??null}))}))},null,2));
