// Identity is obtained from the authenticated API, never from the game save.
// Native provider supplies an access token via secure platform storage/PKCE.
// There is intentionally no password field or development bypass here.
const {openCloudSaveDialog}=require('./cloud-save-dialog.cjs');
function createAccountBootstrap({baseUrl,provider,fetcher=globalThis.fetch,online,openDialog=openCloudSaveDialog}={}){
 const url=new URL(baseUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||typeof provider?.getAccessToken!=='function'||typeof fetcher!=='function'||typeof online!=='function')throw Error('account provider and HTTPS API required');
 const base=url.href.replace(/\/$/,'');let generation=0,session=null,context=null,dialog=null,request=null,pending=null;
 function invalidate(){generation++;request?.abort();dialog?.abort();request=null;dialog=null;session=null;context=null;pending=null;}
 function suspend(){dialog?.abort();}
 async function identity(token){
  if(typeof token!=='string'||!/^[A-Za-z0-9._~+\/=-]{1,4096}$/.test(token))throw Error('invalid identity token');
  const ctl=new AbortController();request=ctl;const timer=setTimeout(()=>ctl.abort(),10000);
  try{
   const r=await fetcher(base+'/v1/identity',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',cache:'no-store',credentials:'omit',redirect:'error',signal:ctl.signal});
   if(r.status!==200||!r.body?.getReader)throw Error('identity unavailable');
   const reader=r.body.getReader(),parts=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096)throw Error('identity response too large');parts.push(value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
   const x=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(x.authenticated!==true||typeof x.account!=='string'||!/^[a-f0-9]{64}$/.test(x.account))throw Error('identity not verified');
   return x.account;
  }finally{clearTimeout(timer);if(request===ctl)request=null;}
 }
 async function start(){
  if(pending)return pending;if(context)return context;
  const gen=generation;const task=(async()=>{
   const token=await provider.getAccessToken();if(gen!==generation)throw Error('session changed');
   if(token==null)return null;
   const account=await identity(token);if(gen!==generation)throw Error('session changed');
   session={account,token};
   const current=()=>gen===generation&&session?.account===account&&context===ctx;
   const ctx=Object.freeze({account,isCurrent:current,async openCloud({openDatabase,canWrite}){
    if(!current()||!online()||dialog)throw Error('cloud unavailable');
    const ctl=new AbortController();dialog=ctl;
    try{return await openDialog({session:{...session},baseUrl:base,fetcher,openDatabase,canWrite:(a,s)=>current()&&canWrite(a,s),online,signal:ctl.signal});}
    finally{if(dialog===ctl)dialog=null;}
   }});
   context=ctx;return ctx;
  })();
  pending=task;try{return await task;}finally{if(pending===task)pending=null;}
 }
 async function revalidate(){
  if(!context||!session)return false;
  const gen=generation,owner=session.account;try{
   const token=await provider.getAccessToken();if(gen!==generation)return false;
   const account=await identity(token);if(gen!==generation)return false;
   if(account!==owner)throw Error('identity changed');
   if(token!==session.token){suspend();session={account,token};}
   return true;
  }catch{if(gen===generation)invalidate();return false;}
 }
 return {start,suspend,invalidate,revalidate,context:()=>context};
}
module.exports={createAccountBootstrap};
