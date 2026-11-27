const fs=require('node:fs'),a=require('node:assert/strict');
const r=JSON.parse(fs.readFileSync('test-results/year-cycle--1.json','utf8'));
let draws=0;
for(const row of r.rows){
 a.equal(row.ahParent.length,12);
 for(const c of row.ahParent){
  const principal=c.draws.reduce((n,x)=>n+x.principal,0);
  a.equal(principal,c.paid+c.remaining,'principal conservation '+row.year+' '+c.id);
  a.ok(c.remaining>=0&&c.interestPaid>=0&&c.cash>=0);
  a.equal(c.arrears,false,'unpaid debt at annual checkpoint '+row.year+' '+c.id);
  a.equal(new Set(c.draws.map(d=>d.title)).size,c.draws.length,'duplicate title window');
 }
}
draws=r.last.ahParent.reduce((n,c)=>n+c.draws.length,0);
console.log(JSON.stringify({draws,last:r.last.ahParent,topUps:r.reserveTopUps}));
a.equal(r.reserveTopUps,0);
