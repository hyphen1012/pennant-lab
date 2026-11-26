const assert=require('node:assert/strict');
const {openSaveTransfer,createSaveTransferService,digest}=require('../server/save-transfer.cjs');
const {createSaveHttp}=require('../server/save-http.cjs');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
async function main(){
 const dir=mkdtempSync(join(tmpdir(),'pl-save-http-')),file=join(dir,'save.sqlite');
 let storage=openSaveTransfer(file,{maxBytes:64,retainGenerations:2}),server;
 const service=createSaveTransferService({storage,authenticate:async token=>['a','b'].includes(token)?{authenticated:true,account:token}:null,validateSave:async p=>p[0]===83});
 try{
  server=createSaveHttp({service,maxBytes:64,allowRequest:async({token})=>token!=='blocked'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/v1/saves';
  const get=(path='',token='a')=>fetch(base+path,{headers:{Authorization:'Bearer '+token}});
  const put=(text,rev,extra={},token='a',slot=1)=>{const payload=Buffer.from(text);return fetch(base+'/'+slot,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream','X-Save-Revision':String(rev),'X-Save-SHA256':digest(payload),'X-Save-Confirmed':'true',...extra},body:payload});};
  assert.equal((await get('','invalid')).status,403);
  assert.equal((await get('','blocked')).status,429);
  assert.equal((await fetch(base)).status,401);
  assert.equal((await put('Save1',0,{'X-Save-Confirmed':'false'})).status,400);
  assert.equal((await put('Save1',0,{'X-Save-SHA256':'0'.repeat(64)})).status,400);
  assert.equal((await put('Invalid',0)).status,403);
  assert.equal((await put('S'.repeat(65),0)).status,413);
  assert.deepEqual(await (await put('Save1',0)).json(),{revision:1,sha:digest(Buffer.from('Save1')),unchanged:false});
  assert.equal((await put('Save2',0)).status,409);
  assert.equal((await put('Save2',1)).status,200);
  assert.equal((await put('Save2',2)).status,200);
  assert.equal((await put('Save3',2)).status,200);
  assert.equal((await put('Save4',3)).status,200);
  assert.equal((await get('/1/history/1')).status,404);
  assert.deepEqual((await (await get('/1/history')).json()).map(x=>x.revision),[3,2]);
  const old=await get('/1/history/2');
  assert.equal(old.status,200);assert.equal(old.headers.get('x-save-revision'),'2');
  assert.equal(old.headers.get('cache-control'),'no-store');assert.equal(await old.text(),'Save2');
  assert.equal((await get('/1','b')).status,404);
  assert.equal((await get('/1/history/2','b')).status,404);
  assert.deepEqual(await (await get('/1/history','b')).json(),[]);
  assert.equal((await put('SaveB',0,{},'b')).status,200);
  assert.equal((await put('Save2',4)).status,200); // restore creates a NEW revision
  assert.equal((await get('/1')).headers.get('x-save-revision'),'5');
  assert.equal(await (await get('/1/history/4')).text(),'Save4');
  assert.equal(await (await get('/1','b')).text(),'SaveB');
  assert.equal((await put('SaveOther',0,{},'a',2)).status,200);
  assert.equal(await (await get('/2')).text(),'SaveOther');
  const results=await Promise.all([put('Save6A',5),put('Save6B',5)]);
  assert.equal(results.filter(x=>x.status===200).length,1);
  assert.ok(results.every(x=>[200,409,503].includes(x.status)));
  for(const result of results)await result.text();
  await new Promise(resolve=>server.close(resolve));server=null;storage.close();
  storage=openSaveTransfer(file,{maxBytes:64,retainGenerations:2});
  assert.equal(storage.get('a',1).revision,6);assert.equal(storage.backup('a',1,5).payload.toString(),'Save2');
  assert.equal(storage.get('b',1).payload.toString(),'SaveB');
  console.log('authenticated binary save transport and generation recovery passed');
 }finally{if(server)await new Promise(resolve=>server.close(resolve));storage.close();rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
