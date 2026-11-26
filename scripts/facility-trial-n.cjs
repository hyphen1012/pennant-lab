// N: isolated sensitivity from M; only another 25 yen per visitor.
const {applyTrialM}=require('./facility-trial-m.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialN(html){return replaceExactly(applyTrialM(html),'attendance*(875+18*Math.min(14,x.park-1)','attendance*(850+18*Math.min(14,x.park-1)');}
module.exports={applyTrialN};
