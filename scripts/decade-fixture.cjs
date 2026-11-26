// Synthetic historical records for isolated tests, not natural-play evidence.
function decadeFixture(w,{partial=false}={}){
 const team=w.selectedId,p=w.players.find(p=>p.teamId===team&&!p.retired&&['C','IF','OF','1B','2B','3B','SS','LF','CF','RF'].includes(p.pos))||w.players.find(p=>p.teamId===team&&!p.retired&&!['SP','RP','CL'].includes(p.pos));
 const standings=Object.fromEntries(['E','W'].map(l=>[l,w.teams.filter(t=>t.league===l).sort((a,b)=>(a.id===team?-1:b.id===team?1:a.id-b.id)).map((t,i)=>({id:t.id,name:t.name,rank:i+1,wins:80-i,losses:63+i,ties:0,rs:500,ra:450,cash:80}))]));
 w.seasonArchive=Array.from({length:partial?11:10},(_,i)=>({year:2027+i,standings:structuredClone(standings),awards:p?[{playerId:p.id,teamId:team,title:'MVP',league:w.teams.find(t=>t.id===team).league}]:[],postseason:{championId:team},myTeamId:team,myCash:80}));
 if(p)p.seasonHistory=[{year:2027,teamId:team,stats:{g:100,ab:400,h:120,hr:30,rbi:90,sb:10}}];
 w.year=partial?2038:2037;w.pendingDecade=partial?null:2036;
 return w;
}
module.exports={decadeFixture};
