'use strict';
const a=require('node:assert/strict'),{createFinanceLedgerTrial}=require('../server/finance-ledger-trial.cjs');
const verified=new Set(),proofKey=r=>[r.world,r.year,r.month,r.id,r.kind,r.principal,r.months,r.attempt].join('|');
let proofCalls=0;
const f=createFinanceLedgerTrial({verifyBankProof:r=>{proofCalls++;return verified.has(proofKey(r));}});
const open=(world='w')=>f.create({world,cash:100,year:2027,closedMonth:0});
const begin=(s,net)=>f.beginMonth(s,{month:s.closedMonth+1,operatingNet:net});
const request=(id,kind,principal,months=12)=>({id,kind,principal,months,attempt:1});
function grant(s,r){verified.add(proofKey({world:s.world,year:s.year,month:s.pending.month,...r}));}
function bank(s,id){const r=request(id,'bank',f.eligibility(s).shortfall);grant(s,r);return f.borrow(s,r).state;}
function pay(s){const r=f.settleMonth(s,s.pending.month);a.equal(r.status,'paid');return r.state;}
let s=open();s=pay(begin(s,-80));a.equal(s.cash,20);a.equal(s.bankUses,0);
s=begin(s,-120);a.equal(f.eligibility(s).shortfall,100);const before=structuredClone(s),r=request('bank1','bank',100);
a.equal(f.settleMonth(s,2).status,'shortfall');a.deepEqual(s,before);
a.throws(()=>f.borrow(s,r),/verified bank proof/);a.deepEqual(s,before);
grant(s,r);a.throws(()=>f.borrow({...s,world:'other'},r),/verified bank proof/);
a.throws(()=>f.borrow(s,{...r,principal:101}),/exact rescue/);
s=f.borrow(s,r).state;a.equal(s.cash,120);a.equal(s.bankUses,1);a.equal(s.loans.length,1);a.deepEqual(before.pending,s.pending);
const calls=proofCalls;const replay=f.borrow(s,r);a.equal(replay.replay,true);a.deepEqual(replay.state,s);a.equal(proofCalls,calls);
a.throws(()=>f.borrow(s,{...r,attempt:2}),/operation conflict/);s=pay(s);a.equal(s.cash,0);
a.equal(f.settleMonth(s,2).status,'replay');a.equal(f.statement(s).loans[0].next.dueMonth,3);
s=begin(s,0);a.equal(s.pending.total,19);a.equal(f.eligibility(s).shortfall,19);s=bank(s,'bank2');s=pay(s);a.equal(s.bankUses,2);a.equal(s.loans[0].paid,1);
s=begin(s,0);a.ok(f.eligibility(s).terminal);a.equal(f.eligibility(s).bankRemaining,0);a.throws(()=>f.borrow(s,request('bank3','bank',f.eligibility(s).shortfall)),/bank limit/);
a.throws(()=>f.period(s,{year:2027,phase:'off',titles:['league']}),/unsettled month/);
let t=open();t=f.period(t,{year:2027,phase:'off',titles:['league','japan','world']});a.equal(f.eligibility(t).preemptiveWindow,true);
t=begin(t,-200);t=f.borrow(t,request('parent1','parentAnnual',100)).state;t=pay(t);a.equal(t.parentUsedYear,2027);
t=f.period(t,{year:2028,phase:'season'});t=begin(t,-1);a.equal(f.eligibility(t).parentRescue,false);a.throws(()=>f.borrow(t,request('parent2','parentMonthly',f.eligibility(t).shortfall)),/parent support unavailable/);
t=bank(t,'b2028');t=pay(t);a.equal(t.bankUses,1);a.equal(t.loans.length,2);a.equal(t.loans[0].paid,1);
t=f.period(t,{year:2028,phase:'off',titles:['japan']});t=begin(t,-1);a.equal(f.eligibility(t).parentRescue,true);t=f.borrow(t,request('parent2','parentMonthly',f.eligibility(t).shortfall)).state;t=pay(t);a.equal(t.parentUsedYear,2028);a.equal(t.bankUses,1);
t=f.period(t,{year:2029,phase:'season'});a.equal(t.bankUses,0);a.equal(t.loans.length,3);a.equal(t.parentUsedYear,2028);
let u=f.period(open(),{year:2027,phase:'off',titles:['world']});u=f.period(u,{year:2028,phase:'season'});u=f.period(u,{year:2028,phase:'off'});a.equal(f.eligibility(u).preemptiveWindow,false);u=f.period(u,{year:2029,phase:'season'});a.equal(u.titleYear,null);
u=begin(u,-200);a.equal(f.eligibility(u).parentRescue,false);a.throws(()=>f.beginMonth(u,{month:1,operatingNet:-201}),/month already prepared/);a.deepEqual(f.beginMonth(u,{month:1,operatingNet:-200}),u);
let v=open();v=begin(v,-200);v=bank(v,'full');v=pay(v);let paid=0;for(let i=0;i<12;i++){v=begin(v,100);paid+=v.pending.total;v=pay(v);}a.equal(f.statement(v).loans[0].remaining,0);a.equal(f.statement(v).loans[0].next,null);a.equal(v.cash,1200-paid);a.equal(paid,163);a.equal(v.loans[0].paid,12);
a.throws(()=>f.beginMonth(v,{month:v.closedMonth+2,operatingNet:0}),/invalid month/);
console.log('PASS immutable finance trial: proof binding, lost response replay, exact rescue, bank cap, annual renewal, parent window, atomic repayment and principal conservation');
