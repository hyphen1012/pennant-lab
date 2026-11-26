const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {blockers,assertProductionReady}=require('../mobile/production-readiness.cjs');
assert.ok(blockers.length);assert.throws(assertProductionReady,/Production release blocked/);
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
assert.ok(read('mobile/prepare.cjs').includes("if(production)require('./production-readiness.cjs').assertProductionReady()"));
assert.ok(read('mobile/src/index.js').includes('reward:config.production?null:reward'));
console.log('release blocker check passed');
