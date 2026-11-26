// Explicit, session-bound migration staging. The transport and local CAS adapter
// are not yet connected to the live game. No automatic local writes or deletion.
function createSaveTransferClient({transport,local,sha256,maxBytes=256*1024*1024}={}){
 if(!transport||!local||[transport.setSession,transport.download,local.inspect,local.replace,sha256].some(f=>typeof f!=='function')||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('migration adapters required');
 let account=null,generation=0,staged=null,busy=false;
 const integer=x=>Number.isSafeInteger(x)&&x>=0;
 const validSlot=s=>[1,2,3].includes(s);
 function invalidate(){generation++;staged=null;}
 function setSession(session){
  if(session!==null&&(!session||typeof session.account!=='string'||!session.account||session.account.length>200))throw Error('invalid account');
  transport.setSession(session);account=session?.account??null;invalidate();
 }
 async function stage({sourceSlot,targetSlot}={}){
  if(busy||!account||!validSlot(sourceSlot)||!validSlot(targetSlot))throw Error('migration unavailable');
  busy=true;staged=null;const owner=account,gen=generation;
  try{
   const remote=await transport.download(sourceSlot);
   if(gen!==generation||!remote||!integer(remote.revision)||remote.revision<1||!(remote.payload instanceof Uint8Array)||!remote.payload.length||remote.payload.length>maxBytes||typeof remote.sha!=='string'||!/^[0-9a-f]{64}$/.test(remote.sha))throw Error('invalid migration source');
   const payload=new Uint8Array(remote.payload);
   if(await sha256(payload)!==remote.sha)throw Error('save hash mismatch');
   if(gen!==generation)throw Error('session changed');
   const target=await local.inspect({account:owner,slot:targetSlot});
   if(gen!==generation||!target||!integer(target.revision))throw Error('target changed');
   staged={owner,gen,sourceSlot,targetSlot,sourceRevision:remote.revision,expectedRevision:target.revision,sha:remote.sha,payload};
   return {sourceSlot,targetSlot,sourceRevision:remote.revision,targetRevision:target.revision,bytes:payload.length,sha:remote.sha};
  }finally{busy=false;}
 }
 async function commit({confirmed=false}={}){
  if(busy||!confirmed||!staged||staged.gen!==generation||staged.owner!==account)throw Error('explicit current migration confirmation required');
  const s=staged;staged=null;busy=true;
  try{
   // The local adapter MUST implement account-bound atomic revision check and
   // preserve the previous save as a recovery copy before replacing.
   const result=await local.replace({account:s.owner,slot:s.targetSlot,expectedRevision:s.expectedRevision,sha:s.sha,payload:new Uint8Array(s.payload)});
   if(s.gen!==generation)throw Error('session changed; inspect migration status');
   if(result?.ok!==true)throw Error('local save conflict');
   return {ok:true,slot:s.targetSlot};
  }finally{busy=false;}
 }
 return {setSession,invalidate,stage,commit};
}
module.exports={createSaveTransferClient};
