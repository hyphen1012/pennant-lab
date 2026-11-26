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
  let canonicalRoster=null;
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
    canonicalEpoch++;canonicalSlots=null;canonicalSnapshot=null;canonicalSlot=null;canonicalRoster=null;canonicalHqWorld=null;canonicalHqError=false;
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

  function canonicalRosterOpen(){
    if(!canonicalSnapshot?.game?.club||slotOpening||!accountCurrent())return;
    canonicalRoster={returnPage:ui.page,world:canonicalSnapshot.world,revision:canonicalSnapshot.revision,mode:'field',orderMode:'swap',role:null,order:null,swap:false,note:''};
    ui.page='canonical-roster';render();window.scrollTo(0,0);
  }
  function canonicalRosterRender(){
    const app=$('#app'),s=canonicalRoster,g=canonicalSnapshot?.game,c=g?.club;
    if(!app)return;
    const head='<div class="setup-screen"><div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-roster-back">‹ 保存確認</button></div>';
    if(!s||!c){
      app.innerHTML=head+'<p role="status">編成の確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-roster-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button><button class="btn outline full" data-action="canonical-return">データ選択へ戻る</button></div>';return;
    }
    const players=new Map(c.roster.map(p=>[p.id,{...p,...p.abilities,teamId:g.team.id,farmTier:p.tier,injury:p.injured?{daysLeft:p.injuryDays||1}:null,stats:{...p.batStats}}]));
    const candidates=new Map(c.lineupCandidates.map(p=>[p.id,p]));
    const lookup=id=>players.get(id),pool=()=>[...candidates.keys()].map(lookup).filter(Boolean);
    const reason=(role,p)=>candidates.get(p.id)?.reasons?.[role]??'起用不可';
    const blocked=slotOpening||!c.canManage||!!canonicalSnapshot.pending?.length||!accountCurrent();
    s.undo=c.lineupUndoAvailable;
    app.innerHTML=head+'<p class="order-roster-note">試験環境 · サーバー保存編成</p>'+(blocked?'<p role="status">'+(slotOpening?'確定状態を確認しています。':'現在は編成を変更できません。')+'</p>':'')+'<fieldset '+(blocked?'disabled':'')+' style="border:0;margin:0;padding:0;min-width:0">'+roster190Markup(c,s,c.fieldingRoles,lookup,pool,reason)+'</fieldset></div>';
  }
  async function canonicalRosterRequest(command){
    const s=canonicalRoster;if(!s||slotOpening||!accountCurrent())return;
    const old=canonicalSnapshot,epoch=canonicalEpoch,scroll=draftScrollY();
    if(command&&(!old?.game?.club?.canManage||old.pending?.length))return;
    slotOpening=true;render();
    try{
      const result=await (command?canonicalPilot.advance(command):canonicalPilot.refresh());
      if(epoch!==canonicalEpoch)return;
      if(result.status!=='ready'||result.snapshot.world!==s.world||result.snapshot.revision<s.revision)throw Error('roster observation required');
      canonicalSnapshot=result.snapshot;s.revision=result.snapshot.revision;s.role=null;s.order=null;s.swap=false;s.note=command?'サーバーに編成を保存しました。':'最新の編成を取得しました。';
    }catch{
      if(epoch!==canonicalEpoch)return;
      canonicalSnapshot=null;s.order=null;s.role=null;s.swap=false;s.note='';
    }finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(scroll);}}
  }
  function canonicalRosterClick(b){
    const s=canonicalRoster,c=canonicalSnapshot?.game?.club,act=b.dataset.action;
    if(!s||!c?.canManage||canonicalSnapshot.pending?.length||slotOpening||!accountCurrent())return;
    const scroll=draftScrollY();s.note='';
    if(act==='order190-mode'){s.mode=b.dataset.mode==='order'?'order':'field';s.role=null;s.order=null;s.swap=false;}
    else if(act==='order190-clear'){s.role=null;s.order=null;s.swap=false;}
    else if(act==='order190-order-mode'){if(s.mode!=='order')return;s.orderMode=b.dataset.mode==='move'?'move':'swap';s.order=null;}
    else if(act==='order190-undo'){if(c.lineupUndoAvailable)void canonicalRosterRequest({club:'lineup-undo'});return;}
    else if(act==='order190-auto'){if(window.confirm('現在のスタメンを監督の判断で組み直しますか？'))void canonicalRosterRequest({club:'lineup-recommend',confirmed:true});return;}
    else if(act==='order190-order'){
      const i=Number(b.dataset.index);if(s.mode!=='order'||!Number.isInteger(i)||i<0||i>=c.lineup.length)return;
      if(s.order===null)s.order=i;
      else{const from=s.order;s.order=null;if(from!==i){void canonicalRosterRequest(s.orderMode==='move'?{club:'lineup-move',slot:from,target:i}:{club:'order',kind:'lineup',slot:from,target:i});return;}}
    }else if(act==='order190-role'){
      const role=b.dataset.role;if(s.mode!=='field'||!FIELD_POSITIONS.includes(role))return;
      if(s.swap&&s.role){
        const id=c.lineup.find(n=>c.fieldingRoles[n]===s.role);s.swap=false;
        if(c.fieldingOptions.some(x=>x.id===id&&x.roles.includes(role))){void canonicalRosterRequest({club:'fielding',playerId:id,key:role});return;}
        s.note='その組み合わせは守備適性上変更できません。';
      }else{s.role=s.role===role?null:role;s.swap=false;}
    }else if(act==='order190-exchange'){if(!s.role)return;s.swap=!s.swap;}
    else if(act==='order190-player'){
      const id=Number(b.dataset.id);if(s.mode!=='field'||!s.role||!c.lineupCandidates.some(x=>x.id===id&&x.roles.includes(s.role)))return;
      void canonicalRosterRequest({club:'lineup-replace',key:s.role,playerId:id});return;
    }else return;
    render();draftJump(scroll);
    if(act==='order190-role'&&s.role&&!s.swap)document.querySelector('.order190 .order-detail')?.scrollIntoView?.({block:'nearest',behavior:'instant'});
    if(act==='order190-exchange'&&s.swap)document.querySelector('.order190 .order-field')?.scrollIntoView?.({block:'nearest',behavior:'instant'});
  }
  let canonicalHqError=false;
  function canonicalHqRender(){
    const app=$('#app'),g=canonicalSnapshot?.game,t=g?.team,v=g?.headquarters;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-return">‹ データ選択</button></div>';
    if(!t||!v){app.innerHTML='<div class="setup-screen">'+top+'<p role="status">確定した日程を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-hq-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    const canStep=v.canStep&&!slotOpening&&!canonicalSnapshot.pending?.length&&accountCurrent();
    const stop=slotOpening?'日程の確定を確認しています。':canonicalSnapshot.pending?.length?'報酬の確定確認が必要です。':!v.canStep?'確認が必要なイベントまたは日程の区切りです。未接続のイベント処理へは自動進行しません。':'';
    const last=v.last,score=last?'<div class="box-result"><span class="tag '+(last.ours>last.theirs?'green':last.ours<last.theirs?'red':'')+'">'+(last.ours>last.theirs?'勝利':last.ours<last.theirs?'敗戦':'引分')+'</span> <span class="small">'+last.year+'年 第'+last.day+'戦 / vs '+h(last.opponent)+'</span><div class="score-big">'+last.ours+' - '+last.theirs+'</div></div>':'<div class="empty">シーズンはまだ始まっていません。</div>';
    const hero=frontOfficeHero(t,{year:g.year,gmName:g.gmName,day:g.day,fans:v.fans,salary:v.salary,rank:v.rank,opponent:v.opponent,dateText:v.dateText});
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(t)+'">'+top+'<main class="main">'+hero+'<section class="panel desk-panel"><div class="desk-heading"><div><div class="eyebrow">GM DESK · FRONT OFFICE</div><h3>業務一覧</h3></div><button class="btn primary" data-action="canonical-hq-step" '+(canStep?'':'disabled')+'>▶ 1日進める</button></div>'+(g.club?'<button class="btn outline full" data-action="canonical-roster-open" '+(slotOpening?'disabled':'')+'>スタメン編成</button>':'')+'</section><section class="panel"><div class="panel-head"><h3 class="panel-title">直近の試合結果</h3></div>'+score+'</section>'+(stop?'<p role="status">'+h(stop)+'</p>':'')+'<p class="small">試験環境 · 本部の概要と1日進行のみ接続済み。イベント演出、その他の業務・倍速・スキップは未接続です。</p></main></div>';
  }
  async function canonicalHqRequest(step){
    if(slotOpening||!accountCurrent()||!canonicalSlot)return;
    const epoch=canonicalEpoch,old=canonicalSnapshot,previousWorld=old?.world||canonicalHqWorld,scroll=draftScrollY();
    if(step&&(!old?.game?.headquarters?.canStep||old.pending?.length))return;
    slotOpening=true;render();
    try{
      const result=await (step?canonicalPilot.advance({step:1}):canonicalPilot.refresh());
      if(epoch!==canonicalEpoch)return;
      if(result.status!=='ready'||result.snapshot.world!==previousWorld)throw Error('headquarters observation required');
      canonicalSnapshot=result.snapshot;canonicalHqError=false;
    }catch{
      if(epoch!==canonicalEpoch)return;
      canonicalSnapshot=null;canonicalHqError=true;
    }finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(scroll);}}
  }
  let canonicalHqWorld=null;
  function canonicalHqOpen(){if(!canonicalSnapshot?.game?.headquarters||slotOpening||!accountCurrent())return;canonicalHqWorld=canonicalSnapshot.world;canonicalHqError=false;ui.page='canonical-hq';render();window.scrollTo(0,0);}
  const canonicalOriginalRender=render;
  render=function(){
    if(ui.page==='canonical-hq'){canonicalHqRender();return;}
    if(ui.page==='canonical-roster'){canonicalRosterRender();return;}
    if(ui.page==='canonical-ready'||ui.page==='game'){
      const app=$('#app');if(!app)return;
      const g=canonicalSnapshot?.game,t=g?.team;
      app.innerHTML='<div class="setup-screen"><div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-return">‹ データ選択</button></div>'+
       (t?'<div class="hero-team">'+teamBadge(t,'logo')+'<div><h2>'+h(t.name)+'</h2><small>GM '+h(g.gmName)+' · '+g.year+'年 '+g.day+'/143試合</small></div></div>':'')+
       '<p role="status">サーバー保存の確認画面（開発試験）</p><p>試験環境で本部と編成を確認できます。</p>'+(g?.headquarters?'<button class="btn primary full" data-action="canonical-hq-open">本部へ進む</button>':'')+(g?.club?'<button class="btn primary full" data-action="canonical-roster-open">スタメン編成</button>':'')+'<button class="btn outline full" data-action="canonical-return">データ選択へ戻る</button></div>';
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
    else if(ui.page==='canonical-ready'&&act==='canonical-hq-open')canonicalHqOpen();
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-step')void canonicalHqRequest(true);
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-refresh')void canonicalHqRequest(false);
    else if(['canonical-ready','canonical-hq'].includes(ui.page)&&act==='canonical-roster-open')canonicalRosterOpen();
    else if(ui.page==='canonical-roster'&&act==='canonical-roster-refresh')void canonicalRosterRequest(null);
    else if(ui.page==='canonical-roster'&&act==='canonical-roster-back'){if(!canonicalSnapshot)void canonicalReturn();else{const dest=canonicalRoster?.returnPage||'canonical-ready';canonicalRoster=null;ui.page=dest;render();window.scrollTo(0,0);}}
    else if(ui.page==='canonical-roster'&&act.startsWith('order190-'))canonicalRosterClick(b);
    else if(ui.page==='setup'&&act==='finish-setup')void canonicalFinishSetup();
    else if(ui.page==='title'&&act==='canonical-logout')window.PennantNative.logoutAccount();
  },true);
  function canonicalInterrupted(){if(!accountContext)return;canonicalReset();render();}
  window.addEventListener('pl-native-suspend',canonicalInterrupted);
  window.addEventListener('pl-canonical-identity-changed',canonicalInterrupted);
`;
module.exports={canonicalTitlePilot};
