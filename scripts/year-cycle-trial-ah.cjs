// AH uses the same annual harness and AF policy, adds debt checkpoints.
const fs=require('node:fs'),{replaceExactly}=require('./facility-trial-k.cjs');
const read=fs.readFileSync;
fs.readFileSync=function(p,...args){
 const v=read.call(this,p,...args);
 if(p!=='scripts/year-cycle-check.cjs')return v;
 return replaceExactly(v,"annualEconomy,parkDiagnostics:game.teams.map(t=>","annualEconomy,ahParent:game.teams.map(ahReport),parkDiagnostics:game.teams.map(t=>");
};
try{
 let source=fs.readFileSync('scripts/year-cycle-trial-af.cjs','utf8');
 source=replaceExactly(source,"require('./facility-trial-af.cjs').applyTrialAF(","require('./facility-trial-ah.cjs').applyTrialAH(");
 new Function('require','process','console',source)(require,process,console);
}finally{fs.readFileSync=read;}
