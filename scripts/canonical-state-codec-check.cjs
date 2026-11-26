const a=require('node:assert/strict'),{createCanonicalStateCodec}=require('../server/canonical-state-codec.cjs'),{createGameAuthority}=require('../server/game-authority.cjs'),{openLedger}=require('../server/account-ledger.cjs');
(async()=>{
 const codec=createCanonicalStateCodec(),small={year:2027,history:[]};a.deepEqual(codec.decode(JSON.stringify(small)),small);a.deepEqual(codec.decode(codec.encode(small)),small);
 const large={year:2126,history:'record|'.repeat(5000000)};a.ok(Buffer.byteLength(JSON.stringify(large))>32*1024*1024);
 const packed=codec.encode(large);a.ok(packed.startsWith('pl-gzip-v1:'));a.equal(codec.decode(packed).history,large.history);
 const parts=packed.split(':');const bad=parts.slice();bad[2]='0'.repeat(64);a.throws(()=>codec.decode(bad.join(':')),/integrity/);
 const wrong=parts.slice();wrong[1]='1';a.throws(()=>codec.decode(wrong.join(':')));
 const bounded=createCanonicalStateCodec({rawLimit:100,zipLimit:100,smallLimit:1});a.throws(()=>bounded.encode({x:'x'.repeat(200)}));a.throws(()=>bounded.decode(packed));a.throws(()=>codec.decode('[]'));a.throws(()=>codec.encode(null));
 const ledger=openLedger(':memory:'),owner='a'.repeat(64),engine={newWorld:()=>({year:2027,history:'x'.repeat(400000)}),advance:s=>({...s,year:s.year+1}),view:s=>({year:s.year,size:s.history.length}),actions:()=>[],achievements:()=>[],applyAction:()=>{throw Error('no action');}};
 const svc=createGameAuthority({ledger,engine,authenticate:async()=>({authenticated:true,account:owner}),verifyRights:async()=>({verified:true,adSkip:false,vip:false}),hasAdProof:()=>false});
 try{
  const w=await svc.create('fixture',1,{});a.equal(w.game.size,400000);a.equal((await svc.advance('fixture',1,w.world,1,{})).game.year,2028);
  ledger.transact(owner,(s,db)=>{const row=db.prepare('SELECT state FROM authority_worlds WHERE account=? AND slot=1').get(owner);a.ok(row.state.startsWith('pl-gzip-v1:'));a.equal(codec.decode(row.state).year,2028);db.prepare('UPDATE authority_worlds SET state=? WHERE account=? AND slot=1').run(JSON.stringify({year:2030,history:'old'}),owner);});
  a.equal((await svc.read('fixture',1)).game.size,3);await svc.advance('fixture',1,w.world,2,{});
  a.equal((await svc.read('fixture',1)).game.year,2031);
 }finally{ledger.close();}
 console.log('PASS canonical legacy and compressed storage, >32MiB synthetic state, bounded decode, corruption rejection and transactional compatibility');
})().catch(e=>{console.error(e);process.exitCode=1;});
