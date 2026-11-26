// Z: protect accumulated capital at mature Lv18-19 parks. No common economy changes.
const {applyTrialY}=require('./facility-trial-y.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialZ(html){
 return replaceExactly(applyTrialY(html),'return target?r2(Math.min(target*.65,Math.max(0,t.cash-reserve)*.55)):0;',`const mature=stadiumState(t).park>=18&&stadiumState(t).park<20;
    return target?r2(Math.min(target*(mature?.80:.65),Math.max(0,t.cash-reserve)*(mature?.70:.55))):0;`);
}
module.exports={applyTrialZ};
