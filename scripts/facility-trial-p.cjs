// P: independent M-based late stadium construction efficiency trial.
const {applyTrialM}=require('./facility-trial-m.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialP(html){
 return replaceExactly(applyTrialM(html),"function facilityCost(key,lv){return r2(draftScoutCost(lv)*(FACILITY_COST_FACTOR[key]??1));}","function facilityCost(key,lv){const base=r2(draftScoutCost(lv)*(FACILITY_COST_FACTOR[key]??1));return key==='park'&&lv>=17&&lv<20?r2(base*.95):base;}");
}
module.exports={applyTrialP};
