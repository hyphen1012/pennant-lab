// Studio-only dry-run policy. No ad-platform credentials, API calls or spending.
// All monetary inputs use integer yen from reconciled settled accounting records.
function nonnegative(v,k){if(!Number.isSafeInteger(v)||v<0)throw Error('invalid '+k);return v;}
function planBudget(x){
  const keys=['settledRevenue','paidOperatingCosts','taxReserve','refundReserve','workingCapitalReserve','bankCash','monthlyLimit','monthSpent','pendingCommitments','reinvestBps'];
  for(const k of keys)nonnegative(x[k],k);
  if(x.reinvestBps>10000)throw Error('reinvestment cannot exceed 100%');
  if(typeof x.reconciled!=='boolean'||typeof x.killSwitch!=='boolean'||typeof x.anomaly!=='boolean')throw Error('missing control flags');
  const protectedCash=x.taxReserve+x.refundReserve+x.workingCapitalReserve;
  const surplus=Math.max(0,x.settledRevenue-x.paidOperatingCosts-protectedCash);
  const allocated=x.monthSpent+x.pendingCommitments;
  const fromProfit=Math.max(0,Number(BigInt(surplus)*BigInt(x.reinvestBps)/10000n)-allocated);
  const fromCash=Math.max(0,x.bankCash-protectedCash-x.pendingCommitments);
  const fromCap=Math.max(0,x.monthlyLimit-allocated);
  const reasons=[];
  if(!x.reconciled)reasons.push('unreconciled');
  if(x.killSwitch)reasons.push('manual-stop');
  if(x.anomaly)reasons.push('anomaly');
  const proposedYen=reasons.length?0:Math.min(fromProfit,fromCash,fromCap);
  return {proposedYen,fromProfit,fromCash,fromCap,reasons,dryRun:true};
}
module.exports={planBudget};
