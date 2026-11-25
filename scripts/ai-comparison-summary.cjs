// Aggregate actual paired annual-policy artifacts; never infer superiority from CI success.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||'comparison-results';
const seeds=[1937,4391,8821,5107,12011],pairs=[];
function read(seed,fixed){
 const r=JSON.parse(fs.readFileSync(path.join(root,'year-cycle-'+seed+'-'+fixed,'year-cycle-'+fixed+'.json'),'utf8'));
 assert.equal(r.years,10);assert.equal(r.rows.length,10);assert.equal(r.totalGames,8580);assert.equal(r.reserveTopUps,0);assert(r.minCash>=0);assert.equal(r.fixedTeam,fixed);
 const stats=r.rows.map(row=>{assert.equal(row.performance.length,12);const p=row.performance.find(x=>x.id===0);assert(p&&p.wins+p.losses+p.ties===143);return p;});
 return {wins:stats.reduce((s,p)=>s+p.wins,0),runDiff:stats.reduce((s,p)=>s+p.rs-p.ra,0),minCash:r.minCash,faDeals:r.rows.reduce((s,p)=>s+(p.faDeals||0),0),final:r.last.clubs.find(c=>c.id===0)};
}
for(const seed of seeds){const fixed=read(seed,0),adaptive=read(seed,-1);pairs.push({seed,fixed,adaptive,winDelta:adaptive.wins-fixed.wins,runDiffDelta:adaptive.runDiff-fixed.runDiff});}
const report={scope:'Five paired seeds; club 0 policy override only. Other clubs still adaptive. Headless annual model; not complete UI.',pairs,winDelta:pairs.reduce((s,p)=>s+p.winDelta,0),runDiffDelta:pairs.reduce((s,p)=>s+p.runDiffDelta,0),improved:pairs.filter(p=>p.winDelta>0).length,minCash:Math.min(...pairs.flatMap(p=>[p.fixed.minCash,p.adaptive.minCash])),superiorityEstablished:false};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/ai-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
