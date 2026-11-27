'use strict';
const a=require('node:assert/strict'),{createHeadlessEngine}=require('../server/headless-engine.cjs'),{decadeFixture}=require('./decade-fixture.cjs'),{newGmTenure}=require('../server/gm-tenure-trial.cjs'),{observeArchivedSeason,recordArchivedSeason}=require('../server/gm-archive-adapter-trial.cjs');
const world=decadeFixture(createHeadlessEngine().newWorld({team:0})),id=world.selectedId,league=world.teams.find(t=>t.id===id).league;
const swapLast=(w,year)=>{const rows=w.seasonArchive.find(s=>s.year===year).standings[league],own=rows.find(t=>t.id===id),last=rows.find(t=>t.rank===6);[own.rank,last.rank]=[last.rank,own.rank];};
for(const year of [2027,2028,2029])swapLast(world,year);
const before=JSON.stringify(world);
for(const mode of ['fixed','offers']){
 let c=newGmTenure(id,mode);
 a.throws(()=>observeArchivedSeason(world,c,2027),/policy/);a.throws(()=>observeArchivedSeason(world,c,2027,'all-12'),/policy/);
 for(const year of [2027,2028,2029]){c=recordArchivedSeason(world,c,year,'league-last');a.equal(c.lastPlaceStreak,year-2026);}
 a.equal(c.status,'decision');a.deepEqual(recordArchivedSeason(world,c,2029,'league-last'),c);
 a.throws(()=>recordArchivedSeason(world,c,2030,'league-last'));
 a.equal(observeArchivedSeason(world,newGmTenure(id,mode),2030,'league-last').lastPlace,false);
}
for(const mutate of [
 w=>w.seasonArchive.push(structuredClone(w.seasonArchive[0])),
 w=>w.seasonArchive[0].myTeamId=(id+1)%12,
 w=>w.seasonArchive[0].standings[league].pop(),
 w=>w.seasonArchive[0].standings[league][0].wins--,
 w=>w.seasonArchive[0].standings[league][0].rank=w.seasonArchive[0].standings[league][1].rank,
 w=>w.seasonArchive[0].standings[league][0].id=w.seasonArchive[0].standings[league][1].id,
 w=>w.year=2027
]){const clone=structuredClone(world);mutate(clone);a.throws(()=>observeArchivedSeason(clone,newGmTenure(id,'fixed'),2027,'league-last'));}
a.equal(JSON.stringify(world),before);
console.log('PASS GM archive trial: explicit candidate policy, complete own-club league archive, duplicate/gap protection, three-year transition, no world mutation; synthetic archive');
