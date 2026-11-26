const assert=require('node:assert/strict'),{gzipSync}=require('node:zlib');
const {decodeGzip,toGameRecord}=require('../mobile/src/save-gzip-codec.cjs');
const {createGameSaveValidator}=require('../server/save-game-codec.cjs');
(async()=>{
 const g={v:2,year:2027,day:0,selectedId:2,teams:Array.from({length:12},(_,id)=>({id,cash:20,name:'球団'+id})),players:[{id:1}],schedule:Array.from({length:143},()=>[])};
 const bytes=gzipSync(JSON.stringify(g)),validate=createGameSaveValidator();
 assert.deepEqual(await decodeGzip(bytes),g);assert.equal(await validate(bytes),true);
 const record=await toGameRecord(bytes);assert.equal(record.encoding,'pl-gzip-json-v1');assert.deepEqual(Buffer.from(await record.bytes.arrayBuffer()),bytes);
 assert.equal(await validate(gzipSync(JSON.stringify({...g,players:[{id:1},{id:1}]}))),false);
 await assert.rejects(decodeGzip(bytes,{maxBytes:64}));assert.equal(await createGameSaveValidator({maxBytes:64})(bytes),false);
 await assert.rejects(decodeGzip(bytes.subarray(0,bytes.length-5)));assert.equal(await validate(bytes.subarray(0,bytes.length-5)),false);
 console.log('gzip save format check passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
