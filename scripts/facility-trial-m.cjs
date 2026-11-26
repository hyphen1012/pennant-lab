// M: independent K-based sensitivity, not cumulative with unsuccessful L.
const {applyTrialK,replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialM(html){
 return replaceExactly(applyTrialK(html),'attendance*(900+18*Math.min(14,x.park-1)','attendance*(875+18*Math.min(14,x.park-1)');
}
module.exports={applyTrialM};
