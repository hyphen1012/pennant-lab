// W: V baseline, optional cost review before the existing facility reduction decision.
const {applyTrialV}=require('./facility-trial-v.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialW(html){
 let s=applyTrialV(html);
 s=replaceExactly(s,'  function cpuEconomyReview(t,date){',`  function trialWTravelTarget(t,reserve,forecast,life){
    const tier=clamp(Math.round(life.travel||0),0,3),x=stadiumState(t);
    // Only review mature clubs facing a forecast-driven reduction, not a cash emergency.
    if(t.id===game.selectedId||tier===0||life.trialWTravelYear===game.year||life.trialUTravelYear===game.year||x.park<19||x.food<15||x.goods<15||Object.keys(INFRA_LABELS).some(k=>infraLevel(t,k)<15))return tier;
    if(t.cash<reserve*.65||t.cash>=reserve*1.5||forecast>=-.5)return tier;
    const saving=CLUB_TRAVEL[tier]-CLUB_TRAVEL[tier-1];
    return forecast+saving>=.5?tier-1:tier;
  }
  function trialWReviewTravel(t,date){
    const life=clubLifeData(t),target=trialWTravelTarget(t,cpuReserve(t),cpuForecast(t),life);
    if(target>=life.travel)return false;
    const old=life.travel;life.travel=target;
    // Recalculate using the real cost model; do not bypass cash/forecast guards.
    if(cpuForecast(t)<.5||t.cash<cpuReserve(t)*.65){life.travel=old;return false;}
    life.trialWTravelYear=game.year;cpuLog(t,date,'travel-review','施設維持に向けた遠征待遇の再評価');return true;
  }
  function cpuEconomyReview(t,date){`);
 s=replaceExactly(s,'    const reserve=cpuReserve(t),forecast=cpuForecast(t),x=stadiumState(t),policy=rivalBudgetPolicy(t);','    trialWReviewTravel(t,date);\n    const reserve=cpuReserve(t),forecast=cpuForecast(t),x=stadiumState(t),policy=rivalBudgetPolicy(t);');
 return s;
}
module.exports={applyTrialW};
