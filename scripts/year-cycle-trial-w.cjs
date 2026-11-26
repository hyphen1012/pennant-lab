const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
let source=fs.readFileSync('scripts/year-cycle-trial-v.cjs','utf8');
source=replaceExactly(source,"require('./facility-trial-v.cjs').applyTrialV(","require('./facility-trial-w.cjs').applyTrialW(");
new Function('require','process','console',source)(require,process,console);
