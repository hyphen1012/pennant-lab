// Durable deletion requests, not a claim that external identity or billing
// records have been erased. Purge is an explicit maintenance operation.
const {DatabaseSync}=require('node:sqlite'),{randomUUID}=require('node:crypto');
function openDeletionRequests(filename,{now=Date.now}={}){
 const db=new DatabaseSync(filename);
 db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS deletion_requests(account TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,requested_at INTEGER NOT NULL,status TEXT NOT NULL,updated_at INTEGER NOT NULL)");
 const get=db.prepare('SELECT * FROM deletion_requests WHERE account=?'),add=db.prepare("INSERT INTO deletion_requests VALUES(?,?,?,'requested',?)"),update=db.prepare('UPDATE deletion_requests SET status=?,updated_at=? WHERE account=? AND status=?');
 const view=r=>r?{requestId:r.request_id,status:r.status,requestedAt:r.requested_at,updatedAt:r.updated_at}:null;
 const id=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<=0)throw Error('invalid server time');return t;}
 function request(account){
  if(!id(account))throw Error('invalid account');db.exec('BEGIN IMMEDIATE');
  try{let row=get.get(account);if(!row){const t=time();add.run(account,randomUUID(),t,t);row=get.get(account);}db.exec('COMMIT');return view(row);}catch(e){db.exec('ROLLBACK');throw e;}
 }
 function advance(account,from,to){
  if(!id(account)||!((from==='requested'&&to==='processing')||(from==='processing'&&to==='completed')))throw Error('invalid deletion transition');
  return update.run(to,time(),account,from).changes===1;
 }
 return {request,status:a=>id(a)?view(get.get(a)):null,blocked:a=>id(a)&&!!get.get(a),advance,close:()=>db.close()};
}
function createDeletionService({registry,authenticate,verifyRecentReauth}={}){
 if(!registry||typeof authenticate!=='function'||typeof verifyRecentReauth!=='function')throw Error('deletion adapters required');
 async function owner(token){const a=await authenticate(token);if(a?.authenticated!==true||!/^([a-f0-9]{64})$/.test(a.account||''))throw Error('unauthorized');return a.account;}
 return {status:async token=>({request:registry.status(await owner(token))}),request:async(token,body)=>{
  const account=await owner(token);
  if(body?.confirmed!==true||typeof body.reauthProof!=='string'||!body.reauthProof||body.reauthProof.length>4096)throw Error('explicit recent reauthentication required');
  const a=await verifyRecentReauth({token,account,proof:body.reauthProof});
  if(a?.verified!==true||a.account!==account)throw Error('recent identity not verified');
  return {request:registry.request(account)};
 }};
}
module.exports={openDeletionRequests,createDeletionService};
