// Pure authoritative game mutations for the two routes whose core rules are
// independent of the full simulation. Only invoke on server-owned state.
function rosterTreatment(game,id,date){
 const p=game.players.find(p=>p.id===id),injury=p?.injury;
 if(!p||p.teamId!==game.selectedId||!injury||injury.date!==date||!/^\d{4,}-\d{2}-\d{2}$/.test(date)||!Number.isSafeInteger(injury.daysLeft)||injury.daysLeft<2||injury.specialTreatment)return null;
 const before=injury.daysLeft,after=Math.max(1,Math.ceil(before/2)),result={before,after,date};
 injury.daysLeft=after;injury.specialTreatment=result;
 const e=game.pendingEvent;if(e?.playerId===id&&e.date===date&&e.teamId===game.selectedId){e.specialTreatment={...result};e.days=after;}
 const old=(game.injuryArchive||[]).find(e=>e.playerId===id&&e.date===date);if(old)old.specialTreatment={...result};
 return result;
}
function retainManager(game,id,year){
 const t=game.teams.find(t=>t.id===game.selectedId),m=t?.manager;
 if(!m||m.id!==id||game.year!==year||!Number.isSafeInteger(m.joinedYear)||year-m.joinedYear+1<7||game.day<98||m.tenureContinuedYear===year)return null;
 m.tenureContinuedYear=year;return {managerId:id,continuedThrough:year+1};
}
module.exports={rosterTreatment,retainManager};
