'use strict';
const fs=require('node:fs'),a=require('node:assert/strict');
const KEYS=['training','indoor','medical','draft','foreign','park','food','goods'];
const round=n=>Math.round(n*100)/100;
function analyze(source){
 a.equal(source.schema,1);a.deepEqual(source.keys,KEYS);a.equal(new Set(source.cases.map(c=>c.seed)).size,3);
 return source.cases.map(({seed,job,years})=>{
  a.ok(years.length>=50);let first=null;
  for(const [i,row] of years.entries()){
   a.equal(row.year,2027+i);a.equal(row.clubs.length,12);a.deepEqual(row.clubs.map(c=>c.id).sort((a,b)=>a-b),Array.from({length:12},(_,j)=>j));
   for(const c of row.clubs){a.equal(c.levels.length,KEYS.length);a.ok(c.levels.every(v=>Number.isInteger(v)&&v>=1&&v<=20));a.ok(Number.isFinite(c.cash)&&c.cash>=0);
    if(c.parkPlan){a.equal(c.parkPlan.level,c.levels[5]);a.ok(c.parkPlan.level<20);a.ok(Number.isFinite(c.parkPlan.required));}else a.equal(c.levels[5],20);
    if(first===null&&c.levels.every(v=>v===20))first=i+1;
   }
  }
  const ranked=years[49].clubs.map(c=>({id:c.id,score:c.levels.reduce((n,v)=>n+v,0),missing:Object.fromEntries(KEYS.map((k,i)=>[k,c.levels[i]]).filter(([,v])=>v<20)),cash:c.cash,parkViable:c.parkPlan?.viable??null,parkRequired:c.parkPlan?.required??null,parkGap:c.parkPlan?round(Math.max(0,c.parkPlan.required-c.cash)):null,forecast:c.forecast,investment:c.investment,actualCashChange:round(c.cashBeforeRollover-c.openingCash)})).sort((a,b)=>b.score-a.score||a.id-b.id);
  return {seed,job,firstAnnualAll20:first,year50:ranked,qualification:'Annual observations only; formal first-reach and five-year maintenance still require checkpoint endurance result.'};
 });
}
if(require.main===module){
 const data=JSON.parse(fs.readFileSync(process.argv[2]||'test-fixtures/af-annual-investment-log-extract.json','utf8')),rows=analyze(data);
 if(!process.argv[2]){
  const get=(seed,id)=>rows.find(r=>r.seed===seed).year50.find(c=>c.id===id);
  a.deepEqual(get(4391,4).missing,{training:19,park:19});a.equal(get(4391,4).parkGap,23.98);a.equal(get(4391,4).parkViable,true);
  a.deepEqual(get(8821,3).missing,{park:19});a.equal(get(8821,3).parkGap,13.98);a.equal(get(8821,3).parkViable,true);
  a.deepEqual(get(8821,4).missing,{park:19});a.deepEqual(get(1937,7).missing,{});
  console.log('PASS actual AF annual log facility mapping, park funding gaps, all 12 clubs across 3 seeds');
 }
 console.log(JSON.stringify(rows,null,2));
}
module.exports={analyze};
