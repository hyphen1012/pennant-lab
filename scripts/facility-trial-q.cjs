// Q: independent M-based mature stadium operating efficiency trial.
const {applyTrialM}=require('./facility-trial-m.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialQ(html){return replaceExactly(applyTrialM(html),'attendance*(875+18*Math.min(14,x.park-1)+12*Math.max(0,x.park-15))','attendance*(875+18*Math.min(14,x.park-1)+4*Math.max(0,x.park-15))');}
module.exports={applyTrialQ};
