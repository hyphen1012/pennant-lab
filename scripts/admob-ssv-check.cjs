const assert=require('node:assert/strict'),{generateKeyPairSync,sign}=require('node:crypto');
const {createAdMobVerifier}=require('../server/admob-ssv.cjs');
(async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const v=createAdMobVerifier({units:['123'],resolveKey:async id=>id==='9'?publicKey:null});
 const q='ad_unit=123&custom_data=opaque_123&reward_amount=1&reward_item=ticket&timestamp=123456789&transaction_id=abcdef';
 const signed=s=>s+'&signature='+sign('sha256',Buffer.from(s),privateKey).toString('base64url')+'&key_id=9';
 const raw=signed(q);assert.equal((await v(raw)).transactionId,'abcdef');
 await assert.rejects(v(raw.replace('opaque_123','opaque_124')));
 await assert.rejects(v(raw.replace('key_id=9','key_id=8')));
 await assert.rejects(v(signed(q+'&ad_unit=123')));
 await assert.rejects(v(signed(q.replace('ad_unit=123','ad_unit=456'))));
 await assert.rejects(v(signed(q.replace('opaque_123','a%20b'))));
 console.log('AdMob SSV signature boundary check passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
