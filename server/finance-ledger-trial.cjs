'use strict';
// Isolated candidate ledger. All calls are trusted server-side trial inputs.
// No HTTP route, game mutation, provider integration or real money.
// Period/reset, first due month and full-payment policy remain trial assumptions.
const {repaymentTrial}=require('./finance-repayment-trial.cjs');
const a=(v,m)=>{if(!v)throw Error(m);};
const int=v=>Number.isSafeInteger(v),amount=v=>int(v)&&v>=0&&v<=1e12;
const key=v=>typeof v==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(v);
const sum=(...xs)=>{const x=xs.reduce((n,v)=>n+v,0);a(int(x),'trial balance overflow');return x;};
const clone=s=>structuredClone(s);
function createFinanceLedgerTrial({verifyBankProof=()=>false,clubRole='player'}={}){
 a(['player','cpu'].includes(clubRole),'trusted club role required');
 a(typeof verifyBankProof==='function','trusted proof verifier required');
 function create({world,cash,year,closedMonth}){
  a(key(world)&&amount(cash)&&int(year)&&year>=2027&&int(closedMonth)&&closedMonth>=0,'invalid trial opening');
  return {world,clubRole,cash,year,phase:'season',closedMonth,bankUses:0,titleYear:null,parentUsedYear:null,loans:[],receipts:{},pending:null};
 }
 function assertRole(s){a(s?.clubRole===clubRole,'club role mismatch');}
 function period(s,{year,phase,titles=[]}){
  assertRole(s);
  a(!s.pending,'unsettled month');a(Array.isArray(titles)&&titles.every(t=>['league','japan','world'].includes(t)),'invalid title');
  const next=clone(s);
  if(s.phase==='season'&&phase==='off'&&year===s.year){next.phase='off';if(titles.length){next.titleYear=year;next.parentUsedYear=null;}}
  else if(s.phase==='off'&&phase==='season'&&year===s.year+1&&titles.length===0){next.year=year;next.phase='season';next.bankUses=0;if(next.titleYear!==year-1){next.titleYear=null;next.parentUsedYear=null;}}
  else throw Error('invalid season transition');
  return next;
 }
 function titleWindow(s){return s.titleYear!==null&&(s.phase==='off'&&s.year===s.titleYear||s.phase==='season'&&s.year===s.titleYear+1);}
 function due(s,month){
  return s.loans.flatMap(l=>{const row=l.rows[l.paid];if(!row)return [];const m=l.openedMonth+row.month;a(m>=month,'overdue trial installment');return m===month?[{id:l.id,...row}]:[];});
 }
 function shortfall(s){return s.pending?Math.max(0,-sum(s.cash,s.pending.operatingNet,-s.pending.total)):0;}
 function eligibility(s){
  assertRole(s);const deficit=shortfall(s),window=titleWindow(s),parent=window&&s.parentUsedYear!==s.titleYear,bank=clubRole==='player'&&s.bankUses<2;
  return {shortfall:deficit,bankRemaining:clubRole==='player'?2-s.bankUses:0,bankRescue:deficit>0&&bank,parentRescue:deficit>0&&parent,preemptiveWindow:clubRole==='player'?window&&bank:parent,terminal:deficit>0&&!bank&&!parent};
 }
 function beginMonth(s,{month,operatingNet}){
  assertRole(s);
  a(int(month)&&month===s.closedMonth+1&&int(operatingNet)&&Math.abs(operatingNet)<=1e12,'invalid month');
  if(s.pending){a(s.pending.month===month&&s.pending.operatingNet===operatingNet,'month already prepared');return clone(s);}
  const next=clone(s),rows=due(next,month);next.pending={month,operatingNet,rows,total:sum(...rows.map(r=>r.payment))};return next;
 }
 function borrow(s,{id,kind,principal,months,attempt}){
  assertRole(s);
  a(key(id)&&!['__proto__','constructor','prototype'].includes(id)&&amount(principal)&&principal>0&&[12,24].includes(months)&&int(attempt)&&attempt>0&&(clubRole==='cpu'?['cpuParentAnnual']:['bank','parentMonthly','parentAnnual']).includes(kind),'invalid trial loan');
  const request={id,kind,principal,months,attempt};
  if(Object.hasOwn(s.receipts,id)){a(JSON.stringify(s.receipts[id])===JSON.stringify(request),'loan operation conflict');return {state:clone(s),replay:true};}
  const e=eligibility(s);a(s.pending&&e.shortfall>0&&principal===e.shortfall,'exact rescue shortfall required');
  if(kind==='bank'){a(e.bankRescue,'bank limit reached');a(verifyBankProof({world:s.world,year:s.year,month:s.pending.month,...request})===true,'verified bank proof required');}
  else a(e.parentRescue,'parent support unavailable');
  const next=clone(s),plan=repaymentTrial({principal,months,kind});
  next.cash=sum(next.cash,principal);a(amount(next.cash),'trial cash bound');
  next.loans.push({id,kind,openedMonth:s.pending.month,principal,paid:0,rows:plan.rows});
  next.receipts[id]=request;
  if(kind==='bank')next.bankUses++;else next.parentUsedYear=next.titleYear;
  return {state:next,replay:false};
 }
 // CPU strategic parent financing: commit a verified project and debt together.
 // All quote inputs are trusted trial inputs, not client commands or game data.
 // Positive cash is normal. No bonus, penalty or reputation effect for borrowing.
 function investWithParent(s,{id,projectId,cost,reserve,monthlyNet,months,attempt}){
  assertRole(s);a(clubRole==='cpu','CPU-only strategic parent financing');
  a(key(id)&&!['__proto__','constructor','prototype'].includes(id)&&key(projectId)&&amount(cost)&&cost>0&&amount(reserve)&&amount(monthlyNet)&&[12,24].includes(months)&&int(attempt)&&attempt>0,'invalid strategic project');
  const request={id,projectId,cost,reserve,monthlyNet,months,attempt,kind:'cpuParentAnnual',purpose:'investment'};
  if(Object.hasOwn(s.receipts,id)){a(JSON.stringify(s.receipts[id])===JSON.stringify(request),'loan operation conflict');return {state:clone(s),replay:true};}
  a(!s.pending,'unsettled month');
  a(titleWindow(s)&&s.parentUsedYear!==s.titleYear,'parent support unavailable');
  a(s.cash>=reserve,'operating reserve required');
  a(!s.loans.some(l=>l.paid<l.rows.length),'existing debt must be settled in this trial');
  const principal=sum(cost,reserve,-s.cash);
  a(amount(principal)&&principal>0&&principal<=cost,'exact project funding gap required');
  const plan=repaymentTrial({principal,months,kind:'cpuParentAnnual'});
  const peak=Math.max(...plan.rows.map(r=>r.payment));
  // Require 1.5x monthly debt service coverage; not a permanent rule.
  a(monthlyNet*2>=peak*3,'insufficient repayment coverage');
  const next=clone(s);next.cash=sum(s.cash,principal,-cost);
  a(next.cash===reserve&&amount(next.cash),'project conservation');
  next.loans.push({id,kind:'cpuParentAnnual',openedMonth:s.closedMonth,principal,paid:0,rows:plan.rows,projectId,purpose:'investment'});
  next.receipts[id]=request;next.parentUsedYear=s.titleYear;
  return {state:next,replay:false};
 }
 function settleMonth(s,month){
  assertRole(s);
  a(int(month),'invalid month');
  if(month===s.closedMonth&&!s.pending)return {state:clone(s),status:'replay'};
  a(s.pending&&s.pending.month===month,'month not prepared');
  if(shortfall(s)>0)return {state:clone(s),status:'shortfall',eligibility:eligibility(s)};
  const next=clone(s);next.cash=sum(next.cash,next.pending.operatingNet,-next.pending.total);
  a(amount(next.cash),'trial cash bound');
  for(const row of next.pending.rows){const l=next.loans.find(l=>l.id===row.id);a(l&&l.rows[l.paid]?.month===row.month,'installment mismatch');l.paid++;}
  next.closedMonth=month;next.pending=null;return {state:next,status:'paid'};
 }
 function statement(s){return {cash:s.cash,...eligibility(s),pending:s.pending?clone(s.pending):null,loans:s.loans.map(l=>({id:l.id,kind:l.kind,principal:l.principal,remaining:l.paid?l.rows[l.paid-1].remaining:l.principal,paid:l.paid,next:l.rows[l.paid]?{...l.rows[l.paid],dueMonth:l.openedMonth+l.rows[l.paid].month}:null}))};}
 return {create,period,beginMonth,borrow,investWithParent,settleMonth,statement,eligibility};
}
module.exports={createFinanceLedgerTrial};
