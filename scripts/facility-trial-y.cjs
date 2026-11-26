// Y: isolated transition return sensitivity on X; no changes to Lv20 or prices/costs/reserve.
const {applyTrialX}=require('./facility-trial-x.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialY(html){
 return replaceExactly(applyTrialX(html),'[0,40,85,140,220,560]','[0,40,85,180,320,560]');
}
module.exports={applyTrialY};
