// HTTPS binary save transport; no automatic uploads or retries.
function createSaveTransport({baseUrl,fetcher=globalThis.fetch,sha256,timeoutMs=120000,maxBytes=256*1024*1024}={}){
 const u=new URL(baseUrl);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||typeof fetcher!=='function'||typeof sha256!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024)throw Error('secure bounded save transport required');
 const base=u.href.replace(/\/$/,'')+'/v1/saves';
 const validSlot=x=>[1,2,3].includes(x),rev=x=>Number.isSafeInteger(x)&&x>=0,hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x),size=x=>Number.isSafeInteger(x)&&x>0&&x<=maxBytes;
 const number=x=>typeof x==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(x)&&rev(Number(x))?Number(x):null;
 const fail=(code,uncertain=false)=>Object.assign(Error(code),{code,uncertain});
 let session=null,generation=0,active=null;
 function setSession(next){
  if(next!==null&&(!next||typeof next.account!=='string'||!next.account||next.account.length>200||typeof next.token!=='string'||!/^[A-Za-z0-9._~+\/=-]{1,4096}$/.test(next.token)))throw Error('invalid session');
  generation++;active?.abort();active=null;session=next?{account:next.account,token:next.token}:null;
 }
 async function read(response,limit,expected){
  if(!response.body?.getReader)throw fail('stream_required');
  const reader=response.body.getReader(),parts=[];let n=0,complete=false;
  try{
   while(true){const {done,value}=await reader.read();if(done){complete=true;break;}if(!(value instanceof Uint8Array)||n+value.length>limit)throw fail('response_too_large');parts.push(value);n+=value.length;}
   if(expected!==undefined&&n!==expected)throw fail('length_mismatch');
   const bytes=new Uint8Array(n);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
  }finally{if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 async function request(path,{method='GET',payload,headers={},parse}){
  const mutation=method==='PUT';
  if(!session)throw fail('authentication_required');
  if(active)throw fail('transfer_in_progress');
  const gen=generation,token=session.token,ctl=new AbortController();active=ctl;let timer,dispatched=false;
  const current=()=>{if(gen!==generation||ctl.signal.aborted)throw fail('session_changed',mutation&&dispatched);};
  try{
   const work=async()=>{
    current();dispatched=true;
    const response=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+token,...headers},body:payload,cache:'no-store',redirect:'error',credentials:'omit',signal:ctl.signal});
    current();
    if(!response||response.status!==200){try{void response?.body?.cancel().catch(()=>{});}catch{}throw fail(response?.status===409?'revision_conflict':response?.status===404?'not_found':'request_rejected',mutation&&response?.status!==409);}
    const value=await parse(response);current();return value;
   };
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{ctl.abort();reject(fail('timeout',mutation&&dispatched));},timeoutMs);});
   return await Promise.race([work(),timeout]);
  }catch(e){if(gen!==generation)throw fail('session_changed',mutation&&dispatched);throw e?.code&&typeof e.uncertain==='boolean'?fail(e.code,e.uncertain||(mutation&&dispatched&&e.code!=='revision_conflict')):fail('network_error',mutation&&dispatched);}
  finally{clearTimeout(timer);if(active===ctl)active=null;ctl.abort();}
 }
 async function json(response){
  if(!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw fail('invalid_response');
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await read(response,16384)));
 }
 const meta=x=>x&&rev(x.revision)&&x.revision>0&&hash(x.sha)&&size(x.bytes);
 function list(){return request('',{parse:async r=>{const x=await json(r);if(!Array.isArray(x)||x.length>3||!x.every(a=>meta(a)&&validSlot(a.slot))||new Set(x.map(a=>a.slot)).size!==x.length)throw fail('invalid_response');return x;}});}
 function history(slot){if(!validSlot(slot))throw fail('invalid_slot');return request('/'+slot+'/history',{parse:async r=>{const x=await json(r);if(!Array.isArray(x)||x.length>10||!x.every(meta)||new Set(x.map(a=>a.revision)).size!==x.length)throw fail('invalid_response');return x;}});}
 function download(slot,revision){
  if(!validSlot(slot)||(revision!==undefined&&(!rev(revision)||revision<1)))throw fail('invalid_slot_or_revision');
  return request('/'+slot+(revision===undefined?'':'/history/'+revision),{parse:async r=>{
   const bytes=number(r.headers.get('content-length')),v=number(r.headers.get('x-save-revision')),sha=r.headers.get('x-save-sha256');
   if(r.headers.get('content-type')!=='application/octet-stream'||r.headers.get('content-encoding')||!size(bytes)||!rev(v)||v<1||!hash(sha)||(revision!==undefined&&revision!==v))throw fail('invalid_response');
   const payload=await read(r,maxBytes,bytes);
   if(await sha256(payload)!==sha)throw fail('hash_mismatch');
   return {revision:v,sha,payload};
  }});
 }
 async function upload({slot,expectedRevision,payload,confirmed}={}){
  if(!session)throw fail('authentication_required');
  if(confirmed!==true||!validSlot(slot)||!rev(expectedRevision)||!(payload instanceof Uint8Array)||!size(payload.length))throw fail('explicit_valid_upload_required');
  const gen=generation,copy=new Uint8Array(payload),sha=await sha256(copy);
  if(gen!==generation)throw fail('session_changed');
  if(!hash(sha))throw fail('hash_failed');
  return request('/'+slot,{method:'PUT',payload:copy,headers:{'Content-Type':'application/octet-stream','X-Save-Revision':String(expectedRevision),'X-Save-SHA256':sha,'X-Save-Confirmed':'true'},parse:async r=>{
   const x=await json(r);
   if(!x||typeof x.unchanged!=='boolean'||x.sha!==sha||!rev(x.revision)||x.revision<1||x.revision!==(x.unchanged?expectedRevision:expectedRevision+1))throw fail('invalid_response',true);
   return x;
  }});
 }
 return {setSession,list,history,download,upload};
}
module.exports={createSaveTransport};
