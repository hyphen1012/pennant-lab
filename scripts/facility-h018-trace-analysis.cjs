'use strict';
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const root=process.argv[2]||'trace-input';
const keys=['training','indoor','medical','draft','foreign','park','food','goods'];
const round=n=>Math.round(n*100)/100;
const targets={1937:7,4391:4,8821:3};
const summary=[];
for(const seed of [1937,4391,8821]){
 const dir=path.join(root,'af-h017-decision-trace-'+seed);
 const rows=fs.readFileSync(path.join(dir,'af-decision-trace.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
 const run=JSON.parse(fs.readFileSync(path.join(dir,'year-cycle--1.json'),'utf8'));
 a.equal(run.reserveTopUps,0);a.equal(new Set(rows.map(r=>r.club)).size,12);
 a.equal(run.firstMax.cycleYear,{1937:2075,4391:2080,8821:2077}[seed]);
 a.ok(run.firstMax.clubs.includes(targets[seed]));
 for(const r of rows){a.ok(keys.every(k=>Number.isInteger(r.levels[k])&&r.levels[k]>=1&&r.levels[k]<=20));a.ok(Number.isFinite(r.cash)&&Number.isFinite(r.reserve)&&Number.isFinite(r.forecast));}
 const groups=[];
 for(let club=0;club<12;club++){
  const trace=rows.filter(r=>r.club===club&&r.year<=2076);
  const selections=trace.filter(r=>r.stage==='selection'&&r.levels.park===19);
  const usable=selections.filter(r=>r.park?.viable===true);
  const other=usable.filter(r=>r.selected&&r.selected.key!=='park');
  const misses=usable.filter(r=>r.cash<r.park.required);
  const eligible=usable.filter(r=>r.cash>=r.park.required);
  const gates=trace.filter(r=>r.stage==='early-gate'&&r.levels.park===19);
  const investments=trace.filter(r=>r.stage==='committed'&&r.levels.park===19);
  groups.push({club,selectionCount:selections.length,viable:usable.length,cashShort:misses.length,eligible:eligible.length,eligibleSelectedPark:eligible.filter(r=>r.selected?.key==='park').length,otherSelected:other.length,earlyGates:gates.length,limit:gates.filter(r=>r.limitReached).length,forecast:gates.filter(r=>r.lowForecast).length,reserve:gates.filter(r=>r.belowReserve).length,closestGap:misses.length?round(Math.min(...misses.map(r=>r.park.required-r.cash))):null,largestGap:misses.length?round(Math.max(...misses.map(r=>r.park.required-r.cash))):null,otherCommits:investments.filter(r=>r.key!=='park').map(r=>({year:r.year,date:r.date,key:r.key,cost:r.cost,cashAfter:r.cash})),parkCommits:investments.filter(r=>r.key==='park').map(r=>({year:r.year,date:r.date,cost:r.cost,cashAfter:r.cash})),latest:selections.slice(-4).map(r=>({year:r.year,date:r.date,cash:r.cash,required:r.park?.required,viable:r.park?.viable,selected:r.selected?.key??null,forecast:r.forecast,hold:r.hold}))});
 }
 summary.push({seed,rows:rows.length,firstReach:run.firstMax.cycleYear,topups:run.reserveTopUps,clubs:groups});
 console.log(JSON.stringify({seed,rows:rows.length,firstReach:run.firstMax.cycleYear,leading:groups[targets[seed]]}));
}
fs.mkdirSync('test-results',{recursive:true});
fs.writeFileSync('test-results/af-h018-analysis.json',JSON.stringify(summary,null,2));
console.log('PASS actual AF trace artifact analysis: 3 seeds x 12 clubs; observations only, no causal claim');
