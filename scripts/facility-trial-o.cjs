// O: independent M-based capital scheduling. No subsidy, price cut or reserve change.
const {applyTrialM}=require('./facility-trial-m.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialO(html){
 return replaceExactly(applyTrialM(html),'return target?r2(Math.min(target*.65,Math.max(0,t.cash-reserve)*.55)):0;','const late=stadiumState(t).park>=17;return target?r2(Math.min(target*(late?.75:.65),Math.max(0,t.cash-reserve)*(late?.65:.55))):0;');
}
module.exports={applyTrialO};
