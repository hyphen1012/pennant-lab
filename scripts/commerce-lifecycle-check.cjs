const assert=require('node:assert/strict');
const {createCommerceLifecycle}=require('../mobile/src/commerce-lifecycle.cjs');
(async()=>{
 let state={verified:false},resolve,blocked=false,session=null;
 const bridge={setSession:s=>{session=s;state={verified:false};},invalidate:()=>{state={verified:false};},status:()=>state,refresh:async()=>{if(blocked)await new Promise(r=>resolve=r);return state={verified:true,vip:true,adSkip:true};}};
 const life=createCommerceLifecycle({bridge,online:async()=>true});
 life.setSession({account:'a'});life.setVisible(true);life.setActive(true);life.setConnected(true);
 assert.equal(await life.refresh(),true);assert.equal(life.status().vip,true);
 life.setVisible(false);life.setActive(false);life.setActive(true);assert.equal(await life.refresh(),false);assert.equal(life.status().vip,false);
 life.setVisible(true);assert.equal(await life.refresh(),true);
 life.setConnected(false);assert.equal(life.status().verified,false);
 life.setConnected(true);blocked=true;const p=life.refresh();await new Promise(r=>setImmediate(r));life.setSession({account:'b'});resolve();assert.equal(await p,false);assert.equal(life.status().verified,false);assert.equal(session.account,'b');
 blocked=false;assert.equal(await life.refresh(),true);life.setSession(null);assert.equal(life.status().verified,false);assert.equal(await life.refresh(),false);
 console.log('commerce lifecycle check passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
