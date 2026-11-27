'use strict';
// Observation-only instrumentation applied to the AF headless trial, never index.html.
const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs'),{applyTrialAF}=require('./facility-trial-af.cjs');
function applyDecisionTrace(html){
 const source=applyTrialAF(html),start=source.indexOf('  function cpuEconomyReview(t,date){'),end=source.indexOf('  function cpuPricePlan(t,date){',start);
 if(start<0||end<=start)throw Error('review boundaries missing');
 let s=source.slice(start,end);
 s=replaceExactly(s,'    if(t.cash<reserve*.65||(forecast<-.5&&t.cash<reserve*1.5)){',`    const trace=(stage,extra={})=>globalThis.__afDecisionTrace({year:game.year,date,club:t.id,stage,cash:t.cash,reserve,forecast,levels:Object.fromEntries(items.map(i=>[i.k,i.lv])),spent:a.spent,investments:a.investments,...extra});
    if(t.cash<reserve*.65||(forecast<-.5&&t.cash<reserve*1.5)){
      trace('solvency-reduction');`);
 s=replaceExactly(s,'if(a.investments>=annualLimit||forecast<.8||t.cash<reserve)return false;',`if(a.investments>=annualLimit||forecast<.8||t.cash<reserve){trace('early-gate',{annualLimit,limitReached:a.investments>=annualLimit,lowForecast:forecast<.8,belowReserve:t.cash<reserve});return false;}`);
 s=replaceExactly(s,'    if(!q)return false;',`    trace('selection',{annualLimit,budget,capitalBudget,hold,park:park?{...park}:null,selected:q?{key:q.k,level:q.lv,cost:q.cost,extra:q.extra,score:q.score}:null});
    if(!q)return false;`);
 s=replaceExactly(s,'if(!(q.stadium?stadiumResize(t,q.k,1):infraUpgrade(t,q.k)))return false;',`if(!(q.stadium?stadiumResize(t,q.k,1):infraUpgrade(t,q.k))){trace('commit-rejected',{key:q.k});return false;}`);
 s=replaceExactly(s,"cpuLog(t,date,'invest',q.label+' Lv.'+(q.lv+1),q.cost);return true;","cpuLog(t,date,'invest',q.label+' Lv.'+(q.lv+1),q.cost);trace('committed',{key:q.k,newLevel:q.lv+1,cost:q.cost});return true;");
 return source.slice(0,start)+s+source.slice(end);
}
function run(){
 const from=Number(process.env.TRACE_FROM_YEAR||2072);
 if(!Number.isInteger(from))throw Error('invalid trace start');
 fs.mkdirSync('test-results',{recursive:true});
 const fd=fs.openSync('test-results/af-decision-trace.ndjson','w');
 globalThis.__afDecisionTrace=row=>{if(row.year>=from)fs.writeSync(fd,JSON.stringify(row)+'\n');};
 try{
   let s=fs.readFileSync('scripts/year-cycle-trial-af.cjs','utf8');
   // Pass the instrumented AF transform through the existing nested annual harness.
   s=replaceExactly(s,"require('./facility-trial-af.cjs').applyTrialAF(","require('./facility-h017-decision-trace.cjs').applyDecisionTrace(");
   new Function('require','process','console',s)(require,process,console);
 }finally{delete globalThis.__afDecisionTrace;fs.closeSync(fd);}
}
if(require.main===module)run();
module.exports={applyDecisionTrace};
