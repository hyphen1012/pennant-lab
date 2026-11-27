// AC: AB revenue plus isolated mature capital allocation sensitivity, not adopted.
const {applyTrialAB}=require('./facility-trial-ab.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAC(html){
 return replaceExactly(applyTrialAB(html),'return target?r2(Math.min(target*.65,Math.max(0,t.cash-reserve)*.55)):0;',`const mature=stadiumState(t).park>=18&&stadiumState(t).park<20;
    return target?r2(Math.min(target*(mature?.80:.65),Math.max(0,t.cash-reserve)*(mature?.70:.55))):0;`);
}
module.exports={applyTrialAC};
