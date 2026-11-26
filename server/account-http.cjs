// Reference HTTP transport. NOT deployed. Requires trusted service/limiter and TLS ingress.
const http=require('node:http');
const ROUTES=new Map([
 ['/v1/wallet',['snapshot',[]]],['/v1/entitlements',['entitlementSnapshot',[]]],['/v1/restore',['restorePurchase',['store','proof']]],['/v1/claim',['claim',['eventProof','choice']]],
 ['/v1/exchange',['exchange',['key']]],['/v1/reserve',['reserve',['actionProof','choice']]],
 ['/v1/finish',['finish',['completionProof']]],['/v1/order',['orderStatus',['id']]]
]);
function createAccountHttp({service,allowRequest,maxBody=65536}={}){
 if(!service||[...ROUTES.values()].some(([m])=>typeof service[m]!=='function')||typeof allowRequest!=='function'||!Number.isSafeInteger(maxBody)||maxBody<1024||maxBody>1048576)throw Error('trusted service, limiter and bounded payload required');
 function send(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
 function read(req){return new Promise((resolve,reject)=>{
  let n=0,parts=[],done=false;
  const fail=status=>{if(!done){done=true;parts=[];reject(Object.assign(Error('invalid request'),{status}));}};
  if(Number(req.headers['content-length']||0)>maxBody){fail(413);req.resume();return;}
  req.on('data',chunk=>{if(done)return;n+=chunk.length;if(n>maxBody){fail(413);return;}parts.push(chunk);});
  req.on('aborted',()=>fail(400));req.on('error',()=>fail(400));
  req.on('end',()=>{if(done)return;try{const x=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!x||Object.getPrototypeOf(x)!==Object.prototype)throw Error();done=true;resolve(x);}catch{fail(400);}});
 });}
 const proof=v=>typeof v==='string'&&v.length>0&&v.length<=maxBody;
 const handlers={snapshot:()=>[],entitlementSnapshot:()=>[],restorePurchase:b=>['apple','google'].includes(b.store)&&proof(b.proof)?[b.store,b.proof]:null,claim:b=>proof(b.eventProof)&&['ticket','point'].includes(b.choice)?[b.eventProof,b.choice]:null,exchange:b=>typeof b.key==='string'&&b.key.length<=64?[b.key]:null,reserve:b=>proof(b.actionProof)&&['ad','ticket'].includes(b.choice)?[b.actionProof,b.choice]:null,finish:b=>proof(b.completionProof)?[b.completionProof]:null,orderStatus:b=>typeof b.id==='string'&&/^[A-Za-z0-9:_-]{1,200}$/.test(b.id)?[b.id]:null};
 return http.createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
  try{
   const route=ROUTES.get(req.url);
   if(!route){req.resume();return send(res,404,{error:'not_found'});}
   if(req.method!=='POST'){req.resume();return send(res,405,{error:'method_not_allowed'});}
   const m=/^Bearer ([A-Za-z0-9._~+\/=-]{1,4096})$/.exec(req.headers.authorization||'');
   if(!m){req.resume();return send(res,401,{error:'authentication_required'});}
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')||req.headers['content-encoding']){req.resume();return send(res,415,{error:'json_required'});}
   if(await allowRequest({token:m[1],remoteAddress:req.socket.remoteAddress,route:req.url})!==true){req.resume();return send(res,429,{error:'rate_limited'});}
   const body=await read(req),[method,keys]=route;
   if(Object.keys(body).length!==keys.length||keys.some(k=>!Object.hasOwn(body,k)))return send(res,400,{error:'invalid_fields'});
   const args=handlers[method](body);if(!args)return send(res,400,{error:'invalid_fields'});
   return send(res,200,await service[method](m[1],...args));
  }catch(e){if(res.destroyed||res.writableEnded)return;
   if(e.status===413||e.status===400)return send(res,e.status,{error:e.status===413?'payload_too_large':'invalid_json'});
   return send(res,403,{error:'request_not_verified'});
  }
 });
}
module.exports={createAccountHttp};
