'use strict';
// Isolated adapter. No server route or saved-world mutation.
// Explicit candidate ranking rule required; the approved rule is still pending.
const {recordCompletedSeason}=require('./gm-tenure-trial.cjs');
function observeArchivedSeason(world,career,year,policy){
 if(policy!=='league-last')throw Error('GM rank policy not selected');
 if(!world||!career||!Number.isInteger(career.teamId)||career.teamId!==world.selectedId||!Number.isSafeInteger(year)||year<2027||!Number.isSafeInteger(world.year)||year>=world.year||!Array.isArray(world.seasonArchive))throw Error('completed own club archive required');
 const records=world.seasonArchive.filter(x=>x?.year===year);
 if(records.length!==1)throw Error('unique completed archive required');
 const row=records[0],clubs=world.teams;
 if(row.myTeamId!==career.teamId||!Array.isArray(clubs)||clubs.length!==12||new Set(clubs.map(t=>t.id)).size!==12||clubs.some(t=>!Number.isInteger(t.id)||t.id<0||t.id>11||!['E','W'].includes(t.league)))throw Error('archive club mismatch');
 for(const league of ['E','W']){
  const expected=clubs.filter(t=>t.league===league).map(t=>t.id).sort((a,b)=>a-b),rows=row.standings?.[league];
  if(expected.length!==6||!Array.isArray(rows)||rows.length!==6||new Set(rows.map(t=>t.rank)).size!==6||rows.some(t=>!Number.isInteger(t.rank)||t.rank<1||t.rank>6||!['wins','losses','ties'].every(k=>Number.isSafeInteger(t[k])&&t[k]>=0)||t.wins+t.losses+t.ties!==143)||rows.map(t=>t.id).sort((a,b)=>a-b).join(',')!==expected.join(','))throw Error('complete league standings required');
 }
 const ownLeague=clubs.find(t=>t.id===career.teamId).league,rank=row.standings[ownLeague].find(t=>t.id===career.teamId).rank;
 return {teamId:career.teamId,year,completed:true,lastPlace:rank===6};
}
function recordArchivedSeason(world,career,year,policy){
 return recordCompletedSeason(career,observeArchivedSeason(world,career,year,policy));
}
module.exports={observeArchivedSeason,recordArchivedSeason};
