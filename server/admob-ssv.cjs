// Signature verification boundary only; no ledger mutation or reward grant.
// Trusted key resolver must fetch Google's official keys via HTTPS, cache <=24h,
// and reject unknown keys. Reservation binding and durable transaction dedup
// are mandatory at the caller. Restrict custom_data to opaque ASCII tokens.
const {verify,createPublicKey}=require('node:crypto');
function createAdMobVerifier({resolveKey,units}={}){
 if(typeof resolveKey!=='function'||!Array.isArray(units)||!units.length||units.some(x=>typeof x!=='string'||!/^\d{1,30}$/.test(x)))throw Error('trusted key resolver and ad units required');
 const allowed=new Set(units);
 return async function verifyCallback(rawQuery){
  if(typeof rawQuery!=='string'||rawQuery.length>8192||!/^[\x21-\x7e]+$/.test(rawQuery)||rawQuery.includes('#'))throw Error('invalid query');
  const parts=rawQuery.split('&'),key=parts.pop(),sig=parts.pop();
  if(!/^key_id=\d{1,16}$/.test(key||'')||!/^signature=[A-Za-z0-9_-]{1,256}={0,2}$/.test(sig||''))throw Error('invalid signature fields');
  const signed=parts.join('&'),values=new Map();
  // Keep raw ordering and bytes. Restrict accepted fields to unescaped ASCII
  // to avoid ambiguous raw/decoded signature canonicalization. Real callback
  // fixtures must confirm compatibility before enabling this verifier.
  for(const p of parts){
   const m=/^([a-z_]+)=([A-Za-z0-9_.:-]{1,512})$/.exec(p);
   if(!m||values.has(m[1])||['signature','key_id'].includes(m[1]))throw Error('invalid or duplicate field');
   values.set(m[1],m[2]);
  }
  const unit=values.get('ad_unit'),transactionId=values.get('transaction_id'),customData=values.get('custom_data'),timestamp=values.get('timestamp'),amount=values.get('reward_amount'),item=values.get('reward_item');
  if(!allowed.has(unit)||!transactionId||!customData||!/^\d{1,20}$/.test(timestamp||'')||!/^\d{1,9}$/.test(amount||'')||Number(amount)<=0||!item)throw Error('missing reward context');
  const pub=await resolveKey(key.slice(7));
  if(!pub)throw Error('unknown signing key');
  const k=pub.type==='public'?pub:createPublicKey(pub);
  if(k.asymmetricKeyType!=='ec'||k.asymmetricKeyDetails?.namedCurve!=='prime256v1'||!verify('sha256',Buffer.from(signed,'utf8'),k,Buffer.from(sig.slice(10),'base64url')))throw Error('invalid signature');
  return Object.freeze({unit,transactionId,customData,timestamp,amount:Number(amount),item});
 };
}
module.exports={createAdMobVerifier};
