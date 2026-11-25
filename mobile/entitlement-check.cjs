const assert=require('node:assert/strict');
const {createEntitlements}=require('./src/entitlements.cjs');
(async()=>{
 let now=1000,account='a',verified=true,adSkip=true,vip=true,release,delay=false,calls=0;
 const verify=async owner=>{calls++;if(delay)await new Promise(r=>release=r);return {verified,account:owner,verifiedAt:now,entitlements:{adSkip:{active:adSkip,expiresAt:null},vip:{active:vip,expiresAt:now+30},unknown:{active:true,expiresAt:null}}};};
 const disabled=createEntitlements();disabled.setAccount('a');assert.equal((await disabled.refresh()).adSkip,false);assert.equal(disabled.status().available,false);
 const e=createEntitlements({verify,now:()=>now,maxAgeMs:100});
 e.setAccount(account);assert.equal(e.status().adSkip,false);assert.equal((await e.refresh()).adSkip,true);assert.equal(e.status().vip,true);
 now+=31;assert.equal(e.status().vip,false);assert.equal(e.status().adSkip,true);
 now+=70;assert.equal(e.status().adSkip,false);
 adSkip=false;assert.equal((await e.refresh()).adSkip,false);assert.equal(e.status().vip,true);
 verified=false;assert.equal((await e.refresh()).vip,false);verified=true;
 delay=true;const pending=e.refresh();const same=e.refresh();while(!release)await Promise.resolve();e.setAccount('b');release();assert.equal((await pending).adSkip,false);assert.equal((await same).vip,false);assert.equal(e.status().verified,false);
 delay=false;adSkip=true;assert.equal((await e.refresh()).adSkip,true);e.invalidate();assert.equal(e.status().adSkip,false);
 const mismatch=createEntitlements({now:()=>now,verify:async()=>({verified:true,account:'wrong',verifiedAt:now,entitlements:{adSkip:{active:true,expiresAt:null}}})});mismatch.setAccount('a');assert.equal((await mismatch.refresh()).adSkip,false);
 const rejected=createEntitlements({verify:async()=>{throw Error('store unavailable')}});rejected.setAccount('a');assert.equal((await rejected.refresh()).vip,false);
 console.log('PASS entitlement boundary: disabled adapter, expiry, stale receipt, revocation, account change, provider failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
