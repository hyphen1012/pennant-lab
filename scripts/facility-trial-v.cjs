const {applyTrialU}=require('./facility-trial-u.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
// V: isolated threshold sensitivity on U, no change to shared economics.
const applyTrialV=html=>replaceExactly(applyTrialU(html),'profit>=(tier===3?16:8)','profit>=(tier===3?18:9)');
module.exports={applyTrialV};
