const fs=require('node:fs'),a=require('node:assert/strict'),{applyTrialAH}=require('./facility-trial-ah.cjs');
const html=applyTrialAH(fs.readFileSync('index.html','utf8'));
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1],end=inline.indexOf("  const appRoot=document.querySelector('#app');");
a.ok(end>0);
const tail=`save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
 const a=(v,m)=>{if(!v)throw Error(m);};
 const t=game.teams.find(t=>t.id!==game.selectedId),p=myTeam();
 game.year=2028;const x=stadiumState(t);x.park=19;
 const cost=facilityCost('park',19),reserve=40,principal=Math.min(10,cost/2);t.cash=r2(cost+reserve-principal);
 const q={viable:true,level:19,cost,required:r2(cost+reserve),projected:100};
 a(!ahTry(t,'2028-04-01',q,100),'no title must reject');
 game.seasonArchive=[{year:2027,standings:{E:[{id:t.id}],W:[{id:p.id}]},postseason:{championId:t.id}}];
 a(!ahTry(p,'2028-04-01',q,100),'selected team must reject');
 a(!ahTry(t,'2028-04-01',q,0),'coverage must reject');
 const initial=t.cash;
 a(ahTry(t,'2028-04-01',q,100),'actual park financed');
 a(x.park===20&&t.cash===reserve,'actual expense and reserve');
 const d=ahDebt(t);a(d.principal===ahMoney(cost+reserve-initial),'exact gap');
 a(!ahTry(t,'2028-04-01',q,100),'repeat reject');
 ahPay(t,'2028-04-30');a(d.paid===0,'no immediate installment');
 for(let i=1;i<=24;i++){const date=new Date(Date.UTC(2028,3+i,1)).toISOString().slice(0,10);ahPay(t,date);const count=d.paid;ahPay(t,date);a(d.paid===count,'duplicate payment');}
 a(d.principalPaid===d.principal&&d.paid===d.rows.length&&!d.arrears,'full repayment');
 a(ahMoney(t.cash)===ahMoney(reserve)-d.principalPaid-d.interestPaid,'cash conservation');
 const report=ahReport(t);a(report.remaining===0&&report.paid===d.principal,'report conservation');
 // Later legitimate borrowing must not rewrite an earlier annual snapshot.
 const historic=ahReport(t),frozen=JSON.stringify(historic);
 game.year=2030;game.seasonArchive.push({year:2029,standings:{E:[{id:t.id}],W:[{id:p.id}]}});
 x.park=19;t.cash=r2(cost+reserve-principal);
 a(ahTry(t,'2030-04-01',q,100),'new title after completion permits another loan');
 a(t.ahParentHistory.length===2&&historic.draws.length===1,'historic draw snapshot');
 a(JSON.stringify(historic)===frozen,'no historical mutation after future loan');
 a(ahReport(t).draws.reduce((n,r)=>n+r.principal,0)===ahReport(t).paid+ahReport(t).remaining,'cumulative debt conservation');
 // Restore snapshot of the current loan, not the obsolete completed loan.
 const saved=JSON.parse(JSON.stringify(game));a(saved.teams.find(r=>r.id===t.id).ahParentDebt.principalPaid===d.principal,'JSON roundtrip');
 return {principal:d.principal,interest:d.interestPaid,remaining:report.remaining};`;
const code=inline.slice(0,end).replace('((Date.now()^0x53e719f1)>>>0)||1937','1937').replace('(() => {','return (() => {')+tail+'})();';
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
const result=new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{});
console.log('PASS AH actual game park investment, title/role/coverage, debt repayment and JSON roundtrip',result);
