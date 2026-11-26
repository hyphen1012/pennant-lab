'use strict';
// Paired policy ablation: same seed, same economy Y, same CPU target; only its learned decisions neutralized.
const fs=require('node:fs'),a=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{replaceExactly}=require('./facility-trial-k.cjs');
const seed=Number(process.argv[2]),target=Number(process.argv[3]),years=Number(process.argv[4]||20);
a.ok(Number.isSafeInteger(seed)&&Number.isInteger(target)&&target>=0&&target<12&&target!==2&&Number.isInteger(years)&&years>=1&&years<=55);
if(process.env.PL_PAIRED_CHILD==='1'){
 const fakeFs={...fs,readFileSync(path,...args){
  const src=fs.readFileSync(path,...args);
  if(path!=='scripts/year-cycle-check.cjs')return src;
  return replaceExactly(src,"faDeals:mv.deals.filter(d=>d.kind==='fa'||d.kind==='return').length,registered:","faDeals:mv.deals.filter(d=>d.kind==='fa'||d.kind==='return').length,recruitment:game.teams.map(t=>({id:t.id,fa:mv.deals.filter(x=>(x.kind==='fa'||x.kind==='return')&&x.to===t.id).length,draft:d.picks.filter(x=>x.teamId===t.id&&x.status==='signed').length,roster:own(t).length,meanRating:r2(own(t).reduce((n,p)=>n+rating(p),0)/Math.max(1,own(t).length))})),registered:");
 }};
 const localRequire=k=>k==='node:fs'?fakeFs:require(k);
 process.argv=[process.argv[0],process.argv[1],String(years),String(seed)];
 const source=fs.readFileSync('scripts/year-cycle-trial-y.cjs','utf8');
 new Function('require','process','console',source)(localRequire,process,console);
}else{
 fs.mkdirSync('test-results',{recursive:true});
 const run=(label,fixed)=>{
  const child=spawnSync(process.execPath,[__filename,String(seed),String(target),String(years)],{stdio:'inherit',env:{...process.env,PL_PAIRED_CHILD:'1',FIXED_TEAM:String(fixed),STOP_AFTER_FACILITY:'0',TEST_VIP:'0'}});
  if(child.error)throw child.error;a.equal(child.status,0,label+' failed');
  const path='test-results/year-cycle-'+fixed+'.json',raw=fs.readFileSync(path,'utf8');fs.writeFileSync('test-results/paired-'+seed+'-'+label+'.json',raw);
  const r=JSON.parse(raw);a.equal(r.years,years);a.equal(r.totalGames,858*years);a.equal(r.reserveTopUps,0);a.ok(r.minCash>=0);a.equal(r.fixedTeam,fixed);
  a.ok(r.rows.every(x=>x.recruitment?.length===12&&x.performance?.length===12&&x.annualEconomy?.length===12&&x.clubs.length===12));
  return r;
 };
 const learned=run('learned',-1),fixed=run('fixed',target);
 const summarize=(r,id)=>{
  const rows=r.rows.map(row=>{const p=row.performance.find(x=>x.id===id),c=row.clubs.find(x=>x.id===id),e=row.annualEconomy.find(x=>x.id===id),q=row.recruitment.find(x=>x.id===id);return {year:row.year,wins:p.wins,losses:p.losses,ties:p.ties,rs:p.rs,ra:p.ra,cash:c.cash,levelSum:c.levels.reduce((a,b)=>a+b,0),revenue:e.revenue,payroll:e.payroll,maintenance:e.maintenance,investment:e.investment,fa:q.fa,draft:q.draft,meanRating:q.meanRating,roster:q.roster,learning:c.learning,budgetSamples:c.budgetSamples,draftSamples:c.draftSamples};});
  const sum=k=>rows.reduce((n,x)=>n+x[k],0),last=rows.at(-1);
  return {id,wins:sum('wins'),losses:sum('losses'),ties:sum('ties'),runDiff:sum('rs')-sum('ra'),minAnnualCash:Math.min(...rows.map(x=>x.cash)),finalCash:last.cash,finalFacility:last.levelSum,fa:sum('fa'),draft:sum('draft'),finalRating:last.meanRating,revenue:sum('revenue'),payroll:sum('payroll'),maintenance:sum('maintenance'),investment:sum('investment'),learning:last.learning,rows};
 };
 const l=Array.from({length:12},(_,i)=>summarize(learned,i)),f=Array.from({length:12},(_,i)=>summarize(fixed,i));
 a.ok(l[target].learning>0,'target must be a learning CPU club');
 const report={seed,target,years,scope:'one CPU ablation; other clubs remain adaptive; observations may still accumulate in control; Y unadopted',learned:l,fixed:f,minCash:{learned:learned.minCash,fixed:fixed.minCash},reserveTopUps:0};
 fs.writeFileSync('test-results/paired-'+seed+'-comparison.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({seed,target,years,learned:{...l[target],rows:undefined},fixed:{...f[target],rows:undefined},minCash:report.minCash}));
}
