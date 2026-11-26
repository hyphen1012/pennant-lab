// U: test reassessment of elevated optional travel benefits; no change to shared costs.
const {applyTrialR}=require('./facility-trial-r.cjs'),{replaceExactly}=require('./facility-trial-k.cjs');
function applyTrialU(html){
 let s=applyTrialR(html);
 s=replaceExactly(s,'  const clubRecruitProcessBase=processCalendarDay;',`  function trialUTravelTarget(t,reserve,profit,life){
    const tier=clamp(Math.round(life.travel||0),0,3);
    // Only one voluntary downgrade per season and never below tier 1 by this rule.
    if(t.id===game.selectedId||tier<2||life.trialUTravelYear===game.year||profit<0||profit>=(tier===3?16:8)||!matureParkTarget(t))return tier;
    const project=parkExpansionPlan(t);
    return project?.viable&&t.cash<project.required&&t.cash<reserve*3?tier-1:tier;
  }
  const clubRecruitProcessBase=processCalendarDay;`);
 s=replaceExactly(s,'      else if(profit<0&&life.travel>0)life.travel--;','      else if(profit<0&&life.travel>0)life.travel--;\n      else {const target=trialUTravelTarget(t,reserve,profit,life);if(target<life.travel){life.travel=target;life.trialUTravelYear=game.year;cpuLog(t,e.date,\'travel-review\',\'球場投資と遠征待遇の再評価\');}}');
 return s;
}
module.exports={applyTrialU};
