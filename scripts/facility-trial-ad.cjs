// AD: AB baseline; isolated small capex sensitivity, not adopted.
const {applyTrialAB}=require('./facility-trial-ab.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAD(html){
 return replaceExactly(applyTrialAB(html),"return key==='park'&&lv>=17&&lv<20?r2(base*.95):base;","return key==='park'&&lv>=17&&lv<20?r2(base*.90):base;");
}
module.exports={applyTrialAD};
