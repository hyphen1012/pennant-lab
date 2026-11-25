// Independent validation seeds and additional club identities. Not a pass-by-win threshold.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||'heldout-results',cases=[[2467,3],[3719,3],[6949,8],[10037,8]];
function read(seed,club,fixed){
 const r=JSON.parse(fs.readFileSync(path.join(root,'heldout-'+seed+'-'+fixed,'year-cycle-'+fixed+'.json'),'utf8'));
 assert.equal(r.years,10);assert.equal(r.totalGames,8580);assert.equal(r.reserveTopUps,0);assert(r.minCash>=0);assert.equal(r.fixedTeam,fixed);
 const rows=r.rows.map(row=>{const p=row.performance.find(x=>x.id===club);assert(p&&p.wins+p.losses+p.ties===143);return p;});
 const summarize=a=>({wins:a.reduce((s,p)=>s+p.wins,0),runDiff:a.reduce((s,p)=>s+p.rs-p.ra,0)});
 return {all:summarize(rows),early:summarize(rows.slice(0,5)),late:summarize(rows.slice(5)),minCash:r.minCash};
}
const pairs=cases.map(([seed,club])=>{const fixed=read(seed,club,club),adaptive=read(seed,club,-1);return {seed,club,fixed,adaptive,winDelta:adaptive.all.wins-fixed.all.wins,earlyDelta:adaptive.early.wins-fixed.early.wins,lateDelta:adaptive.late.wins-fixed.late.wins,runDiffDelta:adaptive.all.runDiff-fixed.all.runDiff};});
const report={scope:'Four new seeds, target clubs 3 and 8; other clubs adaptive. Headless policy comparison. Early/late differences are descriptive, not a causal proof of improvement.',pairs,winDelta:pairs.reduce((s,p)=>s+p.winDelta,0),earlyDelta:pairs.reduce((s,p)=>s+p.earlyDelta,0),lateDelta:pairs.reduce((s,p)=>s+p.lateDelta,0),improved:pairs.filter(p=>p.winDelta>0).length,runDiffDelta:pairs.reduce((s,p)=>s+p.runDiffDelta,0)};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/heldout-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
