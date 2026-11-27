'use strict';
// Offline staging rehearsal only. Caller must stop/drain all writers and
// supply an external key and independently trusted backup generation ID.
// Temporary plaintext requires a trusted private scratch filesystem.
const fs=require('node:fs'),path=require('node:path');
const {randomBytes,hkdfSync,createCipheriv,createDecipheriv,createHash}=require('node:crypto');
const {backupOffline,restoreOffline,FILES}=require('./offline-backup-trial.cjs');
const names=[...FILES,'manifest.json'],magic=Buffer.from('PLBK3'),headerSize=5+12,tagSize=16;
const chunkSize=1024*1024,limit=64*1024**3; // GCM per-message bound is below 64 GiB.
function privateDir(p){
 if(typeof p!=='string'||!path.isAbsolute(p))throw Error('absolute directory required');
 const st=fs.lstatSync(p);
 if(!st.isDirectory()||st.isSymbolicLink()||process.platform!=='win32'&&(st.mode&0o077))throw Error('private directory required');
 return fs.realpathSync(p);
}
function overlaps(a,b){return a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep);}
function config(o){
 if(o?.environment!=='staging'||o.confirmedOffline!==true)throw Error('explicit stopped staging service confirmation required');
 if(!Buffer.isBuffer(o.key)||o.key.length!==32||typeof o.backupId!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(o.backupId))throw Error('invalid encryption options');
 const source=privateDir(o.source);
 if(typeof o.destination!=='string'||!path.isAbsolute(o.destination))throw Error('absolute destination required');
 const parent=privateDir(path.dirname(o.destination)),destination=path.join(parent,path.basename(o.destination));
 if(path.basename(destination).startsWith('.pl-publish-'))throw Error('reserved publication name');
 if(overlaps(source,destination)||overlaps(source,parent)&&source===parent)throw Error('overlapping directories');
 try{fs.lstatSync(destination);throw Error('destination already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 // The caller must designate an independently trusted private scratch root.
 const scratchRoot=privateDir(o.scratchRoot);
 if(overlaps(source,scratchRoot)||overlaps(destination,scratchRoot)||scratchRoot===parent)throw Error('scratch root must be separate from backup and restore locations');
 return {source,parent,destination,scratchRoot,backupId:o.backupId,key:o.key};
}
function derive(c,label){return Buffer.from(hkdfSync('sha256',c.key,Buffer.from(c.backupId),Buffer.from('PENNANT-LAB-STAGING-BACKUP-v3:'+label),32));}
function aad(c,name){return Buffer.from('PENNANT-LAB-STAGING-BACKUP-v3\0'+c.backupId+'\0'+name);}
function stamp(s){return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');}
function readRegular(p){
 const st=fs.lstatSync(p,{bigint:true});
 if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1n)throw Error('regular unlinked file required');
 const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{const actual=fs.fstatSync(fd,{bigint:true});if(stamp(st)!==stamp(actual))throw Error('file changed during open');return {fd,st};}
 catch(e){fs.closeSync(fd);throw e;}
}
function readExact(fd,size,offset){
 const b=Buffer.alloc(size);let n=0;while(n<size){const k=fs.readSync(fd,b,n,size-n,offset+n);if(!k)throw Error('truncated backup');n+=k;}return b;
}
function writeAll(fd,b){for(let n=0;n<b.length;){const k=fs.writeSync(fd,b,n,b.length-n);if(!k)throw Error('short write');n+=k;}}
function transform(c,key,name,source,target,decrypt){
 const from=readRegular(source);let out;
 try{
  const size=Number(from.st.size),max=name==='manifest.json'?65536:limit-64;
  if(!Number.isSafeInteger(size)||size<1||size>max+(decrypt?headerSize+tagSize:0))throw Error('invalid backup file size');
  let start=0,end=size,crypt;
  if(decrypt){
   if(size<=headerSize+tagSize)throw Error('truncated encrypted backup');
   const header=readExact(from.fd,headerSize,0);
   if(!header.subarray(0,5).equals(magic))throw Error('invalid encrypted backup format');
   crypt=createDecipheriv('aes-256-gcm',key,header.subarray(5),{authTagLength:16});
   crypt.setAuthTag(readExact(from.fd,tagSize,size-tagSize));start=headerSize;end=size-tagSize;
  }else{
   const nonce=randomBytes(12);crypt=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:16});
   out=fs.openSync(target,'wx',0o600);writeAll(out,Buffer.concat([magic,nonce]));
  }
  crypt.setAAD(aad(c,name));
  if(decrypt)out=fs.openSync(target,'wx',0o600);
  for(let i=start;i<end;){const n=Math.min(chunkSize,end-i),b=readExact(from.fd,n,i);writeAll(out,crypt.update(b));i+=n;}
  // Authentication is checked before any decrypted file leaves scratch.
  writeAll(out,crypt.final());if(!decrypt)writeAll(out,crypt.getAuthTag());
  if(stamp(from.st)!==stamp(fs.fstatSync(from.fd,{bigint:true}))||stamp(from.st)!==stamp(fs.lstatSync(source,{bigint:true})))throw Error('backup source changed');
  fs.fsyncSync(out);
 }finally{if(out!==undefined)fs.closeSync(out);fs.closeSync(from.fd);}
}
function exactEncrypted(dir){
 const a=fs.readdirSync(dir).sort(),b=names.map(n=>n+'.enc').sort();
 if(a.length!==b.length||a.some((n,i)=>n!==b[i]))throw Error('invalid encrypted inventory');
}
// Metadata flush is supported on POSIX filesystems; a successful flush is
// not a guarantee against power loss, filesystem or storage-controller faults.
function syncDirectory(p){if(process.platform==='win32')return;const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_DIRECTORY||0));try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
// Per-destination cooperative lock. The trusted parent must not be modified
// by uncooperative writers. An orphan lock requires offline operator review.
function absent(p){try{fs.lstatSync(p);throw Error('destination already exists');}catch(e){if(e.code!=='ENOENT')throw e;}}
function run(o,decrypt){
 const c=config(o),encryption=derive(c,'encryption'),authKey=derive(c,'manifest');
 const lock=path.join(c.parent,'.pl-publish-lock-'+createHash('sha256').update(c.destination).digest('hex'));
 let scratch,stage,locked=false,published=false;
 const opts={environment:'staging',confirmedOffline:true,authentication:{key:authKey,backupId:c.backupId}};
 try{
  fs.mkdirSync(lock,{mode:0o700});locked=true;
  syncDirectory(c.parent);absent(c.destination);
  scratch=fs.mkdtempSync(path.join(c.scratchRoot,'.pl-backup-'));fs.chmodSync(scratch,0o700);
  // Same filesystem as the destination: publication is one directory rename.
  stage=fs.mkdtempSync(path.join(c.parent,'.pl-publish-stage-'));fs.chmodSync(stage,0o700);
  const candidate=path.join(stage,'complete'),plain=path.join(scratch,'plain');
  let result;
  if(decrypt){
   exactEncrypted(c.source);fs.mkdirSync(plain,{mode:0o700});
   for(const name of names)transform(c,encryption,name,path.join(c.source,name+'.enc'),path.join(plain,name),true);
   exactEncrypted(c.source);
   result=restoreOffline({...opts,source:plain,destination:candidate});
  }else{
   const manifest=backupOffline({...opts,source:c.source,destination:plain});
   fs.mkdirSync(candidate,{mode:0o700});
   for(const name of names)transform(c,encryption,name,path.join(plain,name),path.join(candidate,name+'.enc'),false);
   exactEncrypted(candidate);result={version:3,backupId:c.backupId,files:manifest.files.length};
  }
  syncDirectory(candidate);syncDirectory(stage);
  absent(c.destination);
  fs.renameSync(candidate,c.destination);published=true;
  // Never remove a complete destination if a post-rename flush fails.
  syncDirectory(stage);syncDirectory(c.parent);
  return result;
 }catch(e){
  if(published)throw new Error('publication complete but durability confirmation failed; inspect destination offline',{cause:e});
  throw e;
 }finally{
  encryption.fill(0);authKey.fill(0);
  // Locks are only removed by the process that acquired them. Forced process
  // termination may leave private plaintext and a lock; do not auto-reclaim.
  try{if(scratch)fs.rmSync(scratch,{recursive:true,force:true});}
  finally{try{if(stage)fs.rmSync(stage,{recursive:true,force:true});}
  finally{if(locked){fs.rmdirSync(lock);syncDirectory(c.parent);}}}
 }
}
module.exports={encryptOffline:o=>run(o,false),decryptOffline:o=>run(o,true)};
