'use strict';
const a=require('node:assert/strict'),{newGmTenure,recordCompletedSeason,declineContinuation,continueOneSeason,inspectTransfer}=require('../server/gm-tenure-trial.cjs');
for(const mode of ['fixed','offers']){
 let s=newGmTenure(3,mode);const record=(year,lastPlace)=>{const old=structuredClone(s);s=recordCompletedSeason(s,{teamId:3,year,lastPlace,completed:true});a.equal(old.teamId,3);return s;};
 a.throws(()=>recordCompletedSeason(s,{teamId:4,year:2027,lastPlace:true,completed:true}));a.throws(()=>recordCompletedSeason(s,{teamId:3,year:2027,lastPlace:true,completed:false}));
 a.equal(inspectTransfer(s,{verified:true,teamId:4}),mode==='offers');a.equal(inspectTransfer(s,{verified:false,teamId:4}),false);
 record(2027,true);record(2027,true);a.equal(s.lastPlaceStreak,1);record(2028,true);record(2029,false);a.equal(s.lastPlaceStreak,0);
 record(2030,true);record(2031,true);record(2032,true);a.equal(s.status,'decision');a.equal(s.pendingYear,2032);a.equal(inspectTransfer(s,{verified:true,teamId:4}),false);
 a.throws(()=>recordCompletedSeason(s,{teamId:3,year:2033,lastPlace:false,completed:true}));a.throws(()=>continueOneSeason(s,2032,{verified:false,route:'gm-continuation',year:2032,teamId:3}));a.throws(()=>continueOneSeason(s,2032,{verified:true,route:'bank',year:2032,teamId:3}));a.throws(()=>continueOneSeason(s,2032,{verified:true,route:'gm-continuation',year:2032,teamId:4}));
 const ended=declineContinuation(s,2032);a.equal(ended.status,'gameover');a.throws(()=>recordCompletedSeason(ended,{teamId:3,year:2033,lastPlace:true,completed:true}));
 // No cap on genuine one-year extensions; losing streak is not erased.
 for(let y=2032;y<2045;y++){s=continueOneSeason(s,y,{verified:true,route:'gm-continuation',year:y,teamId:3});a.throws(()=>continueOneSeason(s,y,{verified:true,route:'gm-continuation',year:y,teamId:3}));if(y<2044)record(y+1,true);}
 record(2045,false);a.equal(s.status,'active');a.equal(s.lastPlaceStreak,0);
}
console.log('PASS GM trial: both modes, completed-year idempotency, reset, decision hold, unlimited verified one-year continuation, decline gameover, transfer eligibility only');
