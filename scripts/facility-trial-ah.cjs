// AH: independent AF baseline, actual engine parent-financed mature park investment.
const {applyTrialAF}=require('./facility-trial-af.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialAH(html){
 const hook=`
  // Trial AH, injected only into headless test source. Amount units are .01 oku.
  const ahMoney=v=>Math.round(v*100);
  const ahMonth=date=>Number(date.slice(0,4))*12+Number(date.slice(5,7))-1;
  function ahDebt(t){return t.ahParentDebt||null;}
  function ahTitle(t){
    const a=game.seasonArchive?.find(r=>r.year===game.year-1);
    return a&&(['E','W'].some(k=>a.standings?.[k]?.[0]?.id===t.id)||a.postseason?.championId===t.id)?a.year:null;
  }
  function ahSchedule(principal){
    let remaining=principal;const rows=[];
    for(let i=0;i<24&&remaining>0;i++){
      const interest=Math.floor((remaining+600)/1200),paid=Math.min(remaining,Math.floor(principal/24)+(i<principal%24?1:0));
      remaining-=paid;rows.push({principal:paid,interest,payment:paid+interest});
    }
    return rows;
  }
  function ahPay(t,date){
    const d=ahDebt(t);if(!d)return;
    const now=ahMonth(date);
    while(d.paid<d.rows.length&&d.opened+d.paid+1<=now){
      const r=d.rows[d.paid];
      if(ahMoney(t.cash)<r.payment){d.arrears=true;return;}
      t.cash=r2(t.cash-r.payment/100);d.paid++;d.principalPaid+=r.principal;d.interestPaid+=r.interest;t.ahParentPaid=(t.ahParentPaid||0)+r.principal;t.ahParentInterest=(t.ahParentInterest||0)+r.interest;d.arrears=false;
    }
  }
  function ahAnnualDue(t){
    const d=ahDebt(t);return d?d.rows.slice(d.paid,d.paid+12).reduce((n,r)=>n+r.payment,0)/100:0;
  }
  const ahForecastBase=cpuForecast;
  cpuForecast=function(t){return r2(ahForecastBase(t)-ahAnnualDue(t));};
  function ahTry(t,date,park,forecast){
    if(t.id===game.selectedId||!park?.viable||park.level<15||park.level>=20||t.cash>=park.required)return false;
    const title=ahTitle(t),prior=ahDebt(t);
    if(title===null||t.ahParentUsedYear===title||prior&&prior.paid<prior.rows.length)return false;
    const reserve=ahMoney(park.required-park.cost),cash=ahMoney(t.cash),cost=ahMoney(park.cost),principal=cost+reserve-cash;
    if(cash<reserve||principal<=0||principal>cost)return false;
    const rows=ahSchedule(principal),peak=Math.max(...rows.map(r=>r.payment));
    if(ahMoney(Math.min(forecast,park.projected))*2<peak*36)return false;
    const before=t.cash;t.cash=r2(t.cash+principal/100);
    if(!stadiumResize(t,'park',1)){t.cash=before;return false;}
    t.ahParentUsedYear=title;t.ahParentDebt={title,opened:ahMonth(date),principal,rows,paid:0,principalPaid:0,interestPaid:0,arrears:false};
    t.ahParentHistory??=[];t.ahParentHistory.push({title,date,principal,cost,level:park.level+1,interest:rows.reduce((n,r)=>n+r.interest,0)});
    return true;
  }
  const ahReviewBase=cpuEconomyReview;
  cpuEconomyReview=function(t,date){
    if(t.id===game.selectedId)return ahReviewBase(t,date);
    const a=cpuEconomy(t),already=a.lastReview===date;
    const changed=ahReviewBase(t,date);if(changed||already)return changed;
    const reserve=cpuReserve(t),forecast=cpuForecast(t),policy=rivalBudgetPolicy(t);
    const annualLimit=clamp(1+Math.floor(Math.max(0,forecast)/15)+(a.style===0?0:1)+policy.limit,1,a.style===0?5:6);
    if(a.investments>=annualLimit||forecast<.8||t.cash<reserve)return false;
    const park=parkExpansionPlan(t,forecast);
    if(!ahTry(t,date,park,forecast))return false;
    a.spent=r2(a.spent+park.cost);a.investments++;cpuLog(t,date,'invest','親会社融資による球場強化 Lv.'+(park.level+1),park.cost);return true;
  };
  const ahDayBase=processCalendarDay;
  processCalendarDay=function(){const e=ahDayBase();if(e?.date)for(const t of game.teams)ahPay(t,e.date);return e;};
  const ahCommerceBase=cpuCommercialCalendar;
  cpuCommercialCalendar=function(f){const r=ahCommerceBase(f);if(f?.date)for(const t of game.teams)ahPay(t,f.date);return r;};
  function ahReport(t){const d=ahDebt(t);return {id:t.id,draws:t.ahParentHistory||[],remaining:d?d.principal-d.principalPaid:0,paid:t.ahParentPaid||0,interestPaid:t.ahParentInterest||0,arrears:d?.arrears||false,cash:t.cash};}
  const ahArchiveBase=archiveSeason;
  archiveSeason=function(){ahArchiveBase();const a=game.seasonArchive?.find(r=>r.year===game.year);if(a)a.ahParent=game.teams.map(ahReport);};
`;
 return replaceExactly(applyTrialAF(html),"  const appRoot=document.querySelector('#app');",hook+"  const appRoot=document.querySelector('#app');");
}
module.exports={applyTrialAH};
