// S: experiment-only capital allocation. No cash injection, rate or reserve change.
const {applyTrialR}=require('./facility-trial-r.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialS(html){
 return replaceExactly(applyTrialR(html),'function parkCapitalHold(',`function parkCapitalHold(t,reserve=cpuReserve(t)){
  const original=trialSOriginalParkCapitalHold(t,reserve);
  if(!(original>0))return original;
  const target=matureParkTarget(t),surplus=Math.max(0,t.cash-reserve);
  if(!Number.isFinite(target)||target<=0||!Number.isFinite(surplus))return original;
  return Math.max(original,Math.min(surplus,r2(Math.min(surplus*.75,target*.85))));
 }
 function trialSOriginalParkCapitalHold(`);
}
module.exports={applyTrialS};
