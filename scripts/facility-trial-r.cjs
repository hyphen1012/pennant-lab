// R: combine independently tested P and Q deltas, not additional reductions.
const {applyTrialQ}=require('./facility-trial-q.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialR(html){
 return replaceExactly(applyTrialQ(html),"function facilityCost(key,lv){return r2(draftScoutCost(lv)*(FACILITY_COST_FACTOR[key]??1));}","function facilityCost(key,lv){const base=r2(draftScoutCost(lv)*(FACILITY_COST_FACTOR[key]??1));return key==='park'&&lv>=17&&lv<20?r2(base*.95):base;}");
}
module.exports={applyTrialR};
