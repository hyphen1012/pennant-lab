// Staging-only canonical game authority boundary. The engine MUST run inside
// the trusted server process; no client-imported save is accepted as authority.
// Wallet reservation/settlement, canonical state and outcome journal share one
// SQLite transaction. The actual full season engine is not integrated yet.
const {randomUUID,createHash}=require('node:crypto'),rules=require('../shared/monetization.cjs');
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(x);
const owner=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const n=x=>Number.isSafeInteger(x)&&x>=0;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const routes=new Set(['draft-revival','foreign-revival','lottery','fa-retention','fa-sign','retirement','manager','medical']);
function installAuthorityTables(db){
 db.exec('CREATE TABLE IF NOT EXISTS authority_worlds(account TEXT NOT NULL,slot INTEGER NOT NULL,world TEXT UNIQUE NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(account,slot)); CREATE TABLE IF NOT EXISTS authority_actions(account TEXT NOT NULL,operation TEXT NOT NULL,world TEXT NOT NULL,route TEXT NOT NULL,descriptor TEXT NOT NULL,result TEXT,attempt INTEGER,PRIMARY KEY(account,operation)); CREATE INDEX IF NOT EXISTS authority_world_actions ON authority_actions(account,world);');
}
function createGameAuthority({ledger,engine,authenticate,verifyRights,hasAdProof,now=Date.now}={}){
 if(!ledger?.transact||[engine?.newWorld,engine?.actions,engine?.achievements,engine?.applyAction,engine?.advance,engine?.view,authenticate,verifyRights,hasAdProof].some(x=>typeof x!=='function'))throw Error('trusted canonical game engine required');
 function sync(v){if(v&&typeof v.then==='function')throw Error('engine transaction must be synchronous');return v;}
 const json=(v,max=32*1024*1024)=>{const s=JSON.stringify(v);if(typeof s!=='string'||Buffer.byteLength(s)>max)throw Error('canonical state exceeds limit');return s;};
 async function identity(token){const a=await authenticate(token);if(a?.authenticated!==true||!owner(a.account))throw Error('unauthorized');return a.account;}
 async function rights(account){const r=await verifyRights(account);if(r?.verified!==true||typeof r.vip!=='boolean'||typeof r.adSkip!=='boolean')throw Error('rights unavailable');return r;}
 function slotCheck(slot){if(![1,2,3].includes(slot))throw Error('invalid slot');}
 function world(db,account,slot){slotCheck(slot);const r=db.prepare('SELECT * FROM authority_worlds WHERE account=? AND slot=?').get(account,slot);if(!r)throw Error('canonical world absent');return {...r,state:JSON.parse(r.state)};}
 function commitWorld(db,r,state){if(!n(r.revision+1))throw Error('world revision exhausted');const q=db.prepare('UPDATE authority_worlds SET state=?,revision=? WHERE account=? AND world=? AND revision=?').run(json(state),r.revision+1,r.account,r.world,r.revision);if(q.changes!==1)throw Error('canonical revision conflict');}
 function view(r){return {world:r.world,revision:r.revision,game:JSON.parse(json(sync(engine.view(r.state)),262144))};}
 function publicWallet(s){return {tickets:s.tickets,points:s.points,claimCount:s.claimCount,owned:Object.keys(s.owned).filter(k=>s.owned[k]===true),nextAt:s.claimCount>=3?s.lastClaim+rules.HOUR:null};}
 function actionKey(r,a){
  if(!a||!routes.has(a.route)||!n(a.year)||a.year<2027||!id(a.eventKey)||typeof a.label!=='string'||a.label.length>160)throw Error('invalid canonical action');
  // Lottery once per season, manager once per manager/season, medical once
  // per injury irrespective of which medical UI or year-crossing view was used.
  const key=a.route==='lottery'?String(a.year):a.route==='medical'?a.eventKey:a.year+':'+a.eventKey;
  return digest([r.world,a.route,key]);
 }
 function actions(r){
  const list=sync(engine.actions(r.state));if(!Array.isArray(list)||list.length>5000)throw Error('invalid canonical actions');
  const m=new Map();for(const a of list){const key=actionKey(r,a);if(m.has(key))throw Error('duplicate canonical action');m.set(key,JSON.parse(json(a,16384)));}return m;
 }
 function lookup(db,account,operation){return db.prepare('SELECT * FROM authority_actions WHERE account=? AND operation=?').get(account,operation);}
 function checkOperation(operation){if(typeof operation!=='string'||! /^[a-f0-9]{64}$/.test(operation))throw Error('invalid canonical operation');}
 function options(db,r,s){
  const items=[];for(const [operation,a] of actions(r)){const o=Object.hasOwn(s.orders,operation)?s.orders[operation]:null;if(o?.status==='committed')continue;items.push({operationId:operation,route:a.route,label:a.label,year:a.year,status:o?.status??'available'});}
  return items;
 }
 async function create(token,slot,command){
  const account=await identity(token);slotCheck(slot);
  // The engine validates the setup command and generates seed server-side.
  // No client-supplied state or seed can be installed.
  return ledger.transact(account,(s,db)=>{
   if(db.prepare('SELECT 1 FROM authority_worlds WHERE account=? AND slot=?').get(account,slot))throw Error('canonical slot exists');
   const state=sync(engine.newWorld(JSON.parse(json(command,4096)),{account,worldId:randomUUID()}));
   const worldId=randomUUID();db.prepare('INSERT INTO authority_worlds VALUES(?,?,?,?,?)').run(account,slot,worldId,1,json(state));
   return view({world:worldId,revision:1,state});
  });
 }
 async function read(token,slot){const account=await identity(token);return ledger.transact(account,(s,db)=>{const r=world(db,account,slot);return {...view(r),actions:options(db,r,s),wallet:publicWallet(s)};});}
 async function advance(token,slot,expectedRevision,command){
  const account=await identity(token);if(!n(expectedRevision))throw Error('invalid revision');
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot);if(r.revision!==expectedRevision)throw Error('world revision conflict');
   // No advancement while an unresolved reward exists in this world. Recovery
   // or explicit cancel is required; lost connection is not a cancel.
   const pending=db.prepare('SELECT operation FROM authority_actions WHERE account=? AND world=? AND result IS NULL').all(account,r.world);
   if(pending.some(x=>s.orders[x.operation]?.status==='pending'))throw Error('reward reconciliation required');
   const next=sync(engine.advance(r.state,JSON.parse(json(command,4096))));commitWorld(db,r,next);
   return view({...r,state:next,revision:r.revision+1});
  });
 }
 async function reserve(token,slot,operation,choice){
  const account=await identity(token);checkOperation(operation);if(!['ad','ticket'].includes(choice))throw Error('invalid mode');
  const entitlements=await rights(account);
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot),previous=lookup(db,account,operation),o=s.orders[operation];
   if(previous&&previous.world!==r.world)throw Error('world mismatch');
   if(previous&&o&&o.status!=='cancelled')return {operationId:operation,...o,replay:true,wallet:publicWallet(s)};
   const a=actions(r).get(operation);if(!a)throw Error('action no longer eligible');
   const reserved=rules.reserve(s,operation,entitlements,choice);
   if(reserved.status==='pending'){
    const other=db.prepare('SELECT operation FROM authority_actions WHERE account=? AND world=? AND result IS NULL').all(account,r.world);
    if(other.some(x=>x.operation!==operation&&s.orders[x.operation]?.status==='pending'))throw Error('another action pending');
    if(previous)db.prepare('UPDATE authority_actions SET descriptor=?,attempt=? WHERE account=? AND operation=?').run(json(a,16384),reserved.attempt,account,operation);
    else db.prepare('INSERT INTO authority_actions VALUES(?,?,?,?,?,NULL,?)').run(account,operation,r.world,a.route,json(a,16384),reserved.attempt);
   }
   return {operationId:operation,...reserved,wallet:publicWallet(s)};
  });
 }
 async function settle(token,slot,operation,attempt){
  const account=await identity(token);checkOperation(operation);if(!n(attempt)||attempt<1)throw Error('invalid attempt');
  const entitlements=await rights(account);
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot),row=lookup(db,account,operation),o=s.orders[operation];
   if(!row||row.world!==r.world||!o||o.attempt!==attempt||row.attempt!==attempt)throw Error('order mismatch');
   if(o.status==='committed'&&row.result)return {status:'committed',replay:true,result:JSON.parse(row.result),revision:r.revision,wallet:publicWallet(s)};
   if(o.status!=='pending')return {status:o.status,wallet:publicWallet(s)};
   if(o.mode==='ad'&&hasAdProof({account,operationId:operation,attempt})!==true)return {status:'awaiting_proof'};
   if(o.mode==='entitlement'&&!(entitlements.vip||entitlements.adSkip))return {status:'entitlement_expired'};
   const a=actions(r).get(operation);if(!a)return {status:'reconcile_required'};
   const next=sync(engine.applyAction(r.state,a));
   if(!next||typeof next!=='object'||!Object.hasOwn(next,'state')||!Object.hasOwn(next,'result'))throw Error('engine action not applied');
   const result=json(next.result,16384);
   if(!rules.finish(s,operation,attempt,true))throw Error('settlement invariant');
   commitWorld(db,r,next.state);
   const q=db.prepare('UPDATE authority_actions SET result=? WHERE account=? AND operation=? AND result IS NULL AND attempt=?').run(result,account,operation,attempt);if(q.changes!==1)throw Error('journal conflict');
   return {status:'committed',replay:false,result:JSON.parse(result),revision:r.revision+1,wallet:publicWallet(s)};
  });
 }
 async function cancel(token,slot,operation,attempt,confirmed){
  const account=await identity(token);checkOperation(operation);if(confirmed!==true||!n(attempt)||attempt<1)throw Error('explicit cancellation required');
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot),row=lookup(db,account,operation),o=s.orders[operation];
   if(!row||row.world!==r.world||!o||o.attempt!==attempt||row.attempt!==attempt)throw Error('order mismatch');
   if(o.status!=='pending')return {status:o.status,wallet:publicWallet(s)};
   if(o.mode==='ad'&&hasAdProof({account,operationId:operation,attempt})===true&&actions(r).has(operation))return {status:'settlement_required'};
   rules.finish(s,operation,attempt,false);return {status:'cancelled',wallet:publicWallet(s)};
  });
 }
 async function claim(token,slot,eventId,choice){
  const account=await identity(token);if(typeof eventId!=='string'||! /^[a-f0-9]{64}$/.test(eventId)||!['ticket','point'].includes(choice))throw Error('invalid achievement request');
  const entitlements=await rights(account);
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot),events=sync(engine.achievements(r.state));if(!Array.isArray(events)||events.length>50000)throw Error('invalid canonical achievements');
   const match=events.find(e=>e?.eligible===true&&id(e.key)&&digest([r.world,e.key])===eventId);
   if(!match)throw Error('achievement not verified');
   return {result:rules.claim(s,{eventId,now:now(),entitlements,choice}),wallet:publicWallet(s)};
  });
 }
 async function achievements(token,slot){const account=await identity(token);return ledger.transact(account,(s,db)=>{
  const r=world(db,account,slot),events=sync(engine.achievements(r.state));if(!Array.isArray(events)||events.length>50000)throw Error('invalid canonical achievements');
  return events.filter(e=>e?.eligible===true&&id(e.key)&&typeof e.label==='string'&&e.label.length<=160).map(e=>{const eventId=digest([r.world,e.key]);return {eventId,label:e.label,claimed:Object.hasOwn(s.claims,eventId)};});
 });}
 return {create,read,advance,reserve,settle,cancel,claim,achievements};
}
module.exports={installAuthorityTables,createGameAuthority};
