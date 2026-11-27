// AE: independent AB baseline, mature actual visitor spend sensitivity.
const {applyTrialAB}=require('./facility-trial-ab.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAE(html){return replaceExactly(applyTrialAB(html),'[0,65,125,225,380,560]','[0,65,125,255,435,640]');}
module.exports={applyTrialAE};
