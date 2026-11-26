const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
let s=fs.readFileSync('scripts/facility-trial-u-check.cjs','utf8');
s=replaceExactly(s,"const {applyTrialU}=require('./facility-trial-u.cjs');","const {applyTrialV:applyTrialU}=require('./facility-trial-v.cjs');");
s=replaceExactly(s,'trialUTravelTarget(t,50,16,life)','trialUTravelTarget(t,50,18,life)');
s=replaceExactly(s,'trialUTravelTarget(t,50,8,life)','trialUTravelTarget(t,50,9,life)');
s=replaceExactly(s,'parkExpansionPlan=originalPlan;return rows;','x.park=19;life.travel=3;rows.push(trialUTravelTarget(t,50,17,life));life.travel=2;rows.push(trialUTravelTarget(t,50,8,life));parkExpansionPlan=originalPlan;return rows;');
s=replaceExactly(s,'[2,3,3,3,1,2,1,3,3,3]','[2,3,3,3,1,2,1,3,3,3,2,1]');
new Function('require','console',s)(require,console);
