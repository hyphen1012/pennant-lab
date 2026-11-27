'use strict';
// Isolated candidate model only. No game state, provider, reward or cash mutation.
// Integer trial units; no adoption of rounding, term or parent rate cycle.
function repaymentTrial({principal,months,kind,earlyMonth=null}) {
  if(!Number.isSafeInteger(principal)||principal<=0||principal>1e12)throw new RangeError('principal must be positive integer <= 1e12 trial units');
  if(![12,24].includes(months))throw new RangeError('trial term must be 12 or 24');
  const rates={bank:[1n,10n],parentMonthly:[1n,20n],parentAnnual:[1n,240n],cpuParentAnnual:[1n,1200n]};
  if(!Object.hasOwn(rates,kind))throw new RangeError('unknown trial rate');
  if(earlyMonth!==null&&(!Number.isSafeInteger(earlyMonth)||earlyMonth<1||earlyMonth>months))throw new RangeError('invalid early settlement month');
  const [num,den]=rates[kind], base=Math.floor(principal/months),rows=[];
  let remaining=principal,totalInterest=0,totalPaid=0;
  for(let month=1;month<=months&&remaining;month++){
    const opening=remaining;
    const interest=Number((BigInt(opening)*num*2n+den)/(2n*den));
    const principalPaid=(month===months||month===earlyMonth)?opening:Math.min(opening,base+(month<=principal%months?1:0));
    remaining-=principalPaid;
    const payment=principalPaid+interest;
    totalInterest+=interest;totalPaid+=payment;
    rows.push({month,opening,interest,principalPaid,payment,remaining});
  }
  return {kind,principal,months,earlyMonth,totalInterest,totalPaid,rows};
}
function compareCashflow(schedule,monthlyCash){
  if(!schedule||!Array.isArray(schedule.rows)||!Array.isArray(monthlyCash)||monthlyCash.length!==schedule.rows.length||!monthlyCash.every(Number.isSafeInteger))throw new TypeError('exact monthly cash inputs required');
  let cash=0,firstShortfall=null;
  const rows=schedule.rows.map((row,i)=>{
    cash+=monthlyCash[i]-row.payment;
    if(!Number.isSafeInteger(cash))throw new RangeError('cash overflow');
    if(cash<0&&firstShortfall===null)firstShortfall=row.month;
    return {month:row.month,cash,shortfall:Math.max(0,-cash)};
  });
  return {firstShortfall,rows};
}
module.exports={repaymentTrial,compareCashflow};
