// AB: Y-based transition value sensitivity, not AA/Z. Lv15 and Lv20 unchanged.
const {applyTrialY}=require('./facility-trial-y.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAB(html){return replaceExactly(applyTrialY(html),'[0,40,85,180,320,560]','[0,65,125,225,380,560]');}
module.exports={applyTrialAB};
