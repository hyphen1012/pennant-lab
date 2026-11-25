const fs=require('node:fs'),inline=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const end=inline.indexOf("  const appRoot=document.querySelector('#app');");
const harness=`
const ck=(v,m)=>{if(!v)throw Error(m);};save=()=>true;render=()=>{};showToast=()=>{};buildFresh();game.started=true;ensureGameExtras();
ck(game.teams.every(t=>sponsorContract(t,game.year)?.companies.length===5&&commerceData(t).broadcasts[game.year]),'all clubs begin with ordinary rights');
const t=myTeam(),other=game.teams.find(q=>q.id!==t.id),p=own(t)[0],cash=t.cash,date=game.year+'-01-01';sponsorOffPay(date);commerceOffPay(date);ck(t.cash>cash,'actual receipts');const paid=t.cash;sponsorOffPay(date);commerceOffPay(date);ck(t.cash===paid,'no duplicated revenue');
delete other.sponsorships[game.year];game=JSON.parse(JSON.stringify(game));ensureGameExtras();ck(!sponsorContract(getTeam(other.id),game.year),'no retrospective contracts');
const mine=myTeam(),player=getPlayer(p.id);player.seasonHistory=[{year:2027,teamId:other.id,stats:{g:20,h:20,w:10},clubStints:{partial:false,rows:[{teamId:mine.id,stats:{g:6,h:5,w:2}},{teamId:other.id,stats:{g:14,h:15,w:8}}]}},{year:2028,teamId:mine.id,stats:{g:30,h:10,w:3}},{year:2029,teamId:other.id,stats:{g:100,h:500,w:100}}];
const rows=legacyFilmRecords(player,mine),scenes=legacyFilmScenes(player,mine);ck(rows.length===2&&rows[0].stats.g===6,'film actual club stints');ck(scenes.some(x=>x.kind==='timeline')&&scenes.some(x=>x.kind==='credit')&&scenes.some(x=>x.kind==='final'&&x.detail.includes('36試合')),'film total and chapters');ck(legacyFilm(player,mine).includes('data-legacy-film'),'play button');const kinds=['intro','start','peak','timeline','honors','final','credit'];const art=kinds.map(k=>legacyFilmBackdrop(k,''));ck(new Set(art).size===7&&art.every((a,i)=>a.includes('data-film-set="'+kinds[i]+'"')),'seven distinct scene sets');ck(legacyFilmBackdrop('peak','IMMORTAL')!==legacyFilmBackdrop('peak','輪廻転生')&&legacyFilmBackdrop('peak','IMMORTAL').includes('cinema-overlay'),'distinct immeasurable layers');ck(!legacyFilmBackdrop('intro','').includes('cinema-overlay'),'ordinary no special layer');
return {rights:12,duplicate:'pass',migration:'pass',filmChapters:scenes.length};
`;
const code=inline.slice(0,end).replace('(() => {','return (() => {')+harness+'})();';
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){}},ls={getItem:()=>null,setItem(){},removeItem(){}};
console.log('PASS initial rights and film',new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{}));
