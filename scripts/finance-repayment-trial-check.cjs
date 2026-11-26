'use strict';
const a=require('node:assert/strict');
const {repaymentTrial:quote,compareCashflow}=require('../server/finance-repayment-trial.cjs');
let checks=0;
for(const kind of ['bank','parentMonthly','parentAnnual'])for(const months of [12,24])for(const principal of [1,23,10000,1e12]){
  const s=quote({principal,months,kind});
  a.equal(s.rows.reduce((n,r)=>n+r.principalPaid,0),principal);
  a.equal(s.rows.at(-1).remaining,0);a.equal(s.totalPaid,principal+s.totalInterest);
  for(const [i,r] of s.rows.entries()){
    a.equal(r.opening-r.principalPaid,r.remaining);a.equal(r.payment,r.interest+r.principalPaid);
    a.equal(r.opening,i?s.rows[i-1].remaining:principal);
  }
  a.deepEqual(quote({principal,months,kind}),s);
  checks++;
}
const results=[];
for(const kind of ['bank','parentMonthly','parentAnnual'])for(const months of [12,24]){
  const s=quote({principal:10000,months,kind});
  const early=quote({principal:10000,months,kind,earlyMonth:6});
  a.ok(early.totalInterest<s.totalInterest);
  a.equal(compareCashflow(s,s.rows.map(r=>r.payment)).firstShortfall,null);
  a.equal(compareCashflow(s,s.rows.map((r,i)=>r.payment-(i===0?1:0))).firstShortfall,1);
  a.equal(compareCashflow(s,s.rows.map((r,i)=>r.payment-(i===s.rows.length-1?1:0))).firstShortfall,s.rows.length);
  results.push({kind,months,first:s.rows[0].payment,interest:s.totalInterest,total:s.totalPaid,earlyInterest:early.totalInterest});checks++;
}
a.equal(quote({principal:10000,months:12,kind:'bank'}).rows[0].interest,1000);
a.equal(quote({principal:10000,months:12,kind:'parentMonthly'}).rows[0].interest,500);
a.equal(quote({principal:10000,months:12,kind:'parentAnnual'}).rows[0].interest,42);
for(const principal of [0,-1,NaN,Infinity,1.5,1e12+1])a.throws(()=>quote({principal,months:12,kind:'bank'}));
for(const months of [0,13,Infinity])a.throws(()=>quote({principal:10000,months,kind:'bank'}));
for(const earlyMonth of [0,13,1.5])a.throws(()=>quote({principal:10000,months:12,kind:'bank',earlyMonth}));
a.throws(()=>quote({principal:10000,months:12,kind:'__proto__'}));
a.throws(()=>compareCashflow(quote({principal:10000,months:12,kind:'bank'}),[0]));
console.log(JSON.stringify({checks,results},null,2));
