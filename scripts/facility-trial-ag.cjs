// AG: bounded late-stage ballpark construction sensitivity on AF, not a product rule.
const {applyTrialAF}=require('./facility-trial-af.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAG(html){return replaceExactly(applyTrialAF(html),"return key==='park'&&lv>=17&&lv<20?r2(base*.95):key==='medical'&&lv===19?r2(base*.95):base;","return key==='park'&&lv>=17&&lv<20?r2(base*.90):key==='medical'&&lv===19?r2(base*.95):base;");}
module.exports={applyTrialAG};
