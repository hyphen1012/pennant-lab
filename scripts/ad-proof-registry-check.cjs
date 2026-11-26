const assert=require('node:assert/strict'),{openAdProofRegistry}=require('../server/ad-proof-registry.cjs');
let now=1000;const db=openAdProofRegistry(':memory:',{now:()=>now,ttlMs:1000});
try{
 const a={account:'a',operationId:'event',attempt:1,unit:'123',item:'ticket',amount:1},b={...a,account:'b'};
 const token=db.issue(a);assert.equal(db.issue(a),token);const other=db.issue(b);
 const proof={customData:token,transactionId:'tx1',unit:'123',item:'ticket',amount:1};
 assert.equal(db.hasProof(a),false);assert.throws(()=>db.recordVerified({...proof,amount:2}));
 assert.deepEqual(db.recordVerified(proof),{duplicate:false});assert.equal(db.hasProof(a),true);assert.equal(db.hasProof(b),false);
 assert.deepEqual(db.recordVerified(proof),{duplicate:true});assert.throws(()=>db.recordVerified({...proof,customData:other}));
 assert.throws(()=>db.recordVerified({...proof,transactionId:'tx2'}));now=2000;
 assert.throws(()=>db.recordVerified({...proof,customData:other,transactionId:'tx3'}));
 assert.equal(db.hasProof(b),false);console.log('ad proof registry checks passed');
}finally{db.close();}
