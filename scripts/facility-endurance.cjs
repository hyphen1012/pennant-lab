// Verify the first naturally observed all-Lv20 club(s), not a later successful club.
const fs=require('node:fs'),assert=require('node:assert/strict');
const r=JSON.parse(fs.readFileSync(process.argv[2]||'test-results/year-cycle--1.json','utf8'));
assert.equal(r.mode,'adaptive');assert.equal(r.reserveTopUps,0);assert(r.minCash>=0);
assert.equal(r.rows.length,r.years);assert.equal(r.totalGames,858*r.years);
const full=c=>c&&c.levels.length===8&&c.levels.every(l=>l===20)&&c.cash>=0;
const best=r.rows.reduce((a,row)=>{for(const c of row.clubs){const score=c.levels.reduce((x,y)=>x+y,0);if(score>a.score)a={year:row.year,score,...c};}return a;},{score:0});
const targetYears=50,first=r.firstMax,firstSeason=first?r.rows.findIndex(row=>row.year===first.cycleYear)+1:null;
let milestone=null;
if(first){
 const i=r.rows.findIndex(row=>row.year===first.cycleYear);
 assert(i>=0&&first.clubs.length&&first.allClubs.length===12,'invalid first milestone checkpoint');
 assert(first.clubs.every(id=>full(first.allClubs.find(c=>c.id===id))),'invalid first max club');
 const following=r.rows.slice(i+1,i+6),checks=first.clubs.map(id=>({club:id,maintained:full(r.rows[i].clubs.find(c=>c.id===id))&&following.length===5&&following.every(row=>full(row.clubs.find(c=>c.id===id))&&row.facilityMin?.[id]?.length===8&&row.facilityMin[id].every(l=>l===20))&&first.minAfterReach?.[id]?.length===8&&first.minAfterReach[id].every(l=>l===20)}));
 milestone={firstCheckpoint:first,reached:first.cycleYear,maintainedThrough:following.at(-1)?.year??null,checks,allClubsAtReach:first.allClubs,allClubsAfterFiveYears:following.length===5?following[4].clubs:null};
}
// Retain all 12 clubs at year 50 and 55 even when no milestone is reached.
const checkpoint=season=>{const row=r.rows[season-1];if(!row)return null;return {season,year:row.year,clubs:row.clubs.map(c=>{const park=row.parkDiagnostics?.find(p=>p.id===c.id),economy=row.annualEconomy?.find(p=>p.id===c.id);return {...c,score:c.levels.reduce((n,v)=>n+v,0),park,economy};})};};
const report={targetYears,firstSeason,years:r.years,minCash:r.minCash,reserveTopUps:r.reserveTopUps,best,milestone,checkpoints:[checkpoint(50),checkpoint(55)],last:r.last.clubs};
fs.writeFileSync('test-results/facility-endurance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
assert(milestone&&firstSeason>0&&firstSeason<=targetYears&&milestone.checks.every(x=>x.maintained),'First club(s) must naturally reach all Lv.20 within 50 seasons and maintain through five further complete seasons');
