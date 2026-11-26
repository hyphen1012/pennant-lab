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
    const head='<div class="title-screen save-terminal multiverse-terminal"><header class="save-terminal-head"><span class="title-serial">VERSION 0.9.191 · STAGING</span><button class="ghost-btn" data-action="launch-back">‹ タイトル</button></header><div class="title-slot-title">セーブデータを選択</div>';
    if(!canonicalSlots)return head+'<p role="status">'+(slotOpening?'セーブ一覧を取得しています。':'サーバーのセーブ一覧を確認できません。データは変更されていません。')+'</p><button class="btn primary full" data-action="canonical-retry" '+(slotOpening?'disabled':'')+'>再取得する</button></div>';
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
    canonicalTvClear();document.querySelector('.canonical-tv-detail')?.close();canonicalTvSuppressed=null;canonicalEpoch++;canonicalSlots=null;canonicalSnapshot=null;canonicalSlot=null;canonicalRoster=null;canonicalHqWorld=null;canonicalTarget=null;canonicalRunning=false;canonicalStop=false;canonicalPlayback='normal';canonicalPlayerId=null;canonicalLeague=null;canonicalHistory=null;canonicalAwardFilter='all';canonicalCampGroup='first';canonicalWinterPlace='taiwan';canonicalDigestCut=0;canonicalFreePage=null;canonicalFreeQuery='';canonicalRotationSlot=null;canonicalOpsNote='';
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
        body='<div class="player-profile"><div class="player-club">'+h(g.team.name)+' · '+positionMarkup(p.pos)+'</div><div class="profile-row profile-upper-row">'+playerUpperPortrait(p)+'<div><h2>'+themedPlayerName(p)+' <small>('+p.age+')</small></h2><div class="profile-meta">'+throwBat(p)+' · '+fmtSalary(p.salary)+'</div><div class="profile-meta">総合 '+rating(p)+' · 愛着 ♥'+p.affinity+'</div></div></div></div><div class="player-detail-condition">'+conditionBar(p)+'</div><section class="panel"><h3>能力・適性</h3>'+annualAbilityStrip(p)+'<p>'+positionMarkup(p.pos)+(p.subPos?' / '+positionMarkup(p.subPos):'')+'</p></section><section class="panel"><h3>今季の公式戦成績</h3>'+statDisplayGrid(p)+'</section>'+focus+canonicalHistoryMarkup(p,blocked);
      }
    }else{
      const rows=c.roster.map(p=>canonicalPlayerModel(p,g)).sort((a,b)=>rating(b)-rating(a)||a.id-b.id);
      body='<h2 class="page-title">全選手</h2><p class="page-sub">所属 '+rows.length+' / '+c.rosterLimit+'人</p>'+[false,true].map(pitch=>{const group=rows.filter(p=>isPitch(p)===pitch);return '<div class="section-label">'+(pitch?positionMarkup('P','投手'):'野手')+'（'+group.length+'人）</div>'+group.map(p=>playerCardMarkup(p,false,true)).join('');}).join('');
    }
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(g.team)+'">'+top+'<main class="main">'+(canonicalOpsNote?'<p role="status">'+h(canonicalOpsNote)+'</p>':'')+body+'</main></div>';
  }
  let canonicalFreePage=null,canonicalFreeQuery='',canonicalRotationSlot=null,canonicalOpsNote='';
  const canonicalOpsPages=['canonical-rotation','canonical-farm','canonical-free','canonical-facilities','canonical-manager'];
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
    }else if(ui.page==='canonical-manager'){
      const m=c.manager;
      body='<h2 class="page-title">監督室</h2>'+(m?'<section class="panel"><h3>'+h(m.name)+'監督</h3><p>在任 '+m.tenure+'年目 · 残契約 '+m.contractYears+'年</p><p>年俸 '+fmtMoney(m.salary)+' · 信頼 '+m.trust+' · 不満 '+m.discontent+'</p><button class="btn primary full" data-action="canonical-manager-renew" '+(blocked||!m.renewAvailable?'disabled':'')+'>契約更改を申し出る · '+fmtMoney(m.renewFee)+'</button></section><section class="panel"><h3>GM戦術方針</h3>'+m.orders.map(o=>'<div class="divider"></div><h4>'+h(o.label)+'</h4><div class="chips">'+[['auto','監督に任せる'],['attack',o.attack],['safe',o.safe]].map(([v,label])=>'<button class="chip '+(v===o.value?'active':'')+'" data-action="canonical-manager-order" data-key="'+h(o.key)+'" data-value="'+v+'" '+(blocked||v===o.value?'disabled':'')+'>'+h(label)+'</button>').join('')+'</div>').join('')+'</section>':'<p class="empty">監督情報なし</p>')+'<section class="panel"><h3>監督候補</h3>'+c.managerCandidates.map(x=>'<div class="player-card"><strong>'+h(x.name)+'</strong><p>年俸 '+fmtMoney(x.salary)+' · '+x.contractYears+'年契約 · 雇用費 '+fmtMoney(x.fee)+'</p><button class="btn outline full" data-action="canonical-manager-hire" data-slot="'+x.slot+'" '+(blocked||x.current||g.team.cash<x.fee?'disabled':'')+'>監督として雇用</button></div>').join('')+'</section>';
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
      canonicalSnapshot=r.snapshot;canonicalRotationSlot=null;canonicalFreePage=null;canonicalHistory=null;
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
    if(!c.canManage||canonicalSnapshot.pending?.length)return;
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
  function canonicalHqRender(){
    const app=$('#app'),g=canonicalSnapshot?.game,t=g?.team,v=g?.headquarters;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-return">‹ データ選択</button></div>';
    if(!t||!v){app.innerHTML='<div class="setup-screen">'+top+'<p role="status">確定した日程を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-hq-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    const canStep=canonicalCanRun(g)&&!slotOpening&&!canonicalRunning;
    const stop=slotOpening?'日程の確定を確認しています。':canonicalSnapshot.pending?.length?'報酬の確定確認が必要です。':!v.canCalendar?'確認が必要なイベントまたは日程の区切りです。未接続のイベント処理へは自動進行しません。':'';
    const last=v.last,score=last?'<div class="box-result"><span class="tag '+(last.ours>last.theirs?'green':last.ours<last.theirs?'red':'')+'">'+(last.ours>last.theirs?'勝利':last.ours<last.theirs?'敗戦':'引分')+'</span> <span class="small">'+last.year+'年 第'+last.day+'戦 / vs '+h(last.opponent)+'</span><div class="score-big">'+last.ours+' - '+last.theirs+'</div></div>':'<div class="empty">シーズンはまだ始まっていません。</div>';
    const disabled=canStep?'':'disabled',modeButtons=[['normal','通常'],['fast','倍速'],['skip','日程スキップ']].map(([k,label])=>'<button class="chip '+(canonicalPlayback===k?'active':'')+'" data-action="canonical-hq-mode" data-mode="'+k+'" aria-pressed="'+(canonicalPlayback===k)+'" '+(canonicalRunning?'disabled':'')+'>'+label+'</button>').join('');
    const targetValid=canonicalTarget&&canonicalTarget.world===canonicalSnapshot.world&&canonicalTarget.year===g.year&&g.calendarIndex<canonicalTarget.goal;
    const controls='<section class="panel"><div class="panel-head"><h3 class="panel-title">日程を進める</h3><span class="pill">'+h(v.dateText)+'</span></div><div class="calendar-playback"><div class="calendar-speed">'+modeButtons+'</div></div><div class="calendar-target-grid"><button class="btn primary" data-action="canonical-hq-run" data-kind="date" '+disabled+'>▶ 1日進める</button><button class="btn soft" data-action="canonical-hq-run" data-kind="weekly" '+disabled+'>週次報告まで</button><button class="btn soft" data-action="canonical-hq-run" data-kind="month" '+disabled+'>月次報告まで</button></div><button class="btn outline full" data-action="canonical-hq-run" data-kind="season" '+disabled+'>シーズン終了まで進行</button>'+(canonicalRunning?'<button class="btn outline full" data-action="canonical-hq-pause" '+(canonicalStop?'disabled':'')+'>'+(canonicalStop?'停止確認中':'一時停止')+'</button><p role="status">確定済み日程 '+g.calendarIndex+' / '+(canonicalTarget?.goal||g.calendarIndex)+'</p>':targetValid?'<button class="btn primary full" data-action="canonical-hq-run" data-kind="resume" '+disabled+'>▶ 続きから</button>':'')+'<p class="tiny">通常報告は記録に保存し、重要なイベントでは停止します。</p></section>';
    const reports='<section class="panel"><h3 class="panel-title">保存済み報告</h3>'+(v.latestMonth?'<p>'+h(v.latestMonth.month)+'：'+v.latestMonth.wins+'勝 '+v.latestMonth.losses+'敗 '+v.latestMonth.ties+'分</p>':'<p class="small">月次報告はまだありません。</p>')+v.latestMilestones.map(m=>'<div class="event">'+h(m.date)+' '+h(m.title)+'</div>').join('')+'</section>';
    const hero=frontOfficeHero(t,{year:g.year,gmName:g.gmName,day:g.day,fans:v.fans,salary:v.salary,rank:v.rank,opponent:v.opponent,dateText:v.dateText});
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(t)+'">'+top+'<main class="main">'+hero+'<section class="panel desk-panel"><div class="desk-heading"><div><div class="eyebrow">GM DESK · FRONT OFFICE</div><h3>業務一覧</h3></div><button class="btn primary" data-action="canonical-hq-step" '+(canStep?'':'disabled')+'>▶ 1日進める</button></div>'+(g.club?'<button class="btn outline full" data-action="canonical-roster-open" '+(slotOpening?'disabled':'')+'>スタメン編成</button>':'')+(g.club?'<button class="btn outline full" data-action="canonical-players">全選手・選手詳細</button>':'')+(g.club?'<button class="btn outline full" data-action="canonical-ops-open" data-kind="rotation">先発ローテーション</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="farm">一軍・二軍管理</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="free">自由契約選手の獲得</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="facilities">球団施設・球場経営</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="manager">監督室</button>':'')+'<button class="btn outline full" data-action="canonical-standings">東西リーグ順位表</button><button class="btn outline full" data-action="canonical-events-open">イベント・年間業務</button></section>'+controls+'<section class="panel"><div class="panel-head"><h3 class="panel-title">直近の試合結果</h3></div>'+score+'</section>'+reports+(stop?'<p role="status">'+h(stop)+'</p>':'')+'<p class="small">試験環境 · 本部、日程進行、編成を接続済み。試合中継・新聞・全イベント画面は未接続です。</p></main></div>';
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
      }
      if(canonicalSnapshot&&(canonicalSnapshot.game.calendarIndex>=target.goal||canonicalSnapshot.game.year!==target.year))canonicalTarget=null;
    }catch{if(epoch===canonicalEpoch)canonicalSnapshot=null;}
    finally{if(epoch===canonicalEpoch){canonicalRunning=false;canonicalStop=false;slotOpening=false;render();}}
  }
  let canonicalHqWorld=null;
  const canonicalCommerceJobs=['fan-fest','fanclub','tv','sponsor','broadcast','naming','opening-promo'];
  const canonicalAnnualJobs=['awards-all','settlement','movement-declarations','draft','roster-cut','renewal1','renewal2','autumn','winter','booking','self','winter-return','camp','exhibition',...canonicalCommerceJobs,'offdesk-opening'];
  let canonicalAwardFilter='all',canonicalCampGroup='first',canonicalWinterPlace='taiwan',canonicalDigestCut=0;
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
        if(n.recoveryPending||n.recoveryCelebration){out+='<p>交渉結果：'+h(n.status)+'</p>'+(n.feedback?'<p>'+h(n.feedback)+'</p>':'')+'<p class="small">広告による交渉復活は報酬画面接続待ちです。</p>'+cmd('dismiss','結果を確認','data-id="'+n.id+'"');}
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
        const scene=k=>k==='rest'?'<img class="report-scene" src="./assets/scenes/camp-rest.svg" alt="宿舎で休養する選手">':k==='meeting'?'<img class="report-scene" src="./assets/scenes/preseason-meeting.svg" alt="チームミーティング">':salesScene(k);
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
      else if(id==='fanclub'){out+='<div class="fan-preview-sticky">'+canonicalFanCard(s,g.team)+'</div><label>クラブ名<input id="canonical-fan-name" maxlength="30" value="'+h(s.name)+'"></label>'+cmd('name','クラブ名を保存')+'<h3>カードデザイン</h3>'+choices('font',[[0,'ゴシック'],[1,'明朝'],[2,'丸ゴシック'],[3,'等幅']],s.font)+choices('color',FAN_COLORS.map((_,i)=>[i,['紺','赤','緑','黒','紫','金'][i]]),s.color)+'<h3>年会費 ¥'+s.fee.toLocaleString()+'</h3>'+choices('fee',[[-500,'−500円'],[500,'＋500円']],null)+'<h3>入会特典</h3><div class="fan-perk-grid">'+s.perks.map(p=>'<button class="fan-perk '+(s.perk===p.key?'chosen':'')+'" data-action="canonical-event-command" data-kind="commerce-perk" data-value="'+h(p.key)+'" '+(held?'disabled':'')+'>'+fanPerkArt(p.key)+'<b>'+h(p.label)+'</b><small>原価 '+p.cost.toLocaleString()+'円 / 人</small></button>').join('')+'</div><p>予想入会 '+s.estimate.members.toLocaleString()+'名 · 年間利益見込み '+fmtMoney(s.estimate.income-s.estimate.cost)+'</p>';}
      else if(id==='broadcast')out+=salesScene('contract')+'<p>放送局の提示 年額 '+fmtMoney(s.base)+'</p><p>希望額 '+fmtMoney(s.base+s.delta)+' · 成立見込み '+s.chance+'%</p>'+choices('delta',[[0,'提示額'],[1,'＋1億円'],[2,'＋2億円'],[3,'＋3億円']],s.delta)+'<p class="small">交渉不成立時は減額条件で契約。</p>';
      else if(id==='naming')out+=salesScene('stadium')+(s.contract?'<p>契約継続中 '+h(s.contract.name)+' · '+s.contract.end+'年まで</p>':choices('choice',[[-1,'契約しない'],...s.options.map((n,i)=>[i,n.name+' · '+n.years+'年 · 年額 '+fmtMoney(n.annual)])],s.choice));
      else if(id==='tv'){out+=salesScene('tv')+'<p>出演メンバー '+s.players.length+' / 5名 · タップで選択、長押しで選手詳細</p><div class="commerce-players">'+s.eligible.map(r=>{const p=g.club?.roster.find(p=>p.id===r.id),model=p?canonicalPlayerModel(p,g):null;return '<button class="btn '+(s.players.includes(r.id)?'primary':'outline')+'" data-action="canonical-event-command" data-kind="commerce-player" data-value="'+r.id+'" data-canonical-tv="'+r.id+'" '+(held?'disabled':'')+'>'+(model?tvFace(model):'')+'<small>'+(model?themedPlayerName(model):h(r.name))+'</small></button>';}).join('')+'</div>';}
      else if(['fan-fest','opening-promo'].includes(id)){out+=s.plans.map(p=>'<article class="fest-plan '+(p.index===s.plan?'chosen':'')+'">'+(id==='fan-fest'?fanFestPhoto(p.photo):salesScene('stadium'))+'<h3>'+h(p.title)+'</h3><p>'+h(p.desc||'')+'</p>'+cmd('plan',h(p.name)+' · '+fmtMoney(p.cost),'data-value="'+p.index+'"')+'</article>').join('')+'<p class="small">'+(id==='fan-fest'?'開催は企画確定の7日後。費用は開催時に精算します。':'開幕戦当日に開催します。')+'</p>';}
      return out+cmd('confirm','この内容で確定する','',held||id==='tv'&&s.players.length!==5||['fan-fest','opening-promo'].includes(id)&&s.plans[s.plan]?.cost>g.team.cash)+(['fan-fest','tv','opening-promo'].includes(id)?cmd('decline','今回は見送る'):'')+cmd('back','本部へ戻る')+'</section>';
    }
    const guests=()=>'<div class="commerce-players">'+(s.players||[]).map(id=>{const p=g.club?.roster.find(p=>p.id===id);if(!p)return '';const model=canonicalPlayerModel(p,g),v=tvSpecial(model);return '<article class="tv-guest" style="--tv-ring:'+v.ring+';--tv-accent:'+v.accent+'">'+faceMini(model,{overall:true})+themedPlayerName(model)+(v.cat?'<p>'+h(v.line)+'</p>'+rareCinemaArt(model,'join',true):'')+'</article>';}).join('')+'</div>';
    const scene=id==='fan-fest'?fanFestPhoto(s.plans?.[s.plan]?.photo??3):salesScene(id==='tv'?'tv':'stadium');
    if(s.stage==='scheduled')return head+scene+'<p>開催・出演予定日 '+h(s.due)+'</p>'+(id==='tv'?guests():'')+cmd('park','計画を確認して本部へ')+'</section>';
    if(s.stage==='live')return head+scene+(id==='tv'?guests():'')+cmd(id==='tv'?'tv':id==='fan-fest'?'live':'opening','開催・出演結果を確認する')+'</section>';
    if(s.stage==='result'){
      let out=head;
      if(id==='fanclub'&&s.contract){const q=s.contract;out='<section class="panel"><h2>'+(q.first?'ファンクラブ設立！！':'ファンクラブが更新されました！！')+'</h2>'+salesCelebration('celebration')+canonicalFanCard(q,g.team)+salesMetrics([['新規入会',q.newMembers+'名'],['継続会員',q.retained+'名'],['合計会員',q.members+'名'],['年会費','¥'+q.fee.toLocaleString()],['会費収入',fmtMoney(q.income)],['特典原価',fmtMoney(q.cost)]])+fanPerkArt(q.perk);}
      else if(id==='sponsor'&&s.contract){out+=salesScene('contract')+'<h3>'+s.contract.companies.length+'社との契約確定</h3>'+s.contract.companies.map(c=>offdeskMoneyRow(c.name,c.annual)).join('');}
      else if(id==='broadcast'&&s.contract)out+=salesScene('contract')+'<p>'+h(s.result)+'</p>'+salesMetrics([['先方提示',fmtMoney(s.contract.base)],['希望額',fmtMoney(s.contract.asked)],['成立額',fmtMoney(s.contract.annual)]]);
      else if(id==='naming')out+=salesScene('stadium')+'<p>'+h(s.result||'契約なし')+'</p>'+(s.contract?'<p>'+s.contract.start+'〜'+s.contract.end+'年 · 年額 '+fmtMoney(s.contract.annual)+'</p>':'');
      else {const r=s.report;out+=(r?.declined?'':id==='fan-fest'?fanFestPhoto(3):scene)+(id==='tv'&&!r?.declined?guests():'')+'<h3>'+h(s.result||'業務完了')+'</h3>'+(r?salesMetrics([['ファン増加','＋'+(r.gain||0)+'人'],['収入',fmtMoney(r.income||0)],['支出',fmtMoney(r.cost||0)],...(Number.isFinite(r.attendance)?[['来場者数',r.attendance+'人'],['満足度',r.satisfaction+'/100']]:[])]):'');}
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
  function canonicalEventRender(){
    const app=$('#app'),g=canonicalSnapshot?.game;if(!app)return;
    const top='<div class="setup-head">'+appLogo()+'<button class="ghost-btn" data-action="canonical-events-back">‹ 本部</button></div>';
    if(!g||!accountCurrent()){app.innerHTML='<div class="setup-screen">'+top+'<p role="status">確定状態を取得してください。自動再送は行いません。</p><button class="btn primary full" data-action="canonical-events-refresh" '+(slotOpening?'disabled':'')+'>最新状態を取得</button></div>';return;}
    const a=g.annual||{},inbox=g.inbox||{},blocked=slotOpening||!!canonicalSnapshot.pending?.length,dis=blocked?'disabled':'';
    const important=!!(inbox.finance||inbox.rare||inbox.injury||inbox.career||inbox.rookie||inbox.decade!==null&&inbox.decade!==undefined||g.foreign?.negotiation?.status==='accepted');
    const commandButton=(key,label,extra='',disabled=blocked)=>'<button class="btn primary full" data-action="canonical-event-command" data-kind="'+key+'" '+extra+' '+(disabled?'disabled':'')+'>'+label+'</button>';
    let body='<h2 class="page-title">イベント・年間業務</h2><p class="page-sub">'+h(a.date||g.headquarters.dateText)+'</p>';
    if(inbox.review){const r=inbox.review;body+='<section class="panel"><h3>試合結果の確認</h3><p>'+h(r.date)+'</p><div class="score-big">'+r.homeScore+' - '+r.awayScore+'</div><p class="small">ホーム球団 '+h((g.club?.standings||[]).find(t=>t.id===r.home)?.name||String(r.home))+' / ビジター '+h((g.club?.standings||[]).find(t=>t.id===r.away)?.name||String(r.away))+'</p>'+commandButton('review','保存済みの試合結果を確認', '',blocked||important)+'</section>';}
    if(inbox.monthly){const m=inbox.monthly;body+='<section class="panel"><h3>月次報告</h3>'+normalDetailCard('finance','月例会議')+'<p>'+h(m.month)+' · '+m.wins+'勝 '+m.losses+'敗 '+m.ties+'分</p>'+(m.finance?'<p>収入 '+fmtMoney(m.finance.revenue)+' / 報告差額 '+fmtMoney(m.finance.net)+'</p>':'<p class="small">会計内訳の記録なし</p>')+'<p>報告時の保有資金 '+fmtMoney(m.cash)+'</p>'+(m.matches||[]).map(x=>'<div class="event">'+h(x.date)+' · '+h(x.opponent)+' '+x.rs+' - '+x.ra+'</div>').join('')+commandButton('month','保存済み月次報告を確認','',blocked||important||!!inbox.review)+'</section>';}
    if(inbox.milestoneCount){body+='<section class="panel"><h3>記録・ニュース</h3>'+inbox.milestones.map(e=>'<p class="event">'+h(e.date)+' '+h(e.title)+'</p>').join('')+(inbox.milestoneCount>inbox.milestones.length?'<p class="small">ほか '+(inbox.milestoneCount-inbox.milestones.length)+'件は記録に保存されています。</p>':'')+commandButton('milestones','保存済み報告を確認','',blocked||important||!!inbox.review)+'</section>';}
    if(important)body+='<section class="panel warning"><h3>重要イベントの対応が必要です</h3><p>特殊選手・去就・負傷・入団報告・資金不足など、専用の演出と判断が必要な処理は未接続のまま保持します。</p></section>';
    const held=blocked||important||!!inbox.review||!!inbox.monthly||!!inbox.milestoneCount;
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
    if(act==='canonical-awards-filter'&&['all','own'].includes(b.dataset.value)){canonicalAwardFilter=b.dataset.value;render();return;}
    if(act==='canonical-winter-place'&&a.active==='winter'&&a.training?.destinations?.some(d=>d.key===b.dataset.value)){canonicalWinterPlace=b.dataset.value;render();return;}
    if(act==='canonical-camp-group'&&['booking','camp'].includes(a.active)&&['first','farm'].includes(b.dataset.value)){canonicalCampGroup=b.dataset.value;render();return;}
    if(act==='canonical-camp-site'&&['booking','camp'].includes(a.active)&&!canonicalSnapshot.pending?.length&&!a.preseason?.paid){const v=b.dataset.value;if(a.preseason?.options.some(x=>x.key===v))void canonicalEventRequest({annual:'preseason',decision:'site',group:canonicalCampGroup,value:v});return;}
    if(act==='canonical-digest-next'&&a.active==='exhibition'&&a.preseason?.report&&!a.preseason.digestSeen){canonicalDigestCut=Math.min(REPORT_DIGEST_CUTS.length-1,canonicalDigestCut+1);render();return;}
    if(act!=='canonical-event-command'||canonicalSnapshot.pending?.length)return;
    const k=b.dataset.kind,job=b.dataset.job;
    let cmd=null;
    if(k==='opening-ack'&&i.opening)cmd={acknowledge:'opening'};
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
    if(slotOpening){e.preventDefault();e.stopImmediatePropagation();if(ui.page==='canonical-hq'&&act==='canonical-hq-pause'&&canonicalRunning){canonicalStop=true;render();}return;}
    if(ui.page==='title'&&ui.launchTitle&&['launch-start','launch-back'].includes(act)||ui.page==='title'&&!ui.launchTitle&&act==='launch-back'||ui.page==='setup'&&['setup-league','pick-setup-team','team-color','club-design'].includes(act))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(ui.page==='title'&&!ui.launchTitle&&['new-slot','continue-slot'].includes(act))void openCanonicalSlot(b,act==='new-slot');
    else if(ui.page==='title'&&act==='canonical-retry'||act==='canonical-return'||ui.page==='setup'&&act==='title')void canonicalReturn();
    else if(ui.page==='canonical-ready'&&act==='canonical-hq-open')canonicalHqOpen();
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-step')void canonicalRun('date');
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-run')void canonicalRun(b.dataset.kind);
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-mode'&&['normal','fast','skip'].includes(b.dataset.mode)){canonicalPlayback=b.dataset.mode;render();}
    else if(ui.page==='canonical-hq'&&act==='canonical-hq-refresh')void canonicalHqRequest(false);
    else if(ui.page==='canonical-hq'&&act==='canonical-events-open'&&canonicalSnapshot?.game&&accountCurrent()){canonicalAwardFilter='all';ui.page='canonical-events';render();draftJump(0);}
    else if(ui.page==='canonical-events')canonicalEventClick(b);
    else if(ui.page==='canonical-hq'&&act==='canonical-ops-open'&&['rotation','farm','free','facilities','manager'].includes(b.dataset.kind)&&canonicalSnapshot?.game?.club&&accountCurrent()){canonicalOpsNote='';canonicalFreePage=null;canonicalFreeQuery='';canonicalRotationSlot=null;ui.page='canonical-'+b.dataset.kind;render();draftJump(0);if(b.dataset.kind==='free')void canonicalLoadFree(0,'');}
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
`;
module.exports={canonicalTitlePilot};
