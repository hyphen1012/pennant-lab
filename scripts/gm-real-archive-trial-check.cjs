'use strict';
// Actual game-generated archive. Do not edit standings or force a last-place finish.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),a=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {newGmTenure,continueOneSeason,declineContinuation}=require('../server/gm-tenure-trial.cjs'),{observeArchivedSeason,recordArchivedSeason}=require('../server/gm-archive-adapter-trial.cjs');
const hash=x=>createHash('sha256').update(x).digest('hex');
const seed=Number(process.argv[2]||1937);a.ok(Number.isSafeInteger(seed)&&seed>0);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pl-gm-archive-'));
try{
 const result=spawnSync(process.execPath,[path.join(__dirname,'canonical-century-projection-profile.cjs'),'generate','3',String(seed),dir],{stdio:'inherit'});a.equal(result.status,0,'real world generation');
 const raw=fs.readFileSync(path.join(dir,'world.json'),'utf8'),w=JSON.parse(raw),meta=JSON.parse(fs.readFileSync(path.join(dir,'world-meta.json'),'utf8'));a.equal(hash(raw),meta.sha256);a.equal(w.seasonArchive.length,3);
 const before=hash(JSON.stringify(w)),id=w.selectedId,league=w.teams.find(t=>t.id===id).league,years=w.seasonArchive.map(x=>x.year).sort((x,y)=>x-y);
 a.deepEqual(years,[2027,2028,2029]);a.equal(w.year,2030);
 const rows=years.map(year=>{const archive=w.seasonArchive.find(x=>x.year===year);a.equal(archive.myTeamId,id);const standing=archive.standings[league].find(x=>x.id===id);return {year,rank:standing.rank,wins:standing.wins,losses:standing.losses,ties:standing.ties};});
 for(const mode of ['fixed','offers']){
  let career=newGmTenure(id,mode),streak=0;
  a.throws(()=>observeArchivedSeason(w,career,2027),/policy/);
  for(const row of rows){
   const obs=observeArchivedSeason(w,career,row.year,'league-last');a.equal(obs.lastPlace,row.rank===6);a.equal(obs.completed,true);
   const prev=career;career=recordArchivedSeason(w,career,row.year,'league-last');streak=row.rank===6?streak+1:0;a.equal(career.lastPlaceStreak,streak);a.equal(career.lastCompletedYear,row.year);
   a.deepEqual(recordArchivedSeason(w,career,row.year,'league-last'),career);a.notEqual(prev,career);
   if(streak===3){a.equal(career.status,'decision');a.throws(()=>continueOneSeason(career,row.year,{verified:false}));a.equal(declineContinuation(career,row.year).status,'gameover');}
   else a.equal(career.status,'active');
  }
  a.throws(()=>observeArchivedSeason(w,career,2030,'league-last'));
  a.throws(()=>observeArchivedSeason(w,newGmTenure((id+1)%12,mode),2027,'league-last'));
 }
 a.equal(hash(JSON.stringify(w)),before,'actual archive must remain unchanged');
 console.log('PASS GM REAL ARCHIVE '+JSON.stringify({seed,teamId:id,league,rows,sha256:before,policy:'candidate league-last; not adopted'}));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
