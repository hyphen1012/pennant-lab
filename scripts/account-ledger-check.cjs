const a=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openLedger,createAccountService}=require('../server/account-ledger.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pennant-ledger-')),filename=path.join(dir,'account.sqlite');
let now=1000,vip=false,permanent=false,ledger=openLedger(filename);
const adapters={
 authenticate:async token=>['a','b'].includes(token)?{authenticated:true,account:token}:null,
 verifyEvent:async(account,proof)=>proof?.startsWith('event-')?{verified:true,account,eligible:true,id:proof}:null,
 verifyEntitlements:async account=>({verified:true,account,verifiedAt:now,entitlements:{adSkip:{active:permanent,expiresAt:null},vip:{active:vip,expiresAt:vip?now+3600000:null}}}),
 verifyAction:async(account,proof)=>proof?.startsWith('action-')?{verified:true,account,eligible:true,id:proof}:null,
 verifyCompletion:async(account,proof)=>proof?.id?.startsWith('action-')?{verified:true,account,id:proof.id,attempt:proof.attempt,mode:proof.mode,applied:proof.applied}:null,
 now:()=>now
}; // These fake adapters are test-only; no production endpoint or credentials.
(async()=>{
 let service=createAccountService({ledger,...adapters});
 await a.rejects(service.snapshot('invalid'));await a.rejects(service.claim('a','forged'));
 const [x,y]=await Promise.all([service.claim('a','event-1'),service.claim('a','event-1')]);
 a.equal([x,y].filter(v=>v.result.ok).length,1);a.equal((await service.snapshot('a')).tickets,1);
 a.equal((await service.claim('b','event-1')).result.ok,true);
 a.equal((await service.claim('a','event-2')).result.ok,true);
 permanent=true;a.equal((await service.claim('a','event-3')).result.kind,'point');
 a.equal((await service.claim('a','event-4')).result.reason,'cooldown');
 ledger.close();ledger=openLedger(filename);service=createAccountService({ledger,...adapters});
 a.equal((await service.snapshot('a')).claimCount,3);a.equal((await service.claim('a','event-1')).result.reason,'duplicate');
 now+=3600000;vip=true;a.equal((await service.claim('a','event-4')).result.amount,2);
 a.equal((await service.reserve('a','action-vip','ticket')).mode,'entitlement');
 await service.finish('a',{id:'action-vip',attempt:1,mode:'entitlement',applied:true});a.equal((await service.snapshot('a')).tickets,2);
 vip=false;permanent=false;
 a.equal((await service.reserve('a','action-1','ticket')).mode,'ticket');a.equal((await service.reserve('a','action-2','ticket')).mode,'ticket');a.equal((await service.reserve('a','action-3','ticket')).mode,'none');
 a.equal((await service.finish('a',{id:'action-1',attempt:1,mode:'ad',applied:true})).ok,false);
 await service.finish('a',{id:'action-1',attempt:1,mode:'ticket',applied:false});a.equal((await service.snapshot('a')).tickets,2);
 await service.finish('a',{id:'action-2',attempt:1,mode:'ticket',applied:true});await service.finish('a',{id:'action-2',attempt:1,mode:'ticket',applied:true});a.equal((await service.snapshot('a')).tickets,1);
 a.equal((await service.exchange('a','frame')).ok,true);a.equal((await service.snapshot('a')).points,0);
 a.equal((await service.snapshot('b')).tickets,1);
 a.equal((await service.reserve('a','action-1','ticket')).attempt,2);
 await service.finish('a',{id:'action-1',attempt:1,mode:'ticket',applied:true});
 a.equal((await service.snapshot('a')).tickets,1);
 ledger.close();ledger=openLedger(filename);service=createAccountService({ledger,...adapters});
 a.equal((await service.reserve('a','action-1','ticket')).attempt,2);
 a.equal((await service.finish('a',{id:'action-1',attempt:2,mode:'ticket',applied:true})).ok,true);
 a.equal((await service.snapshot('a')).tickets,0);
 a.equal((await service.reserve('a','action-1','ticket')).status,'committed');
 await a.rejects(service.finish('a',{id:'action-1',applied:true}));
 console.log('PASS durable account ledger: independent accounts, concurrent duplicate, restart, verified server time, ticket hold/release/commit, entitlement priority');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{ledger.close();fs.rmSync(dir,{recursive:true,force:true});});
