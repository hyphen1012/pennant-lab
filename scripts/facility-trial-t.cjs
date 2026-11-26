// T: independent R-based mature ticket pricing forecast. No change to economics.
const {applyTrialR}=require('./facility-trial-r.cjs');
const assert=require('node:assert/strict');
function applyTrialT(html){
 const source=applyTrialR(html),start=source.indexOf('  function cpuPricePlan(t,date){'),end=source.indexOf('  // Trial F:',start);
 assert(start>=0&&end>start,'price planning anchor');
 let p=source.slice(start,end);
 const anchor='stadiumDemand(t,null,date,Math.max(1,game.day))';
 assert.equal(p.split(anchor).length,4);
 p=p.split(anchor).join('trialTPriceDemand(t,date)');
 const guard='v.satisfaction>=65&&v.attendance>=baseline.attendance*.85&&score>bestScore';
 assert.equal(p.split(guard).length,3);
 p=p.split(guard).join(guard+'&&(!v.split||v.split.every((n,i)=>n.attendance>=baseline.split[i].attendance*.85))');
 const helper=`  function trialTPriceDemand(t,date){
    const day=Math.max(1,game.day);
    if(stadiumState(t).park<15)return stadiumDemand(t,null,date,day);
    // Same representative weekday/weekend weights as parkExpansionPlan.
    const a=stadiumDemand(t,null,'2027-06-04',day),b=stadiumDemand(t,null,'2027-06-06',day);
    const mix=k=>(a[k]*5+b[k]*2)/7;
    return {...Object.fromEntries(['ticket','food','goods','operating','attendance'].map(k=>[k,mix(k)])),satisfaction:Math.min(a.satisfaction,b.satisfaction),split:[a,b]};
  }
`;
 return source.slice(0,start)+helper+p+source.slice(end);
}
module.exports={applyTrialT};
