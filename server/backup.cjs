// Offline maintenance backup: stop writers first to obtain a coherent snapshot
// across the five SQLite databases. Backup target must be outside dataDir.
// Independently mounted/encrypted storage and an off-host copy are operational
// requirements; a path alone cannot prove physical independence.
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto'),{DatabaseSync,backup}=require('node:sqlite');
const NAMES=['account','saves','purchases','ad-proofs','deletion'].map(n=>n+'.sqlite');
const digest=async file=>{const h=createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');};
const nested=(a,b)=>{const r=path.relative(a,b);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
function integrity(file){const db=new DatabaseSync(file,{readOnly:true});try{const r=db.prepare('PRAGMA quick_check').all();if(r.length!==1||Object.values(r[0])[0]!=='ok')throw Error('database integrity failure');}finally{db.close();}}
async function createOfflineBackup({dataDir,backupDir,quiesced=false}={}){
 if(quiesced!==true||!path.isAbsolute(dataDir)||!path.isAbsolute(backupDir))throw Error('offline maintenance confirmation required');
 fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
 const src=fs.realpathSync(dataDir),dst=fs.realpathSync(backupDir);
 if(nested(src,dst)||nested(dst,src)||(process.platform!=='win32'&&(fs.statSync(dst).mode&0o077)!==0))throw Error('private independent backup target required');
 const name='pl-'+Date.now()+'-'+randomUUID(),tmp=path.join(dst,'.'+name),final=path.join(dst,name);fs.mkdirSync(tmp,{mode:0o700});
 try{
  const files=[];
  for(const n of NAMES){
   const input=path.join(src,n),out=path.join(tmp,n);
   if(!fs.lstatSync(input).isFile())throw Error('invalid source database');
   const db=new DatabaseSync(input,{readOnly:true});try{await backup(db,out);}finally{db.close();}
   fs.chmodSync(out,0o600);integrity(out);files.push({name:n,bytes:fs.statSync(out).size,sha256:await digest(out)});
  }
  const manifest={version:1,createdAt:Date.now(),files};fs.writeFileSync(path.join(tmp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  fs.renameSync(tmp,final);return final;
 }catch(e){fs.rmSync(tmp,{recursive:true,force:true});throw e;}
}
async function verifyBackup(dir){
 const raw=fs.readFileSync(path.join(dir,'manifest.json'));if(raw.length>16384)throw Error('invalid manifest');
 const m=JSON.parse(raw);if(m.version!==1||!Array.isArray(m.files)||m.files.length!==NAMES.length||new Set(m.files.map(x=>x.name)).size!==NAMES.length)throw Error('invalid backup manifest');
 for(const row of m.files){if(!NAMES.includes(row.name)||!Number.isSafeInteger(row.bytes)||row.bytes<1||!/^[a-f0-9]{64}$/.test(row.sha256||''))throw Error('invalid backup member');const f=path.join(dir,row.name),s=fs.lstatSync(f);if(!s.isFile()||s.size!==row.bytes||await digest(f)!==row.sha256)throw Error('backup hash mismatch');integrity(f);}
 return m;
}
async function restoreToNewDirectory({backupDir,targetDir}={}){
 if(!path.isAbsolute(backupDir)||!path.isAbsolute(targetDir)||fs.existsSync(targetDir))throw Error('restore requires new directory');
 const m=await verifyBackup(backupDir),parent=fs.realpathSync(path.dirname(targetDir)),target=path.join(parent,path.basename(targetDir)),tmp=target+'.tmp-'+randomUUID();
 fs.mkdirSync(tmp,{mode:0o700});
 try{for(const row of m.files){const dst=path.join(tmp,row.name);fs.copyFileSync(path.join(backupDir,row.name),dst,fs.constants.COPYFILE_EXCL);fs.chmodSync(dst,0o600);if(await digest(dst)!==row.sha256)throw Error('restore checksum mismatch');integrity(dst);}
 if(fs.existsSync(target))throw Error('restore target already exists');fs.renameSync(tmp,target);return target;
 }catch(e){fs.rmSync(tmp,{recursive:true,force:true});throw e;}
}
module.exports={createOfflineBackup,verifyBackup,restoreToNewDirectory};
