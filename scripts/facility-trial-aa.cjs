// AA: independent Y-based price forecast trial. Z is not inherited.
const {applyTrialY}=require('./facility-trial-y.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAA(html){
 let s=applyTrialY(html),start=s.indexOf('  function cpuPricePlan(t,date){'),end=s.indexOf('  // Trial F: choose sales terms',start);
 if(start<0||end<0)throw Error('price policy anchors missing');
 let p=s.slice(start,end);
 p=replaceExactly(p,"const old=x.prices.slice(),baseline=stadiumDemand(t,null,date,Math.max(1,game.day)),net=v=>v.ticket+v.food+v.goods-v.operating;",`const old=x.prices.slice(),net=v=>v.ticket+v.food+v.goods-v.operating;
    // Existing demand equations; representative weekday/weekend, no change to price timing or bands.
    const forecastDates=x.park>=15?['2027-06-04','2027-06-06']:[date];
    const demand=()=>forecastDates.map(d=>stadiumDemand(t,null,d,Math.max(1,game.day)));
    const baseline=demand(),scoreOf=rows=>rows.reduce((n,v,i)=>n+(net(v)+(a.style===2?v.attendance*180:0))*(rows.length===1?1:i===0?5/7:2/7),0);
    const acceptable=rows=>rows.every((v,i)=>v.satisfaction>=65&&v.attendance>=baseline[i].attendance*.85);`);
 p=replaceExactly(p,'let best=old,bestScore=net(baseline)+(a.style===2?baseline.attendance*180:0);','let best=old,bestScore=scoreOf(baseline);');
 const before="const v=stadiumDemand(t,null,date,Math.max(1,game.day));const score=net(v)+(a.style===2?v.attendance*180:0);";
 p=replaceExactly(p,before,'const v=demand();const score=scoreOf(v);');
 p=replaceExactly(p,"const v=stadiumDemand(t,null,date,Math.max(1,game.day)),score=net(v)+(a.style===2?v.attendance*180:0);",'const v=demand(),score=scoreOf(v);');
 const guard='v.satisfaction>=65&&v.attendance>=baseline.attendance*.85&&score>bestScore';
 if(p.split(guard).length!==3)throw Error('price guard anchor');
 p=p.replaceAll(guard,'acceptable(v)&&score>bestScore');
 return s.slice(0,start)+p+s.slice(end);
}
module.exports={applyTrialAA};
