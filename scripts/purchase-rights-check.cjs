const a=require('node:assert/strict');
const {normalizeRights}=require('../server/purchase-rights.cjs');
const {createEntitlementBridge}=require('../mobile/src/entitlement-bridge.cjs');
const {createAccountClient}=require('../mobile/src/account-client.cjs');
const epoch=1700000000000;
const snapshot=(account='a',opts={})=>({verified:true,account,verifiedAt:epoch,serverNow:epoch,entitlements:{adSkip:{active:true,expiresAt:null},vip:{active:true,expiresAt:epoch+1000}},...opts});
const reply=x=>({status:200,json:async()=>x});
(async()=>{
 const valid=snapshot();a.equal(normalizeRights('a',valid,epoch).entitlements.vip.active,true);
 a.equal(normalizeRights('a',valid,epoch+1000).entitlements.vip.active,false);
 for(const bad of [snapshot('b'),snapshot('a',{verified:false}),snapshot('a',{verifiedAt:epoch+1}),snapshot('a',{verifiedAt:epoch-300000}),{verified:true,account:'a',vip:true,adSkip:true},snapshot('a',{entitlements:{adSkip:{active:true,expiresAt:epoch},vip:{active:false,expiresAt:null}}})])a.throws(()=>normalizeRights('a',bad,epoch));
 let mono=10,replyValue=valid,handler=async()=>reply(replyValue),calls=0;
 const options={baseUrl:'https://example.invalid',now:()=>mono,timeoutMs:100,fetcher:(url,opts)=>{calls++;a.equal(url,'https://example.invalid/v1/entitlements');a.equal(opts.redirect,'error');a.equal(opts.body,'{}');return handler(url,opts);}};
 const bridge=createEntitlementBridge(options);
 a.equal((await bridge.refresh()).verified,false);a.equal(calls,0);
 bridge.setSession({account:'a',token:'a-token'});
 a.deepEqual(await bridge.refresh(),{available:true,verified:true,adSkip:true,vip:true});
 mono+=1000;a.equal(bridge.status().vip,false);a.equal(bridge.status().adSkip,true);
 // Server-time based expiry is independent of the device's wall clock.
 mono+=299000;a.equal(bridge.status().verified,false);
 replyValue=snapshot('a',{entitlements:{adSkip:{active:false,expiresAt:null},vip:{active:false,expiresAt:null}}});
 a.deepEqual(await bridge.refresh(),{available:true,verified:true,adSkip:false,vip:false});
 replyValue=snapshot('a');await bridge.refresh();a.equal(bridge.status().adSkip,true);
 let release,signal;handler=(url,opts)=>new Promise(ok=>{release=ok;signal=opts.signal;});
 const pending=bridge.refresh();while(!release)await Promise.resolve();
 bridge.setSession({account:'a',token:'new-token'});a.equal(signal.aborted,true);release(reply(valid));a.equal((await pending).verified,false);a.equal(bridge.status().adSkip,false);
 handler=async()=>reply(snapshot('b'));a.equal((await bridge.refresh()).verified,false);
 handler=async()=>reply(valid);a.equal((await bridge.refresh()).vip,true);
 mono-=1;a.equal(bridge.status().verified,false);mono+=1;a.equal(bridge.status().verified,false);
 // Network delay is deducted from validity, even if the store snapshot was fresh.
 handler=async()=>{mono+=1001;return reply(valid);};a.equal((await bridge.refresh()).vip,false);
 bridge.setSession(null);a.equal(bridge.status().adSkip,false);
 const client=createAccountClient(options);client.setSession({account:'a',token:'a-token'});
 handler=async()=>reply(snapshot('b'));await a.rejects(client.entitlements(),{code:'invalid_response'});
 handler=async()=>reply(snapshot('a',{verifiedAt:epoch-300000}));await a.rejects(client.entitlements(),{code:'invalid_response'});
 console.log('PASS verified store snapshot, expiry, refund projection, monotonic lease, token rotation, network delay and account isolation');
})().catch(e=>{console.error(e);process.exitCode=1});
