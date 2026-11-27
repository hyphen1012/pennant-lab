'use strict';
// Staging-only offline rehearsal. No live backup, no public endpoint, no overwrite.
// Operator must externally stop/drain all writers; sidecar checks are not a lock.
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
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
 const db=new DatabaseSync(p,{readOnly:true});
 try{const rows=db.prepare('PRAGMA quick_check').all();if(rows.length!==1||Object.values(rows[0])[0]!=='ok')throw Error('SQLite integrity check failed');}finally{db.close();}
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
function backupOffline(o){
 confirm(o);const source=privateDir(o.source),before=inventory(source),dest=createDestination(source,o.destination);
 try{
  const files=FILES.map(n=>copyDb(source,dest,n));
  if(!same(before,inventory(source)))throw Error('source changed during backup');
  inventory(dest);
  const manifest={version:VERSION,files};
  const out=path.join(dest,MANIFEST);fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});syncFile(out);
  inventory(dest,true);return manifest;
 }catch(e){fs.rmSync(dest,{recursive:true,force:true});throw e;}
}
function readManifest(source){
 inventory(source,true);const file=path.join(source,MANIFEST),s=regular(file);
 if(s.size>65536n)throw Error('oversized manifest');
 const m=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!m||Object.keys(m).sort().join(',')!=='files,version'||m.version!==VERSION||!Array.isArray(m.files)||m.files.length!==FILES.length||!m.files.every((x,i)=>x&&Object.keys(x).sort().join(',')==='bytes,name,sha256'&&x.name===FILES[i]&&Number.isSafeInteger(x.bytes)&&x.bytes>0&&typeof x.sha256==='string'&&/^[a-f0-9]{64}$/.test(x.sha256)))throw Error('invalid backup manifest');
 return m;
}
function restoreOffline(o){
 confirm(o);const source=privateDir(o.source),before=inventory(source,true),m=readManifest(source);
 for(const {name,bytes,sha256} of m.files)if(!same({bytes,sha256},digest(path.join(source,name))))throw Error('backup hash mismatch');
 const dest=createDestination(source,o.destination);
 try{
  const files=FILES.map(n=>copyDb(source,dest,n));
  if(!same(files,m.files)||!same(before,inventory(source,true))||!same(m,readManifest(source)))throw Error('backup changed during restore');
  inventory(dest);return {version:VERSION,files};
 }catch(e){fs.rmSync(dest,{recursive:true,force:true});throw e;}
}
module.exports={backupOffline,restoreOffline,FILES};
