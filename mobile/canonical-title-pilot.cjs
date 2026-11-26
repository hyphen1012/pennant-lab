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
    canonicalEpoch++;canonicalSlots=null;canonicalSnapshot=null;canonicalSlot=null;canonicalRoster=null;canonicalHqWorld=null;canonicalTarget=null;canonicalRunning=false;canonicalStop=false;canonicalPlayback='normal';canonicalPlayerId=null;canonicalLeague=null;canonicalHistory=null;canonicalFreePage=null;canonicalFreeQuery='';canonicalRotationSlot=null;canonicalOpsNote='';
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
    app.innerHTML='<div class="app-shell" style="'+clubThemeStyle(t)+'">'+top+'<main class="main">'+hero+'<section class="panel desk-panel"><div class="desk-heading"><div><div class="eyebrow">GM DESK · FRONT OFFICE</div><h3>業務一覧</h3></div><button class="btn primary" data-action="canonical-hq-step" '+(canStep?'':'disabled')+'>▶ 1日進める</button></div>'+(g.club?'<button class="btn outline full" data-action="canonical-roster-open" '+(slotOpening?'disabled':'')+'>スタメン編成</button>':'')+(g.club?'<button class="btn outline full" data-action="canonical-players">全選手・選手詳細</button>':'')+(g.club?'<button class="btn outline full" data-action="canonical-ops-open" data-kind="rotation">先発ローテーション</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="farm">一軍・二軍管理</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="free">自由契約選手の獲得</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="facilities">球団施設・球場経営</button><button class="btn outline full" data-action="canonical-ops-open" data-kind="manager">監督室</button>':'')+'<button class="btn outline full" data-action="canonical-standings">東西リーグ順位表</button></section>'+controls+'<section class="panel"><div class="panel-head"><h3 class="panel-title">直近の試合結果</h3></div>'+score+'</section>'+reports+(stop?'<p role="status">'+h(stop)+'</p>':'')+'<p class="small">試験環境 · 本部、日程進行、編成を接続済み。試合中継・新聞・全イベント画面は未接続です。</p></main></div>';
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
  function canonicalHqOpen(){if(!canonicalSnapshot?.game?.headquarters||slotOpening||!accountCurrent())return;canonicalHqWorld=canonicalSnapshot.world;ui.page='canonical-hq';render();window.scrollTo(0,0);}
  const canonicalOriginalRender=render;
  render=function(){
    if(['canonical-players','canonical-player','canonical-standings'].includes(ui.page)){canonicalReadOnlyRender();return;}
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
