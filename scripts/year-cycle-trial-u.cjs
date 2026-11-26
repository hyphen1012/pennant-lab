const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
let source=fs.readFileSync('scripts/year-cycle-trial-r.cjs','utf8');
source=replaceExactly(source,"require('./facility-trial-r.cjs').applyTrialR(","require('./facility-trial-u.cjs').applyTrialU(");
new Function('require','process','console',source)(require,process,console);
