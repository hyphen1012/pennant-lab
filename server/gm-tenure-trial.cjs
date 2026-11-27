'use strict';
// Domain trial only: no live route, no client-supplied eligibility, no ad activation.
// Ranking basis, transfer timing and offer generation remain explicit integration gates.
const validId=n=>Number.isInteger(n)&&n>=0&&n<12,validYear=n=>Number.isSafeInteger(n)&&n>=2027;
function newGmTenure(teamId,transferMode){
 if(!validId(teamId)||!['fixed','offers'].includes(transferMode))throw Error('invalid GM career setup');
 return {teamId,transferMode,lastCompletedYear:null,lastPlaceStreak:0,status:'active',pendingYear:null,continuedYear:null};
}
function checked(c){
 if(!c||!validId(c.teamId)||!['fixed','offers'].includes(c.transferMode)||!['active','decision','gameover'].includes(c.status)||!Number.isSafeInteger(c.lastPlaceStreak)||c.lastPlaceStreak<0||c.lastCompletedYear!==null&&!validYear(c.lastCompletedYear)||c.pendingYear!==null&&!validYear(c.pendingYear)||c.continuedYear!==null&&!validYear(c.continuedYear))throw Error('invalid GM career');
 if(c.status==='decision'?(c.pendingYear!==c.lastCompletedYear||c.lastPlaceStreak<3):c.pendingYear!==null)throw Error('invalid pending GM decision');
 return {...c};
}
// Called only from a future trusted completed-season archive adapter. The
// caller MUST resolve the not-yet-approved ranking basis before enabling it.
function recordCompletedSeason(c,observation){
 const next=checked(c),o=observation;
 if(!o||o.teamId!==next.teamId||!validYear(o.year)||o.completed!==true||typeof o.lastPlace!=='boolean')throw Error('verified completed season required');
 if(next.lastCompletedYear===o.year)return next; // retry never adds a second season
 if(next.status!=='active'||next.lastCompletedYear!==null&&o.year!==next.lastCompletedYear+1)throw Error('GM season not ready');
 next.lastCompletedYear=o.year;
 next.lastPlaceStreak=o.lastPlace?next.lastPlaceStreak+1:0;
 if(next.lastPlaceStreak>=3){next.status='decision';next.pendingYear=o.year;}
 return next;
}
function declineContinuation(c,year){
 const n=checked(c);if(n.status!=='decision'||n.pendingYear!==year)throw Error('GM continuation unavailable');
 n.status='gameover';n.pendingYear=null;return n;
}
// Trial adapter receives a server-verified proof bound to this decision;
// caller must atomically settle real SSV/order and world revision in future.
function continueOneSeason(c,year,proof){
 const n=checked(c);
 if(n.status!=='decision'||n.pendingYear!==year||n.continuedYear===year||proof?.verified!==true||proof.route!=='gm-continuation'||proof.year!==year||proof.teamId!==n.teamId)throw Error('GM continuation proof required');
 n.status='active';n.pendingYear=null;n.continuedYear=year;return n;
}
function inspectTransfer(c,offer){
 const n=checked(c);if(n.status!=='active'||n.transferMode!=='offers'||!offer||offer.verified!==true||!validId(offer.teamId)||offer.teamId===n.teamId)return false;
 // Deliberately no transfer mutation until offer conditions, timing and
 // the streak carry-over decision have been approved.
 return true;
}
module.exports={newGmTenure,recordCompletedSeason,declineContinuation,continueOneSeason,inspectTransfer};
