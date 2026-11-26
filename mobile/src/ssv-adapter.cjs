// Native SDK receives an opaque server reservation token. SDK completion is
// never evidence: only the authenticated status endpoint can confirm receipt.
// Actual grant/application remains the reward coordinator's trusted backend job.
function createSsvAdAdapter({client,sdk,platform,adId,online,consent,delay=ms=>new Promise(r=>setTimeout(r,ms)),polls=5}={}){
 if(!client||[client.issueAd,client.adStatus,sdk?.initialize,sdk?.prepareRewardVideoAd,sdk?.showRewardVideoAd,online,consent,delay].some(f=>typeof f!=='function')||!['android','ios'].includes(platform)||!/^ca-app-pub-\d+\/\d+$/.test(adId||'')||!Number.isInteger(polls)||polls<1||polls>10)throw Error('ad adapter configuration required');
 let busy=false,gen=0,initialized=false;
 function invalidate(){gen++;}
 async function requestAdProof({operationId,attempt}={}){
  if(busy||typeof operationId!=='string'||!operationId||!Number.isSafeInteger(attempt)||attempt<1)return null;
  busy=true;const g=gen,valid=()=>gen===g;
  try{
   if(!valid()||!await online()||!await consent()||!valid())return null;
   if(!initialized){await sdk.initialize();initialized=true;}
   if(!valid()||!await online())return null;
   const r=await client.issueAd({operationId,attempt,platform});
   if(!valid()||!/^[a-f0-9]{64}$/.test(r?.customData||''))return null;
   await sdk.prepareRewardVideoAd({adId,npa:true,ssv:{customData:r.customData}});
   if(!valid()||!await online())return null;
   // No inference from SDK success, dismissal or failure. Poll only the
   // status endpoint, with no repeated ad show or reservation mutation.
   try{await sdk.showRewardVideoAd({adId});}catch{}
   for(let i=0;i<polls;i++){
    if(!valid()||!await online()||!valid())return null;
    const status=await client.adStatus({operationId,attempt});
    if(!valid())return null;
    if(status?.verified===true)return r.customData;
    if(i+1<polls)await delay(1500);
   }
   return null;
  }catch{return null;}finally{busy=false;}
 }
 return {requestAdProof,invalidate};
}
module.exports={createSsvAdAdapter};
