// Staging-only source adapter. Preserve original movie/title, universe map,
// portal and setup editor. Never load or write a legacy local world in this
// build. The post-setup game is deliberately held until its screens are wired.
function canonicalTitlePilot(html){
 const swap=(a,b)=>{if(html.split(a).length!==2)throw Error('canonical title anchor changed: '+a.slice(0,100));html=html.replace(a,()=>b);};
 swap("  function accountCurrent(){","  const canonicalPilot=window.PennantNative?.canonicalGame;\n  if(!canonicalPilot)throw Error('Canonical staging bridge required');\n  let canonicalSlots=null,canonicalSnapshot=null,canonicalSlot=null,canonicalEpoch=0;\n  function accountCurrent(){");
 swap("  function save(){","  function save(){\n    if(canonicalPilot)return true; // No local state write in canonical mode.");
 swap("  async function load(){","  async function load(){\n    if(canonicalPilot)throw Error('Legacy load unavailable in canonical mode');");
 swap("        await load();ensureGameExtras();\n        ui.launchTitle=false;ui.rarePreview=null;","        await refreshCanonicalSlots();\n        ui.launchTitle=false;ui.rarePreview=null;");
 swap("  function revealSlot(group,on=true){","  function revealSlot(group,on=true){\n    if(canonicalPilot)return; // Canonical slot deletion is not yet connected.");
 swap("  function titleScreen(){","  function titleScreen(){\n    if(canonicalPilot)return canonicalTitleScreen();");
 swap("  const appRoot=document.querySelector('#app');",pilotCode+"\n  const appRoot=document.querySelector('#app');");
 return html;
}
const pilotCode = `
  function canonicalTitleScreen(){
    const head='<div class="title-screen save-terminal multiverse-terminal"><header class="save-terminal-head"><span class="title-serial">VERSION 0.9.190 · STAGING</span><button class="ghost-btn" data-action="launch-back">‹ タイトル</button></header><div class="title-slot-title">セーブデータを選択</div>';
    if(!canonicalSlots)return head+'<p role="status">サーバーのセーブ一覧を確認できません。データは変更されていません。</p><button class="btn primary full" data-action="canonical-retry">再取得する</button></div>';
    return head+'<div class="multiverse-map" aria-label="セーブデータを選択">'+cosmicAtlas()+'<div class="title-slots">'+[1,2,3].map(i=>{
      const row=canonicalSlots.find(x=>x.slot===i),d=row?.preview,t=d?.team;
      const orb=row&&!t?worldOrb(i,null,true).replace('<span class="world-new">＋</span>','<span class="world-new">●</span>'):worldOrb(i,t,!!row);
      const label=t?'<strong>'+h(t.name)+'</strong><small>'+leagueTag(t.league)+'　'+d.year+'年</small><small>'+d.day+'/143試合 · '+h(d.gmName)+'</small><small>'+t.wins+'勝　'+fmtMoney(t.cash)+'</small>':row?'<strong>保存済みデータ</strong><small>詳細は開いて確認</small>':'<strong>新しい球団で始める</strong><small>空きデータ '+i+'</small>';
      return '<div class="save-slot-group" data-slot-group="'+i+'" style="--world-tone:'+WORLD_TONES[i-1]+'"><button class="save-slot world-node '+(row?'has-game':'empty-slot')+' '+(t?leagueClass(t.league):'')+'" data-action="'+(row?'continue-slot':'new-slot')+'" data-slot="'+i+'">'+orb+'<span class="slot-label world-label"><span class="world-number">DATA 0'+i+' <i></i></span>'+label+'</span></button></div>';
    }).join('')+'</div></div><p class="save-terminal-hint">試験環境 · サーバー保存データ</p><button class="btn outline full" data-action="canonical-retry">一覧を更新</button><button class="btn outline full" data-action="canonical-logout">ログアウト</button></div>';
  }
  async function refreshCanonicalSlots(){
    const epoch=canonicalEpoch;canonicalSlots=null;
    try{
      if(!accountCurrent()||!window.PennantNative.ready())return false;
      const x=await canonicalPilot.listSlots();
      if(epoch!==canonicalEpoch||!accountCurrent()||x.status!=='ready')return false;
      canonicalSlots=x.slots;return true;
    }catch{return false;}
  }
  function canonicalReset(){
    canonicalEpoch++;canonicalSlots=null;canonicalSnapshot=null;canonicalSlot=null;
    canonicalPilot.suspend();ui.clubDraft=null;ui.portalSlot=null;ui.portalOrigin=null;slotOpening=false;
    ui.page='title';ui.launchTitle=false;
  }
  async function canonicalReturn(){
    if(slotOpening)return;canonicalReset();slotOpening=true;render();
    const epoch=canonicalEpoch;
    try{await refreshCanonicalSlots();}finally{if(epoch===canonicalEpoch){slotOpening=false;render();window.scrollTo(0,0);}}
  }
  async function openCanonicalSlot(b,create){
    const slot=Number(b.dataset.slot);if(slotOpening||!canonicalSlots||![1,2,3].includes(slot)||!accountCurrent())return;
    const orb=b.querySelector('.world-orb'),rect=orb?.getBoundingClientRect();
    ui.portalSlot=slot;ui.portalOrigin=rect?{x:Math.max(0,Math.min(100,(rect.left+rect.width/2)/(window.innerWidth||1)*100)),y:Math.max(0,Math.min(100,(rect.top+rect.height/2)/(window.innerHeight||1)*100))}:null;
    slotOpening=true;render();const epoch=canonicalEpoch;
    try{
      const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?Promise.resolve():new Promise(r=>setTimeout(r,1450));
      const [ok]=await Promise.all([refreshCanonicalSlots(),motion]);
      if(epoch!==canonicalEpoch)return;
      if(!ok||document.hidden||!window.PennantNative.ready()||!accountCurrent())throw Error('connection unavailable');
      const row=canonicalSlots.find(x=>x.slot===slot);
      if(create===!!row)throw Error('slot occupancy changed');
      canonicalPilot.select(slot);canonicalSlot=slot;activeSlot=slot;
      ui.clubDraft=null;
      if(row){
        const result=await canonicalPilot.refresh();
        if(epoch!==canonicalEpoch)return;
        if(result.status!=='ready'||result.snapshot.world!==row.world||result.snapshot.revision<row.revision)throw Error('world changed');
        canonicalSnapshot=result.snapshot;ui.page='canonical-ready';
      }else{
        // Existing setup editor uses the temporary in-memory default club
        // template only. None of that local game is submitted or saved.
        ui.selectedTeam=2;ui.setupLeague='E';ui.page='setup';
      }
    }catch{
      if(epoch!==canonicalEpoch)return;
      canonicalSnapshot=null;canonicalSlot=null;ui.page='title';showToast('セーブ状態が変化したか、通信を確認できません。もう一度選択してください。',true);
    }finally{if(epoch===canonicalEpoch){ui.portalSlot=null;ui.portalOrigin=null;slotOpening=false;render();window.scrollTo(0,0);}}
  }
  async function canonicalFinishSetup(){
    if(slotOpening||ui.page!=='setup'||canonicalSlot===null||!accountCurrent())return;
    const t=getTeam(ui.selectedTeam),d=identityDraft(t),identity=Object.fromEntries(['gmName','name','short','letter','color','accent','shape','pattern','font','motif'].map(k=>[k,d[k]]));
    const epoch=canonicalEpoch;slotOpening=true;ui.page='title';render();
    try{
      const result=await canonicalPilot.create({team:t.id,identity},true);
      if(epoch!==canonicalEpoch)return;
      if(result.status!=='ready')throw Error('creation needs reconciliation');
      canonicalSnapshot=result.snapshot;ui.clubDraft=null;ui.page='canonical-ready';
    }catch{
      if(epoch!==canonicalEpoch)return;
      canonicalSnapshot=null;canonicalSlot=null;ui.page='title';
      await refreshCanonicalSlots(); // observation only; never retry a create.
      if(epoch===canonicalEpoch)showToast('作成結果を確認してください。自動再送・上書きは行いません。',true);
    }finally{if(epoch===canonicalEpoch){slotOpening=false;render();window.scrollTo(0,0);}}
  }
  const canonicalOriginalRender=render;
  render=function(){
    if(ui.page==='canonical-ready'||ui.page==='game'){
      const app=$('#app');if(!app)return;
      const g=canonicalSnapshot?.game,t=g?.team;
      app.innerHTML='<div class="setup-screen"><div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-return">‹ データ選択</button></div>'+
       (t?'<div class="hero-team">'+teamBadge(t,'logo')+'<div><h2>'+h(t.name)+'</h2><small>GM '+h(g.gmName)+' · '+g.year+'年 '+g.day+'/143試合</small></div></div>':'')+
       '<p role="status">サーバー保存の確認画面（開発試験）</p><p>本部以降の画面統合が未完了のため、ゲーム進行はまだ開始できません。</p><button class="btn outline full" data-action="canonical-return">データ選択へ戻る</button></div>';
      return;
    }
    canonicalOriginalRender();
  };
  // This boundary is UI-only. Server commands still require authentication,
  // world revision, explicit confirmation and all original game validation.
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-action]');if(!b)return;
    const act=b.dataset.action;
    if(slotOpening){e.preventDefault();e.stopImmediatePropagation();return;}
    if(ui.page==='title'&&ui.launchTitle&&['launch-start','launch-back'].includes(act)||ui.page==='title'&&!ui.launchTitle&&act==='launch-back'||ui.page==='setup'&&['setup-league','pick-setup-team','team-color','club-design'].includes(act))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(ui.page==='title'&&!ui.launchTitle&&['new-slot','continue-slot'].includes(act))void openCanonicalSlot(b,act==='new-slot');
    else if(ui.page==='title'&&act==='canonical-retry'||act==='canonical-return'||ui.page==='setup'&&act==='title')void canonicalReturn();
    else if(ui.page==='setup'&&act==='finish-setup')void canonicalFinishSetup();
    else if(ui.page==='title'&&act==='canonical-logout')window.PennantNative.logoutAccount();
  },true);
  function canonicalInterrupted(){if(!accountContext)return;canonicalReset();render();}
  window.addEventListener('pl-native-suspend',canonicalInterrupted);
  window.addEventListener('pl-canonical-identity-changed',canonicalInterrupted);
`;
module.exports={canonicalTitlePilot};
