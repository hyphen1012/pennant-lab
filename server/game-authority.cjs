// Staging-only canonical game authority boundary. The engine MUST run inside
// the trusted server process; no client-imported save is accepted as authority.
// Wallet reservation/settlement, canonical state and outcome journal share one
// SQLite transaction. Staging only; no production activation.
const {randomUUID,createHash}=require('node:crypto'),rules=require('../shared/monetization.cjs');
const {createCanonicalStateCodec}=require('./canonical-state-codec.cjs');
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,180}$/.test(x);
const owner=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const n=x=>Number.isSafeInteger(x)&&x>=0;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const routes=new Set(['draft-revival','foreign-revival','lottery','fa-retention','fa-sign','retirement','manager','medical']);
function installAuthorityTables(db){
 db.exec('CREATE TABLE IF NOT EXISTS authority_worlds(account TEXT NOT NULL,slot INTEGER NOT NULL,world TEXT UNIQUE NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(account,slot)); CREATE TABLE IF NOT EXISTS authority_actions(account TEXT NOT NULL,operation TEXT NOT NULL,world TEXT NOT NULL,route TEXT NOT NULL,descriptor TEXT NOT NULL,result TEXT,attempt INTEGER,PRIMARY KEY(account,operation)); CREATE INDEX IF NOT EXISTS authority_world_actions ON authority_actions(account,world);');
 if(!db.prepare('PRAGMA table_info(authority_worlds)').all().some(c=>c.name==='preview'))db.exec('ALTER TABLE authority_worlds ADD COLUMN preview TEXT');
}
// Nullable migration: older worlds remain occupied but have no preview until
// a successful canonical write. Never decompress them merely to list slots.
function createGameAuthority({ledger,engine,authenticate,verifyRights,hasAdProof,now=Date.now}={}){
 if(!ledger?.transact||[engine?.newWorld,engine?.actions,engine?.achievements,engine?.applyAction,engine?.advance,engine?.view,authenticate,verifyRights,hasAdProof].some(x=>typeof x!=='function'))throw Error('trusted canonical game engine required');
 const stateCodec=createCanonicalStateCodec();
 function sync(v){if(v&&typeof v.then==='function')throw Error('engine transaction must be synchronous');return v;}
 const json=(v,max=32*1024*1024)=>{const s=JSON.stringify(v);if(typeof s!=='string'||Buffer.byteLength(s)>max)throw Error('canonical state exceeds limit');return s;};
 async function identity(token){const a=await authenticate(token);if(a?.authenticated!==true||!owner(a.account))throw Error('unauthorized');return a.account;}
 async function rights(account){const r=await verifyRights(account);if(r?.verified!==true||typeof r.vip!=='boolean'||typeof r.adSkip!=='boolean')throw Error('rights unavailable');return r;}
 function slotCheck(slot){if(![1,2,3].includes(slot))throw Error('invalid slot');}
 // Select metadata first. Stale revisions and order observations must not
 // allocate or decompress a century of history. Load at most once per request.
 function world(db,account,slot){
  slotCheck(slot);const r=db.prepare('SELECT account,slot,world,revision FROM authority_worlds WHERE account=? AND slot=?').get(account,slot);if(!r)throw Error('canonical world absent');
  let loaded=false,state;
  Object.defineProperty(r,'state',{enumerable:false,get(){if(!loaded){const row=db.prepare('SELECT state FROM authority_worlds WHERE account=? AND slot=? AND world=? AND revision=?').get(account,slot,r.world,r.revision);if(!row)throw Error('canonical revision conflict');state=stateCodec.decode(row.state);loaded=true;}return state;}});
  return r;
 }
 const inspect=(account,fn)=>typeof ledger.inspect==='function'?ledger.inspect(account,fn):ledger.transact(account,fn);
 function previewFor(state){return typeof engine.preview==='function'?json(sync(engine.preview(state)),4096):null;}
 async function slots(token){const account=await identity(token);return inspect(account,(s,db)=>db.prepare('SELECT slot,world,revision,preview FROM authority_worlds WHERE account=? ORDER BY slot').all(account).map(({preview,...row})=>preview===null?row:{...row,preview:JSON.parse(preview)}));}
 function commitWorld(db,r,state){if(!n(r.revision+1))throw Error('world revision exhausted');const q=db.prepare('UPDATE authority_worlds SET state=?,revision=?,preview=? WHERE account=? AND world=? AND revision=?').run(stateCodec.encode(state),r.revision+1,previewFor(state),r.account,r.world,r.revision);if(q.changes!==1)throw Error('canonical revision conflict');}
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
   const worldId=randomUUID(),state=sync(engine.newWorld(JSON.parse(json(command,4096)),{account,worldId}));
   db.prepare('INSERT INTO authority_worlds(account,slot,world,revision,state,preview) VALUES(?,?,?,?,?,?)').run(account,slot,worldId,1,stateCodec.encode(state),previewFor(state));
   return view({world:worldId,revision:1,state});
  });
 }
 // Delete only the world explicitly observed by the user. Keep the account-level
 // wallet, claims and settlement journal, including old operation identities.
 async function deleteWorld(token,slot,expectedWorld,expectedRevision,confirmed){
  const account=await identity(token);slotCheck(slot);
  if(confirmed!==true||typeof expectedWorld!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(expectedWorld)||!n(expectedRevision)||expectedRevision<1)throw Error('explicit world deletion required');
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot);
   if(r.world!==expectedWorld||r.revision!==expectedRevision)throw Error('world revision conflict');
   const pending=db.prepare('SELECT operation FROM authority_actions WHERE account=? AND world=? AND result IS NULL').all(account,r.world);
   if(pending.some(x=>s.orders[x.operation]?.status==='pending'))throw Error('reward reconciliation required');
   const q=db.prepare('DELETE FROM authority_worlds WHERE account=? AND slot=? AND world=? AND revision=?').run(account,slot,r.world,r.revision);
   if(q.changes!==1)throw Error('canonical revision conflict');
   return {deleted:true,slot,world:r.world,revision:r.revision};
  });
 }
 async function read(token,slot){const account=await identity(token);return inspect(account,(s,db)=>{const r=world(db,account,slot);return {...view(r),actions:options(db,r,s),pending:db.prepare('SELECT operation,attempt FROM authority_actions WHERE account=? AND world=? AND result IS NULL').all(account,r.world).filter(x=>s.orders[x.operation]?.status==='pending').map(x=>({operationId:x.operation,attempt:x.attempt,mode:s.orders[x.operation].mode})),wallet:publicWallet(s)};});}
 // Recover from a lost reserve/settle response without consulting the store
 // or reapplying a game effect. A pending order may no longer be in actions().
 async function freePage(token,slot,worldId,revision,command){
  const account=await identity(token);
  if(typeof worldId!=='string'||!n(revision)||revision<1||typeof engine.freePage!=='function')throw Error('invalid free page request');
  return inspect(account,(s,db)=>{
   const r=world(db,account,slot);
   if(r.world!==worldId||r.revision!==revision)throw Error('canonical revision conflict');
   return {world:r.world,revision:r.revision,page:JSON.parse(json(sync(engine.freePage(r.state,JSON.parse(json(command,4096)))),65536))};
  });
 }
 async function playerPage(token,slot,worldId,revision,command){
  const account=await identity(token);
  if(typeof worldId!=='string'||!n(revision)||revision<1||typeof engine.playerPage!=='function')throw Error('invalid player page request');
  return inspect(account,(s,db)=>{
   const r=world(db,account,slot);
   if(r.world!==worldId||r.revision!==revision)throw Error('canonical revision conflict');
   return {world:r.world,revision:r.revision,page:JSON.parse(json(sync(engine.playerPage(r.state,JSON.parse(json(command,4096)))),262144))};
  });
 }
 async function orderStatus(token,slot,operation){
  const account=await identity(token);checkOperation(operation);
  return inspect(account,(s,db)=>{
   const r=world(db,account,slot),row=lookup(db,account,operation),o=s.orders[operation];
   if(!row||row.world!==r.world||!o)return {world:r.world,revision:r.revision,order:null,wallet:publicWallet(s)};
   if(row.attempt!==o.attempt||(o.status==='committed')!==(row.result!==null))throw Error('canonical journal mismatch');
   return {world:r.world,revision:r.revision,order:{operationId:operation,attempt:o.attempt,mode:o.mode,status:o.status,result:row.result===null?null:JSON.parse(row.result)},wallet:publicWallet(s)};
  });
 }
 async function advance(token,slot,expectedWorld,expectedRevision,command){
  const account=await identity(token);if(typeof expectedWorld!=='string'||!n(expectedRevision))throw Error('invalid world or revision');
  const entitlements=await rights(account);
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot);if(r.world!==expectedWorld||r.revision!==expectedRevision)throw Error('world revision conflict');
   // No advancement while an unresolved reward exists in this world. Recovery
   // or explicit cancel is required; lost connection is not a cancel.
   const pending=db.prepare('SELECT operation FROM authority_actions WHERE account=? AND world=? AND result IS NULL').all(account,r.world);
   if(pending.some(x=>s.orders[x.operation]?.status==='pending'))throw Error('reward reconciliation required');
   const next=sync(engine.advance(r.state,JSON.parse(json(command,command?.club==='memo'?16384:4096)),entitlements));commitWorld(db,r,next);
   return view({...r,state:next,revision:r.revision+1});
  });
 }
 async function reserve(token,slot,operation,choice){
  const account=await identity(token);checkOperation(operation);if(!['ad','ticket'].includes(choice))throw Error('invalid mode');
  const entitlements=await rights(account);
  return ledger.transact(account,(s,db)=>{
   const r=world(db,account,slot),previous=lookup(db,account,operation),o=s.orders[operation];
   if(previous&&previous.world!==r.world)throw Error('world mismatch');
   if(o&&!previous)throw Error('operation already owned by another settlement path');
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
 async function tradePage(token,slot,worldId,revision,command){
  const account=await identity(token);if(typeof worldId!=='string'||!n(revision)||revision<1||typeof engine.tradePage!=='function')throw Error('invalid trade page');
  return inspect(account,(s,db)=>{const r=world(db,account,slot);if(r.world!==worldId||r.revision!==revision)throw Error('canonical revision conflict');return {world:r.world,revision:r.revision,page:JSON.parse(json(sync(engine.tradePage(r.state,JSON.parse(json(command,4096)))),65536))};});
 }
 async function reportPage(token,slot,worldId,revision,command){
  const account=await identity(token);if(typeof worldId!=='string'||!n(revision)||revision<1||typeof engine.reportPage!=='function')throw Error('invalid report page');
  return inspect(account,(s,db)=>{const r=world(db,account,slot);if(r.world!==worldId||r.revision!==revision)throw Error('canonical revision conflict');
  return {world:r.world,revision:r.revision,page:JSON.parse(json(sync(engine.reportPage(r.state,JSON.parse(json(command,4096)))),262144))};});
 }
 function publicAchievement(r,s,e){
  const eventId=digest([r.world,e.key]),out={eventId,label:e.label,claimed:Object.hasOwn(s.claims,eventId)};
  if(Number.isSafeInteger(e.art?.year)&&e.art.year>=2027&&e.art.year<=999999&&['win','facility','championship','league-championship','award','retirement','farewell','club-record','anniversary','record'].includes(e.art.kind))out.art={year:e.art.year,kind:e.art.kind};
  return out;
 }
 async function achievementPage(token,slot,worldId,revision,command){
  const account=await identity(token);
  if(typeof worldId!=='string'||!n(revision)||revision<1||!command||Object.keys(command).length!==2||!n(command.offset)||!n(command.limit)||command.limit<1||command.limit>40)throw Error('invalid achievement page');
  return inspect(account,(s,db)=>{
   const r=world(db,account,slot);if(r.world!==worldId||r.revision!==revision)throw Error('canonical revision conflict');
   const events=sync(engine.achievements(r.state));if(!Array.isArray(events)||events.length>50000)throw Error('invalid canonical achievements');
   const list=events.filter(e=>e?.eligible===true&&id(e.key)&&typeof e.label==='string'&&e.label.length<=160);
   if(command.offset>list.length)throw Error('achievement offset out of range');
   const items=list.slice(command.offset,command.offset+command.limit).map(e=>publicAchievement(r,s,e));
   const end=command.offset+items.length;return {world:r.world,revision:r.revision,page:{offset:command.offset,total:list.length,nextOffset:end<list.length?end:null,items}};
  });
 }
 async function achievements(token,slot){const account=await identity(token);return inspect(account,(s,db)=>{
  const r=world(db,account,slot),events=sync(engine.achievements(r.state));if(!Array.isArray(events)||events.length>50000)throw Error('invalid canonical achievements');
  return events.filter(e=>e?.eligible===true&&id(e.key)&&typeof e.label==='string'&&e.label.length<=160).map(e=>publicAchievement(r,s,e));
 });}
 return {create,deleteWorld,read,advance,reserve,settle,cancel,claim,achievements,orderStatus,slots,freePage,playerPage,achievementPage,reportPage,tradePage};
}
module.exports={installAuthorityTables,createGameAuthority};
