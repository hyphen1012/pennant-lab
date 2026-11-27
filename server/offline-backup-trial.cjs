'use strict';
// Staging-only offline rehearsal. No live backup, no public endpoint, no overwrite.
// Operator must externally stop/drain all writers; sidecar checks are not a lock.
const fs=require('node:fs'),path=require('node:path'),{createHash,createHmac,timingSafeEqual}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const FILES=Object.freeze(['account.sqlite','ad-proofs.sqlite','deletion.sqlite','purchases.sqlite','saves.sqlite']);
const MANIFEST='manifest.json',VERSION=1;
function privateDir(p){
 if(typeof p!=='string'||!path.isAbsolute(p))throw Error('absolute directory required');
 const st=fs.lstatSync(p);
 if(!st.isDirectory()||st.isSymbolicLink()||process.platform!=='win32'&&(st.mode&0o077))throw Error('private directory required');
 return fs.realpathSync(p);
}
function regular(p){
 const s=fs.lstatSync(p,{bigint:true});
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n)throw Error('regular unlinked database file required');
 return s;
}
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
function inventory(dir,manifest=false){
 const names=fs.readdirSync(dir);
 for(const n of names)if(/\.sqlite(?:$|-)|-journal$|-wal$|-shm$/i.test(n)&&!FILES.includes(n))throw Error('unexpected database or live sidecar');
 if(manifest&&(names.length!==FILES.length+1||!names.includes(MANIFEST)))throw Error('unexpected backup inventory');
 return FILES.map(name=>({name,stamp:stamp(regular(path.join(dir,name)))}));
}
function digest(p){
 const st=regular(p),fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)),h=createHash('sha256'),b=Buffer.allocUnsafe(1024*1024);let bytes=0;
 try{for(;;){const n=fs.readSync(fd,b,0,b.length,null);if(!n)break;h.update(b.subarray(0,n));bytes+=n;}}finally{fs.closeSync(fd);}
 if(stamp(st)!==stamp(regular(p))||!Number.isSafeInteger(bytes)||BigInt(bytes)!==st.size)throw Error('file changed during verification');
 return {bytes,sha256:h.digest('hex')};
}
function checkDb(p){
 // This is the disposable destination copy only. A read-only WAL opener can
 // leave sidecars even when no writer exists. Open the copy read/write,
 // query only, close the last connection, then compare its bytes to source.
 const db=new DatabaseSync(p);
 try{db.exec('PRAGMA query_only=ON');const rows=db.prepare('PRAGMA quick_check').all();if(rows.length!==1||Object.values(rows[0])[0]!=='ok')throw Error('SQLite integrity check failed');}finally{db.close();}
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function createDestination(source,target){
 if(typeof target!=='string'||!path.isAbsolute(target))throw Error('absolute destination required');
 const p=path.join(fs.realpathSync(path.dirname(target)),path.basename(target));
 if(p===source||p.startsWith(source+path.sep)||source.startsWith(p+path.sep))throw Error('overlapping directories');
 fs.mkdirSync(p,{mode:0o700});return p;
}
function syncFile(p){const fd=fs.openSync(p,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function copyDb(source,dest,name){
 const from=path.join(source,name),to=path.join(dest,name);
 const before=digest(from);fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);fs.chmodSync(to,0o600);
 checkDb(to);const after=digest(to);
 if(!same(before,after)||!same(before,digest(from)))throw Error('database copy mismatch');
 syncFile(to);return {name,...after};
}
function confirm(o){if(o?.environment!=='staging'||o.confirmedOffline!==true)throw Error('explicit stopped staging service confirmation required');}
function authOptions(o){
 if(o.authentication===undefined)return null;
 const a=o.authentication;if(!a||!Buffer.isBuffer(a.key)||a.key.length!==32||typeof a.backupId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(a.backupId))throw Error('invalid backup authentication options');
 return a;
}
function signedBody(id,files){return {version:2,backupId:id,files:files.map(({name,bytes,sha256})=>({name,bytes,sha256}))};}
function mac(body,key){return createHmac('sha256',key).update('PENNANT-LAB-STAGING-BACKUP-v2\x00').update(JSON.stringify(body)).digest('hex');}
function manifestFor(files,auth){if(!auth)return {version:VERSION,files};const b=signedBody(auth.backupId,files);return {...b,mac:mac(b,auth.key)};}
function backupOffline(o){
 confirm(o);const auth=authOptions(o);const source=privateDir(o.source),before=inventory(source),dest=createDestination(source,o.destination);
 try{
  const files=FILES.map(n=>copyDb(source,dest,n));
  if(!same(before,inventory(source)))throw Error('source changed during backup');
  inventory(dest);
  const manifest=manifestFor(files,auth);
  const out=path.join(dest,MANIFEST);fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});syncFile(out);
  inventory(dest,true);return manifest;
 }catch(e){fs.rmSync(dest,{recursive:true,force:true});throw e;}
}
function readManifest(source,auth){
 inventory(source,true);const file=path.join(source,MANIFEST),s=regular(file);
 if(s.size>65536n)throw Error('oversized manifest');
 const m=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!m||Object.keys(m).sort().join(',')!==(auth?'backupId,files,mac,version':'files,version')||m.version!==(auth?2:VERSION)||!Array.isArray(m.files)||m.files.length!==FILES.length||!m.files.every((x,i)=>x&&Object.keys(x).sort().join(',')==='bytes,name,sha256'&&x.name===FILES[i]&&Number.isSafeInteger(x.bytes)&&x.bytes>0&&typeof x.sha256==='string'&&/^[a-f0-9]{64}$/.test(x.sha256)))throw Error('invalid backup manifest');
 if(auth){if(m.backupId!==auth.backupId||typeof m.mac!=='string'||! /^[a-f0-9]{64}$/.test(m.mac))throw Error('invalid authenticated backup manifest');const expected=mac(signedBody(m.backupId,m.files),auth.key);if(!timingSafeEqual(Buffer.from(m.mac,'hex'),Buffer.from(expected,'hex')))throw Error('backup authentication failed');}
 return m;
}
function restoreOffline(o){
 confirm(o);const auth=authOptions(o),source=privateDir(o.source),before=inventory(source,true),m=readManifest(source,auth);
 for(const {name,bytes,sha256} of m.files)if(!same({bytes,sha256},digest(path.join(source,name))))throw Error('backup hash mismatch');
 const dest=createDestination(source,o.destination);
 try{
  const files=FILES.map(n=>copyDb(source,dest,n));
  if(!same(files,m.files)||!same(before,inventory(source,true))||!same(m,readManifest(source,auth)))throw Error('backup changed during restore');
  inventory(dest);return manifestFor(files,auth);
 }catch(e){fs.rmSync(dest,{recursive:true,force:true});throw e;}
}
module.exports={backupOffline,restoreOffline,FILES};
