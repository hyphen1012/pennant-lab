// Compose existing authenticated services on one listener behind a TLS ingress.
const http=require('node:http');
function createServiceRouter({accountHttp,saveHttp,adService,deletionService,storeNotifications=null,gameAuthority=null,allowRequest,origins=[]}={}){
 const account=accountHttp?.listeners('request')?.[0],save=saveHttp?.listeners('request')?.[0];
 if(typeof account!=='function'||typeof save!=='function'||!adService||!deletionService||typeof allowRequest!=='function'||!Array.isArray(origins)||origins.some(x=>typeof x!=='string'||!(/^(https:\/\/[^/]+|capacitor:\/\/localhost|http:\/\/localhost)$/.test(x))))throw Error('service router configuration required');
 const allowed=new Set(origins),metrics={requests:0,rejected:0,errors:0};
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 async function read(req,limit=16384){if(req.headers['content-encoding']||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))throw Error('json required');let n=0,parts=[];for await(const b of req){n+=b.length;if(n>limit)throw Error('request too large');parts.push(b);}const x=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,n)));if(!x||Object.getPrototypeOf(x)!==Object.prototype)throw Error('invalid json');return x;}
 const exact=(b,keys)=>Object.keys(b).length===keys.length&&keys.every(k=>Object.hasOwn(b,k));
 const handlers={
  '/v1/ads/issue':['issue',['operationId','attempt','platform']],
  '/v1/ads/status':['status',['operationId','attempt']],
  '/v1/deletion/request':['request',['confirmed','reauthProof']],
  '/v1/deletion/status':['status',[]]
 };
 // Only a server-injected engine can enable these routes. No client state
 // upload, seed, entitlement flag, or completion proof is accepted.
 const gameRoutes=new Map([
  ['/v1/game/create',['create',['slot','command']]],
  ['/v1/game/read',['read',['slot']]],
  ['/v1/game/order',['orderStatus',['slot','operationId']]],
  ['/v1/game/advance',['advance',['slot','revision','command']]],
  ['/v1/game/reserve',['reserve',['slot','operationId','choice']]],
  ['/v1/game/settle',['settle',['slot','operationId','attempt']]],
  ['/v1/game/cancel',['cancel',['slot','operationId','attempt','confirmed']]],
  ['/v1/game/achievements',['achievements',['slot']]],
  ['/v1/game/claim',['claim',['slot','eventId','choice']]]
 ]);
 if(gameAuthority&&[...gameRoutes.values()].some(([m])=>typeof gameAuthority[m]!=='function'))throw Error('invalid game authority');
 const server=http.createServer({requestTimeout:120000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
  metrics.requests++;res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reject=(s,e)=>{metrics.rejected++;req.resume();json(res,s,{error:e});};
  try{
   const origin=req.headers.origin;
   if(origin!==undefined){if(!allowed.has(origin))return reject(403,'origin_rejected');res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Expose-Headers','X-Save-Revision,X-Save-SHA256,Content-Length');}
   if(req.method==='OPTIONS'){
    if(!origin||!/^\/v1\/(?:[a-z]+(?:-[a-z0-9]+)*)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(req.url)||!['GET','POST','PUT'].includes(req.headers['access-control-request-method']))return reject(405,'preflight_rejected');
    res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,PUT','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Save-Revision,X-Save-SHA256,X-Save-Confirmed','Access-Control-Max-Age':'300'});return res.end();
   }
   if(req.url==='/healthz'&&req.method==='GET')return json(res,200,{status:'ok'});
   if(/^\/health\.txt(?:\?n=\d{1,20})?$/.test(req.url)&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});return res.end('PENNANT-LAB-ONLINE-v1');}
   if(req.url.startsWith('/v1/admob/ssv?')){
    if(req.method!=='GET'||req.headers['transfer-encoding']||Number(req.headers['content-length']||0)!==0||req.url.length>8300)return reject(400,'invalid_callback');
    if(await allowRequest({token:'admob-callback',remoteAddress:req.socket.remoteAddress,route:'ssv'})!==true)return reject(429,'rate_limited');
    await adService.callback(req.url.slice('/v1/admob/ssv?'.length));return json(res,200,{accepted:true});
   }
   if(req.url==='/v1/store/apple-notification'||req.url==='/v1/store/google-notification'){
    if(!storeNotifications)return reject(503,'store_notifications_disabled');
    if(req.method!=='POST')return reject(405,'method_not_allowed');
    if(await allowRequest({token:'store-notification',remoteAddress:req.socket.remoteAddress,route:'ssv'})!==true)return reject(429,'rate_limited');
    const b=await read(req,131072);
    if(req.url.includes('apple')){
     if(!exact(b,['signedPayload'])||typeof b.signedPayload!=='string'||b.signedPayload.length>65536)return reject(400,'invalid_notification');
     await storeNotifications.notification('apple',b.signedPayload);
    }else{
     const token=/^Bearer ([A-Za-z0-9._-]{1,4096})$/.exec(req.headers.authorization||'')?.[1];
     if(!token)return reject(401,'authentication_required');
     const proof=await storeNotifications.verifyGooglePush(token,b);
     if(proof!==null)await storeNotifications.notification('google',JSON.stringify(proof));
    }
    res.writeHead(204);return res.end();
   }
   if(/^\/v1\/saves(?:\/|$)/.test(req.url))return await save(req,res);
   if(gameRoutes.has(req.url)){
    if(!gameAuthority)return reject(503,'game_authority_disabled');
    if(req.method!=='POST')return reject(405,'method_not_allowed');
    const token=/^Bearer ([A-Za-z0-9._~+\/=-]{1,4096})$/.exec(req.headers.authorization||'')?.[1];
    if(!token)return reject(401,'authentication_required');
    if(await allowRequest({token,remoteAddress:req.socket.remoteAddress,route:req.url})!==true)return reject(429,'rate_limited');
    const [method,keys]=gameRoutes.get(req.url),b=await read(req);
    if(!exact(b,keys)||![1,2,3].includes(b.slot)||('command' in b&&(!b.command||Object.getPrototypeOf(b.command)!==Object.prototype)))return reject(400,'invalid_fields');
    return json(res,200,await gameAuthority[method](token,...keys.map(k=>b[k])));
   }
   if(Object.hasOwn(handlers,req.url)){
    if(req.method!=='POST')return reject(405,'method_not_allowed');
    const token=/^Bearer ([A-Za-z0-9._~+\/=-]{1,4096})$/.exec(req.headers.authorization||'')?.[1];
    if(!token)return reject(401,'authentication_required');
    if(await allowRequest({token,remoteAddress:req.socket.remoteAddress,route:req.url})!==true)return reject(429,'rate_limited');
    const [method,keys]=handlers[req.url],b=await read(req);
    if(!exact(b,keys))return reject(400,'invalid_fields');
    const service=req.url.startsWith('/v1/ads/')?adService:deletionService;
    return json(res,200,await service[method](token,b));
   }
   if(req.url.startsWith('/v1/'))return await account(req,res);
   return reject(404,'not_found');
  }catch(e){metrics.errors++;if(!res.destroyed&&!res.headersSent&&!res.writableEnded)reject(403,'request_not_verified');else if(!res.writableEnded)res.destroy();}
 });
 return {server,metrics:()=>({...metrics})};
}
module.exports={createServiceRouter};
