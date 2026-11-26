// L: keep the modest K costs, add mature stadium fixed-cost efficiency only.
const {applyTrialK,replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialL(html){
 return replaceExactly(applyTrialK(html),'Math.round(14000000+attendance*','Math.round(14000000-300000*Math.max(0,x.park-15)+attendance*');
}
module.exports={applyTrialL};
