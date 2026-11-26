// Test-only full-engine world checkpoint, never a production import endpoint.
// Reserve-isolated simulation tests storage/lineage, NOT economy balance.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),a=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const {openLedger}=require('../server/account-ledger.cjs');
const {createCanonicalStateCodec}=require('../server/canonical-state-codec.cjs');
const {createHeadlessEngine}=require('../server/headless-engine.cjs');
const codec=createCanonicalStateCodec(),engine=createHeadlessEngine(),owner='a'.repeat(64),other='b'.repeat(64);
const digest=s=>createHash('sha256').update(s).digest('hex');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pl-real-world-')),reports=[];
fs.mkdirSync('test-results',{recursive:true});
process.env.SAVE_PROFILE='0';process.env.NO_RESERVE='0';
globalThis.__plSaveProfile=(saved,data)=>{
 const dir=path.join(root,String(data.year));fs.mkdirSync(dir);
 const file=path.join(dir,'account.sqlite'),backup=path.join(dir,'backup.sqlite'),world=randomUUID();
 const rawBytes=Buffer.byteLength(saved),expected=digest(saved);
 let ledger,report={year:data.year,rawBytes,players:data.players.length,seasonArchives:data.seasonArchive.length,sha256:expected};
 const timed=(key,fn)=>{const t=performance.now();try{return fn();}finally{report[key]=Math.round((performance.now()-t)*100)/100;}};
 try{
  const packed=timed('encodeMs',()=>codec.encode(JSON.parse(saved)));report.storedBytes=Buffer.byteLength(packed);
  const insert=(db,account,slot,id,revision,state)=>db.prepare('INSERT INTO authority_worlds VALUES(?,?,?,?,?)').run(account,slot,id,revision,state);
  ledger=openLedger(file);
  timed('writeMs',()=>ledger.transact(owner,(s,db)=>{insert(db,owner,1,world,1,packed);insert(db,owner,2,randomUUID(),1,codec.encode({sentinel:'slot2'}));}));
  ledger.transact(other,(s,db)=>insert(db,other,1,randomUUID(),1,codec.encode({sentinel:'other'})));
  a.throws(()=>ledger.transact(owner,(s,db)=>{db.prepare('UPDATE authority_worlds SET state=?,revision=2 WHERE account=? AND slot=1').run(codec.encode({broken:true}),owner);throw Error('fixture rollback');}),/fixture rollback/);
  ledger.close();ledger=null;
  report.dbBytes=fs.statSync(file).size;
  timed('closedBackupCopyMs',()=>fs.copyFileSync(file,backup));
  ledger=openLedger(backup);
  const restored=timed('restoreMs',()=>ledger.transact(owner,(s,db)=>{
   const row=db.prepare('SELECT * FROM authority_worlds WHERE account=? AND slot=1').get(owner);
   a.equal(row.world,world);a.equal(row.revision,1);
   a.equal(codec.decode(db.prepare('SELECT state FROM authority_worlds WHERE account=? AND slot=2').get(owner).state).sentinel,'slot2');
   return codec.decode(row.state);
  }));
  a.equal(digest(JSON.stringify(restored)),expected,'complete world digest must match');
  ledger.transact(other,(s,db)=>{a.equal(codec.decode(db.prepare('SELECT state FROM authority_worlds WHERE account=? AND slot=1').get(other).state).sentinel,'other');});
  const view=timed('headlessViewMs',()=>engine.view(restored));a.equal(view.year,data.year);a.equal(view.team.id,data.selectedId);
  const achievements=timed('achievementReadMs',()=>engine.achievements(restored));report.achievements=achievements.length;
  a.ok(achievements.length<=50000,'authority achievement bound');
  a.equal(new Set(achievements.map(x=>x.key)).size,achievements.length);
  report.rssBytes=process.memoryUsage().rss;report.passed=true;
  return report;
 }catch(err){report.passed=false;report.error=String(err);throw err;}
 finally{
  if(ledger)ledger.close();
  reports.push(report);fs.writeFileSync('test-results/canonical-real-world-profile.json',JSON.stringify(reports,null,2));console.log('CANONICAL WORLD CHECKPOINT',JSON.stringify(report));
  fs.rmSync(dir,{recursive:true,force:true});
 }
};
try{require('./long-run.cjs');a.ok(reports.length>0,'no real world checkpoint');}
finally{delete globalThis.__plSaveProfile;fs.rmSync(root,{recursive:true,force:true});}
