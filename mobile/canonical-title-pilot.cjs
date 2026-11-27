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
 // These art-only renderers must use the authoritative team, not an unloaded local world.
 swap("  function salesScene(kind){\n    const t=myTeam(),color=","  function salesScene(kind,t=myTeam()){\n    const color=");
 swap("  function fanPerkArt(id){\n    const color=myTeam().color","  function fanPerkArt(id,t=myTeam()){\n    const color=t.color");
 swap("  function fanFestPhoto(i){return '<figure class=\"fest-photo original-art\">'+salesScene(['autograph','stage','stadium','celebration'][i]||'stadium')","  function fanFestPhoto(i,t=myTeam()){return '<figure class=\"fest-photo original-art\">'+salesScene(['autograph','stage','stadium','celebration'][i]||'stadium',t)");
 swap("  function salesCelebration(kind){return '<div class=\"sales-celebration\">'+salesScene(kind)","  function salesCelebration(kind,t=myTeam()){return '<div class=\"sales-celebration\">'+salesScene(kind,t)");
 swap("  function openingPromoArt(plan){\n    const i=clamp(Number(plan)||0,0,2),t=myTeam(),c=","  function openingPromoArt(plan,t=myTeam()){\n    const i=clamp(Number(plan)||0,0,2),c=");
 swap("  const appRoot=document.querySelector('#app');",pilotCode+"\n  const appRoot=document.querySelector('#app');");
 return html;
}
const pilotCode = `
  let canonicalRoster=null,canonicalDeletePress=null,canonicalDeleteSuppressed=null;
  function canonicalTitleScreen(){
    const head='<div class="title-screen save-terminal multiverse-terminal"><header class="save-terminal-head"><span class="title-serial">VERSION 0.9.191 · STAGING</span><button class="ghost-btn" data-action="launch-back">‹ タイトル</button></header><div class="title-slot-title">セーブデータを選択</div>';
    if(!canonicalSlots)return head+'<p role="status">'+(slotOpening?'セーブ一覧を取得しています。':'サーバーのセーブ一覧を確認できません。データは変更されていません。')+'</p><button class="btn primary full" data-action="canonical-retry" '+(slotOpening?'disabled':'')+'>再取得する</button></div>';
    return head+'<div class="multiverse-map" aria-label="セーブデータを選択">'+cosmicAtlas()+'<div class="title-slots">'+[1,2,3].map(i=>{
      const row=canonicalSlots.find(x=>x.slot===i),d=row?.preview,t=d?.team;
      const orb=row&&!t?worldOrb(i,null,true).replace('<span class="world-new">＋</span>','<span class="world-new">●</span>'):worldOrb(i,t,!!row);
      const label=t?'<strong>'+h(t.name)+'</strong><small>'+leagueTag(t.league)+'　'+d.year+'年</small><small>'+d.day+'/143試合 · '+h(d.gmName)+'</small><small>'+t.wins+'勝　'+fmtMoney(t.cash)+'</small>':row?'<strong>保存済みデータ</strong><small>詳細は開いて確認</small>':'<strong>新しい球団で始める</strong><small>空きデータ '+i+'</small>';
      return '<div class="save-slot-group" data-slot-group="'+i+'" style="--world-tone:'+WORLD_TONES[i-1]+'"><button class="save-slot world-node '+(row?'has-game':'empty-slot')+' '+(t?leagueClass(t.league):'')+'" data-action="'+(row?'continue-slot':'new-slot')+'" data-slot="'+i+'">'+orb+'<span class="slot-label world-label"><span class="world-number">DATA 0'+i+' <i></i></span>'+label+'</span></button>'+(row?'<button class="btn outline full canonical-world-delete" style="display:none" data-action="canonical-world-delete" data-slot="'+i+'">このセーブデータを削除</button>':'')+'</div>';
    }).join('')+'</div></div><p class="save-terminal-hint">試験環境 · サーバー保存データ</p><button class="btn outline full" data-action="canonical-retry">一覧を更新</button><button class="btn outline full" data-action="canonical-logout">ログアウト</button></div>';
  }
  function canonicalDeleteClear(){if(canonicalDeletePress)clearTimeout(canonicalDeletePress.timer);canonicalDeletePress=null;}
  function canonicalDeleteReveal(slot){
    if(ui.page!=='title'||ui.launchTitle||slotOpening||!accountCurrent()||!canonicalSlots?.some(x=>x.slot===slot))return;
    document.querySelectorAll('.canonical-world-delete').forEach(b=>{b.style.display=Number(b.dataset.slot)===slot?'':'none';});
    canonicalDeleteSuppressed={slot,until:Date.now()+1100};
  }
  window.addEventListener('pointerdown',e=>{
    if(ui.page!=='title'||ui.launchTitle||slotOpening||!accountCurrent())return;
    const b=e.target.closest?.('button.save-slot.has-game');if(!b||e.button!==0||e.isPrimary===false)return;
    canonicalDeleteClear();canonicalDeleteSuppressed=null;
    const p={slot:Number(b.dataset.slot),id:e.pointerId,x:e.clientX,y:e.clientY,epoch:canonicalEpoch};
    canonicalDeletePress=p;p.timer=setTimeout(()=>{if(canonicalDeletePress===p&&p.epoch===canonicalEpoch){canonicalDeleteReveal(p.slot);p.revealed=true;}},1800);
  },true);
  window.addEventListener('pointermove',e=>{
    const p=canonicalDeletePress;if(!p||p.id!==e.pointerId)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;
    if(Math.abs(dy)>18&&Math.abs(dy)>Math.abs(dx)){canonicalDeleteClear();return;}
    if(Math.abs(dx)>12||Math.abs(dy)>12)clearTimeout(p.timer);
    if(dx<=-55&&Math.abs(dy)<35&&!p.revealed){canonicalDeleteReveal(p.slot);p.revealed=true;}
  },true);
  window.addEventListener('pointerup',e=>{const p=canonicalDeletePress;if(p?.id===e.pointerId){if(p.revealed)canonicalDeleteSuppressed={slot:p.slot,until:Date.now()+1100};canonicalDeleteClear();}},true);
  for(const name of ['pointercancel','scroll'])window.addEventListener(name,canonicalDeleteClear,true);
  window.addEventListener('contextmenu',e=>{const b=e.target.closest?.('button.save-slot.has-game');if(ui.page==='title'&&!ui.launchTitle&&b&&accountCurrent()){e.preventDefault();canonicalDeleteReveal(Number(b.dataset.slot));}},true);
  window.addEventListener('keydown',e=>{const b=e.target.closest?.('button.save-slot.has-game');if(ui.page==='title'&&!ui.launchTitle&&b&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();canonicalDeleteReveal(Number(b.dataset.slot));}},true);
  async function canonicalDeleteWorld(b){
    const slot=Number(b.dataset.slot),row=canonicalSlots?.find(x=>x.slot===slot);
    if(slotOpening||!accountCurrent()||!row||b.style.display==='none'||ui.page!=='title'||ui.launchTitle)return;
    if(!window.confirm('DATA 0'+slot+'「'+(row.preview?.team?.name||'保存済みデータ')+'」を削除しますか？ この世界線のプレイ記録は元に戻せません。'))return;
    canonicalDeleteClear();canonicalDeleteSuppressed=null;const epoch=canonicalEpoch;
    slotOpening=true;canonicalSlots=null;render();
    let deleted=false;
    try{const x=await canonicalPilot.deleteWorld(row,true);if(epoch!==canonicalEpoch)return;deleted=x.status==='deleted';}catch{}
    finally{
      if(epoch===canonicalEpoch){
        canonicalSnapshot=null;canonicalSlot=null;await refreshCanonicalSlots();
        if(epoch===canonicalEpoch){slotOpening=false;render();showToast(deleted?'セーブデータを削除しました。':'削除結果を確認してください。別端末の更新や未確定報酬がある場合は削除できません。自動再送は行いません。',!deleted);}
      }
    }
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
    canonicalDeleteClear();canonicalDeleteSuppressed=null;canonicalTvClear();document.querySelector('.canonical-tv-detail')?.close();canonicalTvSuppressed=null;canonicalEpoch++;canonicalSlots=null;canonicalSnapshot=null;canonicalSlot=null;canonicalRoster=null;canonicalHqWorld=null;canonicalTarget=null;canonicalRunning=false;canonicalStop=false;canonicalPlayback='normal';canonicalPlayerId=null;canonicalLeague=null;canonicalHistory=null;canonicalAwardFilter='all';canonicalCampGroup='first';canonicalWinterPlace='taiwan';canonicalDigestCut=0;canonicalForeignOpen=false;canonicalFreePage=null;canonicalFreeQuery='';canonicalRotationSlot=null;canonicalOpsNote='';canonicalReplay=null;canonicalReplaySkip=false;canonicalArchive=null;canonicalManagerEntry=true;canonicalTrade=null;canonicalTradeQuote=null;canonicalTradeClub=null;canonicalAchievementPage=null;canonicalAchievementNote='';canonicalMemorial=null;canonicalMemorialBusy=false;canonicalRewardNote='';canonicalRights=null;canonicalRightsBusy=false;
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
  const canonicalPlayerModel=(p,g)=>({...p,...p.abilities,teamId:g.team.id,farmTier:p.tier,injury:p.injured?{daysLeft:p.injuryDays||1}:null,stats:{...p.batStats}});
  let canonicalPlayerId=null,canonicalLeague=null,canonicalHistory=null;
  function canonicalHistoryMarkup(p,blocked){
    const d=canonicalHistory;
    if(!d||d.playerId!==p.id)return '<section class="panel"><h3>年度別・通算成績と能力推移</h3><button class="btn outline full" data-action="canonical-history-open" '+(slotOpening?'disabled':'')+'>'+(slotOpening?'取得中…':'成績・能力推移・GMメモを表示')+'</button></section>';
    const growth=d.items.filter(r=>r.overall!==null).slice().reverse(),pts=growth.map((r,i)=>({x:32+i*290/Math.max(1,growth.length-1),y:155-Math.max(0,Math.min(100,r.overall))*1.2,...r}));
    const chart=pts.length?'<div class="chart-holder"><svg class="growth-svg" viewBox="0 0 360 190" role="img" aria-label="保存された年度別総合能力の推移">'+[0,25,50,75,100].map(n=>'<path d="M32 '+(155-n*1.2)+'H322" stroke="#64748b" stroke-opacity=".45"/><text x="0" y="'+(159-n*1.2)+'" font-size="10" fill="currentColor">'+n+'</text>').join('')+'<polyline points="'+pts.map(r=>r.x+','+r.y).join(' ')+'" fill="none" stroke="#e9b949" stroke-width="3"/>'+pts.map(r=>'<circle cx="'+r.x+'" cy="'+r.y+'" r="4" fill="#36b89a"/><text x="'+r.x+'" y="'+(r.y-8)+'" text-anchor="middle" font-size="11" fill="currentColor">'+r.overall+'</text><text x="'+r.x+'" y="176" text-anchor="middle" font-size="9" fill="currentColor">'+String(r.year).slice(-2)+'</text>').join('')+'</svg></div>':'<p class="small">保存済みの能力推移はありません。</p>';
    const season=(label,r)=>r?'<h4>'+label+' · '+h(r.team||'所属記録なし')+'</h4>'+statDisplayGrid(p,r.stats,true):'';
    return '<section class="panel"><h3>一軍通算成績</h3>'+statDisplayGrid(p,d.officialTotal)+(d.hasFarm?'<h3>二軍通算成績</h3>'+statDisplayGrid(p,d.farmTotal):'<p class="small">二軍の記録はまだありません。</p>')+'<p class="small">一軍と二軍は別集計です。未記録の年度は補完しません。</p></section><section class="panel"><h3>保存された総合能力の推移</h3>'+chart+'<p class="small">現在のページに含まれる記録のみ表示します。</p></section><section class="panel"><h3>年度別成績・能力・タイトル</h3><p>'+d.total+'年度中 '+(d.total?d.offset+1:0)+'〜'+(d.offset+d.items.length)+'</p>'+d.items.map(r=>'<details class="club-honor"><summary>'+r.year+'年'+(r.overall===null?'':' · 総合 '+r.overall)+'</summary>'+season('一軍',r.official)+season('二軍',r.farm)+(r.abilities?'<h4>保存能力</h4><div class="annual-ability-strip">'+Object.entries(r.abilities).map(([k,v])=>'<span><small>'+h(DRAFT_LABELS[k]||({breaking:'変化',talent:'精神'})[k]||k)+'</small>'+coloredAbility(v)+'</span>').join('')+'</div>':'<p class="small">個別能力の記録なし</p>')+r.titles.map(t=>'<div class="event">'+h(t.title)+(t.league?' · '+leagueName(t.league):'')+'</div>').join('')+(r.titlesMore?'<p>ほか '+r.titlesMore+'件（元記録は保持）</p>':'')+'</details>').join('')+'<div class="chips"><button class="btn outline" data-action="canonical-history-prev" '+(slotOpening||d.offset===0?'disabled':'')+'>新しい年度</button><button class="btn outline" data-action="canonical-history-next" '+(slotOpening||d.nextOffset===null?'disabled':'')+'>古い年度</button></div></section><section class="panel"><h3>GMメモ</h3><textarea class="player-memo" id="canonical-player-memo" maxlength="2000" '+(blocked?'disabled':'')+'>'+h(d.memo)+'</textarea><button class="btn primary full" data-action="canonical-memo-save" '+(blocked?'disabled':'')+'>メモを保存する</button><p class="small">2000文字以内。明示的に保存します。</p></section>';
  }
  async function canonicalLoadHistory(offset){
    if(slotOpening||ui.page!=='canonical-player'||!accountCurrent()||!canonicalSnapshot?.game?.club?.roster.some(p=>p.id===canonicalPlayerId))return;
    const epoch=canonicalEpoch,id=canonicalPlayerId,scroll=draftScrollY();
    slotOpening=true;render();
    try{
      const r=await canonicalPilot.playerPage({playerId:id,offset,limit:10});
      if(epoch!==canonicalEpoch)return;
      if(r.status!=='ready'||r.page.playerId!==id)throw Error('history observation required');
      canonicalHistory=r.page;
    }catch{if(epoch===canonicalEpoch){canonicalSnapshot=null;canonicalHistory=null;}}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(scroll);}}
  }
  function canonicalReadOnlyRender(){
    const app=$('#app'),g=canonicalSnapshot?.game,c=g?.club;
    if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-info-back">‹ '+(ui.page==='canonical-player'?'全選手':'本部')+'</button></div>';
    if(!g||!accountCurrent()){app.innerHTML='<div class="setup-screen">'+top+'<p>確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-info-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    let body='';
    if(ui.page==='canonical-standings'){
      const league=canonicalLeague||g.team.league,rows=g.headquarters.standings[league];
      body='<h2 class="page-title">順位表</h2><p class="page-sub">'+g.year+'年　第'+g.day+'/143試合終了</p><div class="chips">'+['E','W'].map(l=>'<button class="chip league-tab '+leagueClass(l)+' '+(l===league?'active':'')+'" data-action="canonical-league" data-league="'+l+'">'+leagueName(l)+'</button>').join('')+'</div><section class="panel league-panel '+leagueClass(league)+'">'+standingTableMarkup(league,rows,g.team.id,g.day)+'</section>';
    }else if(!c){body='<p role="status">入団・イベントの確認が必要なため選手情報は公開できません。</p>';}
    else if(ui.page==='canonical-player'){
      const row=c.roster.find(p=>p.id===canonicalPlayerId);
      if(!row)body='<p>選手情報を取得できません。</p>';
      else{const p=canonicalPlayerModel(row,g),blocked=slotOpening||!c.canManage||!!canonicalSnapshot.pending?.length;
        const focus='<section class="panel"><h3>シーズン育成方針</h3><p class="small">重点育成する能力を選択します。</p><div class="chips">'+['balanced',...Object.keys(row.abilities)].map(k=>'<button class="chip '+(row.focus===k?'active':'')+'" data-action="canonical-focus" data-key="'+h(k)+'" '+(blocked||row.focus===k?'disabled':'')+'>'+h(k==='balanced'?'バランス':DRAFT_LABELS[k]||k)+'</button>').join('')+'</div></section>';
        body='<div class="player-profile"><div class="player-club">'+h(g.team.name)+' · '+positionMarkup(p.pos)+'</div><div class="profile-row profile-upper-row">'+playerUpperPortrait(p)+'<div><h2>'+themedPlayerName(p)+' <small>('+p.age+')</small></h2><div class="profile-meta">'+throwBat(p)+' · '+fmtSalary(p.salary)+'</div><div class="profile-meta">総合 '+rating(p)+' · 愛着 ♥'+p.affinity+'</div></div></div></div><div class="player-detail-condition">'+conditionBar(p)+'</div><section class="panel"><h3>能力・適性</h3>'+annualAbilityStrip(p)+'<p>'+positionMarkup(p.pos)+(p.subPos?' / '+positionMarkup(p.subPos):'')+'</p></section><section class="panel"><h3>今季の公式戦成績</h3>'+statDisplayGrid(p)+'</section>'+canonicalUniformMarkup(p,g)+focus+canonicalHistoryMarkup(p,blocked);
      }
    }else{
      const rows=c.roster.map(p=>canonicalPlayerModel(p,g)).sort((a,b)=>rating(b)-rating(a)||a.id-b.id);
      body='<h2 class="page-title">全選手</h2><p class="page-sub">所属 '+rows.length+' / '+c.rosterLimit+'人</p>'+[false,true].map(pitch=>{const group=rows.filter(p=>isPitch(p)===pitch);return '<div class="section-label">'+(pitch?positionMarkup('P','投手'):'野手')+'（'+group.length+'人）</div>'+group.map(p=>playerCardMarkup(p,false,true)).join('');}).join('');
    }
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(g.team)+'">'+top+'<main class="main">'+(canonicalOpsNote?'<p role="status">'+h(canonicalOpsNote)+'</p>':'')+body+'</main></div>';
  }
  let canonicalFreePage=null,canonicalFreeQuery='',canonicalRotationSlot=null,canonicalOpsNote='';
  let canonicalManagerEntry=true;
  let canonicalTrade=null,canonicalTradeQuote=null,canonicalTradeClub=null;
  async function canonicalTradeRead(command){
    if(slotOpening||!accountCurrent()||!canonicalSnapshot?.game?.club?.tradeAvailable||canonicalSnapshot.pending?.length)return;
    const epoch=canonicalEpoch;slotOpening=true;canonicalTradeQuote=null;if(command.mode==='list'){canonicalTrade=null;canonicalTradeClub=command.clubId;}render();
    try{const r=await canonicalPilot.tradePage(command);if(epoch!==canonicalEpoch)return;if(r.status!=='ready')throw Error('trade observation required');if(command.mode==='list')canonicalTrade=r.page;else canonicalTradeQuote=r.page;}
    catch{if(epoch===canonicalEpoch){canonicalSnapshot=null;canonicalTrade=null;canonicalTradeQuote=null;}}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();}}
  }
  function canonicalTradeMarkup(g,blocked){
    const c=g.club,p=canonicalTrade,q=canonicalTradeQuote,dis=blocked?'disabled':'';
    if(!c.tradeAvailable)return '<section class="panel"><h2>シーズン中トレード</h2><p>開幕後から7月31日まで。重要イベント・報酬の確定後に利用してください。</p></section>';
    const clubs=c.standings.filter(x=>x.id!==g.team.id),options=clubs.map(x=>'<option value="'+x.id+'" '+((canonicalTradeClub??p?.clubId)===x.id?'selected':'')+'>'+h(x.name)+'</option>').join('');
    const select=(side,rows,ids)=>Array.from({length:3},(_,i)=>'<label class="small">'+(i+1)+'人目<select class="canonical-trade-pick" data-side="'+side+'" '+dis+'><option value="">選手なし</option>'+rows.map(x=>'<option value="'+x.id+'" '+(ids?.[i]===x.id?'selected':'')+'>'+h(x.name)+' '+h(namePos(x.pos))+' '+x.overall+' · '+fmtSalary(x.salary)+'</option>').join('')+'</select></label>').join('');
    return '<section class="panel"><div class="eyebrow">TRADE MARKET · 7/31 DEADLINE</div><h2>シーズン中トレード</h2><p>各球団最大3名・金銭の組み合わせ。特殊選手、負傷者、保護契約等は対象外。</p><label>交渉球団<select id="canonical-trade-club" '+dis+'>'+options+'</select></label><button class="btn outline full" data-action="canonical-trade-load" '+dis+'>候補を取得する</button>'+(p?'<h3>自球団から提示</h3>'+select('out',p.out,q?.outIds)+'<h3>相手球団から獲得</h3>'+select('in',p.in,q?.inIds)+'<label>移籍金（億円、正：支払い／負：受取）<input id="canonical-trade-fee" type="number" min="-30" max="30" step="0.01" value="'+(q?.fee??0)+'" '+dis+'></label><button class="btn outline full" data-action="canonical-trade-review" '+dis+'>条件を確認する</button>':'')+(q?'<div class="panel canonical-trade-result" role="status"><h3>'+(q.ok?'合意可能な条件':'交渉不成立')+'</h3><p>'+h(q.ok?'移籍金 '+fmtMoney(q.fee)+' · 年俸増減 '+fmtMoney(q.delta):q.reason)+'</p>'+(q.ok?'<button class="btn primary full" data-action="canonical-trade-commit" '+dis+'>この条件で契約する</button>':'')+'</div>':'')+'</section>';
  }
  function canonicalTradeForm(){
    const p=canonicalTrade,fee=$('#canonical-trade-fee'),club=Number($('#canonical-trade-club')?.value);
    if(!p||p.clubId!==club||!fee?.validity.valid||fee.value==='')return null;
    const ids=side=>Array.from(document.querySelectorAll('.canonical-trade-pick[data-side="'+side+'"]')).map(x=>x.value).filter(Boolean).map(Number);
    const out=ids('out'),inc=ids('in'),amount=Number(fee.value);if(!out.length&&!inc.length||new Set([...out,...inc]).size!==out.length+inc.length||!out.every(id=>p.out.some(x=>x.id===id))||!inc.every(id=>p.in.some(x=>x.id===id))||!Number.isFinite(amount)||Math.abs(amount)>30||Math.round(amount*100)/100!==amount)return null;
    return {clubId:club,out,in:inc,fee:amount};
  }
  function canonicalTradeEdited(e){
    if(ui.page!=='canonical-trade'||slotOpening||!accountCurrent())return;
    const target=e.target;
    if(target?.id==='canonical-trade-club'){
      const club=Number(target.value);
      if(!canonicalSnapshot?.game?.club?.standings.some(x=>x.id===club&&x.id!==canonicalSnapshot.game.team.id))return;
      if(canonicalTradeClub===club)return;
      canonicalTradeClub=club;canonicalTrade=null;canonicalTradeQuote=null;render();return;
    }
    if(target?.id==='canonical-trade-fee'||target?.classList?.contains('canonical-trade-pick')){
      if(!canonicalTradeQuote)return;
      canonicalTradeQuote=null;
      const result=$('.canonical-trade-result');
      if(result)result.textContent='条件を変更しました。もう一度条件を確認してください。';
    }
  }
  document.addEventListener('input',canonicalTradeEdited,true);
  document.addEventListener('change',canonicalTradeEdited,true);
  const canonicalOpsPages=['canonical-rotation','canonical-farm','canonical-free','canonical-facilities','canonical-manager','canonical-trade'];
  function canonicalOpsRender(){
    const app=$('#app'),g=canonicalSnapshot?.game,c=g?.club;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-ops-back">‹ 本部</button></div>';
    if(!c||!accountCurrent()){
      app.innerHTML='<div class="setup-screen">'+top+'<p role="status">確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-ops-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;
    }
    const blocked=slotOpening||!c.canManage||!!canonicalSnapshot.pending?.length;
    const dis=blocked?'disabled':'',busy=slotOpening?'disabled':'';
    const players=new Map(c.roster.map(p=>[p.id,canonicalPlayerModel(p,g)]));
    const label=p=>p?faceMini(p,{overall:true})+' <strong>'+themedPlayerName(p)+'</strong> '+positionMarkup(p.pos)+' <small>('+p.age+')</small>':'欠員';
    let body='';
    if(ui.page==='canonical-rotation'){
      body='<h2 class="page-title">先発ローテーション</h2><p class="page-sub">変更する枠を選択し、次に先発候補を選択してください。</p><section class="panel">'+c.rotation.map((id,i)=>'<button class="btn '+(canonicalRotationSlot===i?'primary':'outline')+' full" data-action="canonical-rotation-slot" data-slot="'+i+'" '+dis+'>第'+(i+1)+'先発　'+label(players.get(id))+'</button>').join('')+'</section>';
      if(canonicalRotationSlot!==null){
        body+='<section class="panel"><h3>先発候補</h3><p class="small">現在の先発を選ぶと、ローテーション内で入れ替えます。</p>'+c.rotationCandidates.map(id=>players.get(id)).filter(Boolean).map(p=>'<div class="player-card"><div>'+label(p)+'</div>'+annualAbilityStrip(p)+'<button class="btn outline full" data-action="canonical-rotation-pick" data-id="'+p.id+'" '+(blocked||c.rotation[canonicalRotationSlot]===p.id?'disabled':'')+'>この選手に変更</button></div>').join('')+'</section>';
      }
    }else if(ui.page==='canonical-farm'){
      body='<h2 class="page-title">一軍・二軍管理</h2><p class="page-sub">一軍 '+c.roster.filter(p=>p.tier===1).length+' / '+c.farmLimit+'名</p><section class="panel"><h3>入れ替え方針</h3>'+[['auto','監督に任せる'],['manual','手動管理']].map(([mode,t])=>'<button class="btn '+(c.farmMode===mode?'primary':'outline')+' full" data-action="canonical-farm-mode" data-mode="'+mode+'" '+(blocked||c.farmMode===mode?'disabled':'')+'>'+t+'</button>').join('')+'</section>';
      for(const tier of [1,2]){
        const rows=c.roster.filter(p=>p.tier===tier).map(p=>players.get(p.id)).sort((a,b)=>rating(b)-rating(a)||a.id-b.id);
        body+='<div class="section-label">'+(tier===1?'一軍':'二軍')+'（'+rows.length+'名）</div>'+rows.map(p=>'<div class="player-card"><div>'+label(p)+'</div>'+conditionBar(p)+annualAbilityStrip(p)+'<button class="btn outline full" data-action="canonical-farm-move" data-id="'+p.id+'" '+(blocked||!p.canFarmMove?'disabled':'')+'>'+(tier===1?'二軍へ降格':'一軍へ昇格')+'</button></div>').join('');
      }
    }else if(ui.page==='canonical-facilities'){
      const levels=Object.fromEntries(c.facilities.map(f=>[f.key,f.level]));
      const card=f=>{
        const lv=f.level,infra=!['park','food','goods'].includes(f.key),src=infra?photoSource(f.key,campusTier(lv)):null;
        const preview=infra?(src?'<img class="campus-preview facility-detail-photo" src="'+h(src)+'" alt="'+h(f.label)+'">':'<svg class="campus-preview" viewBox="-170 -120 340 235" aria-hidden="true">'+campusBuilding(f.key,lv)+'</svg>'):'';
        return '<section class="panel canonical-facility" data-facility="'+f.key+'"><div class="row" style="gap:12px">'+preview+'<div style="min-width:0;flex:1"><h3>'+h(f.label)+'</h3><b>Lv.'+lv+' / 20</b></div></div>'+campusStageLine(lv)+campusLevelBar(lv)+'<p>年間維持費 <b>'+fmtMoney(f.upkeep)+'</b></p>'+(f.nextCost===null?'<p class="gold-text">最高レベル達成</p>':'<p class="small">次Lv.年間維持費 '+fmtMoney(f.nextUpkeep)+'（増額 '+fmtMoney(Math.round((f.nextUpkeep-f.upkeep)*100)/100)+'）</p>'+(lv>=15?'<p class="infra-warning">Lv.16以降は高額な強化・維持費が必要です。</p>':'')+'<button class="btn primary full" data-action="canonical-facility-change" data-key="'+f.key+'" data-direction="1" '+(blocked||g.team.cash<f.nextCost?'disabled':'')+'>Lv.'+(lv+1)+'へ強化 · '+fmtMoney(f.nextCost)+'</button>')+(lv>1?'<button class="btn outline full" data-action="canonical-facility-change" data-key="'+f.key+'" data-direction="-1" '+dis+'>Lv.'+(lv-1)+'へ縮小（返金なし）</button>':'')+'</section>';
      };
      const total=c.facilities.reduce((n,f)=>n+f.upkeep,0);
      body='<h2 class="page-title">球団施設・球場経営</h2><section class="panel"><div class="grid2"><div class="metric"><div class="lab">球団資金</div><div class="val">'+fmtMoney(g.team.cash)+'</div></div><div class="metric"><div class="lab">年間施設維持費</div><div class="val">'+fmtMoney(Math.round(total*100)/100)+'</div></div><div class="metric"><div class="lab">年間営業収支見込み</div><div class="val">'+fmtMoney(c.forecast)+'</div></div><div class="metric"><div class="lab">運転資金留保目安</div><div class="val">'+fmtMoney(c.reserve)+'</div></div></div><p class="small">強化費は即時支払い、維持費は月次精算。収支見込みは保証値ではありません。</p></section><section class="panel"><h3>本拠地球場</h3><div class="stadium-map">'+stadiumArt(levels.park,levels.food,levels.goods)+'</div><p>収容人数 '+c.capacity.toLocaleString('ja-JP')+'人</p></section>'+c.facilities.map(card).join('');
      body+='<section class="panel"><h3>客席・チケット価格</h3>'+['内野S','内野A','内野B','外野ホーム','外野ビジター'].map((label,i)=>'<label class="stadium-price-row"><span>'+label+'</span><input type="number" class="canonical-price" min="500" max="20000" step="100" value="'+c.prices[i]+'" aria-label="'+label+'" '+(blocked||!c.canPrice?'disabled':'')+'> 円</label>').join('')+'<p class="small">500〜20,000円、100円単位。シーズン中の価格変更は1回まで。</p><button class="btn primary full" data-action="canonical-prices" '+(blocked||!c.canPrice?'disabled':'')+'>価格を確定する</button></section><section class="panel"><h3>年間遠征環境</h3><div class="grid2">'+c.travelCosts.map((cost,i)=>'<button class="btn '+(c.travel===i?'primary':'outline')+'" data-action="canonical-travel" data-index="'+i+'" '+(blocked||c.travel===i?'disabled':'')+'>'+['標準','快適','プレミアム','最高級'][i]+' · '+fmtMoney(cost)+'/年</button>').join('')+'</div><p class="small">遠征費は月次自動精算します。</p></section><section class="panel"><h3>球団支援・待遇改善</h3>'+c.support.map(x=>'<button class="btn outline full" data-action="canonical-support" data-key="'+h(x.key)+'" '+(blocked||!x.eligible?'disabled':'')+'>'+h(x.label)+' · '+fmtMoney(x.cost)+'</button>').join('')+'</section>';
    }else if(ui.page==='canonical-trade'){
      body=canonicalTradeMarkup(g,blocked);
    }else if(ui.page==='canonical-manager'){
      const m=c.manager;
      if(m&&canonicalManagerEntry){body='<div class="room-scene manager-entry"><div class="room-heading"><small>MANAGER’S OFFICE</small><h2>監督面談</h2><small>球団本部 · 監督室</small></div>'+managerPortrait(m,g.team.id)+'<div class="room-dialogue"><b>'+h(m.name)+'監督</b>チームの状態と起用方針について話しましょう。</div><button class="btn primary full" data-action="canonical-manager-enter">面談を始める ›</button></div>';}
      else{
        const grade=x=>'<div class="manager-grade-strip">'+[['野手起用','field'],['投手起用','pitch'],['采配的中','tactical'],['育成力','development']].map(([label,k])=>'<div class="manager-grade"><small>'+label+'</small><b style="color:'+gradeBriefColor(x.ratings[k])+'">'+gradeBrief(x.ratings[k])+'</b></div>').join('')+'</div>';
        const tone=(k,v)=>k==='special'?(v>60?'特殊選手優先':v<40?'能力重視':'バランス'):managerTone(v);
        body='<div class="manager-office room-scene"><div class="room-heading"><small>MANAGER’S OFFICE</small><h2>監督室</h2></div>'+(m?'<div class="room-dialogue"><b>'+h(m.name)+'監督</b>'+g.team.wins+'勝'+g.team.losses+'敗'+g.team.ties+'分。今後の采配とチーム方針について確認しましょう。</div><section class="panel manager-sheet"><div class="manager-profile">'+managerPortrait(m,g.team.id)+'<div class="manager-identity"><strong>'+h(m.name)+'監督</strong><small>'+m.age+'歳 · '+h(m.style)+'タイプ</small><small>在任 '+m.tenure+'年目 · 残契約 '+m.contractYears+'年 · 年俸 '+fmtMoney(m.salary)+'</small></div></div>'+grade(m)+'<div class="manager-relations"><div><span>信頼</span><b>'+Math.round(m.trust)+'</b></div><div class="'+(m.discontent>=55?'is-warning':'')+'"><span>不満</span><b>'+Math.round(m.discontent)+'</b></div></div>'+(m.risk?'<div class="manager-warning">'+h(m.risk)+'</div>':'')+'<button class="btn primary full" data-action="canonical-manager-renew" '+(blocked||!m.renewAvailable?'disabled':'')+'>契約更改を申し出る · '+fmtMoney(m.renewFee)+'</button></section><section class="panel manager-orders-panel"><h3>GM戦術方針</h3><p class="small">指定しない項目は監督が判断します。指示は次の試合から反映され、監督との方針の衝突は不満につながります。</p>'+m.orders.map(o=>'<div class="manager-strategy"><div class="manager-strategy-head"><strong>'+h(o.label)+'</strong><div class="manager-traits"><span>監督の傾向 <b>'+tone(o.key,o.tendency)+'</b></span><span>現在の采配 <b>'+tone(o.key,o.effective)+'</b></span></div></div><div class="manager-options">'+[['auto','監督に任せる'],['attack',o.attack],['safe',o.safe]].map(([v,label])=>'<button class="manager-option '+(v===o.value?'selected':'')+'" data-action="canonical-manager-order" data-key="'+h(o.key)+'" data-value="'+v+'" aria-pressed="'+(v===o.value)+'" '+(blocked||v===o.value?'disabled':'')+'>'+h(label)+'</button>').join('')+'</div></div>').join('')+'</section><section class="panel manager-activity-panel"><h3>最近の監督采配</h3><p>直近'+m.recent.games+'試合 · '+m.recent.total+'件</p>'+m.recent.items.map(x=>'<div class="manager-activity-row"><b>第'+x.gameNo+'戦 · '+x.inning+'回'+h(x.side)+'</b><span>'+h(x.label)+' '+h(x.inName)+' <small>（'+h(x.outName)+'に代わって出場）</small></span></div>').join('')+(!m.recent.total?'<p class="small">現在の監督による選手交代の記録はありません。</p>':'')+'</section>':'<p class="empty">監督情報なし</p>')+'<section class="panel manager-candidates"><h3>監督候補を比較して雇用</h3>'+c.managerCandidates.map(x=>'<div class="player-card"><div class="manager-profile">'+managerPortrait(x,g.team.id)+'<div><strong>'+h(x.name)+'</strong><p>'+x.age+'歳 · '+h(x.style)+'タイプ</p></div></div>'+grade(x)+'<p>年俸 '+fmtMoney(x.salary)+' · '+x.contractYears+'年契約 · 雇用費 '+fmtMoney(x.fee)+'</p><button class="btn outline full" data-action="canonical-manager-hire" data-slot="'+x.slot+'" '+(blocked||x.current||g.team.cash<x.fee?'disabled':'')+'>監督として雇用</button></div>').join('')+'</section></div>';
      }
    }else{
      const p=canonicalFreePage;
      body='<h2 class="page-title">自由契約選手の獲得</h2><section class="panel"><label for="canonical-free-query">選手名で検索</label><input id="canonical-free-query" maxlength="80" value="'+h(canonicalFreeQuery)+'" '+busy+'><button class="btn primary full" data-action="canonical-free-search" '+busy+'>検索する</button></section>';
      if(p){
        body+='<p class="page-sub">'+(p.total?p.offset+1:0)+'〜'+(p.offset+p.items.length)+' / '+p.total+'名</p>'+p.items.map(r=>'<div class="player-card"><strong>'+h(r.name)+' ('+r.age+')</strong> '+positionMarkup(r.pos)+'<p>総合 '+r.overall+' · 年俸 '+fmtSalary(r.salary)+' · 獲得費 '+fmtMoney(r.cost)+'</p><button class="btn outline full" data-action="canonical-free-sign" data-id="'+r.id+'" '+(blocked||c.roster.length>=c.rosterLimit?'disabled':'')+'>獲得する</button></div>').join('')+(p.items.length?'':'<p class="empty">該当する選手はいません。</p>')+'<div class="chips"><button class="btn outline" data-action="canonical-free-prev" '+(slotOpening||p.offset===0?'disabled':'')+'>前のページ</button><button class="btn outline" data-action="canonical-free-next" '+(slotOpening||p.nextOffset===null?'disabled':'')+'>次のページ</button></div>';
      }else body+='<p role="status">'+(slotOpening?'選手一覧を取得しています。':'検索するを押して一覧を取得してください。')+'</p>';
    }
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(g.team)+'">'+top+'<main class="main">'+(canonicalOpsNote?'<p role="status">'+h(canonicalOpsNote)+'</p>':'')+(blocked?'<p class="small">現在は変更できません。閲覧のみ可能です。</p>':'')+body+'</main></div>';
  }
  async function canonicalOpsRequest(command){
    if(slotOpening||!accountCurrent()||!canonicalSlot)return;
    const old=canonicalSnapshot,world=old?.world||canonicalHqWorld,epoch=canonicalEpoch,scroll=draftScrollY();
    if(command&&(!old?.game?.club?.canManage||old.pending?.length))return;
    slotOpening=true;canonicalOpsNote='';render();
    try{
      const r=await(command?canonicalPilot.advance(command):canonicalPilot.refresh());
      if(epoch!==canonicalEpoch)return;
      if(r.status!=='ready'||r.snapshot.world!==world)throw Error('observation required');
      canonicalSnapshot=r.snapshot;canonicalRotationSlot=null;canonicalFreePage=null;canonicalHistory=null;canonicalTrade=null;canonicalTradeQuote=null;
      canonicalOpsNote=command?'サーバーに変更を保存しました。':'最新状態を取得しました。';
    }catch{if(epoch===canonicalEpoch){canonicalSnapshot=null;canonicalFreePage=null;canonicalRotationSlot=null;canonicalHistory=null;}}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(scroll);}}
    if(epoch===canonicalEpoch&&canonicalSnapshot?.game?.club&&ui.page==='canonical-free')void canonicalLoadFree(0,canonicalFreeQuery);
    if(epoch===canonicalEpoch&&canonicalSnapshot?.game?.club&&ui.page==='canonical-player'&&command?.club==='memo')void canonicalLoadHistory(0);
  }
  async function canonicalLoadFree(offset,query){
    if(slotOpening||!accountCurrent()||ui.page!=='canonical-free'||!canonicalSnapshot?.game?.club)return;
    const epoch=canonicalEpoch;canonicalFreeQuery=query;canonicalFreePage=null;slotOpening=true;render();
    try{
      const r=await canonicalPilot.freePage({offset,limit:30,query});
      if(epoch!==canonicalEpoch)return;
      if(r.status!=='ready')throw Error('observation required');
      canonicalFreePage=r.page;
    }catch{if(epoch===canonicalEpoch){canonicalFreePage=null;canonicalSnapshot=null;}}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(0);}}
  }
  function canonicalOpsClick(b){
    const act=b.dataset.action,c=canonicalSnapshot?.game?.club;
    if(act==='canonical-ops-back'){canonicalFreePage=null;canonicalRotationSlot=null;canonicalOpsNote='';ui.page='canonical-hq';render();draftJump(0);return;}
    if(act==='canonical-ops-refresh'){void canonicalOpsRequest(null);return;}
    if(!c||!accountCurrent()||slotOpening)return;
    if(ui.page==='canonical-free'){
      if(act==='canonical-free-search'){const q=String($('#canonical-free-query')?.value||'').trim();if(q.length<=80&&!Array.from(q).some(ch=>ch.charCodeAt(0)<32))void canonicalLoadFree(0,q);return;}
      if(act==='canonical-free-prev'&&canonicalFreePage?.offset>0){void canonicalLoadFree(Math.max(0,canonicalFreePage.offset-30),canonicalFreeQuery);return;}
      if(act==='canonical-free-next'&&Number.isSafeInteger(canonicalFreePage?.nextOffset)){void canonicalLoadFree(canonicalFreePage.nextOffset,canonicalFreeQuery);return;}
    }
    if(ui.page==='canonical-manager'&&act==='canonical-manager-enter'){canonicalManagerEntry=false;render();draftJump(0);return;}
    if(!c.canManage||canonicalSnapshot.pending?.length)return;
    if(ui.page==='canonical-trade'){
      if(act==='canonical-trade-load'){const clubId=Number($('#canonical-trade-club')?.value);if(c.standings.some(x=>x.id===clubId&&x.id!==canonicalSnapshot.game.team.id))void canonicalTradeRead({mode:'list',clubId});return;}
      const form=canonicalTradeForm();if(!form){showToast('交渉球団・選手・金額を確認してください。',true);return;}
      if(act==='canonical-trade-review')void canonicalTradeRead({mode:'quote',...form});
      if(act==='canonical-trade-commit'){const q=canonicalTradeQuote;if(q?.ok&&q.clubId===form.clubId&&q.fee===form.fee&&JSON.stringify(q.outIds)===JSON.stringify(form.out)&&JSON.stringify(q.inIds)===JSON.stringify(form.in)&&window.confirm('この条件で移籍を確定しますか？'))void canonicalOpsRequest({club:'season-trade',...form,confirmed:true});else showToast('条件を再確認してください。',true);}
      return;
    }
    const id=Number(b.dataset.id),row=c.roster.find(p=>p.id===id);
    if(ui.page==='canonical-rotation'){
      if(act==='canonical-rotation-slot'){const i=Number(b.dataset.slot);if(Number.isSafeInteger(i)&&i>=0&&i<c.rotation.length){canonicalRotationSlot=i;render();}return;}
      if(act==='canonical-rotation-pick'&&canonicalRotationSlot!==null&&c.rotationCandidates.includes(id)&&id!==c.rotation[canonicalRotationSlot])void canonicalOpsRequest({club:'rotation',slot:canonicalRotationSlot,playerId:id});
    }else if(ui.page==='canonical-farm'){
      if(act==='canonical-farm-mode'&&['auto','manual'].includes(b.dataset.mode)&&b.dataset.mode!==c.farmMode&&window.confirm('一・二軍の管理方針を変更しますか？'))void canonicalOpsRequest({club:'farm-mode',value:b.dataset.mode});
      if(act==='canonical-farm-move'&&row?.canFarmMove&&window.confirm(row.name+'選手を'+(row.tier===1?'二軍へ降格':'一軍へ昇格')+'しますか？（手動管理になります）'))void canonicalOpsRequest({club:'farm-move',playerId:id});
    }else if(ui.page==='canonical-facilities'){
      const f=c.facilities.find(x=>x.key===b.dataset.key),dir=Number(b.dataset.direction);
      if(act==='canonical-facility-change'&&f&&[-1,1].includes(dir)){
        if(dir===1&&(f.nextCost===null||canonicalSnapshot.game.team.cash<f.nextCost)||dir===-1&&f.level<=1)return;
        const question=f.label+' Lv.'+f.level+' → Lv.'+(f.level+dir)+(dir===1?' に強化しますか？ 強化費 '+fmtMoney(f.nextCost)+' / 年間維持費 '+fmtMoney(f.nextUpkeep):' に縮小しますか？ 返金はありません。');
        if(window.confirm(question))void canonicalOpsRequest({club:'facility',key:f.key,direction:dir});return;
      }
      if(act==='canonical-prices'&&c.canPrice){
        const values=[...document.querySelectorAll('.canonical-price')].map(el=>Number(el.value));
        if(values.length!==5||values.some(v=>!Number.isSafeInteger(v)||v<500||v>20000||v%100)){showToast('500〜20,000円、100円単位で設定してください。',true);return;}
        if(values.every((v,i)=>v===c.prices[i]))return;
        if(window.confirm('5席種のチケット価格を確定しますか？'))void canonicalOpsRequest({club:'prices',values});return;
      }
      if(act==='canonical-travel'){const v=Number(b.dataset.index);if([0,1,2,3].includes(v)&&v!==c.travel&&window.confirm('年間遠征環境を変更しますか？ 年間費用 '+fmtMoney(c.travelCosts[v])))void canonicalOpsRequest({club:'travel',value:v});return;}
      if(act==='canonical-support'){const x=c.support.find(x=>x.key===b.dataset.key&&x.eligible);if(x&&window.confirm(x.label+'を実施しますか？ '+fmtMoney(x.cost)))void canonicalOpsRequest({club:'support',key:x.key});return;}
    }else if(ui.page==='canonical-manager'){
      const m=c.manager;
      if(act==='canonical-manager-order'&&m){const o=m.orders.find(o=>o.key===b.dataset.key),v=b.dataset.value;if(o&&['auto','attack','safe'].includes(v)&&o.value!==v)void canonicalOpsRequest({club:'manager-order',key:o.key,value:v});return;}
      if(act==='canonical-manager-hire'){const x=c.managerCandidates.find(x=>x.slot===Number(b.dataset.slot)&&!x.current);if(x&&canonicalSnapshot.game.team.cash>=x.fee&&window.confirm(x.name+'を監督として雇用しますか？ '+fmtMoney(x.fee)))void canonicalOpsRequest({club:'manager-hire',slot:x.slot,confirmed:true});return;}
      if(act==='canonical-manager-renew'&&m?.renewAvailable&&window.confirm(m.name+'監督に契約更改を申し出ますか？ '+fmtMoney(m.renewFee)))void canonicalOpsRequest({club:'manager-renew',confirmed:true});
    }else if(ui.page==='canonical-free'&&act==='canonical-free-sign'){
      const r=canonicalFreePage?.items.find(p=>p.id===id);
      if(r&&c.roster.length<c.rosterLimit&&window.confirm(r.name+'選手を獲得しますか？ 獲得費 '+fmtMoney(r.cost)+' / 年俸 '+fmtSalary(r.salary)))void canonicalOpsRequest({club:'sign',playerId:id,confirmed:true});
    }
  }
  function canonicalRosterRender(){
    const app=$('#app'),s=canonicalRoster,g=canonicalSnapshot?.game,c=g?.club;
    if(!app)return;
    const head='<div class="setup-screen"><div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-roster-back">‹ 保存確認</button></div>';
    if(!s||!c){
      app.innerHTML=head+'<p role="status">編成の確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-roster-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button><button class="btn outline full" data-action="canonical-return">データ選択へ戻る</button></div>';return;
    }
    const players=new Map(c.roster.map(p=>[p.id,canonicalPlayerModel(p,g)]));
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
  let canonicalPlayback='normal',canonicalTarget=null,canonicalRunning=false,canonicalStop=false;
  const canonicalCanRun=g=>!!g?.headquarters?.canCalendar&&!canonicalSnapshot?.pending?.length&&accountCurrent();
  let canonicalRewardReturn='canonical-hq',canonicalRewardNote='',canonicalRights=null,canonicalRightsBusy=false;
  let canonicalAchievementPage=null,canonicalAchievementNote='',canonicalMemorial=null,canonicalMemorialBusy=false;
  function canonicalAnniversaryMarkup(label,year,preview=false){
    if(!canonicalOwnDecor('anniversary'))return '';
    return '<section class="panel" data-canonical-anniversary="'+(preview?'preview':'record')+'" style="background:radial-gradient(ellipse at top,#554724,#111d2c 75%);color:#fff0c7;border:3px double #e4c37b;overflow:hidden;text-align:center;padding:18px"><style>@keyframes pl-anniversary-glow{0%{opacity:.35;transform:scale(.96)}100%{opacity:1;transform:scale(1)}}@media(prefers-reduced-motion:no-preference){[data-canonical-anniversary] svg{animation:pl-anniversary-glow 1.5s ease-out both}}</style><small>CLUB ANNIVERSARY · '+(preview?'演出見本':'記念実績')+'</small><svg viewBox="0 0 300 128" style="display:block;width:100%;max-width:300px;margin:auto" aria-hidden="true"><g fill="none" stroke="#dfc07a"><circle cx="150" cy="64" r="48"/><circle cx="150" cy="64" r="41"/><path d="M150 23L162 48 189 51 169 70 174 98 150 85 126 98 131 70 111 51 138 48Z" fill="#d9b66c"/><path d="M12 101L91 75M288 101L209 75M28 25L96 46M272 25L204 46M150 0V12M150 116V128" stroke-width="2"/></g></svg><h2 style="color:inherit">'+h(label)+'</h2>'+(preview?'<p>実績を獲得した表示ではありません。到達後に演出を閲覧できます。</p>':'<p>'+h(String(year))+'年の保存済み記録</p>')+'<p class="small" style="color:inherit">演出のみ。能力・ポイント付与・日程進行は変わりません。</p></section>';
  }
  function canonicalAchievementRender(){
    const app=$('#app'),snap=canonicalSnapshot,g=snap?.game,p=canonicalAchievementPage;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-achievements-back">‹ 報酬へ</button></div>';
    const dis=slotOpening||!snap||!!snap.pending?.length;
    const btn=(label,choice,id)=>'<button class="btn outline" data-action="canonical-achievements-claim" data-choice="'+choice+'" data-id="'+h(id)+'" '+(dis?'disabled':'')+'>'+label+'</button>';
    const preview=canonicalMemorial&&snap&&canonicalMemorial.world===snap.world&&canonicalMemorial.revision===snap.revision?'<section class="panel" data-canonical-memorial><h3>記念アート（試作）</h3><img alt="記念アート" style="width:100%;height:auto;max-width:360px;display:block;margin:auto" src="'+h(canonicalMemorial.url)+'">'+(canonicalOwnDecor('frame')||canonicalOwnDecor('deluxeCard')?'<div class="chips"><button class="btn outline" data-action="canonical-achievements-frame" data-frame="standard" aria-pressed="'+(canonicalMemorial.frame==='standard')+'">標準枠</button>'+(canonicalOwnDecor('frame')?'<button class="btn outline" data-action="canonical-achievements-frame" data-frame="foil" aria-pressed="'+(canonicalMemorial.frame==='foil')+'">金箔記念枠</button>':'')+(canonicalOwnDecor('deluxeCard')?'<button class="btn outline" data-action="canonical-achievements-frame" data-frame="deluxe" aria-pressed="'+(canonicalMemorial.frame==='deluxe')+'">最高級カード</button>':'')+'</div>':'')+'<div class="chips"><button class="btn primary" data-action="canonical-achievements-share" '+(canonicalMemorialBusy?'disabled':'')+'>画像を共有・保存</button><button class="btn outline" data-action="canonical-achievements-art-close">閉じる</button></div><p class="small">SNS投稿は不要です。画像はゲーム内の記念作品です。</p></section>':'';
    const museum=!!snap?.wallet?.owned?.includes('museum')&&accountCurrent();
    const museumHeader=museum?'<section data-canonical-museum class="panel" style="background:linear-gradient(135deg,#18232d,#354553);color:#f8eed7;border:1px solid #b9a57d;border-radius:14px;padding:16px"><small>PENNANT LAB · CLUB MUSEUM</small><h2 style="color:inherit">球団博物館</h2><p>保存された自球団の実績 '+(p?.total??'確認中')+'件</p><p class="small" style="color:inherit">展示作品は下の実績から開けます。報酬・能力には影響しません。</p></section>':'';
    const body='<h2 class="page-title">記念実績・報酬</h2>'+museumHeader+preview+(snap?.wallet?'<p>広告券 '+snap.wallet.tickets+' / 30 · ポイント '+snap.wallet.points+'</p>':'')+'<p class="small">サーバーに記録された自球団の実績のみ対象です。権利や受け取り制限はサーバーが判定します。記念アートの保存・共有は任意で、報酬の受け取りとは無関係です。</p>'+(canonicalAchievementNote?'<p role="status">'+h(canonicalAchievementNote)+'</p>':'')+(p&&snap?'<p>'+(p.total?p.offset+1:0)+'〜'+(p.offset+p.items.length)+' / '+p.total+'件</p>'+p.items.map(e=>'<article class="panel" '+(museum?'data-canonical-museum-exhibit style="border:1px solid #b9a57d;border-left:5px solid #b9a57d"':'')+'><h3>'+h(e.label)+'</h3>'+(e.art?.kind==='anniversary'?canonicalAnniversaryMarkup(e.label,e.art.year):'')+'<button class="btn outline full" data-action="canonical-achievements-art" data-id="'+h(e.eventId)+'" '+(slotOpening?'disabled':'')+'>記念アートを開く</button>'+(e.claimed?'<p>受け取り済み</p>':'<div class="chips">'+btn('広告券を希望','ticket',e.eventId)+btn('ポイントを希望','point',e.eventId)+'</div>')+'</article>').join('')+'<div class="chips"><button class="btn outline" data-action="canonical-achievements-prev" '+(slotOpening||p.offset===0?'disabled':'')+'>前のページ</button><button class="btn outline" data-action="canonical-achievements-next" '+(slotOpening||p.nextOffset===null?'disabled':'')+'>次のページ</button></div>':'<p role="status">'+(slotOpening?'実績を確認しています。':'最新状態を取得してください。自動再送は行いません。')+'</p>')+'<button class="btn outline full" data-action="canonical-achievements-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button>';
    app.innerHTML='<div class="app-shell" '+(g?'style="'+clubThemeStyle(g.team)+'"':'')+'>'+top+'<main class="main">'+body+'</main></div>';
  }
  async function canonicalAchievementRequest(offset,claim=null,refresh=false){
    if(slotOpening||!accountCurrent()||!canonicalSlot)return;
    const epoch=canonicalEpoch,world=canonicalSnapshot?.world||canonicalHqWorld;slotOpening=true;canonicalAchievementNote='';canonicalAchievementPage=null;canonicalMemorial=null;render();
    try{
      if(claim||refresh||!canonicalSnapshot){const r=await(claim?canonicalPilot.claimAchievement(claim.id,claim.choice,true):canonicalPilot.refresh());if(epoch!==canonicalEpoch)return;if(r.status!=='ready'||r.snapshot.world!==world)throw Error('achievement observation required');canonicalSnapshot=r.snapshot;if(claim){const v=r.claimResult;canonicalAchievementNote=v?.ok?'受け取りを確認しました：'+(v.kind==='ticket'?'広告券':'ポイント')+' '+v.amount:({duplicate:'受け取り済みです。',cooldown:'受け取り制限中です。',capacity:'広告券が上限に達しています。'})[v?.reason]||'受け取り状況を確認してください。';}}
      const r=await canonicalPilot.achievementPage({offset,limit:30});if(epoch!==canonicalEpoch)return;if(r.status!=='ready')throw Error('achievement page required');canonicalAchievementPage=r.page;
    }catch{if(epoch===canonicalEpoch){canonicalSnapshot=null;canonicalAchievementPage=null;}}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(0);}}
  }
  function canonicalAchievementClick(b){
    const act=b.dataset.action,p=canonicalAchievementPage;
    if(act==='canonical-achievements-back'){canonicalMemorial=null;ui.page='canonical-rewards';void canonicalRewardRequest(null);return;}
    if(act==='canonical-achievements-refresh'){void canonicalAchievementRequest(0,null,true);return;}
    if(!p||!canonicalSnapshot)return;
    if(act==='canonical-achievements-art'){canonicalDrawMemorial(b.dataset.id,'standard');return;}
    if(act==='canonical-achievements-frame'){if(canonicalMemorial&&!canonicalMemorialBusy&&canonicalFrameAllowed(b.dataset.frame))canonicalDrawMemorial(canonicalMemorial.eventId,b.dataset.frame);return;}
    if(act==='canonical-achievements-art-close'){canonicalMemorial=null;render();return;}
    if(act==='canonical-achievements-share'){void canonicalShareMemorial();return;}
    if(act==='canonical-achievements-prev'&&p.offset>0)void canonicalAchievementRequest(Math.max(0,p.offset-30));
    else if(act==='canonical-achievements-next'&&p.nextOffset!==null)void canonicalAchievementRequest(p.nextOffset);
    else if(act==='canonical-achievements-claim'&&!canonicalSnapshot.pending?.length&&p.items.some(e=>e.eventId===b.dataset.id&&!e.claimed)&&['ticket','point'].includes(b.dataset.choice)&&window.confirm('この実績の報酬を受け取りますか？'))void canonicalAchievementRequest(p.offset,{id:b.dataset.id,choice:b.dataset.choice});
  }
  function canonicalFrameAllowed(frame){return frame==='standard'||frame==='foil'&&canonicalOwnDecor('frame')||frame==='deluxe'&&canonicalOwnDecor('deluxeCard');}
  function canonicalDrawMemorial(eventId,frame){
    const e=canonicalAchievementPage?.items.find(e=>e.eventId===eventId),snap=canonicalSnapshot;
    if(!e||!snap||!accountCurrent()||!window.PennantMemorialArt||canonicalMemorialBusy||slotOpening||!canonicalFrameAllowed(frame))return;
    try{const canvas=document.createElement('canvas'),m=window.PennantMemorialArt.draw(canvas,e,{frame}),url=canvas.toDataURL('image/png');if(!url.startsWith('data:image/png;base64,'))throw Error('image encoding');canonicalMemorial={eventId,frame,url,year:m.year??0,world:snap.world,revision:snap.revision};render();document.querySelector('[data-canonical-memorial]')?.scrollIntoView?.({block:'start'});}catch{showToast('記念アートを生成できませんでした。',true);}
  }
  async function canonicalShareMemorial(){
    const m=canonicalMemorial,epoch=canonicalEpoch;
    if(!m||canonicalMemorialBusy||!accountCurrent()||slotOpening||m.world!==canonicalSnapshot?.world||m.revision!==canonicalSnapshot?.revision)return;
    canonicalMemorialBusy=true;const name='PENNANT_LAB_'+m.year+'_memorial.png';
    try{if(typeof window.PennantNative?.shareImage==='function')await window.PennantNative.shareImage(m.url.slice('data:image/png;base64,'.length),name);else{const a=document.createElement('a');a.href=m.url;a.download=name;a.click();}}
    catch{if(epoch===canonicalEpoch)showToast('画像を共有・保存できませんでした。',true);}
    finally{if(epoch===canonicalEpoch){canonicalMemorialBusy=false;if(ui.page==='canonical-achievements')render();}}
  }
  function canonicalRewardLink(){return '<button class="btn outline full" data-action="canonical-rewards-open">広告券・報酬・慰留</button>';}
  function canonicalProfileMarkup(snap){
    const g=snap?.game,t=g?.team;if(!t||!snap.wallet?.owned?.includes('profile')||!accountCurrent())return '';
    return '<section class="panel" data-canonical-gm-profile style="border:1px solid #a28d60;border-radius:14px;overflow:hidden"><details><summary style="cursor:pointer;font-weight:700;padding:8px 0">GMプロフィール · 記念カード</summary><div style="background:linear-gradient(135deg,#142231,#344658);color:#f6ebcd;border:1px solid #bcaa7c;border-radius:10px;padding:16px"><small>FRONT OFFICE / GENERAL MANAGER</small><h2 style="color:inherit;overflow-wrap:anywhere">'+h(g.gmName||'GM')+'</h2><p style="color:inherit">'+h(t.name)+' · '+g.year+'年</p><p style="color:inherit">'+t.wins+'勝 '+t.losses+'敗 '+t.ties+'分</p><small>保存データに基づく記念表示</small></div></details><p class="small">能力・経営・出現率に影響しません。</p></section>';
  }
  const canonicalDecorCatalog=Object.freeze({hq:[15,'本部テーマ','本部の業務パネルを専用デザインに変更します。'],museum:[20,'博物館','記念実績を専用展示パネルで閲覧できます。'],uniform:[10,'ユニフォーム','選手詳細に球団カラーの限定ユニフォームを追加します。'],emblem:[30,'エンブレム','本部に限定エンブレム展示を追加します。'],deluxeCard:[50,'最高級カード','記念アートに最高級カード枠を追加します。'],anniversary:[100,'創設記念演出','実際の50・100・500・1000年記念実績に専用演出を追加します。報酬画面で見本を確認できます。']});
  function canonicalOwnDecor(key){return accountCurrent()&&canonicalSnapshot?.wallet?.owned?.includes(key)===true;}
  function canonicalUniformMarkup(p,g){
    if(!canonicalOwnDecor('uniform'))return '';
    const color=/^#[0-9a-f]{6}$/i.test(g.team.color)?g.team.color:'#31465b';
    return '<section class="panel" data-canonical-uniform><details><summary>限定ユニフォーム · 選手記念モデル</summary><svg viewBox="0 0 300 200" style="display:block;width:100%;max-width:270px;margin:auto" role="img" aria-label="球団カラーの限定ユニフォーム"><path d="M110 20L65 36 24 78 55 113 78 95 78 180H222V95L245 113 276 78 235 36 190 20Q150 64 110 20Z" fill="'+color+'" stroke="#b9a57d" stroke-width="4"/><path d="M110 20Q150 64 190 20M150 47V180M78 105H222" fill="none" stroke="#eee2bb" stroke-width="3"/><path d="M90 155H140M160 155H210" stroke="#eee2bb" opacity=".7"/><text x="150" y="94" fill="#fff" stroke="#101820" stroke-width=".5" font-size="18" text-anchor="middle" font-weight="bold">'+h(g.team.letter||'PL')+'</text></svg><p>'+h(p.name)+' · '+h(g.team.name)+'</p><p class="small">記念衣装。選手能力・登録情報には影響しません。</p></details></section>';
  }
  function canonicalEmblemMarkup(g){
    if(!canonicalOwnDecor('emblem'))return '';
    return '<section class="panel" data-canonical-emblem><details><summary>限定エンブレム · 球団記念紋章</summary><div style="max-width:220px;margin:12px auto;padding:20px;text-align:center;background:#18232d;color:#f2dfae;border:4px double #c8aa6d;border-radius:40% 40% 18% 18%">'+teamBadge(g.team,'logo')+'<h3 style="color:inherit">'+h(g.team.name)+'</h3><small>CLUB HERITAGE</small></div><p class="small">記念紋章。公式球団ロゴや成績は変更しません。</p></details></section>';
  }
  function canonicalRightsMarkup(snap){
    const r=canonicalRights,owned=new Set(snap.wallet.owned||[]),labels={ticket:'広告券',frame:'カード枠',profile:'GMプロフィール',uniform:'ユニフォーム',hq:'本部テーマ',museum:'博物館',emblem:'エンブレム',deluxeCard:'最高級カード',anniversary:'創設記念演出'};
    const rights=r?'<p>永久広告スキップ：'+(r.adSkip.active?'確認済み・有効':'未保有または無効')+'</p><p>VIP：'+(r.vip.active?'確認済み・有効':'未保有または無効')+'</p>'+(r.vip.active?'<p>有効期限：'+h(new Date(r.vip.expiresAt).toLocaleString('ja-JP'))+'</p>':'')+'<p class="small">確認時刻：'+h(new Date(r.serverNow).toLocaleString('ja-JP'))+'（この時点の状態。利用時にはサーバーで再確認します）</p>':'<p class="small">購入権利は未確認です。下のボタンで確認してください。</p>';
    const rows=Object.entries(window.PennantExchangeCatalog||{}).filter(([k])=>k!=='ticket'&&Object.hasOwn(labels,k)).map(([k,cost])=>'<article class="event"><strong>'+h(labels[k])+' · '+cost+'ポイント</strong>'+(Object.hasOwn(canonicalDecorCatalog,k)?owned.has(k)?'<p class="small">取得済み・'+h(canonicalDecorCatalog[k][2])+'</p>':'<p class="small">'+h(canonicalDecorCatalog[k][2])+'能力・経営には影響しません。</p><button class="btn outline full" data-action="canonical-decor-exchange" data-key="'+k+'" '+(slotOpening||canonicalRightsBusy||snap.pending?.length||snap.wallet.points<cost?'disabled':'')+'>'+cost+'ポイントで交換</button>':k==='profile'?owned.has(k)?'<p class="small">取得済み・本部でGMプロフィールを閲覧できます。</p>':'<p class="small">本部に記念プロフィールを追加します。能力・経営に影響しません。</p><button class="btn outline full" data-action="canonical-profile-exchange" '+(slotOpening||canonicalRightsBusy||snap.pending?.length||snap.wallet.points<cost?'disabled':'')+'>5ポイントで交換</button>':k==='frame'?owned.has(k)?'<p class="small">取得済み・記念アートで金箔枠を選択できます。</p>':'<p class="small">記念画像に金箔枠を追加します。能力・出現率は変わりません。</p><button class="btn outline full" data-action="canonical-frame-exchange" '+(slotOpening||canonicalRightsBusy||snap.pending?.length||snap.wallet.points<cost?'disabled':'')+'>3ポイントで交換</button>':'<p class="small">'+(owned.has(k)?'取得済み（利用画面は準備中）':'提供準備中・ポイントは消費しません')+'</p>')+'</article>').join('');
    return '<section class="panel"><h3>購入権利の確認</h3>'+rights+'<button class="btn outline full" data-action="canonical-rights-refresh" '+(slotOpening||canonicalRightsBusy?'disabled':'')+'>'+(canonicalRightsBusy?'確認中…':'サーバーの購入権利を確認')+'</button><p class="small">試験環境のため購入は受け付けません。</p></section><section class="panel"><h3>ポイント交換品</h3><p class="small">必要ポイントは暫定仕様です。未提供の交換品は取得できません。</p>'+rows+'</section>';
  }
  async function canonicalRightsRefresh(){
    if(slotOpening||canonicalRightsBusy||!accountCurrent()||!canonicalSnapshot)return;
    const epoch=canonicalEpoch;canonicalRights=null;canonicalRightsBusy=true;render();
    try{const r=await canonicalPilot.readEntitlements();if(epoch!==canonicalEpoch||ui.page!=='canonical-rewards'||!accountCurrent())return;if(r.status==='ready')canonicalRights=r.rights;else canonicalRewardNote='購入権利を確認できませんでした。';}
    catch{if(epoch===canonicalEpoch&&ui.page==='canonical-rewards')canonicalRewardNote='購入権利を確認できませんでした。';}
    finally{if(epoch===canonicalEpoch){canonicalRightsBusy=false;if(ui.page==='canonical-rewards')render();}}
  }
  function canonicalRewardRender(){
    const app=$('#app'),snap=canonicalSnapshot,g=snap?.game;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-rewards-back">‹ 戻る</button></div>';
    if(!g||!snap.wallet||!Array.isArray(snap.actions)||!Array.isArray(snap.pending)){app.innerHTML='<div class="setup-screen">'+top+'<p role="status">報酬の確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-rewards-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    const pending=snap.pending,dis=slotOpening?'disabled':'',btn=(kind,id,label,disabled=false)=>'<button class="btn outline full" data-action="canonical-rewards-command" data-kind="'+kind+'" data-id="'+h(id)+'" '+(disabled||slotOpening?'disabled':'')+'>'+label+'</button>';
    const body='<h2 class="page-title">広告券・報酬</h2><section class="panel"><p>広告券 <b>'+snap.wallet.tickets+' / 30</b>　ポイント <b>'+snap.wallet.points+'</b></p><p class="small">試験環境：広告券、サーバーで確認済みの広告スキップ権利のみ利用できます。実広告は未接続です。</p><button class="btn outline full" data-action="canonical-achievements-open">記念実績・報酬を受け取る</button><button class="btn outline full" data-action="canonical-ticket-exchange" '+(slotOpening||pending.length||snap.wallet.points<1||snap.wallet.tickets>=30?'disabled':'')+'>1ポイントを広告券1枚に交換</button><p class="small">記念カード枠・GMプロフィール・ユニフォーム・本部テーマ・博物館・エンブレム・最高級カードも交換できます。創設記念演出も交換できます。</p></section>'+canonicalRightsMarkup(snap)+canonicalAnniversaryMarkup('創設記念セレモニー',null,true)+(canonicalRewardNote?'<p role="status">'+h(canonicalRewardNote)+'</p>':'')+pending.map(p=>'<section class="panel warning"><h3>未確定の報酬</h3><p>結果を確認するまで日程進行は停止します。</p>'+btn('reconcile',p.operationId,'確定結果を照合する')+btn('cancel',p.operationId,'予約の取り消しを申請する')+'</section>').join('')+'<section class="panel"><h3>現在利用可能な報酬</h3>'+snap.actions.filter(a=>['available','cancelled'].includes(a.status)).map(a=>'<article class="event"><strong>'+h(a.label)+'</strong>'+btn('ticket',a.operationId,'広告券・確認済み権利で実行',pending.length>0)+'</article>').join('')+(!snap.actions.some(a=>['available','cancelled'].includes(a.status))?'<p>現在利用できる報酬はありません。</p>':'')+'</section><button class="btn outline full" data-action="canonical-rewards-refresh" '+dis+'>最新状態を取得</button>';
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(g.team)+'">'+top+'<main class="main">'+body+'</main></div>';
  }
  async function canonicalRewardRequest(kind,id){
    if(slotOpening||!accountCurrent()||!canonicalSlot)return;
    const epoch=canonicalEpoch,world=canonicalSnapshot?.world||canonicalHqWorld;slotOpening=true;canonicalRewardNote='';canonicalRights=null;render();
    try{const r=await(kind==='exchange'?canonicalPilot.exchangeTicket(true):kind==='frame'?canonicalPilot.exchangeFrame(true):kind==='profile'?canonicalPilot.exchangeProfile(true):Object.hasOwn(canonicalDecorCatalog,kind)?canonicalPilot.exchangeDecor(kind,true):kind?canonicalPilot.reward(kind,id,true):canonicalPilot.refresh());if(epoch!==canonicalEpoch)return;if(r.status!=='ready'||r.snapshot.world!==world)throw Error('reward observation required');canonicalSnapshot=r.snapshot;canonicalRewardNote=Object.hasOwn(canonicalDecorCatalog,kind)?(r.exchangeOk?'装飾品への交換を確認しました。':'交換できませんでした。最新残高を確認してください。'):kind==='profile'?(r.exchangeOk?'GMプロフィールへの交換を確認しました。':'交換できませんでした。最新残高を確認してください。'):kind==='frame'?(r.exchangeOk?'記念カード枠への交換を確認しました。':'交換できませんでした。最新残高を確認してください。'):kind==='exchange'?(r.exchangeOk?'広告券への交換を確認しました。':'交換できませんでした。最新残高を確認してください。'):({committed:'報酬の適用をサーバーで確認しました。',cancelled:'予約の取り消しを確認しました。',unavailable:'広告券または有効な権利がありません。',awaiting_proof:'広告完了証明がまだ確認できません。',pending:'報酬は未確定です。',settlement_required:'完了証明が確認されました。確定結果を照合してください。',entitlement_expired:'権利の有効期限を確認してください。'})[r.rewardStatus]||'';}
    catch{if(epoch===canonicalEpoch)canonicalSnapshot=null;}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();}}
  }
  function canonicalRewardClick(b){
    const act=b.dataset.action;
    if(canonicalRightsBusy)return;
    if(act==='canonical-rights-refresh'){void canonicalRightsRefresh();return;}
    if(act==='canonical-rewards-back'){canonicalRights=null;ui.page=canonicalRewardReturn;render();draftJump(0);return;}
    if(act==='canonical-rewards-refresh'){void canonicalRewardRequest(null);return;}
    if(act==='canonical-decor-exchange'){const k=b.dataset.key,cost=Object.hasOwn(canonicalDecorCatalog,k)?canonicalDecorCatalog[k][0]:null,w=canonicalSnapshot?.wallet;if(cost!==null&&w&&w.points>=cost&&!w.owned?.includes(k)&&!canonicalSnapshot.pending?.length&&window.confirm(cost+'ポイントで'+canonicalDecorCatalog[k][1]+'を取得しますか？'))void canonicalRewardRequest(k);return;}
    if(act==='canonical-profile-exchange'){const w=canonicalSnapshot?.wallet;if(w&&w.points>=5&&!w.owned?.includes('profile')&&!canonicalSnapshot.pending?.length&&window.confirm('5ポイントでGMプロフィールを取得しますか？'))void canonicalRewardRequest('profile');return;}
    if(act==='canonical-frame-exchange'){const w=canonicalSnapshot?.wallet;if(w&&w.points>=3&&!w.owned?.includes('frame')&&!canonicalSnapshot.pending?.length&&window.confirm('3ポイントで金箔記念カード枠を取得しますか？'))void canonicalRewardRequest('frame');return;}
    if(act==='canonical-ticket-exchange'){const w=canonicalSnapshot?.wallet;if(w&&w.points>=1&&w.tickets<30&&!canonicalSnapshot.pending?.length&&window.confirm('1ポイントを広告券1枚に交換しますか？'))void canonicalRewardRequest('exchange');return;}
    if(act!=='canonical-rewards-command'||!canonicalSnapshot?.wallet)return;
    const k=b.dataset.kind,id=b.dataset.id;
    if(!['ticket','reconcile','cancel'].includes(k))return;
    if(k==='ticket'&&!canonicalSnapshot.actions?.some(a=>a.operationId===id&&['available','cancelled'].includes(a.status)))return;
    if(k!=='ticket'&&!canonicalSnapshot.pending?.some(a=>a.operationId===id))return;
    if(k==='reconcile'||window.confirm(k==='cancel'?'この報酬の予約を取り消しますか？':'広告券1枚または確認済み権利で、この報酬を実行しますか？'))void canonicalRewardRequest(k,id);
  }
  function canonicalMatchReport(r,g){
    if(!r?.home||!r?.away)return '<p class="small">保存済みの試合詳細はありません。</p>';
    const teams=[r.away,r.home],out=r.home.id===g.team.id?r.homeScore-r.awayScore:r.awayScore-r.homeScore;
    const side=(t,n,role)=>'<div style="--match-club:'+clubAccessible(clubIdentity(t).color,'#15283c','#ffffff')+'">'+teamBadge(t,'mini-logo')+'<small>'+role+'</small><strong>'+h(t.short)+'</strong><b>'+n+'</b></div>';
    const name=p=>p?themedPlayerName(p):'記録なし';
    const innings=Math.max(9,r.inningsA.length,r.inningsH.length),cell=n=>Number.isFinite(n)?h(n):'–';
    let body='<section class="review-screen"><div class="review-kicker">'+r.year+' SEASON · 第'+r.day+'戦</div><div class="game-result-hero result-'+(out>0?'win':out<0?'loss':'draw')+'"><div class="result-verdict">'+(out>0?'勝利':out<0?'敗戦':'引き分け')+'</div><div class="normal-match-score" data-normal-match><small>'+h(r.date||'試合結果')+'</small><div>'+side(r.away,r.awayScore,'VISITOR')+'<span>−</span>'+side(r.home,r.homeScore,'HOME')+'</div></div></div><section class="panel"><h3>イニング別スコア</h3><div class="table-wrap"><table class="watch-table result-table"><thead><tr><th>球団</th>'+Array.from({length:innings},(_,i)=>'<th>'+(i+1)+'</th>').join('')+'<th>計</th></tr></thead><tbody>'+teams.map((t,i)=>'<tr><th class="watch-team '+leagueClass(t.league)+'">'+h(t.short)+'</th>'+Array.from({length:innings},(_,j)=>'<td>'+cell((i?r.inningsH:r.inningsA)[j])+'</td>').join('')+'<td>'+cell(i?r.homeScore:r.awayScore)+'</td></tr>').join('')+'</tbody></table></div><h3>主な出来事</h3>'+r.events.map(x=>'<div class="event">'+h(x)+'</div>').join('')+(!r.events.length?'<p class="small">特記事項なし</p>':'')+'<p>先発：'+name(r.spAway)+' / '+name(r.spHome)+'</p></section>';
    if(r.moves){const move=m=>'<div class="event"><strong>'+h(m.inning)+'回 '+h(m.side||'')+' · '+h(m.team)+' · '+h(m.inName||'選手')+'</strong><p class="small">'+h(m.outName||'選手')+'に代わって出場 · '+h(m.role||m.type||'')+(m.reason?' · '+h(m.reason):'')+'</p></div>';body+='<section class="panel manager-match-report"><h3>BENCH REPORT · 監督の采配記録</h3>'+r.moves.slice(0,2).map(move).join('')+(r.moves.length>2?'<details><summary>詳細を開く（残り'+(r.moves.length-2)+'件）</summary>'+r.moves.slice(2).map(move).join('')+'</details>':'')+(!r.moves.length?'<p>選手交代の記録はありません。</p>':'')+'</section>';}
    if(r.box){for(const t of teams.slice().sort((a,b)=>Number(b.id===g.team.id)-Number(a.id===g.team.id))){const table=(kind,keys,labels)=>'<div class="table-wrap"><table class="data-table review-stat-table"><thead><tr><th>選手</th>'+labels.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+r.box[kind].filter(x=>x.teamId===t.id).map(x=>'<tr><td class="name">'+name(x.player)+'</td>'+keys.map(k=>'<td>'+(k==='outs'&&Number.isFinite(x.outs)?Math.floor(x.outs/3)+'.'+x.outs%3:cell(x[k]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';body+='<section class="panel"><h3>'+h(t.name)+' · 個人成績</h3><div class="section-label hitter-heading">野手</div>'+table('bat',['ab','h','hr','rbi','bb'],['打数','安打','本','打点','四球'])+'<div class="section-label pitcher-heading">投手</div>'+table('pitch',['outs','pitches','h','er','k','bb'],['投球回','球数','被安打','自責','奪三振','四球'])+'</section>';}}else body+='<p class="small">この試合には個別成績が保存されていません。</p>';
    return body+'</section>';
  }
  function canonicalPaperMarkup(p){
    if(!p)return '<p>保存済みの新聞はまだありません。</p>';
    const [main,...rest]=p.articles,w=p.weekly;
    return '<section class="daily-newspaper"><div class="paper-dateline"><span>PENNANT LAB SPORTS EDITION</span><span>'+h(p.date)+'</span></div><div class="paper-masthead"><span class="paper-icon">⚾</span><div><small>BASEBALL JOURNAL</small><h1>'+(w?'週刊 球界ニュース':'本日の球界ニュース')+'</h1></div></div><div class="paper-stories"><article class="paper-lead"><div class="paper-kicker">'+h(main.tag)+'</div><h2>'+h(main.headline)+'</h2><p>'+h(main.body)+'</p><div class="paper-highlight">'+h(main.stat||'')+'</div></article><div class="paper-briefs">'+rest.map(a=>'<article class="paper-brief"><div class="paper-kicker">'+h(a.tag)+'</div><h3>'+h(a.headline)+'</h3><p>'+h(a.body)+'</p><b>'+h(a.stat||'')+'</b></article>').join('')+'</div></div>'+(w?'<div class="weekly-section"><h2>'+h(w.teamName)+' · 週間成績</h2><p>'+h(w.start)+' ～ '+h(w.end)+'</p><p>'+w.record.w+'勝 '+w.record.l+'敗 '+w.record.t+'分</p>'+w.scores.map(x=>'<div class="event">'+h(x.date)+' · '+h(x.opponent)+' '+x.rs+' − '+x.ra+'</div>').join('')+'</div>':'')+'<div class="paper-next"><strong>NEXT GAME</strong><span>'+h(p.nextDate||'全日程終了')+' '+h(p.nextOpponent||'')+'</span></div></section>';
  }
  let canonicalReplay=null,canonicalReplaySkip=false;
  function canonicalReplayMarkup(){
    const x=canonicalReplay,r=x?.report;
    if(!x)return '';
    const controls='<div class="watch-controls"><button class="btn outline" data-action="canonical-hq-pause" '+(canonicalStop?'disabled':'')+'>⏸ 日程を一時停止</button><button class="btn primary" data-action="canonical-replay-skip">演出をスキップ ›</button></div>';
    if(x.phase==='date')return '<section class="calendar-date-intro"><div class="calendar-date-kicker">PENNANT SEASON · 確定済み日程</div><div class="calendar-date-window"><div class="calendar-date-current"><span>'+h(formatCalendarDate(x.date,true))+'</span></div></div><div class="calendar-date-caption">'+h(x.label)+'</div></section>'+controls;
    if(x.phase==='paper')return canonicalPaperMarkup(x.paper)+controls;
    if(x.phase==='final')return canonicalMatchReport(r,canonicalSnapshot.game)+controls;
    const shown=r.replay.slice(0,x.step),last=shown.at(-1),completed=shown.filter(v=>v.phase==='end'),active=last&&last.phase!=='end'?last:null;
    const total=id=>completed.filter(v=>v.teamId===id).reduce((n,v)=>n+v.runs,0)+(active?.teamId===id?active.runsAfter:0);
    const side=t=>'<div>'+teamBadge(t)+'<span class="watch-club '+leagueClass(t.league)+'">'+h(t.short)+'</span><strong>'+total(t.id)+'</strong></div>';
    const table=(from,to,totals)=>'<table class="watch-table"><thead><tr><th>球団</th>'+Array.from({length:to-from+1},(_,i)=>'<th>'+(from+i)+'</th>').join('')+(totals?'<th>計</th>':'')+'</tr></thead><tbody>'+[r.away,r.home].map(t=>'<tr><th class="watch-team '+leagueClass(t.league)+'">'+h(t.short)+'</th>'+Array.from({length:to-from+1},(_,i)=>{const n=completed.find(v=>v.inning===from+i&&v.teamId===t.id)?.runs??(active?.inning===from+i&&active?.teamId===t.id?active.runsAfter:null);return '<td class="'+(n===null?'':'played')+'">'+(n===null?'·':n)+'</td>';}).join('')+(totals?'<td class="watch-total">'+total(t.id)+'</td>':'')+'</tr>').join('')+'</tbody></table>';
    const current=last&&(last.teamId===r.away.id?r.away:r.home),label=last?last.inning+'回'+last.side+' · '+current.short+(active?'':' 攻撃終了'):'プレーボール';
    const flash=active?.play?'<div class="watch-scoring-flash watch-scoring-'+(active.play.kind==='hr'?'homer':'strike')+'"><div class="watch-scoring-kicker">'+(active.play.kind==='hr'?'HOME RUN!':'TEN STRIKEOUTS IN A ROW!')+'</div><div class="watch-scoring-player"><span class="watch-scorer-ball">⚾</span><div><strong>'+h(active.play.batterName)+'</strong><b>'+h(active.play.title)+'</b></div></div></div>':'';
    return '<div class="watch-game-screen '+(active?'watch-scored':'')+'"><div class="review-kicker">PENNANT LAB · INNING WATCH</div><section class="panel watch-hero"><div class="watch-overline">保存済み試合の再生 · '+h(r.date)+'</div><div class="watch-score">'+side(r.away)+'<span class="watch-separator">–</span>'+side(r.home)+'</div><div class="watch-inning-info"><strong>'+h(label)+'</strong></div>'+flash+'<div class="watch-progress"><i style="width:'+Math.round(x.step/Math.max(1,r.replay.length)*100)+'%"></i></div></section><section class="panel watch-scoreboard"><h3>イニング別スコア</h3><div class="table-wrap">'+table(1,9,true)+(last?.inning>9?'<div class="watch-extra-label">延長戦</div>'+table(10,last.inning,false):'')+'</div></section><p class="small">サーバーで確定済みの記録を再生しています。</p>'+controls+'</div>';
  }
  async function canonicalPresentDay(g,epoch,full){
    const v=g.headquarters,day=v.lastDay;
    if(!day?.date||canonicalPlayback==='skip'||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
    const live=()=>epoch===canonicalEpoch&&!canonicalStop&&!canonicalReplaySkip&&!document.hidden;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const fast=canonicalPlayback==='fast';canonicalReplaySkip=false;
    try{
      if(!live())return;
      canonicalReplay={phase:'date',date:day.date,label:day.type==='game'?'第'+day.gameNo+'戦':day.reason||'休養日'};render();await wait(fast?180:350);
      if(!live())return;
      const r=v.lastReport,p=v.latestPaper;
      if(day.type==='game'&&r?.date===day.date){
        if(full&&Array.isArray(r.replay)&&r.replay.length){canonicalReplay={phase:'watch',report:r,step:0};render();await wait(fast?80:180);for(let i=1;i<=r.replay.length&&live();i++){canonicalReplay.step=i;render();await wait(r.replay[i-1].phase==='end'?(fast?70:130):(fast?220:500));}}
        if(live()){canonicalReplay={phase:'final',report:r};render();await wait(full?(fast?350:700):(fast?120:250));}
      }else if(p?.date===day.date){canonicalReplay={phase:'paper',paper:p};render();await wait(full?(fast?500:1000):(fast?150:300));}
    }finally{if(epoch===canonicalEpoch){canonicalReplay=null;canonicalReplaySkip=false;}}
  }
  let canonicalArchive=null,canonicalArchiveKind='matches',canonicalArchiveYear=0;
  async function canonicalArchiveLoad(kind,year,offset){
    const g=canonicalSnapshot?.game,decadeEvent=ui.page==='canonical-events'&&kind==='decades'&&g?.inbox?.decade===year&&!g.inbox.finance&&!g.inbox.rare&&!g.inbox.injury&&!g.inbox.career&&!g.inbox.rookie;
    if(slotOpening||!accountCurrent()||!g||!g.headquarters?.archiveAvailable&&!decadeEvent)return;
    const epoch=canonicalEpoch;canonicalArchiveKind=kind;canonicalArchiveYear=year;canonicalArchive=null;slotOpening=true;render();
    try{const r=await canonicalPilot.reportPage({kind,year,offset,limit:kind==='papers'?3:1});if(epoch!==canonicalEpoch)return;if(r.status!=='ready')throw Error('archive observation required');canonicalArchive=r.page;}
    catch{if(epoch===canonicalEpoch){canonicalSnapshot=null;canonicalArchive=null;}}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(0);}}
  }
  function canonicalDecadeMarkup(r,g){
    if(!r)return '';
    const empty='<p class="small">該当する保存済み記録はありません。</p>',me=r.teams.find(t=>t.id===g.team.id),section=(title,body)=>'<details class="panel"><summary><b>'+h(title)+'</b></summary>'+body+'</details>',person=p=>h(p.name)+(p.club?' · '+h(p.club):'');
    const records=(rows,count)=>rows.length?rows.map(e=>'<div class="event">'+h(e.year)+'年 · '+h(e.title)+'</div>').join('')+'<p class="small">'+rows.length+' / '+count+'件（代表記録）</p>':empty;
    const leaderRows=side=>r.leaders[side].map(x=>'<article class="event"><b>期間最多 '+h(x.label)+' · '+h(x.value)+'</b>'+x.leaders.map(p=>'<div>'+person(p)+'</div>').join('')+(x.count>x.leaders.length?'<p class="small">ほか '+(x.count-x.leaders.length)+'名</p>':'')+'</article>').join('')||empty;
    return '<section class="decade-book edition-detail" data-canonical-decade><div class="decade-cover"><small>PENNANT LAB · CHRONICLE</small><div class="decade-mark">◆</div><h2>球界10年史</h2><div class="decade-years">'+r.start+' – '+r.end+'</div><p>'+r.count+'シーズンの軌跡 · '+(r.complete?'10周年記念版':'保存済み年度のみ')+'</p></div>'+
      section('特殊記録・偉業',records(r.feats,r.counts.feats))+section('歴代記録更新',records(r.records,r.counts.records))+
      section('殿堂入り選手',r.hall.map(p=>'<div class="event">'+person(p)+' · '+p.year+'年選出 · '+p.score.toFixed(1)+' PTS</div>').join('')+(r.counts.hall>r.hall.length?'<p class="small">上位20名 / '+r.counts.hall+'名</p>':'')||empty)+
      section('球界の黄金時代','<div class="table-wrap"><table class="data-table"><thead><tr><th>球団</th><th>日本一</th><th>リーグV</th><th>勝率</th><th>連覇</th></tr></thead><tbody>'+r.teams.map(t=>'<tr data-own-club="'+(t.id===g.team.id)+'"><td>'+leagueTag(t.league,true)+' '+h(t.name)+'</td><td>'+t.championships+'</td><td>'+t.leagueTitles+'</td><td>'+t.pct.toFixed(3)+'</td><td>'+t.best+'</td></tr>').join('')+'</tbody></table></div>')+
      section('自球団の10年史',me?'<h3>'+h(me.name)+'</h3><div class="decade-stat-grid"><div><small>日本一</small><b>'+me.championships+'回</b></div><div><small>リーグ優勝</small><b>'+me.leagueTitles+'回</b></div><div><small>通算勝率</small><b>'+me.pct.toFixed(3)+'</b></div><div><small>最長リーグ連覇</small><b>'+me.best+'年</b></div></div>'+r.own.slice().reverse().map(t=>'<div class="event">'+t.year+'年 · '+h(t.name)+' · '+t.wins+'勝 '+t.losses+'敗 '+t.ties+'分 · '+(t.champion?'日本一':t.rank+'位')+'</div>').join(''):empty)+
      section('10年間の野手成績',leaderRows('bat'))+section('10年間の投手成績',leaderRows('pitch'))+
      section('タイトル・名選手',r.awards.map(p=>'<div class="event">'+person(p)+' · MVP '+p.mvp+'回 · '+p.count+'冠・賞</div>').join('')+(r.counts.awards>r.awards.length?'<p class="small">上位20名 / '+r.counts.awards+'名</p>':'')||empty)+
      section('年度別の優勝球団',r.timeline.slice().reverse().map(t=>'<article class="event"><b>'+t.year+'年 · 日本一：'+h(t.champion?.name||'記録なし')+'</b><p>東：'+h(t.east?.name||'記録なし')+' ／ 西：'+h(t.west?.name||'記録なし')+'</p></article>').join('')||empty)+'<p class="small">実際に保存された年度・記録から集計。未保存の成績は補完しません。</p></section>';
  }
  function canonicalArchiveMarkup(g){
    if(!g.headquarters.archiveAvailable)return '<p class="small">重要イベントの確認後に過去の記録を閲覧できます。</p>';
    const p=canonicalArchive,disabled=slotOpening?'disabled':'',kind=canonicalArchiveKind,year=canonicalArchiveYear;
    return '<section class="panel"><h3>過去の試合・新聞・10年史</h3><div class="chips"><button class="chip '+(kind==='matches'?'active':'')+'" data-action="canonical-archive-kind" data-kind="matches" '+disabled+'>試合</button><button class="chip '+(kind==='papers'?'active':'')+'" data-action="canonical-archive-kind" data-kind="papers" '+disabled+'>新聞</button><button class="chip '+(kind==='decades'?'active':'')+'" data-action="canonical-archive-kind" data-kind="decades" '+disabled+'>10年史</button></div><label>'+(kind==='decades'?'10年史の終了年度（0＝全期間）':'年度（0＝全年度）')+'<input id="canonical-archive-year" type="number" min="0" max="'+(g.year+(kind==='decades'?9:0))+'" value="'+year+'" '+disabled+'></label><button class="btn outline full" data-action="canonical-archive-search" '+disabled+'>記録を検索</button>'+(p?'<p>'+ (p.total?p.offset+1:0)+'〜'+(p.offset+p.items.length)+' / '+p.total+'件 · 新しい順</p>'+p.items.map(x=>kind==='matches'?canonicalMatchReport(x,g):kind==='decades'?canonicalDecadeMarkup(x,g):canonicalPaperMarkup(x)).join('')+'<div class="chips"><button class="btn outline" data-action="canonical-archive-prev" '+(slotOpening||!p.offset?'disabled':'')+'>前のページ</button><button class="btn outline" data-action="canonical-archive-next" '+(slotOpening||p.nextOffset===null?'disabled':'')+'>次のページ</button></div>':slotOpening?'<p role="status">記録を取得中</p>':'')+'<p class="small">球団ロゴ・選手名は保存世界の現在の登録情報を参照します。旧記録にない詳細成績は生成しません。</p></section>';
  }
  function canonicalReportsRender(){
    const app=$('#app'),g=canonicalSnapshot?.game;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-reports-back">‹ 本部</button></div>';
    if(!g){app.innerHTML='<div class="setup-screen">'+top+'<p>本部で最新状態を取得してください。</p></div>';return;}
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(g.team)+'">'+top+'<main class="main"><h2 class="page-title">保存済み試合・新聞</h2>'+canonicalMatchReport(g.headquarters.lastReport,g)+canonicalPaperMarkup(g.headquarters.latestPaper)+canonicalArchiveMarkup(g)+'</main></div>';
  }
  function canonicalHqRender(){
    const app=$('#app'),g=canonicalSnapshot?.game,t=g?.team,v=g?.headquarters;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-return">‹ データ選択</button></div>';
    if(!t||!v){app.innerHTML='<div class="setup-screen">'+top+'<p role="status">確定した日程を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-hq-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    if(canonicalReplay){app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(t)+'"><main class="main">'+canonicalReplayMarkup()+'</main></div>';return;}
    const canStep=canonicalCanRun(g)&&!slotOpening&&!canonicalRunning;
    const stop=slotOpening?'日程の確定を確認しています。':canonicalSnapshot.pending?.length?'報酬の確定確認が必要です。':!v.canCalendar?'確認が必要なイベントまたは日程の区切りです。未接続のイベント処理へは自動進行しません。':'';
    const last=v.last,score=last?'<div class="box-result"><span class="tag '+(last.ours>last.theirs?'green':last.ours<last.theirs?'red':'')+'">'+(last.ours>last.theirs?'勝利':last.ours<last.theirs?'敗戦':'引分')+'</span> <span class="small">'+last.year+'年 第'+last.day+'戦 / vs '+h(last.opponent)+'</span><div class="score-big">'+last.ours+' - '+last.theirs+'</div></div>':'<div class="empty">シーズンはまだ始まっていません。</div>';
    const disabled=canStep?'':'disabled',modeButtons=[['normal','通常'],['fast','倍速'],['skip','日程スキップ']].map(([k,label])=>'<button class="chip '+(canonicalPlayback===k?'active':'')+'" data-action="canonical-hq-mode" data-mode="'+k+'" aria-pressed="'+(canonicalPlayback===k)+'" '+(canonicalRunning?'disabled':'')+'>'+label+'</button>').join('');
    const targetValid=canonicalTarget&&canonicalTarget.world===canonicalSnapshot.world&&canonicalTarget.year===g.year&&g.calendarIndex<canonicalTarget.goal;
    const controls='<section class="panel"><div class="panel-head"><h3 class="panel-title">日程を進める</h3><span class="pill">'+h(v.dateText)+'</span></div><div class="calendar-playback"><div class="calendar-speed">'+modeButtons+'</div></div><div class="calendar-target-grid"><button class="btn primary" data-action="canonical-hq-run" data-kind="date" '+disabled+'>▶ 1日進める</button><button class="btn soft" data-action="canonical-hq-run" data-kind="weekly" '+disabled+'>週次報告まで</button><button class="btn soft" data-action="canonical-hq-run" data-kind="month" '+disabled+'>月次報告まで</button></div><button class="btn outline full" data-action="canonical-hq-run" data-kind="season" '+disabled+'>シーズン終了まで進行</button>'+(canonicalRunning?'<button class="btn outline full" data-action="canonical-hq-pause" '+(canonicalStop?'disabled':'')+'>'+(canonicalStop?'停止確認中':'一時停止')+'</button><p role="status">確定済み日程 '+g.calendarIndex+' / '+(canonicalTarget?.goal||g.calendarIndex)+'</p>':targetValid?'<button class="btn primary full" data-action="canonical-hq-run" data-kind="resume" '+disabled+'>▶ 続きから</button>':'')+'<p class="tiny">通常報告は記録に保存し、重要なイベントでは停止します。</p></section>';
    const reports='<section class="panel"><h3 class="panel-title">保存済み報告</h3>'+(v.latestMonth?'<p>'+h(v.latestMonth.month)+'：'+v.latestMonth.wins+'勝 '+v.latestMonth.losses+'敗 '+v.latestMonth.ties+'分</p>':'<p class="small">月次報告はまだありません。</p>')+v.latestMilestones.map(m=>'<div class="event">'+h(m.date)+' '+h(m.title)+'</div>').join('')+'</section>';
    const hero=frontOfficeHero(t,{year:g.year,gmName:g.gmName,day:g.day,fans:v.fans,salary:v.salary,rank:v.rank,opponent:v.opponent,dateText:v.dateText});
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(t)+'">'+top+'<main class="main">'+hero+canonicalProfileMarkup(canonicalSnapshot)+canonicalEmblemMarkup(g)+'<section class="panel desk-panel" '+(canonicalSnapshot.wallet?.owned?.includes('hq')&&accountCurrent()?'data-canonical-hq-theme style="border:2px solid #b9a57d;border-radius:16px;box-shadow:inset 0 0 0 4px #b9a57d22"':'')+'><div class="desk-heading"><div><div class="eyebrow">GM DESK · FRONT OFFICE</div><h3>業務一覧</h3></div><button class="btn primary" data-action="canonical-hq-step" '+(canStep?'':'disabled')+'>▶ 1日進める</button></div>'+(g.club?'<button class="btn outline full" data-action="canonical-roster-open" '+(slotOpening?'disabled':'')+'>スタメン編成</button>':'')+(g.club?'<button class="btn outline full" data-action="canonical-players">全選手・選手詳細</button>':'')+(g.club?'<button class="btn outline full" data-action="canonical-ops-open" data-kind="rotation">先発ローテーション</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="farm">一軍・二軍管理</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="free">自由契約選手の獲得</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="facilities">球団施設・球場経営</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="manager">監督室</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="trade">シーズン中トレード</button>':'')+'<button class="btn outline full" data-action="canonical-standings">東西リーグ順位表</button><button class="btn outline full" data-action="canonical-events-open">イベント・年間業務</button>'+canonicalRewardLink()+'</section>'+controls+'<section class="panel"><div class="panel-head"><h3 class="panel-title">直近の試合結果</h3></div>'+score+'<button class="btn outline full" data-action="canonical-reports-open">試合詳細・新聞を読む</button></section>'+reports+(stop?'<p role="status">'+h(stop)+'</p>':'')+'<p class="small">試験環境 · 本部、日程進行、編成を接続済み。保存済み試合詳細・最新新聞を接続済み。通常・倍速は確定済み日程と試合を再生します。全履歴の閲覧は追加開発中です。</p></main></div>';
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
      canonicalSnapshot=result.snapshot;
    }catch{
      if(epoch!==canonicalEpoch)return;
      canonicalSnapshot=null;
    }finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(scroll);}}
  }
  async function canonicalRun(kind){
    const g=canonicalSnapshot?.game,world=canonicalSnapshot?.world;
    if(slotOpening||canonicalRunning||!canonicalCanRun(g)||!['date','weekly','month','season','resume'].includes(kind))return;
    if(kind==='season'&&!window.confirm('シーズン終了まで日程を進めますか？ 重要なイベントでは停止します。'))return;
    if(kind!=='resume')canonicalTarget={world,year:g.year,goal:g.headquarters.goals[kind],kind};
    const target=canonicalTarget;
    if(!target||target.world!==world||target.year!==g.year||!Number.isSafeInteger(target.goal)||target.goal<=g.calendarIndex)return;
    const epoch=canonicalEpoch;canonicalRunning=true;canonicalStop=false;slotOpening=true;render();
    try{
      while(epoch===canonicalEpoch&&!canonicalStop&&!document.hidden&&canonicalSnapshot?.world===world&&canonicalSnapshot.game.year===target.year&&canonicalSnapshot.game.calendarIndex<target.goal&&canonicalCanRun(canonicalSnapshot.game)){
        if(canonicalPlayback!=='skip')await new Promise(resolve=>setTimeout(resolve,canonicalPlayback==='fast'?350:750));
        if(epoch!==canonicalEpoch||canonicalStop||document.hidden)break;
        const before=canonicalSnapshot.game.calendarIndex,result=await canonicalPilot.advance({calendar:'day'});
        if(epoch!==canonicalEpoch)return;
        if(result.status!=='ready'||result.snapshot.world!==world)throw Error('calendar observation required');
        canonicalSnapshot=result.snapshot;render();
        if(canonicalSnapshot.game.calendarIndex===before)break;
        await canonicalPresentDay(canonicalSnapshot.game,epoch,target.kind==='date');
        if(epoch!==canonicalEpoch)return;render();
      }
      if(canonicalSnapshot&&(canonicalSnapshot.game.calendarIndex>=target.goal||canonicalSnapshot.game.year!==target.year))canonicalTarget=null;
    }catch{if(epoch===canonicalEpoch)canonicalSnapshot=null;}
    finally{if(epoch===canonicalEpoch){canonicalRunning=false;canonicalStop=false;slotOpening=false;render();}}
  }
  let canonicalHqWorld=null;
  const canonicalCommerceJobs=['fan-fest','fanclub','tv','sponsor','broadcast','naming','opening-promo'];
  const canonicalAnnualJobs=['awards-all','settlement','movement-declarations','draft','roster-cut','renewal1','renewal2','autumn','winter','booking','self','winter-return','camp','exhibition',...canonicalCommerceJobs,'offdesk-opening'];
  let canonicalAwardFilter='all',canonicalCampGroup='first',canonicalWinterPlace='taiwan',canonicalDigestCut=0,canonicalForeignOpen=false;
  const canonicalEventLabels={...FLOW_LABEL,'fan-fest':'ファン感謝デー',fanclub:'ファンクラブ',tv:'テレビ出演',sponsor:'スポンサー契約',broadcast:'放映権',naming:'命名権','opening-promo':'開幕戦イベント'};
  const canonicalEventStatus={scheduled:'予定',ready:'対応可能',active:'対応中',waiting:'結果待ち',done:'完了'};
  function canonicalDraftModel(c){
    if(!c)return null;
    return {id:c.id,name:c.name,pos:c.pos,age:c.age||18,teamId:null,specialCategory:c.specialCategory,originCategory:c.originCategory,appearanceSeed:c.appearanceSeed,scoutingHidden:c.hidden===true,abilitiesHidden:true};
  }
  function canonicalDraftMarkup(g,a,held,button){
    const d=a.draft;if(!d)return '<p class="warning">ドラフト情報を取得できません。</p>';
    const cmd=(key,label,attrs='',disable=held)=>button('draft-'+key,label,attrs,disable);
    const name=c=>c?themedPlayerName(canonicalDraftModel(c)):'指名見送り';
    const art=(c,kind)=>c?rareCinemaArt(canonicalDraftModel(c),kind):'';
    const card=c=>'<article class="panel draft-card" data-draft-card="'+c.id+'"><div class="recruit-player">'+faceMini(canonicalDraftModel(c))+'<div class="recruit-identity"><strong>'+name(c)+'</strong><small>'+h(c.type)+' · '+positionMarkup(c.pos)+(c.school?' · '+h(c.school):'')+'</small></div></div>'+(c.hidden?'<p>能力・本人情報は非公開</p>':c.report?'<p>推定総合 '+c.report.low+'〜'+c.report.high+' · 確度 '+h(c.report.confidence)+'</p><div class="annual-ability-strip">'+Object.entries(c.report.values).map(([k,v])=>'<span><small>'+h(DRAFT_LABELS[k]||k)+'</small><b>'+v.low+'〜'+v.high+'</b></span>').join('')+'</div><p class="small">'+h(c.report.preference)+' · '+h(c.report.abroad)+'</p>'+c.hints.map(x=>'<p class="event">'+h(x.quote)+'</p>').join(''):'')+'<div class="chips">'+Object.entries(SCOUT_TASKS).map(([key,v])=>cmd('research',h(v[0])+(c.tasks.includes(key)?' ✓':''),'data-id="'+c.id+'" data-key="'+key+'"',held||!c.canResearch||c.tasks.includes(key))).join('')+'</div>'+((d.phase==='first'||d.phase==='later')&&d.canNominate?cmd('nominate','この選手を指名','data-id="'+c.id+'"'):'')+'</article>';
    let out='<section class="draft-room draft-event"><header class="draft-stage-head"><small>PENNANT LAB · '+g.year+'</small><div class="draft-stage-emblem">◆</div><h1>ドラフト会議</h1><p>'+d.round+'巡目</p></header>';
    if(d.rareIntro){const c=d.introCandidate;out+='<section class="rare-news-screen"><h2>特別スカウト報告</h2>'+rarePanel(canonicalDraftModel(c),'scout',c?.hidden?'……説明のつかない選手がいます。':'今年は特別な選手が候補にいるようです。')+art(c,'nomination')+cmd('intro','指名会議へ進む')+'</section>';}
    else if(d.announcement&&d.announcementRow){const r=d.announcementRow;out+='<section class="draft-announcement-focus" data-own="'+(r.teamId===g.team.id)+'"><small>'+r.round+'巡目 · '+(r.cursor+1)+' / '+r.total+'</small><h2>'+h(r.team)+'</h2><h3>'+name(r.candidate)+'</h3>'+art(r.candidate,'nomination')+'<p>'+(r.contested?'指名発表':r.candidate?'交渉権獲得':'指名見送り')+'</p>'+cmd('announcement-next','次の発表')+cmd('announcement','発表をまとめて確認')+'</section>';}
    else if(d.phase==='lottery'&&d.lottery){const l=d.lottery;out+='<section class="draft-draw-stage" data-stage="'+h(l.stage)+'" data-own-draw="'+l.own+'"><header><h2>'+l.tickets+'球団競合</h2><h3>'+name(l.candidate)+'</h3>'+art(l.candidate,'lottery')+'</header><p>'+l.clubs.map(t=>h(t.name)).join(' / ')+'</p>';
      if(l.stage==='choose'){out+='<p>交渉権を決める抽選を行います。</p><div class="draft-ticket-grid">'+(l.own?Array.from({length:l.tickets},(_,i)=>'<button class="draft-ticket" data-action="canonical-event-command" data-kind="draft-ticket" data-ticket="'+i+'" '+(held?'disabled':'')+'><span class="ticket-seal">◆</span><strong>くじ '+(i+1)+'</strong></button>').join(''):'')+'</div>'+cmd('delegate',l.own?'監督に抽選を任せる':'他球団の抽選を進める');}
      else if(l.stage==='sealed')out+=cmd('reveal','くじを開封する');
      else if(l.stage==='revealed')out+='<h2>'+h(l.winnerName)+' 交渉権獲得</h2>'+art(l.candidate,l.winner===g.team.id?'win':'loss')+cmd('next-draw','次の抽選・結果へ');
      out+='</section>';
    }else if(d.phase==='first-result'){out+='<h2>1巡目の指名結果</h2>'+cmd('next-round','次の指名へ');}
    else if(d.phase==='negotiate'){const n=d.negotiation;if(!n){out+=cmd('finish','入団交渉を終了する');}
      else{out+='<section class="panel draft-negotiation">'+rarePanel(canonicalDraftModel(n),'contract')+'<div class="recruit-player">'+faceMini(canonicalDraftModel(n))+'<h3>'+name(n)+'</h3></div>';
        if(n.recoveryPending||n.recoveryCelebration){out+='<p>交渉結果：'+h(n.status)+'</p>'+(n.feedback?'<p>'+h(n.feedback)+'</p>':'')+'<p class="small">広告券・確認済み権利による復活は上部の報酬画面から利用できます。</p>'+cmd('dismiss','結果を確認','data-id="'+n.id+'"');}
        else if(n.question){out+='<h3>'+h(n.question.text)+'</h3>'+n.question.options.map(o=>cmd('reply',h(o.label),'data-id="'+n.id+'" data-answer="'+h(o.key)+'"')).join('');}
        else if(n.status==='rights'){out+='<h3>入団条件を提示</h3><label>育成方針<select id="canonical-draft-role"><option value="develop">育成重視</option><option value="chance">出場機会重視</option></select></label>'+n.offers.map(o=>cmd('offer',['抑えめ','標準','好条件'][o.level]+' · 契約金 '+fmtMoney(o.fee)+' / 年俸 '+fmtSalary(o.salary),'data-id="'+n.id+'" data-level="'+o.level+'"',held||o.fee+o.salary>g.team.cash)).join('');}
        if(!n.recoveryPending&&!n.recoveryCelebration&&n.status==='rights')out+=cmd('withdraw','交渉を打ち切る','data-id="'+n.id+'"')+cmd('delegate-contract','交渉を監督に任せる','data-id="'+n.id+'"');
        out+='</section>';}
    }else if(d.phase==='done'){out+='<h2>指名・交渉終了</h2>'+button('complete','戦力外通告へ進む','data-job="draft"',held);}
    else if(['scout','first','later'].includes(d.phase)){
      out+='<p>調査枠 '+d.researchUsed+' / '+d.researchBudget+'</p>'+(d.phase==='scout'?cmd('start','指名会議を開始する'):d.canNominate?cmd('pass','指名を見送る'):d.phase==='first'?cmd('cpu','他球団の指名へ'):'')+d.candidates.map(card).join('');
    }
    if(!d.announcement&&!d.rareIntro&&d.picks.length)out+='<section class="panel"><h3>確定済み指名結果</h3>'+d.picks.map(p=>'<p class="event">'+p.round+'位 · '+h(p.name)+' · '+h((g.club?.standings||[]).find(t=>t.id===p.teamId)?.name||String(p.teamId))+' · '+h(p.status)+'</p>').join('')+'</section>';
    return out+'</section>';
  }
  function canonicalCutMarkup(g,a,held,button){
    const r=a.roster;if(!r)return '<p class="warning">登録枠情報を取得できません。</p>';
    const p=r.projection;
    return '<section class="panel"><h2>戦力外通告</h2>'+normalDetailCard('contract','来季の支配下登録')+'<p>来季予定 '+p.projected+' / '+(g.club?.rosterLimit||50)+'名 · 超過 '+p.excess+'名</p><p>指名・合意済み '+p.signed+'名 · 引退予定 '+p.retiring+'名 · 不足補充 '+p.minimumFill+'名</p>'+r.eligible.map(x=>{const model=g.club?.roster.find(p=>p.id===x.id),selected=r.selected.includes(x.id);return '<article class="panel"><div class="recruit-player">'+(model?faceMini(canonicalPlayerModel(model,g),{overall:true}):'')+'<div><strong>'+(model?themedPlayerName(canonicalPlayerModel(model,g)):h(x.name))+'</strong><p>'+positionMarkup(x.pos)+' · 年俸 '+fmtSalary(x.salary)+'</p></div></div>'+(x.warnings||[]).map(w=>'<p class="small">'+h(w)+'</p>').join('')+button('cut',selected?'戦力外候補から外す':'戦力外候補にする','data-id="'+x.id+'"',held)+'</article>';}).join('')+button('complete','戦力外通告を確定する','data-job="roster-cut"',held||p.excess>0)+'</section>';
  }
  function canonicalAnnualPerson(g,x){
    const r=g.club?.roster.find(p=>p.id===x.id),p=r?canonicalPlayerModel(r,g):null;
    return '<div class="annual-person">'+(p?faceMini(p,{overall:true}):'')+'<div><strong>'+(p?themedPlayerName(p):annualReportName(x))+'</strong>'+(x.pos?'<small>'+positionMarkup(x.pos)+'</small>':'')+'</div></div>'+(p?annualAbilityStrip(p):'');
  }
  function canonicalRenewalMarkup(g,a,held,button){
    const d=a.renewal;if(!d)return '<p class="warning">契約更改情報なし</p>';
    const states={signed:'サイン済',pending:'保留',unoffered:'未提示',released:'自由契約予定','retire-intent':'引退申し出',retired:'引退予定'},rows=d.round===2?d.rows.filter(r=>r.revisit||r.editable||['pending','retire-intent'].includes(r.status)):d.rows;
    const editable=d.rows.some(r=>r.editable),cmd=(k,label,attrs='',disabled=held)=>button('renewal-'+k,label,attrs,disabled);
    let out='<section class="panel renewal-room"><h2>契約更改 第'+d.round+'回</h2>'+normalDetailCard('contract','年俸交渉')+'<p>未確定 '+d.unresolved+'名 · 交渉は最大2回</p><p>球団資金 '+fmtMoney(g.team.cash)+'</p>';
    if(editable)out+='<section class="panel"><h3>一括提示額</h3><div class="chips">'+[['assessment','査定額'],['middle','中間額'],['desired','希望額']].map(([v,n])=>cmd('bulk',n,'data-value="'+v+'"')).join('')+'</div>'+cmd('submit','一括提示する','data-bonus="0"')+cmd('submit','出来高ボーナス付きで一括提示','data-bonus="1"')+'</section>';
    out+=rows.map(r=>'<article class="panel renewal-card" data-renewal-id="'+r.id+'">'+canonicalAnnualPerson(g,r)+'<p>'+h(states[r.status]||r.status)+'</p><div class="renewal-money"><span>今季<b>'+fmtSalary(r.current)+'</b></span><span>査定額<b>'+fmtSalary(r.assessment)+'</b></span><span>希望額<b>'+fmtSalary(r.desired)+'</b></span></div>'+(r.editable?'<label>提示年俸（万円）<input class="canonical-renewal-salary" type="number" min="500" max="150000" step="100" value="'+Math.round(r.offer*10000)+'" '+(held?'disabled':'')+'></label><details><summary>出来高ボーナスを追加契約</summary>'+r.options.map(o=>'<label class="row"><input class="canonical-renewal-bonus" type="checkbox" value="'+h(o.key)+'" '+((r.bonuses||[]).includes(o.key)?'checked':'')+' '+(held?'disabled':'')+'>'+h(o.label)+' · '+fmtMoney(o.amount)+'</label>').join('')+'</details>'+cmd('offer','この条件で提示','data-id="'+r.id+'"'):'')+(r.status==='retire-intent'?cmd('retire','引退を了承する','data-id="'+r.id+'"'):['pending','unoffered'].includes(r.status)?cmd('release','自由契約とする','data-id="'+r.id+'"'):r.status==='released'?cmd('restore','交渉対象に戻す','data-id="'+r.id+'"'):'')+(r.history||[]).map(x=>'<p class="small">第'+x.round+'回 '+fmtSalary(x.offer)+' · '+h(states[x.status]||x.status)+'</p>').join('')+'</article>').join('');
    const pendingUnsubmitted=d.rows.some(r=>['unoffered','retire-intent'].includes(r.status));
    if(d.round===1&&d.unresolved)out+=cmd('next','保留選手は第2回交渉へ','',held||pendingUnsubmitted);
    if(d.round===2&&d.unresolved)out+=cmd('final-release','未合意選手を自由契約とする','',held||pendingUnsubmitted);
    if(!d.unresolved)out+=button('complete','契約更改を確定','data-job="'+a.active+'"',held);
    return out+'</section>';
  }
  function canonicalTrainingReport(g,report){
    if(!report)return '';
    const rows=report.rows||[];
    return '<section class="panel"><h3>育成結果報告</h3>'+(Number.isFinite(report.cost)?'<p>費用 '+fmtMoney(report.cost)+'</p>':'')+rows.map(r=>'<article class="panel">'+canonicalAnnualPerson(g,r)+(Number.isFinite(r.before)&&Number.isFinite(r.after)?'<p>総合 '+annualNumberChange(r.before,r.after)+'</p>':'')+(Number.isFinite(r.xp)?'<p>経験値 +'+r.xp+'</p>':'')+(Number.isFinite(r.energyBefore)&&Number.isFinite(r.energyAfter)?'<p>体力 '+annualNumberChange(r.energyBefore,r.energyAfter)+'</p>':'')+((r.abilities||r.deltas||[]).length?'<div class="ref-ability-grid">'+(r.abilities||r.deltas).map(annualAbilityChange).join('')+'</div>':'<p class="small">能力変化の個別記録なし</p>')+'</article>').join('')+(rows.length?'':'<p class="small">対象の育成記録なし</p>')+'</section>';
  }
  function canonicalTrainingMarkup(g,a,held,button){
    const phase=a.active,t=a.training||a.preseason;if(!t)return '<p class="warning">育成情報なし</p>';
    const preseason=phase==='self',cmd=(k,label,attrs='',disabled=held)=>button('training-'+k,label,attrs,disabled),pre=(k,label,attrs='',disabled=held)=>button('pre-'+k,label,attrs,disabled);
    let out='<section class="panel annual-phase"><h2>'+h(canonicalEventLabels[phase]||phase)+'</h2>';
    if(t.report){if(phase==='winter')out+='<h3>世界へ、出発</h3>'+(t.report.entries||[]).map(e=>{const p=g.club?.roster.find(p=>p.id===e.id);return '<div class="panel">'+reportLandscape(e.destination)+(p?canonicalAnnualPerson(g,p):'')+'<p>'+h(winterDest(e.destination)?.[1]||e.destination)+'</p></div>';}).join('')+'<p>1月第2週に帰国予定</p>';
      else out+=reportLandscape('club')+canonicalTrainingReport(g,t.report);
      if(phase==='winter')out+='<p>派遣費用 '+fmtMoney(t.report.cost||0)+'</p>';
      return out+(preseason?pre('finish','結果を確認して本部へ'):button('complete','結果を確認して本部へ','data-job="'+phase+'"',held))+'</section>';
    }
    if(phase==='winter'){
      const plan=t.assignments||{},n=Object.keys(plan).length,selected=t.destinations.find(d=>d.key===canonicalWinterPlace)||t.destinations[0];
      out+='<p>派遣枠 '+n+' / 4 · 費用 '+fmtMoney(t.cost)+'</p>'+winterMap(plan,selected.key).replace(/data-action="ref-winter-place"/g,'data-action="canonical-winter-place"')+'<h3>'+h(selected.label)+'</h3>'+reportLandscape(selected.key)+'<p>'+h(selected.effect)+'</p>'+t.eligible.map(p=>{const current=plan[p.id],same=current===selected.key;return '<article class="panel">'+canonicalAnnualPerson(g,p)+'<p>'+(current?'派遣先 '+h(winterDest(current)?.[1]||current):'未選択')+'</p>'+cmd('assign',same?'派遣を解除':'この選手を派遣','data-id="'+p.id+'" data-value="'+(same?'none':selected.key)+'"',held||!current&&n>=4)+'</article>';}).join('')+cmd('run','派遣を確定する','',held||t.cost>g.team.cash);
    }else if(preseason&&t.support){
      out+='<h3>球団支援・待遇改善を実施しますか？</h3><p>育成方針決定後の任意支援です。</p>'+t.supportOptions.map(x=>pre('support',h(x.label)+' · '+fmtMoney(x.cost),'data-value="'+h(x.key)+'"',held||!x.eligible)).join('')+pre('run','支援の選択を終えて育成を実施する')+pre('self-back','育成方針を見直す');
    }else{
      out+=reportLandscape('club')+t.players.map(p=>'<article class="panel" data-training-id="'+p.id+'">'+canonicalAnnualPerson(g,p)+'<label>重点育成<select class="canonical-training-focus" '+(held?'disabled':'')+'>'+p.focus.map(k=>'<option value="'+h(k)+'" '+(k===p.menu.focus?'selected':'')+'>'+h(k==='balanced'?'バランス':DRAFT_LABELS[k]||k)+'</option>').join('')+'</select></label><label>練習強度<select class="canonical-training-intensity" '+(held?'disabled':'')+'>'+[['rest','休養'],['light','軽め'],['normal','通常'],['hard','強化']].filter(([k])=>!p.injured||k==='rest').map(([k,v])=>'<option value="'+k+'" '+(k===p.menu.intensity?'selected':'')+'>'+v+'</option>').join('')+'</select></label>'+cmd('menu','育成方針を保存','data-id="'+p.id+'"')+'</article>').join('')+(preseason?pre('run','育成方針を決定して支援の選択へ'):cmd('run','秋季キャンプを開始する'));
    }
    return out+'</section>';
  }
  function canonicalPreseasonMarkup(g,a,held,button){
    const p=a.preseason,phase=a.active;if(!p)return '<p class="warning">イベント情報なし</p>';
    const cmd=(k,label,attrs='',disabled=held)=>button('pre-'+k,label,attrs,disabled);
    let out='<section class="panel annual-phase"><h2>'+h(canonicalEventLabels[phase]||phase)+'</h2>';
    if(phase==='winter-return')return out+(p.report?canonicalTrainingReport(g,p.report)+cmd('finish','帰国報告を確認する'):'<p>帰国報告待ち</p>')+'</section>';
    if(['booking','camp'].includes(phase)){
      if(p.report)return out+reportCampTraining(p.sites)+canonicalTrainingReport(g,p.report)+cmd('finish','キャンプ結果を確認する')+'</section>';
      if(!p.paid&&!p.step){out+='<div class="chips">'+[['first','一軍'],['farm','二軍']].map(([k,n])=>'<button class="chip '+(canonicalCampGroup===k?'active':'')+'" data-action="canonical-camp-group" data-value="'+k+'">'+n+'</button>').join('')+'</div>'+campDestinationMap(p.sites,canonicalCampGroup).replace(/data-action="ref-site"/g,'data-action="canonical-camp-site"')+'<p>合計費用 '+fmtMoney(p.cost)+'</p>'+cmd('confirm-sites','キャンプ地を確定','',held||p.cost>g.team.cash);}
      else if(phase==='camp'&&p.step===1)out+=reportCampTraining(p.sites)+cmd('kickoff','キャンプイン');
      else if(phase==='camp'&&p.step===2){
        const options=[['inside','室内でファンへサイン','ファン +250人','contract'],['outside','屋外でファンへサイン','ファン +500人／現場評価 -2','stadium'],['rest','休養に充てる','キャンプ終了時に体力を最大10回復','rest'],['meeting','チームミーティング','現場評価 +2','meeting']];
        const scene=k=>k==='rest'?'<img class="report-scene" src="./assets/scenes/camp-rest.svg" alt="宿舎で休養する選手">':k==='meeting'?'<img class="report-scene" src="./assets/scenes/preseason-meeting.svg" alt="チームミーティング">':salesScene(k,g.team);
        out+='<h3>春季キャンプ視察</h3>'+reportLandscape(p.sites.first)+'<p>天候が悪くなりそうです。指示を選択してください。</p>'+options.filter(x=>!p.visitPending||x[0]===p.visit).map(([k,n,d,v])=>'<div class="panel">'+scene(v)+'<h3>'+n+'</h3><p>'+d+'</p>'+(p.visitPending?'':cmd('visit','選択する','data-value="'+k+'"'))+'</div>').join('')+(p.visitPending?cmd('visit-finish','確認して本部へ戻る'):'');
      }else if(phase==='camp'&&p.step===3)out+=reportCampTraining(p.sites)+cmd('run','キャンプ終了報告へ進む');
    }else if(phase==='exhibition'){
      if(p.report&&!p.digestSeen){const [key,title]=REPORT_DIGEST_CUTS[Math.min(canonicalDigestCut,REPORT_DIGEST_CUTS.length-1)];out+='<div class="preseason-montage"><h3>オープン戦ダイジェスト</h3><div class="montage-frame"><img src="./assets/scenes/preseason-'+key+'.svg" alt="'+h(title)+'"><div class="montage-label">'+h(title)+'</div></div><p>'+(canonicalDigestCut+1)+' / '+REPORT_DIGEST_CUTS.length+' · 試合のイメージ映像</p>'+(canonicalDigestCut<REPORT_DIGEST_CUTS.length-1?'<button class="btn primary full" data-action="canonical-digest-next" '+(held?'disabled':'')+'>次のシーン</button>':cmd('digest','試合結果へ'))+cmd('digest','ダイジェストをスキップして結果へ')+'</div>';}
      else if(p.report){
        const side=id=>{const t=p.report.clubs?.find(t=>t.id===id);return t?'<span class="preseason-score-team" style="--score-club:'+clubAccessible(clubIdentity(t).color,'#142536','#ffffff')+'">'+teamBadge(t,'mini-logo')+'<strong>'+h(t.short)+'</strong></span>':h(String(id));};
        out+='<h3>全試合結果</h3>'+p.report.games.map(m=>'<article class="preseason-score-card"><p>'+h(m.date)+'</p><div class="preseason-score-line">'+side(m.away)+'<b>'+(m.noContest||!Number.isFinite(m.awayScore)?'—':m.awayScore)+' − '+(m.noContest||!Number.isFinite(m.homeScore)?'—':m.homeScore)+'</b>'+side(m.home)+'</div></article>').join('')+canonicalTrainingReport(g,p.report)+cmd('finish','オープン戦の結果を確認する');
      }else if(p.meeting)out+='<img class="report-scene" src="./assets/scenes/preseason-meeting.svg" alt="監督と選手の作戦会議"><h3>オープン戦方針を共有しました</h3>'+cmd('run','ミーティングを終えて本部へ');
      else out+='<h3>オープン戦方針</h3>'+[['balanced','バランス重視'],['first','主力調整'],['youth','若手育成']].map(([k,n])=>cmd('policy',n+(p.policy===k?' ✓':''),'data-value="'+k+'"',held||p.policy===k||p.meetingDone)).join('')+cmd('run','ミーティングへ');
    }
    return out+'</section>';
  }
  function canonicalMarketMarkup(g,a,held,button){
    const m=a.market;if(!m)return '';
    const cmd=(k,label,attrs='',disabled=held)=>button('market-'+k,label,attrs,disabled);
    const roomLabels={news:'移籍市場ニュース',fa:'国内FA交渉',return:'国内復帰交渉',other:'自由契約・トレード・補償'};
    const model=r=>({...r,...r.abilities});
    let out='<section class="panel renewal-room"><h2>移籍市場</h2>'+normalDetailCard('contract','移籍交渉')+'<p>回答待ち '+m.waiting+'件 · 再交渉 '+m.counter+'件 · 未確認回答 '+m.unread+'件</p>'+(m.deadline?'<p>市場期限 '+h(m.deadline)+'</p>':'');
    if(!m.active)return out+(m.roomOptions||[]).map(k=>cmd('open',roomLabels[k],'data-value="'+k+'"')).join('')+(m.news==='opening-wait'?'<p>交渉解禁日まで日程を進めてください。</p>':'')+'</section>';
    if(m.room==='news'){
      const titles={eve:'明日、FA交渉解禁',opening:'FA交渉解禁・国内復帰選手発表',results:'移籍市場・去就決定速報'};
      out+='<section class="offdesk-news"><h2>'+h(titles[m.news]||'移籍市場速報')+'</h2>'+(m.newsRows||[]).map(r=>'<div class="event">'+h(r.name)+' · '+h(movementRequestLabel(r.kind))+(r.outcome?' · '+h(r.outcome.text):'')+'</div>').join('');
      if(m.news==='results')out+=m.specialResults.map(r=>'<article class="panel">'+faceMini(model(r))+themedPlayerName(model(r))+rarePanel(model(r),'join',r.outcome.text)+rareCinemaArt(model(r),'join',true)+cmd('special-result',r.seen?'確認済み':'特別速報を確認','data-id="'+r.id+'"',held||r.seen)+'</article>').join('');
      return out+cmd('news','ニュースを確認して本部へ','',held||m.specialResults.some(r=>!r.seen))+'</section></section>';
    }
    if(['fa','return'].includes(m.room)){
      out+='<h3>'+roomLabels[m.room]+'</h3>'+m.rows.map(r=>{
        const p=model(r),v=r.talk,o=r.offer,open=r.canApproach&&!r.unread;
        const act=(key,label,attrs='',disabled=held)=>cmd(key,label,'data-id="'+r.id+'" '+attrs,disabled);
        const actionRows=[['listen','本人の希望を聞く'],['winning','優勝を目指す'],['chance','出場機会を重視'],['trust','本人の希望を尊重'],['vision','球団の将来像を説明'],...(r.category?[['legacy','その選手だけの物語に触れる']]:[])];
        return '<article class="panel" data-fa-player="'+r.id+'"><div class="recruit-player">'+faceMini(p,{overall:true})+'<div><strong>'+themedPlayerName(p)+'</strong><p>'+positionMarkup(r.pos)+' · '+r.age+'歳</p></div></div>'+annualAbilityStrip(p)+'<p>希望年俸 '+fmtSalary(r.demand)+' · 獲得時費用 '+fmtMoney(r.cost)+'</p><p>'+h(r.outcome.text)+'</p>'+(o?'<p>提示 '+fmtSalary(o.salary)+' · '+(o.years||1)+'年契約'+(o.due?' · 回答予定 '+h(o.due):'')+(o.counter?' · 再提示希望 '+fmtSalary(o.counter):'')+(o.replyUntil?' · 回答期限 '+h(o.replyUntil):'')+'</p>':'')+(r.unread?act('ack','回答を確認する'):'')+(open?rarePanel(p,'contract')+(v?'<div class="panel"><p>第'+v.round+'回 · '+v.turn+' / '+v.max+'回</p><p>信頼 '+v.trust+' · 満足 '+v.satisfaction+' · 警戒 '+v.caution+'</p><p>'+h(v.speech||'')+'</p></div>':'')+'<div class="chips">'+actionRows.map(([k,n])=>act('talk',n,'data-key="'+k+'"',held||!!v&&v.turn>=v.max)).join('')+'</div><label>提示年俸（百万円）<input class="canonical-fa-salary" type="number" min="'+r.bounds.min+'" max="'+Math.max(r.bounds.min,r.bounds.max)+'" step="1" value="'+Math.round((v?.salary??o?.counter??r.demand)*100)+'"></label>'+act('salary','年俸を提示する','',held||r.bounds.max<r.bounds.min||!!v&&v.turn>=v.max)+'<label>契約年数<select class="canonical-fa-years">'+Array.from({length:10},(_,i)=>'<option value="'+(i+1)+'" '+((v?.years||o?.years||1)===i+1?'selected':'')+'>'+(i+1)+'年</option>').join('')+'</select></label>'+act('years','契約年数を設定')+act('submit','正式オファーを送る','',held||!r.canSubmit)+(o?.status==='counter'?act('withdraw','再交渉を取りやめる'):''):'')+'</article>';
      }).join('');
    }else if(m.room==='other'){
      out+='<h3>合意済みの移籍</h3>'+m.deals.map(d=>'<section class="panel"><p>'+h(movementRequestLabel(d.kind))+' · '+h(d.name||d.players.join(' ↔ '))+(Number.isFinite(d.salary)?' · '+fmtSalary(d.salary):'')+(d.years?' · '+d.years+'年':'')+'</p>'+(m.cpuDone&&d.kind==='fa'?'<p>補償 '+h(d.rank||'')+' · '+fmtMoney(d.comp||0)+' · '+(d.compMode==='player'?'人的補償':'金銭補償')+'</p>'+d.compOptions.map(p=>cmd('comp',h(p.name)+'を人的補償に選ぶ','data-id="'+d.id+'" data-other="'+p.id+'"')).join(''):'')+'</section>').join('');
      if(!m.cpuDone){
        out+='<h3>自由契約選手</h3>'+m.free.map(r=>'<article class="panel" data-market-free="'+r.id+'"><strong>'+h(r.name)+'</strong><p>'+positionMarkup(r.pos)+' · 希望 '+fmtSalary(r.demand)+' · 費用 '+fmtMoney(r.cost)+'</p>'+(r.offer?'<p>交渉結果 '+h(r.offer)+'</p>':'<label>提示年俸（万円）<input type="number" min="500" max="50000" step="100" value="'+Math.round(r.demand*10000)+'"></label>'+cmd('free','獲得交渉を行う','data-id="'+r.id+'"'))+'</article>').join('');
        const mine=m.tradeClubs.find(t=>t.id===g.team.id),rivals=m.tradeClubs.filter(t=>t.id!==g.team.id);
        const options=list=>'<option value="">選択してください</option>'+list.map(p=>'<option value="'+p.id+'">'+h(p.name)+' · '+h(p.pos)+' · '+p.age+'歳 · 総合 '+p.overall+' · '+fmtSalary(p.salary)+(p.category?' · '+h(p.category):'')+'</option>').join('');
        out+='<section class="panel"><h3>1対1トレード</h3><p class="small">能力、年齢、年俸、ポジション需要から相手球団が判断します。</p><label>自球団の提示選手<select id="canonical-trade-mine">'+options(mine?.players||[])+'</select></label><label>相手球団の希望選手<select id="canonical-trade-other"><option value="">選択してください</option>'+rivals.map(t=>'<optgroup label="'+h(t.name)+'">'+options(t.players).replace('<option value="">選択してください</option>','')+'</optgroup>').join('')+'</select></label>'+cmd('trade','交換を提案する')+'</section><section class="panel"><h3>交換ドラフト</h3><p>23〜32歳・今季65試合以下・通常選手。各球団1回まで。</p>'+(mine?.players||[]).filter(p=>p.exchange).map(p=>cmd('exchange',h(p.name)+'を交換候補にする','data-id="'+p.id+'"')).join('')+'</section>';
        out+=cmd('close','CPU交渉を確定し移籍結果へ','',held||m.waiting>0||m.counter>0||m.unread>0);
      }else out+=cmd('finish','補償を確定して市場を終了');
    }
    return out+cmd('home','交渉を中断して本部へ')+'</section>';
  }
  function canonicalFanCard(s,t){
    const fonts=['sans-serif','serif','"Hiragino Maru Gothic ProN",sans-serif','monospace'],color=FAN_COLORS[s.color]||FAN_COLORS[0],ink=s.color===5?'#382a17':'#fff6d9';
    return '<div class="fan-card deluxe-card" style="--fc-color:'+color+';--fc-ink:'+ink+';font-family:'+fonts[s.font||0].replaceAll('"','&quot;')+'"><div class="fc-watermark">'+teamBadge(t)+'</div><div class="fc-top"><span>PENNANT LAB<br><b>OFFICIAL FAN CLUB</b></span><span class="fc-emblem">'+teamBadge(t)+'</span></div><div class="fc-name">'+h(s.name)+'</div><div class="fc-metal"><i></i><i></i><i></i><i></i></div><div class="fc-bottom"><span>MEMBER NO.<b>000001</b></span><span>SINCE<b>'+s.since+'</b></span><span>ANNUAL FEE<b>¥'+s.fee.toLocaleString()+'</b></span></div><div class="fc-footer">OFFICIAL MEMBERSHIP · '+h(t.short||t.name)+'</div></div>';
  }
  function canonicalCommerceMarkup(g,a,held,button){
    const s=a.commerce;if(!s)return '<p class="warning">営業情報なし</p>';
    const id=s.job,cmd=(k,label,attrs='',disabled=held)=>button('commerce-'+k,label,attrs,disabled),choices=(k,rows,selected)=>'<div class="commerce-options">'+rows.map(([v,n])=>cmd(k,h(n)+(String(v)===String(selected)?' ✓':''),'data-value="'+h(String(v))+'"',held||String(v)===String(selected))).join('')+'</div>',title=canonicalEventLabels[id]||id;
    const head='<section class="panel"><h2>'+h(title)+'</h2>';
    if(['brief','briefing'].includes(s.stage))return head+normalDetailCard(id==='sponsor'?'sponsor':'contract','営業部からの報告')+'<p>'+s.year+'年の営業計画を決定します。</p>'+cmd('start','業務を開始する')+cmd('back','本部へ戻る')+'</section>';
    if(s.stage==='selection'){
      let out=head;
      if(id==='sponsor'){out+=normalDetailCard('sponsor','協賛契約')+'<p>年間契約額は12回に分けて入金。契約社数に応じて不祥事時の影響が増加します。</p>'+s.candidates.map(c=>'<button class="sponsor-choice '+(s.selected.includes(c.id)?'chosen':'')+'" data-action="canonical-event-command" data-kind="commerce-toggle" data-value="'+h(c.id)+'" '+(held?'disabled':'')+'><span class="sponsor-check">'+(s.selected.includes(c.id)?'✓':'○')+'</span><span><strong>'+h(c.name)+'</strong><small>'+h(c.industry)+'</small></span><b>'+fmtMoney(c.annual)+'</b></button>').join('')+'<div class="sponsor-risk"><p>不祥事時のファン離れの影響 ＋'+s.risk.burden+'% ／ 各社解除率 '+s.risk.cancellation+'%</p></div><p>契約 '+s.selected.length+'社 · 年額 '+fmtMoney(s.annual)+'</p>';}
      else if(id==='fanclub'){out+='<div class="fan-preview-sticky">'+canonicalFanCard(s,g.team)+'</div><label>クラブ名<input id="canonical-fan-name" maxlength="30" value="'+h(s.name)+'"></label>'+cmd('name','クラブ名を保存')+'<h3>カードデザイン</h3>'+choices('font',[[0,'ゴシック'],[1,'明朝'],[2,'丸ゴシック'],[3,'等幅']],s.font)+choices('color',FAN_COLORS.map((_,i)=>[i,['紺','赤','緑','黒','紫','金'][i]]),s.color)+'<h3>年会費 ¥'+s.fee.toLocaleString()+'</h3>'+choices('fee',[[-500,'−500円'],[500,'＋500円']],null)+'<h3>入会特典</h3><div class="fan-perk-grid">'+s.perks.map(p=>'<button class="fan-perk '+(s.perk===p.key?'chosen':'')+'" data-action="canonical-event-command" data-kind="commerce-perk" data-value="'+h(p.key)+'" '+(held?'disabled':'')+'>'+fanPerkArt(p.key,g.team)+'<b>'+h(p.label)+'</b><small>原価 '+p.cost.toLocaleString()+'円 / 人</small></button>').join('')+'</div><p>予想入会 '+s.estimate.members.toLocaleString()+'名 · 年間利益見込み '+fmtMoney(s.estimate.income-s.estimate.cost)+'</p>';}
      else if(id==='broadcast')out+=salesScene('contract',g.team)+'<p>放送局の提示 年額 '+fmtMoney(s.base)+'</p><p>希望額 '+fmtMoney(s.base+s.delta)+' · 成立見込み '+s.chance+'%</p>'+choices('delta',[[0,'提示額'],[1,'＋1億円'],[2,'＋2億円'],[3,'＋3億円']],s.delta)+'<p class="small">交渉不成立時は減額条件で契約。</p>';
      else if(id==='naming')out+=salesScene('stadium',g.team)+(s.contract?'<p>契約継続中 '+h(s.contract.name)+' · '+s.contract.end+'年まで</p>':choices('choice',[[-1,'契約しない'],...s.options.map((n,i)=>[i,n.name+' · '+n.years+'年 · 年額 '+fmtMoney(n.annual)])],s.choice));
      else if(id==='tv'){out+=salesScene('tv',g.team)+'<p>出演メンバー '+s.players.length+' / 5名 · タップで選択、長押しで選手詳細</p><div class="commerce-players">'+s.eligible.map(r=>{const p=g.club?.roster.find(p=>p.id===r.id),model=p?canonicalPlayerModel(p,g):null;return '<button class="btn '+(s.players.includes(r.id)?'primary':'outline')+'" data-action="canonical-event-command" data-kind="commerce-player" data-value="'+r.id+'" data-canonical-tv="'+r.id+'" '+(held?'disabled':'')+'>'+(model?tvFace(model):'')+'<small>'+(model?themedPlayerName(model):h(r.name))+'</small></button>';}).join('')+'</div>';}
      else if(['fan-fest','opening-promo'].includes(id)){out+=s.plans.map(p=>'<article class="fest-plan '+(p.index===s.plan?'chosen':'')+'">'+(id==='fan-fest'?fanFestPhoto(p.photo,g.team):openingPromoArt(p.index,g.team))+'<h3>'+h(p.title)+'</h3><p>'+h(p.desc||'')+'</p>'+cmd('plan',h(p.name)+' · '+fmtMoney(p.cost),'data-value="'+p.index+'"')+'</article>').join('')+'<p class="small">'+(id==='fan-fest'?'開催は企画確定の7日後。費用は開催時に精算します。':'開幕戦当日に開催します。')+'</p>';}
      return out+cmd('confirm','この内容で確定する','',held||id==='tv'&&s.players.length!==5||['fan-fest','opening-promo'].includes(id)&&s.plans[s.plan]?.cost>g.team.cash)+(['fan-fest','tv','opening-promo'].includes(id)?cmd('decline','今回は見送る'):'')+cmd('back','本部へ戻る')+'</section>';
    }
    const guests=()=>'<div class="commerce-players">'+(s.players||[]).map(id=>{const p=g.club?.roster.find(p=>p.id===id);if(!p)return '';const model=canonicalPlayerModel(p,g),v=tvSpecial(model);return '<article class="tv-guest" style="--tv-ring:'+v.ring+';--tv-accent:'+v.accent+'">'+faceMini(model,{overall:true})+themedPlayerName(model)+(v.cat?'<p>'+h(v.line)+'</p>'+rareCinemaArt(model,'join',true):'')+'</article>';}).join('')+'</div>';
    const scene=id==='fan-fest'?fanFestPhoto(s.plans?.[s.plan]?.photo??3,g.team):id==='opening-promo'?openingPromoArt(s.plan,g.team):salesScene(id==='tv'?'tv':'stadium',g.team);
    if(s.stage==='scheduled')return head+scene+'<p>開催・出演予定日 '+h(s.due)+'</p>'+(id==='tv'?guests():'')+cmd('park','計画を確認して本部へ')+'</section>';
    if(s.stage==='live')return head+scene+(id==='tv'?guests():'')+cmd(id==='tv'?'tv':id==='fan-fest'?'live':'opening','開催・出演結果を確認する')+'</section>';
    if(s.stage==='result'){
      let out=head;
      if(id==='fanclub'&&s.contract){const q=s.contract;out='<section class="panel"><h2>'+(q.first?'ファンクラブ設立！！':'ファンクラブが更新されました！！')+'</h2>'+salesCelebration('celebration',g.team)+canonicalFanCard(q,g.team)+salesMetrics([['新規入会',q.newMembers+'名'],['継続会員',q.retained+'名'],['合計会員',q.members+'名'],['年会費','¥'+q.fee.toLocaleString()],['会費収入',fmtMoney(q.income)],['特典原価',fmtMoney(q.cost)]])+fanPerkArt(q.perk,g.team);}
      else if(id==='sponsor'&&s.contract){out+=salesScene('contract',g.team)+'<h3>'+s.contract.companies.length+'社との契約確定</h3>'+s.contract.companies.map(c=>offdeskMoneyRow(c.name,c.annual)).join('');}
      else if(id==='broadcast'&&s.contract)out+=salesScene('contract',g.team)+'<p>'+h(s.result)+'</p>'+salesMetrics([['先方提示',fmtMoney(s.contract.base)],['希望額',fmtMoney(s.contract.asked)],['成立額',fmtMoney(s.contract.annual)]]);
      else if(id==='naming')out+=salesScene('stadium',g.team)+'<p>'+h(s.result||'契約なし')+'</p>'+(s.contract?'<p>'+s.contract.start+'〜'+s.contract.end+'年 · 年額 '+fmtMoney(s.contract.annual)+'</p>':'');
      else {const r=s.report;out+=(r?.declined?'':id==='fan-fest'?fanFestPhoto(3,g.team):scene)+(id==='tv'&&!r?.declined?guests():'')+'<h3>'+h(s.result||'業務完了')+'</h3>'+(r?salesMetrics([['ファン増加','＋'+(r.gain||0)+'人'],['収入',fmtMoney(r.income||0)],['支出',fmtMoney(r.cost||0)],...(Number.isFinite(r.attendance)?[['来場者数',r.attendance+'人'],['満足度',r.satisfaction+'/100']]:[])]):'');}
      return out+cmd('finish','業務を完了する')+'</section>';
    }
    return head+'<p>未対応の営業状態です。確定状態を維持します。</p></section>';
  }
  let canonicalTvPress=null,canonicalTvSuppressed=null;
  function canonicalTvClear(){if(canonicalTvPress?.timer)clearTimeout(canonicalTvPress.timer);canonicalTvPress=null;}
  function canonicalTvDetails(id){
    const g=canonicalSnapshot?.game,p=g?.club?.roster.find(p=>p.id===id);
    if(ui.page!=='canonical-events'||g?.annual?.active!=='tv'||!p||slotOpening||document.querySelector('.canonical-tv-detail'))return;
    const model=canonicalPlayerModel(p,g),dlg=document.createElement('dialog');
    dlg.className='tv-detail-dialog canonical-tv-detail';dlg.innerHTML='<section class="panel"><button class="btn outline full" data-tv-close>閉じる</button>'+playerUpperPortrait(model)+'<h2>'+themedPlayerName(model)+'</h2>'+annualAbilityStrip(model)+statDisplayGrid(model)+'</section>';
    dlg.addEventListener('click',e=>{if(e.target.closest('[data-tv-close]'))dlg.close();});dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.appendChild(dlg);dlg.showModal();
  }
  window.addEventListener('pointerdown',e=>{const b=e.target.closest?.('[data-canonical-tv]');if(ui.page!=='canonical-events'||!b||b.disabled||slotOpening)return;canonicalTvClear();const p={id:Number(b.dataset.canonicalTv),x:e.clientX,y:e.clientY,epoch:canonicalEpoch};canonicalTvPress=p;p.timer=setTimeout(()=>{if(canonicalTvPress!==p||canonicalEpoch!==p.epoch)return;canonicalTvSuppressed={id:p.id,until:Date.now()+900};canonicalTvDetails(p.id);canonicalTvClear();},550);},true);
  window.addEventListener('pointermove',e=>{const p=canonicalTvPress;if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>12)canonicalTvClear();},true);
  for(const name of ['pointerup','pointercancel','scroll'])window.addEventListener(name,canonicalTvClear,true);
  function canonicalForeignMarkup(g,blocked,button){
    const f=g.foreign;if(!f)return '';
    const held=blocked||!f.canOperate,cmd=(k,label,attrs='',disable=held)=>button('foreign-'+k,label,attrs,disable);
    const toggle='<button class="btn outline full" data-action="canonical-foreign-toggle">'+(canonicalForeignOpen?'海外スカウトを閉じる':'海外スカウト・外国人選手獲得')+'</button>';
    if(!canonicalForeignOpen&&!f.responsePending)return '<section class="panel">'+toggle+'</section>';
    const model=p=>({...p,age:p.age||25,teamId:null,scoutingHidden:p.hidden===true,abilitiesHidden:p.hidden===true});
    const prospect=p=>'<div class="recruit-player">'+faceMini(model(p))+'<div><strong>'+themedPlayerName(model(p))+'</strong><p>'+h(p.country)+' · '+positionMarkup(p.pos)+(p.age?' · '+p.age+'歳':'')+'</p></div></div>'+(p.hidden?'<p>能力・本人情報は非公開</p>':p.estimate?'<p>推定総合 '+p.estimate.low+'〜'+p.estimate.high+' · 確度 '+h(p.confidence)+'</p>':'')+'<div class="annual-ability-strip">'+Object.entries(p.abilities||{}).map(([k,v])=>'<span><small>'+h(DRAFT_LABELS[k]||k)+'</small><b>'+(v?.value!=null?v.value:v?v.low+'〜'+v.high:'?')+'</b></span>').join('')+'</div>'+((p.stats||[]).length?'<div class="grid2">'+p.stats.map(([k,v])=>'<p>'+h(k)+' '+h(v)+'</p>').join('')+'</div>':'');
    let out='<section class="panel"><h2>海外スカウト・外国人選手獲得</h2>'+toggle+normalDetailCard('foreign','海外選手調査')+(held?'<p class="small">現在は別の重要業務・報告の対応が必要です。</p>':'');
    if(!f.initialized)return out+cmd('init','海外スカウトを開始')+'</section>';
    out+='<p>調査回数 '+f.used+' / '+f.budget+'</p>';
    const n=f.negotiation;
    if(!n)return out+(f.candidates.length?f.candidates.map(p=>'<article class="panel draft-card">'+prospect(p)+f.research.map(t=>cmd('research',h(t.label)+' '+fmtMoney(t.cost)+(p.tasks.includes(t.key)?' ✓':''),'data-id="'+p.id+'" data-key="'+t.key+'"',held||p.tasks.includes(t.key)||f.used>=f.budget||g.team.cash<t.cost)).join('')+cmd('begin','獲得交渉に進む','data-id="'+p.id+'"',held||!p.canBegin)+'</article>').join(''):'<p>現在確認できる候補者はありません。</p>')+'</section>';
    const p=n.candidate;out+='<article class="panel">'+prospect(p)+rareCinemaArt(model(p),'contract')+'<p>交渉状況 · '+h(({talk:'交渉中',waiting:'回答待ち',counter:'再交渉',response:'回答到着',signed:'契約成立',refused:'交渉不成立',rival:'他球団契約','rival-pending':'他球団契約',overseas:'海外残留'})[n.status]||n.status)+'</p>';
    if(n.status==='talk'){
      out+='<p>交渉意欲 '+(n.interest===null?'……判定不能':n.interest)+' · 会話 '+n.answerCount+' / 3</p>'+(!n.interpreter?cmd('interpreter','交渉通訳を依頼 '+fmtMoney(n.interpreterCost),'',held||g.team.cash<n.interpreterCost):'<p>通訳あり</p>');
      if(n.question)out+='<h3>'+h(n.question.text)+'</h3>'+n.question.options.map(x=>cmd('reply',h(x.label),'data-key="'+h(x.key)+'"')).join('');
      else if(n.answerCount===3){out+='<h3>生活・待遇支援</h3>'+f.supportOptions.map(x=>cmd('support',h(x.label)+' '+fmtMoney(x.cost)+(n.support?.[x.key]?' ✓':''),'data-key="'+x.key+'" data-enabled="'+(!n.support?.[x.key])+'"')).join('')+'<h3>契約条件</h3>'+n.offers.map(o=>cmd('offer',['基本条件','標準条件','好条件'][o.level]+' · 契約金 '+fmtMoney(o.fee)+' · 年俸 '+fmtMoney(o.salary)+' · 支援 '+fmtMoney(o.supportCost)+(n.offerLevel===o.level?' ✓':''),'data-level="'+o.level+'"',held||!o.affordable)).join('')+cmd('submit','正式オファーを提出','',held||n.offerLevel==null);}
    }else if(n.status==='waiting'){out+='<p>回答予定 '+h(n.due||'未定')+'</p>'+(n.ready?cmd('open','回答を確認する'):'<p>本部に戻って日程を進めてください。</p>');}
    else if(n.status==='counter'&&n.counter){out+='<p>当初年俸 '+fmtMoney(n.counter.originalSalary)+' → 希望年俸 '+fmtMoney(n.counter.salary)+'</p>'+cmd('counter','希望額を受け入れる','data-accept="true"',held||!n.counter.affordable)+cmd('counter','当初の条件を維持','data-accept="false"');}
    else if(!n.opened)out+=cmd('open','回答を確認する');
    else if(n.status==='signed'){out+='<h3>契約成立</h3>'+rareCinemaArt(model(p),'join',n.stage===2)+(n.result?.offer?'<p>契約金 '+fmtMoney(n.result.offer.fee)+' · 年俸 '+fmtMoney(n.result.offer.salary)+'</p>':'')+(n.stage<2?cmd('reveal','能力を段階公開する（'+(n.stage+1)+'/2）'):cmd('finish','入団報告を完了する'));}
    else {out+=rareCinemaArt(model(p),'loss')+'<p>交渉結果を確認してください。</p>'+(n.result?.recovery?'<p class="small">広告券・確認済み権利による復活は上部の報酬画面から利用できます。</p>':'')+cmd('finish','この交渉を終了する');}
    return out+'</article></section>';
  }
  function canonicalEventRender(){
    const app=$('#app'),g=canonicalSnapshot?.game;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-events-back">‹ 本部</button></div>';
    if(!g||!accountCurrent()){app.innerHTML='<div class="setup-screen">'+top+'<p role="status">確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-events-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    const a=g.annual||{},inbox=g.inbox||{},blocked=slotOpening||!!canonicalSnapshot.pending?.length,dis=blocked?'disabled':'';
    const important=!!(inbox.finance||inbox.rare||inbox.injury||inbox.career||inbox.rookie||inbox.decade!==null&&inbox.decade!==undefined);
    const commandButton=(key,label,extra='',disabled=blocked)=>'<button class="btn primary full" data-action="canonical-event-command" data-kind="'+key+'" '+extra+' '+(disabled?'disabled':'')+'>'+label+'</button>';
    let body='<h2 class="page-title">イベント・年間業務</h2><p class="page-sub">'+h(a.date||g.headquarters.dateText)+'</p>'+canonicalRewardLink();
    if(inbox.review){const r=inbox.review,report=g.headquarters.lastReport;body+='<section class="panel"><h3>試合結果の確認</h3>'+(report?.gameId===r.gameId?canonicalMatchReport(report,g):'<p>'+h(r.date)+'</p><div class="score-big">'+r.homeScore+' - '+r.awayScore+'</div>')+commandButton('review','保存済みの試合結果を確認','',blocked||important)+'</section>';}
    if(inbox.monthly){const m=inbox.monthly;body+='<section class="panel"><h3>月次報告</h3>'+normalDetailCard('finance','月例会議')+'<p>'+h(m.month)+' · '+m.wins+'勝 '+m.losses+'敗 '+m.ties+'分</p>'+(m.finance?'<p>収入 '+fmtMoney(m.finance.revenue)+' / 報告差額 '+fmtMoney(m.finance.net)+'</p>':'<p class="small">会計内訳の記録なし</p>')+'<p>報告時の保有資金 '+fmtMoney(m.cash)+'</p>'+(m.matches||[]).map(x=>'<div class="event">'+h(x.date)+' · '+h(x.opponent)+' '+x.rs+' - '+x.ra+'</div>').join('')+commandButton('month','保存済み月次報告を確認','',blocked||important||!!inbox.review)+'</section>';}
    if(inbox.milestoneCount){body+='<section class="panel"><h3>記録・ニュース</h3>'+inbox.milestones.map(e=>'<p class="event">'+h(e.date)+' '+h(e.title)+'</p>').join('')+(inbox.milestoneCount>inbox.milestones.length?'<p class="small">ほか '+(inbox.milestoneCount-inbox.milestones.length)+'件は記録に保存されています。</p>':'')+commandButton('milestones','保存済み報告を確認','',blocked||important||!!inbox.review)+'</section>';}
    if(important){
      const person=(id,kind)=>{const p=g.club?.roster.find(p=>p.id===id);if(!p)return '<p>選手の詳細情報は現在非表示です。</p>';const m=canonicalPlayerModel(p,g);return playerUpperPortrait(m)+'<h3>'+themedPlayerName(m)+'</h3>'+rarePanel(m,kind)+rareCinemaArt(m,kind,true);};
      if(inbox.finance){const f=inbox.finance;body+='<section class="panel warning"><h2>資金不足</h2><p>'+h(f.date)+' · 不足額 '+fmtMoney(f.shortfall)+'</p><p>銀行融資は未接続です。資金を自動補填しません。</p>'+(f.status==='gameover'?'<p>経営終了 · 保存データは保持されています。</p>':commandButton('finance-end','経営を終了する（取り消し不可）','',blocked))+'</section>';}
      else if(inbox.rare){const r=inbox.rare,m=r.player?{...r.player,scoutingHidden:false,abilitiesHidden:false}:{name:'????',specialCategory:r.category,scoutingHidden:true,abilitiesHidden:true};body+='<section class="rare-news-screen"><header class="edition-heading"><small>'+h(r.date)+' · SPECIAL NEWS</small><h2>'+h(r.title||'特別速報')+'</h2></header>'+rarePanel(m,'news')+rareCinemaArt(m,'news',!r.hidden)+(r.player?'<h3>'+themedPlayerName(m)+'</h3>':'')+'<p>'+h(r.body||(r.hidden?'詳細はまだ公開されていません。':'特別なニュースが届きました。'))+'</p>'+commandButton('rare-ack','速報を確認する')+'</section>';}
      else if(inbox.injury){const r=inbox.injury;body+='<section class="panel"><h2>重要負傷報告</h2>'+person(r.playerId,'medical')+'<p>'+h(r.date)+' · 離脱見込み '+h(r.days)+'日</p><p class="small">特別治療は上部の報酬画面を確認してください。実広告は未接続です。</p>'+commandButton('injury-ack','負傷報告を確認する')+'</section>';}
      else if(inbox.career){const r=inbox.career,consult=['consult','plan'].includes(r.stage);body+='<section class="panel"><h2>'+ (consult?'引退・去就相談':r.stage==='farewell'?'引退セレモニー':'選手からの報告')+'</h2>'+person(r.playerId,consult?'consult':r.stage==='farewell'?'farewell':'news')+(consult?'<p>引退に際して準備する行事を選択してください。選択は最大5件です。</p><fieldset id="canonical-farewell-options">'+r.options.map(o=>'<label class="row"><input type="checkbox" value="'+h(o.key)+'" '+dis+'>'+h(o.label)+' · '+fmtMoney(o.cost)+'</label>').join('')+'</fieldset><p class="small">引退慰留は上部の報酬画面を確認してください。行事費用は確定時に支払います。</p>'+commandButton('career-accept','引退と準備内容を確定する'):['thanks','farewell'].includes(r.stage)?commandButton('career-dismiss','報告を確認する'):'<p>未接続の相談段階です。</p>')+'</section>';}
      else if(inbox.rookie){const r=inbox.rookie;body+='<section class="panel"><header class="edition-heading"><small>'+h(r.year)+' · ROOKIE ARRIVALS</small><h2>新人入団報告</h2></header>'+r.entries.map((p,i)=>{const m=p.stage===2?{...canonicalDraftModel(p),...p.abilities,teamId:g.team.id,scoutingHidden:false,abilitiesHidden:false,pastLifeAppearance:p.pastLifeAppearance}:canonicalDraftModel(p);return '<article class="panel"><h3>新人 '+(i+1)+'</h3>'+rarePanel(m,'join')+(p.stage===2?faceMini(m)+'<h3>'+themedPlayerName(m)+'</h3>'+annualAbilityStrip(m)+rareCinemaArt(m,'join',true):'<p>'+h(p.name||'未公開')+' · '+positionMarkup(p.pos)+'</p>')+ (p.stage===1?rareCinemaArt(m,'join'):'')+(p.stage<2?commandButton('rookie-reveal',p.stage===0?'入団報告を開く':'能力を公開する','data-id="'+p.id+'"'):'')+'</article>';}).join('')+commandButton('rookie-finish','新人入団報告を終了する','',blocked||r.entries.some(p=>p.stage<2))+'</section>';}
      else if(inbox.decade!=null)body+='<section class="panel"><h2>球団史・節目の報告</h2><p>'+h(inbox.decade)+'年の節目を迎えました。</p><button class="btn primary full" data-action="canonical-decade-read" '+dis+'>10年史を読む</button>'+(canonicalArchive?.kind==='decades'&&canonicalArchive.year===inbox.decade?canonicalArchive.items.map(x=>canonicalDecadeMarkup(x,g)).join('')||'<p>保存済みの記録はありません。</p>':'')+'<p class="small">閲覧は任意です。後から記録画面で再読できます。</p>'+commandButton('decade-ack','節目の報告を確認する')+'</section>';
    }
    const ordinaryPending=!!inbox.review||!!inbox.monthly||!!inbox.milestoneCount;
    const annualRoutineMayDefer=(!!a.mode||a.canStart===true)&&a.routineClearable===true;
    const held=blocked||important||!!g.foreign?.responsePending||ordinaryPending&&!annualRoutineMayDefer;
    body+=canonicalForeignMarkup(g,blocked||important,commandButton);
    if(inbox.opening)body+='<section class="panel"><h2>新シーズン開幕</h2>'+normalDetailCard('opening','新たなシーズン')+commandButton('opening-ack','新シーズンを始める','',held)+'</section>';
    if(a.canStart)body+='<section class="panel"><h3>シーズン全日程終了</h3>'+normalDetailCard('awards','年間表彰・決算')+commandButton('start','オフシーズン業務を開始','',held)+'</section>';
    if(a.mode){
      body+='<section class="panel desk-panel"><h3>年間業務一覧</h3>'+a.tasks.map(j=>'<div class="event"><b>'+h(canonicalEventLabels[j.id]||j.id)+'</b><p class="small">'+h(j.start)+' · '+h(canonicalEventStatus[j.status]||j.status)+'</p>'+(j.status==='ready'?j.id==='movement-market'?'':canonicalAnnualJobs.includes(j.id)?commandButton('open','業務を始める','data-job="'+j.id+'"',held||!!a.active):'<p class="small">専用画面の接続待ち</p>':'')+'</div>').join('')+commandButton('day','オフシーズンの1日を進める','',held||!a.canAdvance)+'</section>';
      if(a.active==='awards-all'&&a.awardReport){
        const rows=a.awardReport.awards.filter(r=>canonicalAwardFilter==='all'||r.teamId===g.team.id);
        body+='<section class="review-screen"><header class="edition-heading"><small>'+g.year+' · AWARDS CEREMONY</small><h2>年間表彰式</h2></header>'+normalDetailCard('awards','表彰式会場')+'<div class="chips">'+[['all','全球団'],['own','自球団']].map(([v,t])=>'<button class="chip '+(v===canonicalAwardFilter?'active':'')+'" data-action="canonical-awards-filter" data-value="'+v+'">'+t+'</button>').join('')+'</div>'+rows.map(r=>'<section class="panel award-winner '+leagueClass(r.league)+' achievement-surface" '+achievementAttrs(r.title)+'>'+achievementHeading(r.title)+'<span class="award-medal">🏅 '+h(r.title)+'</span><div class="award-hero" data-own-club="'+(r.teamId===g.team.id)+'">'+(r.player?awardPortrait(r.player,r.title):'')+'<div><strong>'+(r.player?themedPlayerName(r.player):'選手')+'</strong><small>'+h(r.team)+'</small><span class="award-stat">'+h(r.stat)+'</span></div></div></section>').join('')+(rows.length?'':'<p class="empty">受賞者なし</p>')+'<h3>今季の記録</h3>'+a.awardReport.milestones.filter(e=>canonicalAwardFilter==='all'||e.teamId===g.team.id).map(e=>'<p class="event">'+h(e.date)+' '+h(e.title)+'</p>').join('')+commandButton('complete','表彰式を終了する','data-job="awards-all"',held)+'</section>';
      }else if(a.active==='settlement'&&a.financeReport){
        const r=a.financeReport;body+='<section class="panel"><h2>年間収支報告会</h2>'+normalDetailCard('finance','決算資料')+normalFinanceBalance(r.income,r.expense,r.net)+'<p>営業収支（投資前） '+fmtMoney(r.operating)+'</p><p>現在の保有資金 '+fmtMoney(r.cash)+'</p><h3>収入内訳</h3>'+r.incomeRows.map(([k,v])=>offdeskMoneyRow(k,v)).join('')+'<h3>支出内訳</h3>'+r.expenseRows.map(([k,v])=>offdeskMoneyRow(k,-v)).join('')+commandButton('complete','収支報告を確認する','data-job="settlement"',held)+'</section>';
      }else if(a.active==='movement-declarations'){
        const rows=a.requests||[],unresolved=rows.some(r=>['request','refused'].includes(r.status));
        body+='<section class="panel renewal-room"><h2>FA・海外挑戦の相談</h2>'+normalDetailCard('contract','去就相談・残留交渉')+rows.map(r=>{const p=g.club?.roster.find(p=>p.id===r.id),model=p?canonicalPlayerModel(p,g):null,open=['request','refused'].includes(r.status);return '<section class="panel">'+(model?playerUpperPortrait(model)+'<h3>'+themedPlayerName(model)+'</h3>':'')+'<p>'+h(movementRequestLabel(r.kind))+' · '+h(({request:'去就相談',refused:'残留交渉保留',retained:'残留合意',stayed:'挑戦見送り'})[r.status]||r.status)+'</p><p>希望年俸 '+fmtSalary(r.demand)+'</p>'+(open?[['retain','希望額で残留提示',1],['retain','希望額＋15％',1.15],['allow','本人の希望を受け入れる',0],...(r.kind==='posting'?[['deny','ポスティングを認めない',0]]:[])].map(([kind,label,mult])=>commandButton(kind,label,'data-id="'+r.id+'" data-mult="'+mult+'"',held)).join(''):'')+'</section>';}).join('')+(rows.length?'':'<p>対象選手はいません。</p>')+commandButton('complete','相談を終了する','data-job="movement-declarations"',held||unresolved)+'</section>';
      }else if(a.active==='movement-market')body+=canonicalMarketMarkup(g,a,held,commandButton);
      else if(a.active==='draft')body+=canonicalDraftMarkup(g,a,held,commandButton);
      else if(a.active==='roster-cut')body+=canonicalCutMarkup(g,a,held,commandButton);
      else if(['renewal1','renewal2'].includes(a.active))body+=canonicalRenewalMarkup(g,a,held,commandButton);
      else if(['autumn','winter','self'].includes(a.active))body+=canonicalTrainingMarkup(g,a,held,commandButton);
      else if(['booking','winter-return','camp','exhibition'].includes(a.active))body+=canonicalPreseasonMarkup(g,a,held,commandButton);
      else if(canonicalCommerceJobs.includes(a.active))body+=canonicalCommerceMarkup(g,a,held,commandButton);
      else if(a.active)body+='<p class="warning">現在のイベントの専用画面は未接続です。処理は保持します。</p>';
      if(!a.active&&a.market)body+=canonicalMarketMarkup(g,a,held,commandButton);
    }else if(!a.canStart&&!inbox.opening&&!inbox.review&&!inbox.monthly&&!inbox.milestoneCount&&!important)body+='<p class="empty">現在対応する年間業務はありません。</p>';
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(g.team)+'">'+top+'<main class="main">'+body+'</main></div>';
  }
  async function canonicalEventRequest(command){
    if(slotOpening||!accountCurrent()||!canonicalSlot||command&&(!canonicalSnapshot||canonicalSnapshot.pending?.length))return;
    const old=canonicalSnapshot,epoch=canonicalEpoch,world=old?.world||canonicalHqWorld,scroll=draftScrollY();slotOpening=true;render();
    try{const r=await(command?canonicalPilot.advance(command):canonicalPilot.refresh());if(epoch!==canonicalEpoch)return;if(r.status!=='ready'||r.snapshot.world!==world)throw Error('event observation required');canonicalSnapshot=r.snapshot;}
    catch{if(epoch===canonicalEpoch)canonicalSnapshot=null;}
    finally{if(epoch===canonicalEpoch){slotOpening=false;render();draftJump(scroll);}}
  }
  function canonicalEventClick(b){
    const act=b.dataset.action,g=canonicalSnapshot?.game,a=g?.annual,i=g?.inbox||{};
    if(act==='canonical-events-back'){ui.page='canonical-hq';render();draftJump(0);return;}
    if(act==='canonical-events-refresh'){void canonicalEventRequest(null);return;}
    if(!g||!accountCurrent()||slotOpening)return;
    if(act==='canonical-foreign-toggle'){canonicalForeignOpen=!canonicalForeignOpen;render();return;}
    if(act==='canonical-awards-filter'&&['all','own'].includes(b.dataset.value)){canonicalAwardFilter=b.dataset.value;render();return;}
    if(act==='canonical-winter-place'&&a.active==='winter'&&a.training?.destinations?.some(d=>d.key===b.dataset.value)){canonicalWinterPlace=b.dataset.value;render();return;}
    if(act==='canonical-camp-group'&&['booking','camp'].includes(a.active)&&['first','farm'].includes(b.dataset.value)){canonicalCampGroup=b.dataset.value;render();return;}
    if(act==='canonical-camp-site'&&['booking','camp'].includes(a.active)&&!canonicalSnapshot.pending?.length&&!a.preseason?.paid){const v=b.dataset.value;if(a.preseason?.options.some(x=>x.key===v))void canonicalEventRequest({annual:'preseason',decision:'site',group:canonicalCampGroup,value:v});return;}
    if(act==='canonical-digest-next'&&a.active==='exhibition'&&a.preseason?.report&&!a.preseason.digestSeen){canonicalDigestCut=Math.min(REPORT_DIGEST_CUTS.length-1,canonicalDigestCut+1);render();return;}
    if(act!=='canonical-event-command'||canonicalSnapshot.pending?.length)return;
    const k=b.dataset.kind,job=b.dataset.job;
    const important=!!(i.finance||i.rare||i.injury||i.career||i.rookie||i.decade!=null);
    if(important&&!['finance-end','rare-ack','injury-ack','career-accept','career-dismiss','rookie-reveal','rookie-finish','decade-ack'].includes(k))return;
    let cmd=null;
    if(k.startsWith('foreign-')&&g.foreign?.canOperate&&!i.finance&&!i.rare&&!i.injury&&!i.career&&!i.rookie&&i.decade==null){
      const decision=k.slice(8),f=g.foreign,n=f.negotiation,id=Number(b.dataset.id),key=b.dataset.key,level=Number(b.dataset.level);canonicalForeignOpen=true;
      if(decision==='init'&&!f.initialized)cmd={foreign:decision};
      else if(decision==='begin'&&!n&&f.candidates.some(p=>p.id===id&&p.canBegin))cmd={foreign:decision,playerId:id};
      else if(decision==='research'&&!n&&f.candidates.some(p=>p.id===id&&!p.tasks.includes(key))&&f.research.some(t=>t.key===key))cmd={foreign:decision,playerId:id,key};
      else if(decision==='interpreter'&&n?.status==='talk'&&!n.interpreter)cmd={foreign:decision};
      else if(decision==='reply'&&n?.question?.options.some(o=>o.key===key))cmd={foreign:decision,key};
      else if(decision==='support'&&n?.status==='talk'&&n.answerCount===3&&f.supportOptions.some(o=>o.key===key))cmd={foreign:decision,key,enabled:b.dataset.enabled==='true'};
      else if(decision==='offer'&&n?.offers.some(o=>o.level===level&&o.affordable))cmd={foreign:decision,level};
      else if(decision==='submit'&&n?.status==='talk'&&n.offerLevel!=null&&window.confirm('正式オファーを提出しますか？'))cmd={foreign:decision};
      else if(decision==='open'&&n&&!n.opened&&(n.ready||n.status==='response'))cmd={foreign:decision};
      else if(decision==='counter'&&n?.counter&&(b.dataset.accept==='false'||n.counter.affordable)&&window.confirm('再交渉の条件を確定しますか？'))cmd={foreign:decision,accept:b.dataset.accept==='true'};
      else if(decision==='reveal'&&n?.status==='signed'&&n.opened&&n.stage<2)cmd={foreign:decision};
      else if(decision==='finish'&&n?.opened&&(n.status!=='signed'||n.stage===2)&&window.confirm('交渉結果を確定して終了しますか？'))cmd={foreign:decision};
    }
    else if(k==='finance-end'&&i.finance?.status==='pending'&&window.confirm('融資はまだ利用できません。経営終了を確定しますか？ この操作は取り消せません。'))cmd={finance:'gameover',confirmed:true};
    else if(k==='rare-ack'&&!i.finance&&i.rare)cmd={acknowledge:'rare',eventKey:i.rare.eventKey};
    else if(k==='injury-ack'&&!i.finance&&!i.rare&&i.injury)cmd={acknowledge:'injury',eventKey:i.injury.eventKey};
    else if(k==='career-accept'&&!i.finance&&!i.rare&&!i.injury&&['consult','plan'].includes(i.career?.stage)){
      const options=Array.from(document.querySelectorAll('#canonical-farewell-options input:checked')).map(x=>x.value);
      if(options.length>5){showToast('選択できる行事は最大5件です。',true);return;}
      if(options.some(k=>!i.career.options.some(o=>o.key===k)))return;
      const cost=i.career.options.filter(o=>options.includes(o.key)).reduce((n,o)=>n+o.cost,0);
      if(window.confirm('引退を受け入れ、準備費用 '+fmtMoney(cost)+' を確定しますか？'))cmd={career:'accept',playerId:i.career.playerId,options};
    }
    else if(k==='career-dismiss'&&!i.finance&&!i.rare&&!i.injury&&['thanks','farewell'].includes(i.career?.stage))cmd={career:'dismiss',playerId:i.career.playerId};
    else if(k==='rookie-reveal'&&!i.finance&&!i.rare&&!i.injury&&!i.career&&i.rookie?.entries.some(p=>p.id===Number(b.dataset.id)&&p.stage<2))cmd={acknowledge:'rookie-reveal',playerId:Number(b.dataset.id)};
    else if(k==='rookie-finish'&&!i.finance&&!i.rare&&!i.injury&&!i.career&&i.rookie&&i.rookie.entries.every(p=>p.stage===2))cmd={acknowledge:'rookie-finish'};
    else if(k==='decade-ack'&&!i.finance&&!i.rare&&!i.injury&&!i.career&&!i.rookie&&i.decade!=null)cmd={acknowledge:'decade',eventKey:String(i.decade)};
    else if(k==='opening-ack'&&i.opening)cmd={acknowledge:'opening'};
    else if(k==='review'&&i.review)cmd={acknowledge:'review',eventKey:i.review.gameId};
    else if(k==='month'&&i.monthly)cmd={acknowledge:'month'};
    else if(k==='milestones'&&i.milestoneCount)cmd={acknowledge:'milestones'};
    else if(k==='start'&&a.canStart)cmd={annual:'start'};
    else if(k==='day'&&a.canAdvance)cmd={annual:'day'};
    else if(k==='open'&&canonicalAnnualJobs.includes(job)&&a.tasks?.some(j=>j.id===job&&j.status==='ready')&&!a.active)cmd={annual:'open',job};
    else if(k==='complete'&&a.active===job&&canonicalAnnualJobs.includes(job)&&(!['roster-cut','renewal1','renewal2'].includes(job)||window.confirm('この業務を確定しますか？')))cmd={annual:'complete',job};
    else if(a.active==='movement-declarations'&&['retain','allow','deny'].includes(k)){
      const r=a.requests.find(r=>r.id===Number(b.dataset.id)&&['request','refused'].includes(r.status)),m=Number(b.dataset.mult);
      if(r&&(k!=='deny'||r.kind==='posting')&&(k!=='retain'||[1,1.15].includes(m))&&window.confirm('選手の去就について、この判断を確定しますか？'))cmd={annual:'movement',playerId:r.id,decision:k,...(k==='retain'?{multiplier:m}:{})};
    }
    else if(a.active==='draft'&&k.startsWith('draft-')){
      const decision=k.slice(6),id=Number(b.dataset.id),d=a.draft;
      if(['start','intro','announcement','announcement-next','pass','cpu','delegate','reveal','next-draw','next-round','finish'].includes(decision))cmd={annual:'draft',decision};
      else if(decision==='ticket')cmd={annual:'draft',decision,ticket:Number(b.dataset.ticket)};
      else if(decision==='research'&&d?.candidates.some(c=>c.id===id&&c.canResearch&&!c.tasks.includes(b.dataset.key)))cmd={annual:'draft',decision,playerId:id,key:b.dataset.key};
      else if(decision==='nominate'&&d?.canNominate&&d.candidates.some(c=>c.id===id)&&window.confirm('この選手を指名しますか？'))cmd={annual:'draft',decision,playerId:id};
      else if(decision==='reply'&&d?.negotiation?.id===id)cmd={annual:'draft',decision,playerId:id,answer:b.dataset.answer};
      else if(decision==='offer'&&d?.negotiation?.id===id){const role=$('#canonical-draft-role')?.value,level=Number(b.dataset.level);if(['chance','develop'].includes(role)&&[0,1,2].includes(level)&&window.confirm('この条件を正式に提示しますか？'))cmd={annual:'draft',decision,playerId:id,level,role};}
      else if(['dismiss','withdraw','delegate-contract'].includes(decision)&&d?.negotiation?.id===id&&(decision==='dismiss'||window.confirm('交渉の判断を確定しますか？')))cmd={annual:'draft',decision,playerId:id};
    }else if(a.active==='roster-cut'&&k==='cut'&&a.roster?.eligible.some(p=>p.id===Number(b.dataset.id)))cmd={annual:'cut',playerId:Number(b.dataset.id)};
    else if(['renewal1','renewal2'].includes(a.active)&&k.startsWith('renewal-')){
      const decision=k.slice(8),id=Number(b.dataset.id),d=a.renewal,r=d?.rows.find(x=>x.id===id);
      if(decision==='bulk'&&['assessment','middle','desired'].includes(b.dataset.value))cmd={annual:'renewal',decision,mode:b.dataset.value};
      else if(decision==='submit'&&window.confirm('一括提示額を確定しますか？'))cmd={annual:'renewal',decision,bonus:b.dataset.bonus==='1'};
      else if(decision==='offer'&&r?.editable){const el=b.closest('[data-renewal-id]'),salary=Number(el?.querySelector('.canonical-renewal-salary')?.value)/10000,bonuses=[...el.querySelectorAll('.canonical-renewal-bonus:checked')].map(e=>e.value);if(Number.isFinite(salary)&&salary>=.05&&salary<=15&&Math.abs(Math.round(salary*100)-salary*100)<1e-7&&bonuses.every(x=>r.options.some(o=>o.key===x))&&window.confirm('提示年俸・出来高条件を確定しますか？'))cmd={annual:'renewal',decision,playerId:id,salary,bonuses};else if(!Number.isFinite(salary)||salary<.05||salary>15)showToast('年俸は500〜150000万円です。',true);}
      else if(['release','restore','retire'].includes(decision)&&r&&window.confirm('選手の契約判断を確定しますか？'))cmd={annual:'renewal',decision,playerId:id};
      else if(['next','final-release'].includes(decision)&&window.confirm('残りの契約交渉を進めますか？'))cmd={annual:'renewal',decision};
    }else if(['autumn','winter','self'].includes(a.active)&&k.startsWith('training-')){
      const decision=k.slice(9),t=a.training||a.preseason,id=Number(b.dataset.id);
      if(decision==='menu'){const p=t?.players?.find(x=>x.id===id),el=b.closest('[data-training-id]'),focus=el?.querySelector('.canonical-training-focus')?.value,intensity=el?.querySelector('.canonical-training-intensity')?.value;if(p&&p.focus.includes(focus)&&['rest','light','normal','hard'].includes(intensity))cmd={annual:'training',decision,playerId:id,focus,intensity};}
      else if(decision==='assign'&&t?.eligible?.some(x=>x.id===id))cmd={annual:'training',decision,playerId:id,destination:b.dataset.value};
      else if(decision==='run'&&window.confirm('現在の育成・派遣計画を確定しますか？'))cmd={annual:'training',decision};
    }else if(['booking','self','winter-return','camp','exhibition'].includes(a.active)&&k.startsWith('pre-')){
      const decision=k.slice(4),v=b.dataset.value;
      if(['confirm-sites','kickoff','visit-finish','run','finish','self-back','digest'].includes(decision)&&(!['confirm-sites','kickoff','run'].includes(decision)||window.confirm('この内容で進めますか？')))cmd={annual:'preseason',decision};
      else if(['visit','policy','support'].includes(decision)&&typeof v==='string'&&(decision==='policy'||window.confirm('この方針を選択しますか？')))cmd={annual:'preseason',decision,value:v};
    }
    else if(k.startsWith('market-')&&a.market){
      const decision=k.slice(7),m=a.market,id=Number(b.dataset.id),r=m.rows.find(r=>r.id===id);
      if(decision==='open'&&!a.active&&m.roomOptions.includes(b.dataset.value))cmd={annual:'market',decision,room:b.dataset.value};
      else if(a.active==='movement-market'){
        if(['home','news','close','finish'].includes(decision)&&(!['close','finish'].includes(decision)||window.confirm('移籍市場のこの処理を確定しますか？')))cmd={annual:'market',decision};
        else if(decision==='special-result'&&m.specialResults.some(x=>x.id===id&&!x.seen))cmd={annual:'market',decision,playerId:id};
        else if(r&&decision==='talk')cmd={annual:'market',decision,playerId:id,key:b.dataset.key};
        else if(r&&decision==='salary'){const million=Number(b.closest('[data-fa-player]')?.querySelector('.canonical-fa-salary')?.value);if(Number.isSafeInteger(million)&&million>=r.bounds.min&&million<=r.bounds.max)cmd={annual:'market',decision,playerId:id,million};else showToast('提示可能な年俸の範囲を確認してください。',true);}
        else if(r&&decision==='years'){const years=Number(b.closest('[data-fa-player]')?.querySelector('.canonical-fa-years')?.value);if(Number.isInteger(years)&&years>=1&&years<=10)cmd={annual:'market',decision,playerId:id,years};}
        else if(r&&['ack','submit','withdraw'].includes(decision)&&(decision==='ack'||window.confirm('交渉条件・判断を確定しますか？')))cmd={annual:'market',decision,playerId:id};
        else if(decision==='free'&&m.free.some(x=>x.id===id&&!x.offer)){const salary=Number(b.closest('[data-market-free]')?.querySelector('input')?.value)/10000;if(Number.isFinite(salary)&&salary>=.05&&salary<=5&&window.confirm('この年俸で提示しますか？'))cmd={annual:'market',decision,playerId:id,salary};}
        else if(decision==='trade'){const playerId=Number($('#canonical-trade-mine')?.value),otherId=Number($('#canonical-trade-other')?.value);if(m.tradeClubs.find(t=>t.id===g.team.id)?.players.some(p=>p.id===playerId)&&m.tradeClubs.some(t=>t.id!==g.team.id&&t.players.some(p=>p.id===otherId))&&window.confirm('トレードを提案しますか？'))cmd={annual:'market',decision,playerId,otherId};}
        else if(decision==='exchange'&&m.tradeClubs.find(t=>t.id===g.team.id)?.players.some(p=>p.id===id&&p.exchange)&&window.confirm('交換候補として提示しますか？'))cmd={annual:'market',decision,playerId:id};
        else if(decision==='comp'){const otherId=Number(b.dataset.other);if(m.deals.some(d=>d.id===id&&d.compOptions.some(p=>p.id===otherId))&&window.confirm('人的補償を確定しますか？'))cmd={annual:'market',decision,playerId:id,otherId};}
      }
    }
    else if(canonicalCommerceJobs.includes(a.active)&&k.startsWith('commerce-')){
      const decision=k.slice(9),s=a.commerce,raw=b.dataset.value;
      if(decision==='player'&&canonicalTvSuppressed?.id===Number(raw)&&Date.now()<canonicalTvSuppressed.until){canonicalTvSuppressed=null;return;}
      if(['start','back','finish','park','live','tv','opening'].includes(decision))cmd={annual:'commerce',decision};
      else if(['confirm','decline'].includes(decision)&&window.confirm('この営業判断を確定しますか？'))cmd={annual:'commerce',decision};
      else if(decision==='name'){const value=String($('#canonical-fan-name')?.value||'').trim();if(value&&value.length<=30)cmd={annual:'commerce',decision,value};}
      else if(['toggle','perk'].includes(decision)&&typeof raw==='string')cmd={annual:'commerce',decision,value:raw};
      else if(['player','fee','color','font','delta','choice','plan'].includes(decision)&&Number.isSafeInteger(Number(raw)))cmd={annual:'commerce',decision,value:Number(raw)};
    }
    if(cmd)void canonicalEventRequest(cmd);
  }
  function canonicalHqOpen(){if(!canonicalSnapshot?.game?.headquarters||slotOpening||!accountCurrent())return;canonicalHqWorld=canonicalSnapshot.world;ui.page='canonical-hq';render();window.scrollTo(0,0);}
  const canonicalOriginalRender=render;
  render=function(){
    if(['canonical-players','canonical-player','canonical-standings'].includes(ui.page)){canonicalReadOnlyRender();return;}
    if(ui.page==='canonical-reports'){canonicalReportsRender();return;}
    if(ui.page==='canonical-achievements'){canonicalAchievementRender();return;}
    if(ui.page==='canonical-rewards'){canonicalRewardRender();return;}
    if(ui.page==='canonical-events'){canonicalEventRender();return;}
    if(canonicalOpsPages.includes(ui.page)){canonicalOpsRender();return;}
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
    if(slotOpening){e.preventDefault();e.stopImmediatePropagation();if(ui.page==='canonical-hq'&&act==='canonical-hq-pause'&&canonicalRunning){canonicalStop=true;render();}else if(ui.page==='canonical-hq'&&act==='canonical-replay-skip'&&canonicalReplay){canonicalReplaySkip=true;}return;}
    if(ui.page==='title'&&ui.launchTitle&&['launch-start','launch-back'].includes(act)||ui.page==='title'&&!ui.launchTitle&&act==='launch-back'||ui.page==='setup'&&['setup-league','pick-setup-team','team-color','club-design'].includes(act))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(ui.page==='title'&&!ui.launchTitle&&['new-slot','continue-slot'].includes(act)){
      if(canonicalDeleteSuppressed?.slot===Number(b.dataset.slot)&&Date.now()<canonicalDeleteSuppressed.until){canonicalDeleteSuppressed=null;return;}
      void openCanonicalSlot(b,act==='new-slot');
    }
    else if(ui.page==='title'&&!ui.launchTitle&&act==='canonical-world-delete')void canonicalDeleteWorld(b);
    else if(ui.page==='title'&&act==='canonical-retry'||act==='canonical-return'||ui.page==='setup'&&act==='title')void canonicalReturn();
    else if(ui.page==='canonical-ready'&&act==='canonical-hq-open')canonicalHqOpen();
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-step')void canonicalRun('date');
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-run')void canonicalRun(b.dataset.kind);
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-mode'&&['normal','fast','skip'].includes(b.dataset.mode)){canonicalPlayback=b.dataset.mode;render();}
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-refresh')void canonicalHqRequest(false);
    else if(ui.page==='canonical-hq'&&act==='canonical-reports-open'&&canonicalSnapshot?.game&&accountCurrent()){canonicalArchive=null;canonicalArchiveKind='matches';canonicalArchiveYear=0;ui.page='canonical-reports';render();draftJump(0);}
    else if(ui.page==='canonical-reports'&&act==='canonical-reports-back'){canonicalArchive=null;ui.page='canonical-hq';render();draftJump(0);}
    else if(ui.page==='canonical-reports'&&act==='canonical-archive-kind'&&['matches','papers','decades'].includes(b.dataset.kind))void canonicalArchiveLoad(b.dataset.kind,canonicalArchiveYear,0);
    else if(ui.page==='canonical-reports'&&act==='canonical-archive-search'){const year=Number($('#canonical-archive-year')?.value),max=canonicalSnapshot?.game.year+(canonicalArchiveKind==='decades'?9:0);if(Number.isSafeInteger(year)&&(year===0||year>=2027&&year<=max))void canonicalArchiveLoad(canonicalArchiveKind,year,0);else showToast('年度は0または2027年以降を指定してください。',true);}
    else if(ui.page==='canonical-reports'&&act==='canonical-archive-prev'&&canonicalArchive?.offset>0)void canonicalArchiveLoad(canonicalArchiveKind,canonicalArchiveYear,Math.max(0,canonicalArchive.offset-(canonicalArchiveKind==='papers'?3:1)));
    else if(ui.page==='canonical-reports'&&act==='canonical-archive-next'&&canonicalArchive?.nextOffset!=null)void canonicalArchiveLoad(canonicalArchiveKind,canonicalArchiveYear,canonicalArchive.nextOffset);
    else if(ui.page==='canonical-hq'&&act==='canonical-events-open'&&canonicalSnapshot?.game&&accountCurrent()){canonicalAwardFilter='all';canonicalForeignOpen=false;canonicalArchive=null;ui.page='canonical-events';render();draftJump(0);}
    else if(['canonical-hq','canonical-events'].includes(ui.page)&&act==='canonical-rewards-open'&&canonicalSnapshot?.game&&accountCurrent()){canonicalRewardReturn=ui.page;ui.page='canonical-rewards';void canonicalRewardRequest(null);draftJump(0);}
    else if(ui.page==='canonical-rewards'&&act==='canonical-achievements-open'&&canonicalSnapshot?.wallet&&accountCurrent()){ui.page='canonical-achievements';void canonicalAchievementRequest(0);}
    else if(ui.page==='canonical-achievements')canonicalAchievementClick(b);
    else if(ui.page==='canonical-rewards')canonicalRewardClick(b);
    else if(ui.page==='canonical-events'&&act==='canonical-decade-read'&&canonicalSnapshot?.game?.inbox?.decade!=null)void canonicalArchiveLoad('decades',canonicalSnapshot.game.inbox.decade,0);
    else if(ui.page==='canonical-events'){canonicalArchive=null;canonicalEventClick(b);}
    else if(ui.page==='canonical-hq'&&act==='canonical-ops-open'&&['rotation','farm','free','facilities','manager','trade'].includes(b.dataset.kind)&&canonicalSnapshot?.game?.club&&accountCurrent()){canonicalOpsNote='';canonicalFreePage=null;canonicalFreeQuery='';canonicalRotationSlot=null;canonicalTrade=null;canonicalTradeQuote=null;canonicalTradeClub=null;canonicalManagerEntry=true;ui.page='canonical-'+b.dataset.kind;render();draftJump(0);if(b.dataset.kind==='free')void canonicalLoadFree(0,'');}
    else if(canonicalOpsPages.includes(ui.page))canonicalOpsClick(b);
    else if(ui.page==='canonical-hq'&&act==='canonical-players'&&canonicalSnapshot?.game?.club&&accountCurrent()){ui.page='canonical-players';render();draftJump(0);}
    else if(ui.page==='canonical-hq'&&act==='canonical-standings'&&canonicalSnapshot?.game?.headquarters&&accountCurrent()){canonicalLeague=canonicalSnapshot.game.team.league;ui.page='canonical-standings';render();draftJump(0);}
    else if(ui.page==='canonical-standings'&&act==='canonical-league'&&['E','W'].includes(b.dataset.league)){canonicalLeague=b.dataset.league;render();}
    else if(ui.page==='canonical-players'&&act==='player-detail'&&canonicalSnapshot?.game?.club?.roster.some(p=>p.id===Number(b.dataset.id))&&accountCurrent()){canonicalPlayerId=Number(b.dataset.id);canonicalHistory=null;ui.page='canonical-player';render();draftJump(0);}
    else if(ui.page==='canonical-player'&&act==='canonical-history-open')void canonicalLoadHistory(0);
    else if(ui.page==='canonical-player'&&act==='canonical-history-prev'&&canonicalHistory?.offset>0)void canonicalLoadHistory(Math.max(0,canonicalHistory.offset-10));
    else if(ui.page==='canonical-player'&&act==='canonical-history-next'&&Number.isSafeInteger(canonicalHistory?.nextOffset))void canonicalLoadHistory(canonicalHistory.nextOffset);
    else if(ui.page==='canonical-player'&&act==='canonical-memo-save'&&canonicalHistory?.playerId===canonicalPlayerId){
      const c=canonicalSnapshot?.game?.club,p=c?.roster.find(p=>p.id===canonicalPlayerId),v=$('#canonical-player-memo')?.value;
      if(p&&c.canManage&&!canonicalSnapshot.pending?.length&&typeof v==='string'&&v.length<=2000&&v!==canonicalHistory.memo)void canonicalOpsRequest({club:'memo',playerId:p.id,value:v});
    }
    else if(ui.page==='canonical-player'&&act==='canonical-focus'){const c=canonicalSnapshot?.game?.club,p=c?.roster.find(p=>p.id===canonicalPlayerId),k=b.dataset.key;if(p&&c.canManage&&!canonicalSnapshot.pending?.length&&['balanced',...Object.keys(p.abilities)].includes(k)&&p.focus!==k)void canonicalOpsRequest({club:'focus',playerId:p.id,key:k});}
    else if(['canonical-players','canonical-player','canonical-standings'].includes(ui.page)&&act==='canonical-info-refresh')void canonicalOpsRequest(null);
    else if(['canonical-players','canonical-player','canonical-standings'].includes(ui.page)&&act==='canonical-info-back'){ui.page=ui.page==='canonical-player'?'canonical-players':'canonical-hq';canonicalPlayerId=null;canonicalHistory=null;canonicalOpsNote='';render();draftJump(0);}
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
  // Audio is a presentation-only observer of the current authoritative view.
  // Never use a hidden player's category for an audio cue.
  const sceneAudio=window.PennantAudio;
  if(sceneAudio){
    let audioScene=null;
    const refreshSceneAudio=()=>{
      const g=canonicalSnapshot?.game;
      const next=sceneAudio.sceneFor({page:ui.page,launchTitle:ui.launchTitle,annual:g?.annual?.active,inbox:g?.inbox,foreign:canonicalForeignOpen||g?.foreign?.responsePending,replay:canonicalReplay?.phase,skip:canonicalRunning&&canonicalPlayback==='skip',portal:!!ui.portalSlot,startup:startupPlaying||document.body.classList?.contains('official-startup-active'),available:ui.page==='title'||ui.page==='setup'||!!g});
      if(next!==audioScene){
        audioScene=next;sceneAudio.setScene(next);
        const cue=({mystery:'alert',legend:'rare',immortal:'immortal',rebirth:'rebirth',transcendent:'transcendent',awards:'awards',crisis:'alert'})[next];
        if(cue)sceneAudio.cue(cue);
      }
    };
    function audioPanel(){
      if(!['title','canonical-hq'].includes(ui.page)||startupPlaying||ui.portalSlot)return;
      const app=$('#app');if(!app||app.querySelector('[data-pl-audio]'))return;
      const p=sceneAudio.inspect().prefs,details=document.createElement('details');
      details.className='panel';details.dataset.plAudio='1';
      details.innerHTML='<summary>サウンド設定（試聴版）</summary><label class="row"><input type="checkbox" data-pl-audio-enabled '+(p.enabled?'checked':'')+'> ゲーム内サウンド</label><label> BGM音量 <input type="range" min="0" max="100" step="5" value="'+Math.round(p.bgm*100)+'" data-pl-bgm aria-label="BGM音量"></label><label> 効果音音量 <input type="range" min="0" max="100" step="5" value="'+Math.round(p.sfx*100)+'" data-pl-sfx aria-label="効果音音量"></label><button type="button" class="btn outline full" data-pl-audio-test>効果音を試聴</button><p class="small">端末に保存されます。起動動画の音声には影響しません。</p>';
      details.addEventListener('input',e=>{const b=e.target;if(b.hasAttribute('data-pl-audio-enabled')){sceneAudio.settings({enabled:b.checked});if(b.checked)void sceneAudio.unlock();}else if(b.hasAttribute('data-pl-bgm'))sceneAudio.settings({bgm:Number(b.value)/100});else if(b.hasAttribute('data-pl-sfx'))sceneAudio.settings({sfx:Number(b.value)/100});});
      details.addEventListener('click',e=>{if(e.target.closest('[data-pl-audio-test]'))void sceneAudio.unlock().then(ok=>{if(ok)sceneAudio.cue('open');});});
      (app.firstElementChild||app).appendChild(details);
    }
    const beforeAudioRender=render;
    render=function(){const result=beforeAudioRender();try{refreshSceneAudio();audioPanel();}catch{}return result;};
    window.addEventListener('click',e=>{
      if(!e.isTrusted||startupPlaying||document.hidden||!audioScene)return;
      const b=e.target.closest?.('button[data-action]');
      if(b?.disabled)return;
      void sceneAudio.unlock().then(ok=>{if(ok&&b&&!slotOpening&&audioScene)sceneAudio.cue('tap');});
    },true);
    document.addEventListener('visibilitychange',()=>sceneAudio.visibility(!document.hidden));
    window.addEventListener('pl-native-suspend',()=>sceneAudio.visibility(false));
    window.addEventListener('focus',()=>{if(!document.hidden)sceneAudio.visibility(true);});
    window.addEventListener('pagehide',()=>sceneAudio.visibility(false));
    window.addEventListener('pageshow',()=>sceneAudio.visibility(!document.hidden));
  }
`;
module.exports={canonicalTitlePilot};
