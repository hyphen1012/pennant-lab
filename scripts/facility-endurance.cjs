// Natural investment milestone: all eight facilities must reach 20 and stay there for five further seasons.
const fs=require('node:fs'),assert=require('node:assert/strict');
const r=JSON.parse(fs.readFileSync(process.argv[2]||'test-results/year-cycle--1.json','utf8'));
assert.equal(r.mode,'adaptive');assert.equal(r.reserveTopUps,0);assert(r.minCash>=0);
assert.equal(r.rows.length,r.years);assert.equal(r.totalGames,858*r.years);
const full=c=>c&&c.levels.length===8&&c.levels.every(l=>l===20)&&c.cash>=0;
const milestones=[];
for(let i=0;i<r.rows.length;i++)for(const c of r.rows[i].clubs){
  if(!full(c))continue;
  const following=r.rows.slice(i+1,i+6);
  if(following.length===5&&following.every(row=>full(row.clubs.find(x=>x.id===c.id))))milestones.push({club:c.id,reached:r.rows[i].year,maintainedThrough:following[4].year,allClubsAtReach:r.rows[i].clubs,allClubsAfterFiveYears:following[4].clubs});
}
const best=r.rows.reduce((a,row)=>{for(const c of row.clubs){const score=c.levels.reduce((x,y)=>x+y,0);if(score>a.score)a={year:row.year,score,...c};}return a;},{score:0});
const report={years:r.years,minCash:r.minCash,reserveTopUps:r.reserveTopUps,best,milestone:milestones[0]||null,last:r.last.clubs};
fs.writeFileSync('test-results/facility-endurance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
assert(milestones.length,'No club naturally reached all Lv.20 and maintained it for five more years');
