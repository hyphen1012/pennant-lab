// A verified store snapshot is required; never trust client receipts or flags.
// The host adapter must query current store ownership/refund/revocation and bind
// the purchase to this authenticated account. This module is not a store verifier.
const MAX_AGE_MS=300000;
const timestamp=v=>Number.isSafeInteger(v)&&v>=0;
function normalizeRights(account,value,serverNow){
 if(typeof account!=='string'||!account||account.length>200||!timestamp(serverNow)||value?.verified!==true||value.account!==account||!timestamp(value.verifiedAt)||value.verifiedAt>serverNow||serverNow-value.verifiedAt>=MAX_AGE_MS)throw Error('entitlements unavailable');
 const e=value.entitlements;
 if(!e||typeof e.adSkip?.active!=='boolean'||typeof e.vip?.active!=='boolean'||e.adSkip.expiresAt!==null||!(e.vip.active?timestamp(e.vip.expiresAt):e.vip.expiresAt===null))throw Error('invalid entitlement snapshot');
 const vip=e.vip.active&&e.vip.expiresAt>serverNow;
 return {verified:true,account,verifiedAt:value.verifiedAt,serverNow,entitlements:{adSkip:{active:e.adSkip.active,expiresAt:null},vip:{active:vip,expiresAt:vip?e.vip.expiresAt:null}}};
}
module.exports={normalizeRights,MAX_AGE_MS};
