// L-only entry point. K remains the control, and its workflow is unchanged.
const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
process.env.FACILITY_TRIAL_J='1';
let source=fs.readFileSync('scripts/year-cycle-check.cjs','utf8');
source=replaceExactly(source,"require('./facility-trial-j.cjs').applyTrialJ(fs.readFileSync('index.html','utf8'))","require('./facility-trial-l.cjs').applyTrialL(require('./facility-trial-j.cjs').applyTrialJ(fs.readFileSync('index.html','utf8')))");
source=replaceExactly(source,'optional:clubLifeSpend(t,year)','optional:clubLifeSpend(t,year),overheadDetails:Object.fromEntries([\'staff\',\'travel\',\'camp\',\'venue\',\'admin\',\'renewal\'].map(k=>[k,r2((game.financeLedger?.periods||[]).reduce((n,p)=>n+(p.clubs[t.id]?.overhead?.[k]||0),0))])),stadiumDetails:(()=>{const q=stadiumTotals(stadiumMatches(t));return {games:q.games,attendance:q.attendance,capacity:q.capacity,ticket:r2(q.ticket/1e8),food:r2(q.food/1e8),goods:r2(q.goods/1e8),foodCost:r2(q.food*.58/1e8),goodsCost:r2(q.goods*.62/1e8),otherOperating:r2((q.operating-q.food*.58-q.goods*.62)/1e8)};})(),transfer:clubTransferYear(t,year)');
new Function('require','process','console',source)(require,process,console);
