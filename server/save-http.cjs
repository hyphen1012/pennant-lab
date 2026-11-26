// Standalone reference endpoint; production TLS, identity and rate limits required.
const http=require('node:http');
const {digest}=require('./save-transfer.cjs');
const integer=s=>typeof s==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;
function createSaveHttp({service,allowRequest,maxBytes=256*1024*1024,maxConcurrent=1}={}){
 if(!service||['list','download','importSave','history','downloadBackup'].some(k=>typeof service[k]!=='function')||typeof allowRequest!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>256*1024*1024||!Number.isSafeInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>4)throw Error('trusted save adapters required');
 let active=0;
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 function json(res,status,value){res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
 function fail(req,res,status,error){req.resume();json(res,status,{error});}
 async function body(req,len){
  let n=0;const parts=[];
  for await(const part of req){n+=part.length;if(n>len)throw Error('length mismatch');parts.push(part);}
  if(n!==len||!req.complete)throw Error('incomplete body');
  return Buffer.concat(parts,n);
 }
 return http.createServer({requestTimeout:120000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
  let reserved=false;
  try{
   const route=/^\/v1\/saves(?:\/([123])(?:\/history(?:\/([1-9][0-9]{0,15}))?)?)?$/.exec(req.url);
   if(!route)return fail(req,res,404,'not_found');
   const slot=route[1]?Number(route[1]):null,isHistory=req.url.includes('/history'),revision=route[2]?integer(route[2]):null;
   if(route[2]&&revision===null)return fail(req,res,400,'invalid_revision');
   const write=req.method==='PUT'&&slot&&!isHistory;
   if(req.method!=='GET'&&!write)return fail(req,res,405,'method_not_allowed');
   const token=/^Bearer ([A-Za-z0-9._~+\/=-]{1,4096})$/.exec(req.headers.authorization||'')?.[1];
   if(!token)return fail(req,res,401,'authentication_required');
   if(await allowRequest({token,remoteAddress:req.socket.remoteAddress,route:write?'save_write':'save_read'})!==true)return fail(req,res,429,'rate_limited');
   if(active>=maxConcurrent)return fail(req,res,503,'busy');
   active++;reserved=true;
   // Authenticate before allocating upload memory. importSave reauthenticates
   // before committing; account identity must be stable for a token.
   if(write){
    const len=integer(req.headers['content-length']),expectedRevision=integer(req.headers['x-save-revision']),sha=req.headers['x-save-sha256'];
    if(req.headers['content-type']!=='application/octet-stream'||req.headers['content-encoding']||req.headers['transfer-encoding'])return fail(req,res,415,'binary_required');
    if(len===null||len<1||len>maxBytes)return fail(req,res,413,'invalid_size');
    if(expectedRevision===null||typeof sha!=='string'||!/^[0-9a-f]{64}$/.test(sha)||req.headers['x-save-confirmed']!=='true')return fail(req,res,400,'invalid_import');
    await service.list(token);
    const payload=await body(req,len);
    if(digest(payload)!==sha)return json(res,400,{error:'hash_mismatch'});
    return json(res,200,await service.importSave(token,{slot,expectedRevision,payload,sha,confirmed:true}));
   }
   if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)!==0)return fail(req,res,400,'unexpected_body');
   if(!slot)return json(res,200,await service.list(token));
   if(isHistory&&!revision)return json(res,200,await service.history(token,slot));
   const result=isHistory?await service.downloadBackup(token,slot,revision):await service.download(token,slot);
   if(!result)return json(res,404,{error:'not_found'});
   const {payload,sha}=result;
   if(!Buffer.isBuffer(payload)||!payload.length||payload.length>maxBytes||digest(payload)!==sha||!Number.isSafeInteger(result.revision)||result.revision<1)throw Error('invalid stored data');
   res.writeHead(200,{...headers,'Content-Type':'application/octet-stream','Content-Length':payload.length,'X-Save-SHA256':sha,'X-Save-Revision':String(result.revision)});
   // Hold concurrency reservation through socket flush or disconnect.
   await new Promise(resolve=>{res.once('finish',resolve);res.once('close',resolve);res.end(payload);});
  }catch(e){
   if(!res.destroyed&&!res.writableEnded&&!res.headersSent)fail(req,res,e?.message==='save revision conflict'?409:403,e?.message==='save revision conflict'?'revision_conflict':'request_not_verified');
  }finally{if(reserved)active--;}
 });
}
module.exports={createSaveHttp};
