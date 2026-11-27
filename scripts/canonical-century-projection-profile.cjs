'use strict';
// Separate processes for generation, synchronous reference, and worker measurement.
// Never upload the generated raw world; retain only measurement and hashes.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),a=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{performance}=require('node:perf_hooks'),{createHash}=require('node:crypto');
const hash=x=>createHash('sha256').update(x).digest('hex');
const mode=process.argv[2]||'run',years=Number(process.argv[3]||2),seed=Number(process.argv[4]||1937),root=process.argv[5];
a.ok(Number.isInteger(years)&&years>=1&&years<=100&&Number.isSafeInteger(seed));
if(mode==='generate'){
 process.env.SAVE_PROFILE='0';process.env.NO_RESERVE='0';
 process.argv=[process.argv[0],process.argv[1],String(years),String(seed)];
 globalThis.__plSaveProfile=(saved,data)=>{
  if(data.seasonArchive.length===years){
   fs.writeFileSync(path.join(root,'world.json'),saved);
   fs.writeFileSync(path.join(root,'world-meta.json'),JSON.stringify({years,year:data.year,bytes:Buffer.byteLength(saved),sha256:hash(saved),players:data.players.length,selectedId:data.selectedId}));
  }
  return {bytes:Buffer.byteLength(saved)};
 };
 try{require('./long-run.cjs');}finally{delete globalThis.__plSaveProfile;}
 a.ok(fs.existsSync(path.join(root,'world.json')));
}else if(mode==='encode'){
 const raw=fs.readFileSync(path.join(root,'world.json'),'utf8'),meta=JSON.parse(fs.readFileSync(path.join(root,'world-meta.json'),'utf8'));a.equal(hash(raw),meta.sha256);
 const stored=require('../server/canonical-state-codec.cjs').createCanonicalStateCodec().encode(JSON.parse(raw));fs.writeFileSync(path.join(root,'world.stored'),stored);
 fs.writeFileSync(path.join(root,'encode.json'),JSON.stringify({bytes:Buffer.byteLength(stored),sha256:hash(stored)}));
}else if(['http','http-direct'].includes(mode)){
 require('./canonical-century-http-recovery.cjs');
}else if(['sync','worker','worker-encoded','worker-direct'].includes(mode)){
 (async()=>{
  const file=path.join(root,'world.json'),meta=JSON.parse(fs.readFileSync(path.join(root,'world-meta.json'),'utf8'));
  const report={mode,years,seed,world:meta,passed:false};const output=path.join(root,mode+'.json');let timer;
  try{
   const started=performance.now();let state;
   if(['worker-encoded','worker-direct'].includes(mode)){state=fs.readFileSync(path.join(root,'world.stored'),'utf8');const stored=JSON.parse(fs.readFileSync(path.join(root,'encode.json'),'utf8'));a.equal(hash(state),stored.sha256);report.storedBytes=stored.bytes;}
   else{let raw=fs.readFileSync(file,'utf8');a.equal(hash(raw),meta.sha256);state=JSON.parse(raw);raw=null;a.equal(state.seasonArchive.length,years);}
   report.loadMs=performance.now()-started;
   const {createHeadlessEngine}=require('../server/headless-engine.cjs'),engine=createHeadlessEngine();
   report.sourceHash=engine.sourceHash;
   let ticks=0;timer=setInterval(()=>ticks++,20);
   const begin=performance.now();
   const p=mode==='sync'?engine.readProjection(state):await require('../server/projection-worker-trial.cjs').createProjectionWorkerTrial({directText:mode==='worker-direct'})[mode==='worker'?'project':'projectEncoded'](state);
   report.projectionMs=performance.now()-begin;clearInterval(timer);timer=null;
   report.intervalTicks=ticks;report.projectionSha256=hash(JSON.stringify(p));report.actions=p.actions.length;
   a.equal(p.game.year,meta.year);a.equal(p.game.team.id,meta.selectedId);
   if(mode!=='sync')a.ok(ticks>0,'worker must yield to event loop');
   report.passed=true;
  }catch(e){report.error=String(e);throw e;}
  finally{clearInterval(timer);report.rssBytes=process.memoryUsage().rss;report.maxRssKiB=process.resourceUsage().maxRSS;fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('CENTURY PROJECTION',JSON.stringify(report));}
 })().catch(e=>{console.error(e);process.exitCode=1;});
}else{
 a.equal(mode,'run');
 fs.mkdirSync('test-results',{recursive:true});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-century-worker-'));
 const output='test-results/century-worker-'+years+'.json',report={years,seed,passed:false,stages:{}};
 const stage=name=>{
  const r=spawnSync(process.execPath,[__filename,name,String(years),String(seed),dir],{stdio:'inherit'});
  report.stages[name]={status:r.status,signal:r.signal,error:r.error?String(r.error):null};
  const f=path.join(dir,name+'.json');if(fs.existsSync(f))report[name]=JSON.parse(fs.readFileSync(f,'utf8'));
  fs.writeFileSync(output,JSON.stringify(report,null,2));
  return r.status===0;
 };
 try{
  a.ok(stage('generate'),'world generation failed');
  a.ok(stage('encode'),'storage encoding failed');
  const syncOK=stage('sync'),workerOK=stage('worker'),encodedOK=stage('worker-encoded');a.ok(syncOK&&workerOK&&encodedOK,'projection stage failed');
  a.equal(report.sync.world.sha256,report.worker.world.sha256);a.equal(report.sync.sourceHash,report.worker.sourceHash);
  a.equal(report.sync.projectionSha256,report.worker.projectionSha256,'worker projection differs');
  a.equal(report.sync.sourceHash,report['worker-encoded'].sourceHash);a.equal(report.sync.projectionSha256,report['worker-encoded'].projectionSha256,'encoded worker projection differs');
  a.ok(stage('worker-direct'),'direct text projection failed');
  a.equal(report['worker-direct'].sourceHash,report.sync.sourceHash);a.equal(report['worker-direct'].projectionSha256,report.sync.projectionSha256,'direct text projection differs');
  report.directComparison={priorPeakKiB:report['worker-encoded'].maxRssKiB,directPeakKiB:report['worker-direct'].maxRssKiB,priorMs:report['worker-encoded'].projectionMs,directMs:report['worker-direct'].projectionMs};
  a.ok(stage('http'),'HTTP recovery stage failed');
  a.equal(report.http.projectionSha256,report.sync.projectionSha256);a.equal(report.http.sourceHash,report.sync.sourceHash);
  a.ok(stage('http-direct'),'direct HTTP recovery failed');
  a.equal(report['http-direct'].projectionSha256,report.sync.projectionSha256);a.equal(report['http-direct'].sourceHash,report.sync.sourceHash);
  report.passed=true;
 }finally{fs.writeFileSync(output,JSON.stringify(report,null,2));fs.rmSync(dir,{recursive:true,force:true});}
}
