const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const end=inline.indexOf("  const appRoot=document.querySelector('#app');");
const harness=`
const ck=(v,m)=>{if(!v)throw Error(m);};save=()=>true;render=()=>{};showToast=()=>{};buildFresh();ensureGameExtras();ui.page='title';const original=game;
ck(scenarioStart('sponsor'),'scenario');const f=flowGet(),j=f.jobs.sponsor,t=myTeam(),y=game.year+1;
ck(j.status==='scheduled'&&!flowEvents(f).includes('スポンサー契約'),'not visible early');
ck(flowDay(f)&&j.status==='ready'&&flowEvents(f).includes('スポンサー契約')&&flowBlocking(f),'date activation');
ck(sponsorAction('sponsor-open',{dataset:{}})&&f.active==='sponsor','open');
ck(sponsorAction('sponsor-start',{dataset:{}}),'briefing');
const s=j.state;ck(s.candidates.length===12&&sponsorScreen(f,j).includes('スポンサー増加のリスク'),'candidate UI');
const id=s.candidates[0].id;ck(sponsorAction('sponsor-toggle',{dataset:{value:id}})&&s.selected.length===1,'choose');
ck(sponsorAction('sponsor-back',{dataset:{}})&&j.status==='ready','park');
ck(sponsorAction('sponsor-open',{dataset:{}})&&j.state.selected.length===1,'selection persisted');
ck(sponsorAction('sponsor-confirm',{dataset:{}})&&s.stage==='result','contract');
const contract=sponsorContract(t,y),expected=contract.companies[0].annual;ck(contract.companies.length===1&&!sponsorSign(t,y,[],f.date),'no duplicate');
ck(game.teams.filter(t=>t.id!==game.selectedId).every(t=>!sponsorContract(t,y)),'isolated scenario skips CPU contracts');
// Exercise the production calendar path separately, on the isolated fixture only.
const scenario=scenarioLab;try{scenarioLab=null;cpuCommercialCalendar(f);ck(game.teams.every(t=>sponsorContract(t,y)),'CPU contracts on production calendar');const snapshot=JSON.stringify(game.teams.map(t=>t.sponsorships));cpuCommercialCalendar(f);ck(snapshot===JSON.stringify(game.teams.map(t=>t.sponsorships)),'CPU contract idempotence');}finally{scenarioLab=scenario;}
ck(sponsorAction('sponsor-finish',{dataset:{}})&&j.status==='done','complete');
const cash=t.cash;sponsorOffPay(y+'-01-01');ck(t.cash===r2(cash+r2(expected/12))&&contract.payments.length===1,'offseason cash');
sponsorOffPay(y+'-01-01');ck(contract.payments.length===1&&t.cash===r2(cash+r2(expected/12)),'offseason no duplicate');
const regular=sponsorSettle(t,y+'-10-31','season');ck(r2(regular+sponsorReceived(t,y,'off'))===r2(expected*10/12),'season instalments');
sponsorOffPay(y+'-12-01');ck(sponsorReceived(t,y)===expected&&contract.payments.length===12,'twelve months exact');
ck(sponsorSettle(t,y+'-12-31','season')===0,'no double settlement');
ck(sponsorRisk(12).cancellation===34&&sponsorRisk(9).burden===90,'risk scale');
ck(JSON.parse(JSON.stringify(game)).teams.find(a=>a.id===t.id).sponsorships[y].payments.length===12,'save compatible');
ck(scenarioEnd()&&game===original,'isolation');
return {pass:true,annual:expected,payments:12};
`;
const code=inline.slice(0,end).replace('(() => {','return (() => {')+harness+'})();';
const doc={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},body:{appendChild(){},insertAdjacentHTML(){}}},win={addEventListener(){},scrollTo(){},confirm:()=>true},ls={getItem:()=>null,setItem(){},removeItem(){}};
console.log('PASS sponsorship',new Function('document','window','localStorage','setTimeout','clearTimeout',code)(doc,win,ls,()=>0,()=>{}));
