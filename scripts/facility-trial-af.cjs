// AF: AE baseline, medical final construction tier only.
const {applyTrialAE}=require('./facility-trial-ae.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAF(html){return replaceExactly(applyTrialAE(html),"return key==='park'&&lv>=17&&lv<20?r2(base*.95):base;","return key==='park'&&lv>=17&&lv<20?r2(base*.95):key==='medical'&&lv===19?r2(base*.95):base;");}
module.exports={applyTrialAF};
