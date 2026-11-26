// X: attendance-backed premium service sales, W baseline. No cash grant.
const {applyTrialW}=require('./facility-trial-w.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialX(html){
 let s=applyTrialW(html);
 s=replaceExactly(s,'  function stadiumDemand(t,away,date,day){',`  function trialXPremium(t,x,kind){
    // Additional per-visitor spend from premium hospitality/merchandising.
    // Requires the actual venue and supporting shop; condition discounts apply.
    const venue=[0,40,85,140,220,560][clamp(x.park-15,0,5)];
    return Math.round(venue*clamp((x[kind]-10)/10,0,1)*clamp(clubCondition(t,kind)/100,0,1));
  }
  function stadiumDemand(t,away,date,day){`);
 s=replaceExactly(s,'attendance*(850+40*(x.food-1)*clubCondition(t,\'food\')/100)','attendance*(850+40*(x.food-1)*clubCondition(t,\'food\')/100+trialXPremium(t,x,\'food\'))');
 s=replaceExactly(s,'attendance*(600+45*(x.goods-1)*clubCondition(t,\'goods\')/100)','attendance*(600+45*(x.goods-1)*clubCondition(t,\'goods\')/100+trialXPremium(t,x,\'goods\'))');
 return s;
}
module.exports={applyTrialX};
