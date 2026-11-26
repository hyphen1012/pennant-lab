const assert=require('node:assert/strict'),{createNativeBillingAdapter}=require('../mobile/src/native-billing-adapter.cjs');
(async()=>{
 let account='a'.repeat(64),online=true,last=null,finished=0;
 const catalog=[{id:'fixture-permanent',type:'inapp'},{id:'fixture-vip',type:'subs',basePlan:'month'}];
 const plugin={product:async p=>({id:p.id,formattedPrice:'¥480'}),purchase:async p=>{last=p;return {status:'pending'};},restore:async()=>({rows:[{id:'fixture-permanent',store:'google',status:'purchased',proof:'fixture'},{id:'unknown'}]}),finish:async()=>{finished++;}};
 const sdk=createNativeBillingAdapter({plugin,platform:'android',catalog,account:()=>account,online:()=>online});
 await assert.rejects(sdk.purchase('fixture-vip'));assert.equal((await sdk.products(catalog.map(x=>x.id))).length,2);await sdk.purchase('fixture-vip');assert.equal(last.confirmedPrice,'¥480');assert.equal(last.account,account);assert.equal(last.basePlan,'month');
 const rows=await sdk.restore();assert.equal(rows.length,1);await sdk.finish(rows[0]);assert.equal(finished,1);
 account='b'.repeat(64);await assert.rejects(sdk.purchase('fixture-vip'));online=false;await assert.rejects(sdk.products(['fixture-vip']));
 const ios=createNativeBillingAdapter({plugin,platform:'ios',catalog,account:()=>account,online:()=>true});await ios.products(['fixture-permanent']);await ios.purchase('fixture-permanent');assert.match(last.account,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
 console.log('PASS native store adapter pricing, account binding and filtered recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
