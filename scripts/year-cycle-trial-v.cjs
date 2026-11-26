const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
let source=fs.readFileSync('scripts/year-cycle-trial-u.cjs','utf8');
source=replaceExactly(source,"require('./facility-trial-u.cjs').applyTrialU(","require('./facility-trial-v.cjs').applyTrialV(");
new Function('require','process','console',source)(require,process,console);
