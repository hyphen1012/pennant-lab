const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
let source=fs.readFileSync('scripts/year-cycle-trial-af.cjs','utf8');
source=replaceExactly(source,"require('./facility-trial-af.cjs').applyTrialAF(","require('./facility-trial-ah.cjs').applyTrialAH(");
new Function('require','process','console',source)(require,process,console);
