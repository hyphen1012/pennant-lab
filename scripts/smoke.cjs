const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script);
const listeners=[];
const store=new Map(), local=new Map(), overlays=[];
const dateRenders=[],watchRenders=[],introRenders=[],gameSetRenders=[],resultRenders=[],medicalRenders=[],monthlyRenders=[];
const app={
  _html:'',
  get innerHTML(){return this._html;},
  set innerHTML(markup){
    this._html=markup;
    if(markup.includes('class="calendar-date-intro'))dateRenders.push(markup);
    if(markup.includes('watch-game-screen'))watchRenders.push(markup);
    if(markup.includes('game-cinematic-intro'))introRenders.push(markup);
    if(markup.includes('game-cinematic-outro'))gameSetRenders.push(markup);
    if(markup.includes('game-result-hero'))resultRenders.push(markup);
    if(markup.includes('gm-briefing-screen'))medicalRenders.push(markup);
    if(markup.includes('gm-month-report'))monthlyRenders.push(markup);
  }
};
const db={
  objectStoreNames:{contains:()=>true},
  transaction:(name,mode)=>{
    const tx={oncomplete:null,onerror:null,onabort:null,
      objectStore:()=>({
        get:slot=>{
          const req={result:store.get(Number(slot))||null,onsuccess:null,onerror:null};
          queueMicrotask(()=>req.onsuccess?.());
          return req;
        },
        put:row=>{
          store.set(row.slot,row);
          queueMicrotask(()=>tx.oncomplete?.());
          return {};
        }
      })
    };
    return tx;
  }
};
const indexedDB={open:()=>{
  const req={result:db,onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};
  queueMicrotask(()=>req.onsuccess?.());return req;
}};
const domElement=()=>({innerHTML:'',textContent:'',className:'',style:{},remove(){},
  appendChild(){},click(){},setAttribute(){},removeAttribute(){}});
// The engine VM cannot decode MP4; emit a synthetic ended event rather than
// disabling the shipping startup or conflating this with actual playback QA.
const mockVideo=()=>{const events=new Map();return {...domElement(),currentTime:7,
  addEventListener:(k,fn)=>events.set(k,fn),pause(){},load(){},
  async play(){queueMicrotask(()=>events.get('ended')?.());}
};};
const document={
  hidden:false,
  body:{appendChild() {},insertAdjacentHTML(where,markup){overlays.push(markup)}},
  querySelector:sel=>sel==='#app'?app:null,
  querySelectorAll:()=>[],
  createElement:tag=>tag==='video'?mockVideo():domElement(),
  removeEventListener:(type,callback)=>{const i=listeners.findIndex(x=>x.type===type&&x.callback===callback);if(i>=0)listeners.splice(i,1);},
  addEventListener:(type,callback,capture)=>listeners.push({type,callback,capture:!!capture})
};
const window={
  indexedDB,addEventListener:(type,callback,capture)=>listeners.push({type,callback,capture:!!capture}),scrollTo(){},location:{href:'https://localhost/'}
};
const localStorage={
  getItem:key=>local.has(key)?local.get(key):null,
  setItem:(key,value)=>local.set(key,String(value)),
  removeItem:key=>local.delete(key)
};
const fakeTimeout=(fn,ms,...args)=>ms>=3000&&ms!==4400?0:setTimeout(fn,ms>=300?0:ms,...args);
const context={window,document,localStorage,console,setTimeout:fakeTimeout,
  clearTimeout,Date,Math,JSON,Number,String,Array,Object,Set,Map,
  Promise,Blob:global.Blob,URL:global.URL};
// Fixtures are injected only into this test's VM, never shipped in the game.
vm.runInNewContext(script.replace('window.PennantLab={',"window.TestFixture={\n  regular:()=>{game.ceremonyStage=null;game.pendingCeremonyIntro=null;game.calendarFlow=null;game.offseasonDesk=null;ui.tab=\"hq\";save();render();},\n  clock:()=>JSON.parse(JSON.stringify(flowGet())),\n  tick:()=>{const f=flowGet();if(!f)throw Error(\"missing calendar\");return flowNextEvent(f);},\n  annual:()=>{const year=game.year,check=(v,m)=>{if(!v)throw Error(m);};\n    const d=ensureDraft(),mv=movementInit();game.ceremonyStage=\"movement-declarations\";\n    for(const r of mv.requests.filter(r=>r.from===game.selectedId&&r.status===\"request\"))movementAction(\"movement-allow\",{dataset:{id:String(r.id)}});\n    game.ceremonyStage=null;\n    for(const date of [\"11-30\",\"12-14\",\"12-17\",\"12-21\",\"12-31\"]){const f={mode:\"off\",year,date:year+\"-\"+date};cpuCommercialCalendar(f);commerceOffPay(f.date);sponsorOffPay(f.date);}\n    for(let i=0;i<300&&d.phase!==\"negotiate\"&&d.phase!==\"done\";i++){\n      if(d.phase===\"lottery\"){if(d.pendingLottery.stage===\"choose\")check(draftDraw(d,null,\"delegate\"),\"draw\");else if(d.pendingLottery.stage===\"sealed\")check(draftOpenTicket(d),\"ticket\");else check(draftNextDraw(d),\"next draw\");}else draftAuto(d);\n      d.announcement=null;\n    }\n    if(d.phase===\"negotiate\"){draftAuto(d);check(draftFinalize(d),\"draft finish\");}\n    check(d.phase===\"done\",\"draft done\");\n    for(const t of game.teams){for(let i=0;i<50&&draftRosterProjection(d,t).excess;i++){const p=draftCutOptions(d,t).find(p=>!draftCutIds(d,t).includes(p.id));check(p&&draftToggleCut(d,t,p.id),\"cut\");}check(!draftRosterProjection(d,t).excess,\"roster projection\");}\n    d.cutConfirmed=true;\n    for(const t of game.teams)check(budgetedRenewalPlan(t,mv).confirmed,\"renewals\");\n    check(annualRunPhase(\"autumn\"),\"autumn training\");check(winterDispatch(),\"winter dispatch\");\n    movementCPU(mv);mv.closed=true;\n    game.calendarFlow=null;game.ceremonyStage=null;game.pendingCeremonyIntro=null;nextSeason();\n    check(game.year===year+1,\"next year\");\n    game.ceremonyStage=null;game.calendarFlow=null;game.offseasonDesk=null;game.pendingCeremonyIntro=null;\n    ui.tab=\"hq\";save();render();\n  }\n};window.PennantLab={"),context,{filename:'pennant-lab.js'});

function dispatch(type,data={}){
  const el={
    dataset:data,
    value:data.value,
    classList:{contains:()=>false},
    closest:selector=>selector==='[data-action]'&&data.action?el:null
  };
  const event={target:el,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){this.stopped=true;},stopped:false};
  const acts=listeners.filter(l=>l.type===type);
  for(const l of [...acts.filter(x=>x.capture),...acts.filter(x=>!x.capture)]){
    if(event.stopped)break;
    l.callback(event);
  }
}
function finishMeeting(){
  if(app.innerHTML.includes('aria-label="1/5ページ"')){
    assert(!app.innerHTML.includes('data-turn="forward"'),'Initial cover is stationary');
    dispatch('click',{action:'meeting-page',step:'1'});
    assert(app.innerHTML.includes('data-turn="forward"'));
    assert(app.innerHTML.includes('meeting-paper meeting-current'));
    assert(app.innerHTML.includes('meeting-paper meeting-fixed'));
    assert(app.innerHTML.includes('class="meeting-flap"'));
    assert.equal((app.innerHTML.match(/class="meeting-curl-strip"/g)||[]).length,10);
    assert(app.innerHTML.includes('meeting-match-row meeting-table-head'));
    assert(app.innerHTML.includes('01 月例会議資料'));
    assert(app.innerHTML.includes('02 今月の戦績'));
    dispatch('click',{action:'meeting-page',step:'-1'});
    assert(app.innerHTML.includes('data-turn="back"'));
    assert(app.innerHTML.includes('aria-label="1/5ページ"'));
  }
  for(let i=0;i<4;i++)dispatch('click',{action:'meeting-page',step:'1'});
  dispatch('click',{action:'finish-month'});
}
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0));}
(async()=>{
  await flush();
  assert(window.PennantLab,'Game API must bootstrap');
  assert(app.innerHTML.includes('data-official-title-image'),'Official title markup');
  assert(!app.innerHTML.includes('data-slot-group='),'Title must precede saves');
  dispatch('click',{action:'launch-start'});await flush();
  assert(app.innerHTML.includes('VERSION '+html.match(/<title>PENNANT LAB v(\d+\.\d+\.\d+)/)[1]+' · '),'Current release save terminal');
  const previewBefore=JSON.stringify(window.PennantLab.getSnapshot()),saveBefore=store.size;
  dispatch('click',{action:'rare-preview-open'});assert(app.innerHTML.includes('演出確認'));assert(app.innerHTML.includes('特殊選手の顔デザイン'));assert(app.innerHTML.includes('data-permanent-mask="true"'));assert(app.innerHTML.includes('data-portrait-inherited="異界転生"'));
  dispatch('click',{action:'rare-preview-start'});assert(app.innerHTML.includes('観測記録に異常を検出'));
  dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('ニューススタジオのキャスター'));
  dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('完全試合'));assert(app.innerHTML.includes('???'));assert(!app.innerHTML.includes('class="rinne-smile"'));assert(!app.innerHTML.includes('class="rinne-voice"'));
  dispatch('click',{action:'rare-news-ack'});for(let i=0;i<4;i++)dispatch('click',{action:'rare-news-next'});
  dispatch('click',{action:'rare-preview-role',value:'OF'});dispatch('click',{action:'rare-preview-start'});dispatch('click',{action:'rare-news-next'});dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('14 − 2'));
  dispatch('click',{action:'rare-preview-category',value:'輪廻転生'});dispatch('click',{action:'rare-preview-start'});assert(!app.innerHTML.includes('rinne-piece left'));assert(app.innerHTML.includes('rinne-piece whole'));
  dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('rinne-piece left'));assert(app.innerHTML.includes('rinne-piece right'));assert(app.innerHTML.includes('崩壊した架空の野球場'));
  await flush();assert(!app.innerHTML.includes('rinne-piece left'));
  assert(app.innerHTML.includes('壊滅したスタジオ'));dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('ruined-feature'));assert(app.innerHTML.includes('class="rinne-smile"'));assert(app.innerHTML.includes('「また俺の時代だ...」'));assert(app.innerHTML.includes('14 − 2'));assert(app.innerHTML.includes('????'));
  for(const category of ['PARALLEL','STAR','LEGEND','IMMORTAL']){
    dispatch('click',{action:'rare-preview-category',value:category});
    dispatch('click',{action:'rare-preview-route',value:'foreign'});
    dispatch('click',{action:'rare-preview-start'});assert(app.innerHTML.includes('GLOBAL SCOUTING'));
    dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('海外担当スカウト'));assert(app.innerHTML.includes('海外球場のスタンドとグラウンド'));assert(!app.innerHTML.includes('ニューススタジオのキャスター'));
    dispatch('click',{action:'rare-news-next'});if(category==='IMMORTAL')assert(app.innerHTML.includes('???'));
    dispatch('click',{action:'rare-news-ack'});
  }
  dispatch('click',{action:'rare-preview-route',value:'draft'});
  dispatch('click',{action:'rare-preview-category',value:'転生'});
  dispatch('click',{action:'rare-preview-start'});
  dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('大学全国大会'));
  dispatch('click',{action:'rare-news-next'});assert(app.innerHTML.includes('FLASHBACK'));assert(app.innerHTML.includes('見本球団'));assert(app.innerHTML.includes('39歳'));
  dispatch('click',{action:'rare-preview-exit'});assert.equal(JSON.stringify(window.PennantLab.getSnapshot()),previewBefore);assert.equal(store.size,saveBefore);
  const snap=window.PennantLab.getSnapshot();
  assert.equal(snap.teams.length,12);
  assert.equal(snap.playerCount>250,true);
  dispatch('click',{action:'finish-setup'});dispatch('click',{action:'report-intro-skip'});assert(app.innerHTML.includes('EVENTS · SCHEDULE'));assert(app.innerHTML.includes('data-action="flow-day"'));
  const pre=window.TestFixture.clock();assert.equal(pre.mode,'pre');assert.equal(pre.date,pre.year+'-01-01');
  assert(window.TestFixture.tick());assert.equal(window.TestFixture.clock().jobs.self.status,'ready');
  assert.equal(window.PennantLab.getSnapshot().games,0);assert(app.innerHTML.includes('data-job="self"'));
  // The regular-season UI test is an independent fixture; training is exercised by annual_training.cjs.
  window.TestFixture.regular();await flush();
  dispatch('click',{action:'tab',tab:'business'});
  dispatch('click',{action:'business-sub',sub:'club'});
  assert(app.innerHTML.includes('アイコン文字'));
  assert(app.innerHTML.includes('LIVE PREVIEW'));
  assert(app.innerHTML.includes('id="club-identity-preview"'));
  dispatch('change',{change:'club-field',field:'letter',value:'PL'});
  dispatch('click',{action:'team-color',color:'#dc2626'});
  dispatch('click',{action:'club-design',field:'shape',value:'shield'});
  dispatch('click',{action:'club-design',field:'pattern',value:'stripe'});
  assert(app.innerHTML.includes('data-shape="shield" data-pattern="stripe"'));
  assert(app.innerHTML.includes('LIVE PREVIEW'));
  dispatch('click',{action:'club-settings-save'});
  await flush();
  const club=store.get(1).data.teams.find(t=>t.id===store.get(1).data.selectedId);
  assert.equal(club.color,'#dc2626');assert.equal(club.letter,'PL');assert.equal(club.emblem.shape,'shield');assert.equal(club.emblem.pattern,'stripe');
  assert(app.innerHTML.includes('--own-club-color:'));
  dispatch('click',{action:'business-sub',sub:'club'});
  dispatch('change',{change:'club-field',field:'letter',value:'NO'});
  dispatch('click',{action:'club-settings-cancel'});
  await flush();
  assert.equal(store.get(1).data.teams.find(t=>t.id===store.get(1).data.selectedId).letter,'PL');

  dispatch('click',{action:'tab',tab:'team'});
  assert.match(app.innerHTML,/チームメンバー/);
  assert.match(app.innerHTML,/class="avatar player-portrait/);
  assert.match(app.innerHTML,/class="face-artwork"/);
  assert(!/<span class="avatar[^>]*>[\s\S]*?<span class="face-mini/.test(
    app.innerHTML.split('class="player-card"')[1]?.split('</button>')[0]||''),
    'Player icon must not contain a second face-mini ring');
  const avatarCount=(app.innerHTML.match(/class="avatar player-portrait/g)||[]).length;
  assert(avatarCount>=20,'The team roster should render portraits for every club player');
  const playerButton=app.innerHTML.match(/data-action="player-detail" data-id="(\d+)"/);
  assert(playerButton,'Player detail button exists');
  dispatch('click',{action:'player-detail',id:playerButton[1]});
  assert.match(app.innerHTML,/class="profile-row profile-upper-row"/);
  assert.match(app.innerHTML,/player-upper-art/);
  assert.match(app.innerHTML,/data-action="detail-tab"/);
  dispatch('click',{action:'detail-tab',sub:'stats'});
  assert(app.innerHTML.includes('通算成績'));
  assert(app.innerHTML.includes('年度別成績'));
  assert(app.innerHTML.includes('タイトル獲得歴'));
  assert(app.innerHTML.includes('記録達成履歴'));

  // New field-first lineup, candidate list and two-tap batting-order editor.
  dispatch('click',{action:'tab',tab:'roster'});
  assert.match(app.innerHTML,/スターティングメンバー/);
  assert.match(app.innerHTML,/監督におまかせ/);
  assert.equal((app.innerHTML.match(/class="order-node"/g)||[]).length,9);
  dispatch('click',{action:'order190-role',role:'DH'});
  assert.match(app.innerHTML,/class="order-candidate"/);
  assert.match(app.innerHTML,/class="face-mini [^"]*has-overall"/);
  assert.match(app.innerHTML,/class="portrait-overall"/);
  assert.match(app.innerHTML,/--avatar-color:#/);
  dispatch('click',{action:'order190-mode',mode:'order'});
  const rosterBefore=window.PennantLab.getSnapshot().teams.find(t=>t.id===window.PennantLab.getSnapshot().selectedId).lineup.slice();
  assert.match(app.innerHTML,/class="order-row"/);
  assert.match(app.innerHTML,/class="portrait-overall"/);
  dispatch('click',{action:'order190-order',index:'0'});
  dispatch('click',{action:'order190-order',index:'1'});
  const rosterAfter=window.PennantLab.getSnapshot().teams.find(t=>t.id===window.PennantLab.getSnapshot().selectedId).lineup;
  assert.equal(rosterAfter[0],rosterBefore[1]);assert.equal(rosterAfter[1],rosterBefore[0]);
  dispatch('click',{action:'roster-mode',mode:'rotation'});
  assert.match(app.innerHTML,/data-kind="rotation"/);
  assert.match(app.innerHTML,/class="portrait-overall"/);

  // The FA market is a readable vertical list rather than a horizontally
  // scrollable table; draft/foreign scouting may use the same card renderer.
  dispatch('click',{action:'tab',tab:'business'});
  dispatch('click',{action:'business-sub',sub:'market'});
  assert.match(app.innerHTML,/自由契約選手/);
  assert.match(app.innerHTML,/class="recruit-list"/);
  assert.match(app.innerHTML,/class="recruit-candidate"/);
  assert.match(app.innerHTML,/class="position-word" data-position-group="(?:pitch|catch|infield|outfield)"/);
  assert.match(app.innerHTML,/class="face-mini [^"]*has-overall"/);
  assert.match(app.innerHTML,/class="portrait-overall"/);
  assert.match(app.innerHTML,/data-action="sign"/);
  assert.match(app.innerHTML,/契約金/);
  assert(!app.innerHTML.includes('<table class="data-table">'),
    'Recruitment screen should not gain a wide horizontal table');
  const beforeForeign=window.PennantLab.getSnapshot().playerCount;
  dispatch('click',{action:'business-sub',sub:'foreign'});
  assert(app.innerHTML.includes('海外スカウト'));assert(app.innerHTML.includes('data-action="foreign-init"'));
  dispatch('click',{action:'foreign-init'});assert(app.innerHTML.includes('36名'));assert(app.innerHTML.includes('未調査'));assert.match(app.innerHTML,/class="position-word" data-position-group=/);assert(!app.innerHTML.includes('data-action="sign"'));
  await flush();
  const initialForeign=store.get(1).data.foreignMarket;
  assert.equal(initialForeign.candidates.length,36);assert(initialForeign.candidates.filter(c=>c.scoutDiscovered).length<36);
  const ownBefore=store.get(1).data.teams.find(t=>t.id===store.get(1).data.selectedId);
  dispatch('click',{action:'foreign-upgrade'});await flush();
  const ownAfter=store.get(1).data.teams.find(t=>t.id===store.get(1).data.selectedId);
  assert.equal(ownAfter.foreignScoutLevel,(ownBefore.foreignScoutLevel||2)+1);
  assert.equal(ownAfter.scoutLevel,ownBefore.scoutLevel);
  const foreignHtml=app.innerHTML;
  dispatch('click',{action:'business-sub',sub:'market'});dispatch('click',{action:'business-sub',sub:'foreign'});
  assert.equal(app.innerHTML,foreignHtml);assert.equal(window.PennantLab.getSnapshot().playerCount,beforeForeign);
  dispatch('click',{action:'foreign-filter',value:'pitch'});assert.match(app.innerHTML,/\d+名 · 獲得可能候補/);
  dispatch('click',{action:'foreign-filter',value:'all'});
  const foreignId=app.innerHTML.match(/data-action="foreign-detail" data-id="(\d+)"/)[1];
  dispatch('click',{action:'foreign-detail',id:foreignId});assert(app.innerHTML.includes('海外リーグ・昨季実績'));
  dispatch('click',{action:'foreign-research',id:foreignId,value:'interview'});assert(app.innerHTML.includes('面談メモ'));assert(app.innerHTML.includes('対象選手の調査報告'));assert(!app.innerHTML.includes('data-action="foreign-begin"'));dispatch('click',{action:'foreign-report-back',id:foreignId});
  dispatch('click',{action:'foreign-begin',id:foreignId});assert(app.innerHTML.includes('QUESTION 1 / 3'));assert(app.innerHTML.includes('通訳なし'));
  dispatch('click',{action:'foreign-interpreter'});assert(app.innerHTML.includes('通訳：'));
  for(let n=0;n<3;n++){const q=app.innerHTML.match(/data-action="foreign-reply" data-value="([^"]+)"/);assert(q);dispatch('click',{action:'foreign-reply',value:q[1]});}
  assert(app.innerHTML.includes('専属通訳（初年度）'));assert(app.innerHTML.includes('日本での住居手配（初年度）'));
  dispatch('click',{action:'foreign-support',value:'interpreter'});dispatch('click',{action:'foreign-support',value:'housing'});dispatch('click',{action:'foreign-offer',value:'2'});assert(app.innerHTML.includes('data-action="foreign-submit"'));dispatch('click',{action:'foreign-submit'});
  assert(app.innerHTML.includes('foreign-waiting'));assert(!app.innerHTML.includes('data-action="foreign-close"'));
  if(app.innerHTML.includes('data-action="foreign-reply-open"')){dispatch('click',{action:'foreign-reply-open'});assert(app.innerHTML.includes('data-action="foreign-close"'));dispatch('click',{action:'foreign-close'});}
  dispatch('click',{action:'tab',tab:'hq'});assert(app.innerHTML.includes('新人スカウト'));assert(app.innerHTML.includes('海外スカウト'));

  assert.match(app.innerHTML,/data-action="mgr-open"/);
  assert.match(app.innerHTML,/class="desk-task" data-action="mgr-open" data-priority="(?:optional|recommended)"/);
  assert(app.innerHTML.includes('GM DESK · FRONT OFFICE'));
  assert(app.innerHTML.includes('EVENTS · SCHEDULE'));
  assert(app.innerHTML.includes('data-priority="recommended"'));
  assert(app.innerHTML.includes('data-priority="optional"'));
  assert(!app.innerHTML.includes('data-priority="required"'),'Regular duties do not invent mandatory restrictions');
  assert(!app.innerHTML.includes('class="panel manager-home"'),'Manager must appear in GM desk, not a separate panel');
  dispatch('click',{action:'mgr-open'});
  assert(app.innerHTML.includes('data-action="mgr-enter"'));
  dispatch('click',{action:'mgr-enter'});
  assert(app.innerHTML.includes('MANAGER\'S OFFICE'));
  assert.match(app.innerHTML,/監督・GM方針/);
  assert.match(app.innerHTML,/data-action="mgr-offer"/);
  const oldCash=window.PennantLab.getSnapshot().teams.find(t=>t.id===2).cash;
  dispatch('click',{action:'mgr-offer',slot:'1'});
  assert.match(app.innerHTML,/監督の雇用契約/);
  dispatch('click',{action:'confirm'});
  const cash=window.PennantLab.getSnapshot().teams.find(t=>t.id===2).cash;
  assert(cash<oldCash,'Manager hiring spends the disclosed signing fee');
  assert.match(app.innerHTML,/manager-portrait/);
  assert.match(app.innerHTML,/manager-grade-strip/);
  assert.match(app.innerHTML,/野手起用/);
  assert.match(app.innerHTML,/投手起用/);
  assert.match(app.innerHTML,/采配的中/);
  assert.match(app.innerHTML,/育成力/);
  assert.match(app.innerHTML,/現在の采配/);
  assert.match(app.innerHTML,/積極的/);
  assert.match(app.innerHTML,/消極的/);
  assert(!app.innerHTML.includes('data-change="manager-order"'),'Native select must be replaced by in-game buttons');
  dispatch('click',{action:'mgr-order',key:'bullpen',choice:'attack'});
  assert.match(app.innerHTML,/data-action="mgr-order" data-key="bullpen" data-choice="attack"\s+aria-pressed="true"/);
  // Manager must actually use the bench according to pregame GM strategy.
  dispatch('click',{action:'mgr-order',key:'pinch',choice:'attack'});
  dispatch('click',{action:'mgr-order',key:'youth',choice:'attack'});
  assert.match(app.innerHTML,/最近の監督采配/);
  dispatch('click',{action:'tab',tab:'hq'});
  await window.PennantLab.advance('day');
  // The day action must show the simulated inning-by-inning watch before the final score.
  for(let tries=0;tries<12&&watchRenders.length===0;tries++){
    if(app.innerHTML.includes('data-action="auto-day-close"'))dispatch('click',{action:'auto-day-close'});
    if(app.innerHTML.includes('data-action="finish-month"'))finishMeeting();
    if(app.innerHTML.includes('data-action="injury-ack"'))dispatch('click',{action:'injury-ack'});
    await window.PennantLab.advance('day');
  }
  assert(dateRenders.length>0,'One-day progression shows a calendar date intro');
  assert(dateRenders.every(v=>!v.includes('data-action="pause-calendar"')&&!v.includes('data-action="auto-return-hq"')),'Date interstitial has no pause or return controls');
  assert(dateRenders.every(v=>!v.includes('result-score-row')&&!v.includes('game-cinematic-intro')),'Date intro must not show a score or game cinematic');
  assert(introRenders.length>0,'One-day game starts with a PLAY BALL introduction');
  assert(introRenders[0].includes('PLAY BALL'));
  assert(!introRenders[0].includes('result-score-row'),'Pregame must not reveal the result');
  assert(gameSetRenders.length>0,'Game-set moment precedes the detailed result');
  assert(gameSetRenders.some(x=>x.includes('GAME SET')));
  assert(resultRenders.some(x=>x.includes('result-verdict')),'The result must use a cinematic result card');
  assert(resultRenders.some(x=>x.includes('result-score-row')),'The final score is in the result card');
  assert(resultRenders.some(x=>x.includes('result-table')),'The detailed result fits the no-scroll scoreboard');
  assert(resultRenders.some(x=>x.includes('BENCH REPORT · 監督の采配記録')),
    'Daily result must retain the manager bench report');
  assert(watchRenders.length>1,'One-day action should replay half innings before the final score');
  assert(watchRenders.some(x=>x.includes('試合観戦モード')));
  assert(watchRenders.some(x=>x.includes('イニング別スコア')));
  assert(watchRenders.some(x=>x.includes('data-action="watch-skip"')));
  assert(watchRenders.some(x=>x.includes('data-action="pause-calendar"')));
  assert(watchRenders.every(x=>!new RegExp('[0-9]+/[0-9]+ 半イニング').test(x)),
    'Do not disclose the total number of half-innings before the match ends');
  assert(watchRenders.every(x=>x.includes('class="watch-progress"')),
    'Keep the progress gauge visible without a match-length counter');
  assert(!app.innerHTML.includes('watch-game-screen'),'After replay, show the normal game report');
  const after=window.PennantLab.getSnapshot();
  assert(after.day>=1&&after.day<=12);
  assert(after.games>=0);
  await flush();
  assert(store.get(1)?.data,'Game save should be persisted');

  // Play a complete season in skip mode without routine monthly/injury stops.
  // Daily progression can have pending milestone/rare news even on opening day.
  for(let i=0;i<80;i++){
    const page=app.innerHTML;
    if(page.includes('data-action="rare-news-next"'))dispatch('click',{action:'rare-news-next'});
    else if(page.includes('data-action="rare-news-ack"'))dispatch('click',{action:'rare-news-ack'});
    else if(page.includes('data-action="milestone-ack"')){dispatch('click',{action:'milestone-ack'});dispatch('click',{action:'edition-exit-confirm'});}
    else if(page.includes('data-action="injury-ack"'))dispatch('click',{action:'injury-ack'});
    else if(page.includes('data-action="finish-month"'))finishMeeting();
    else if(page.includes('data-action="finish-review"'))dispatch('click',{action:'finish-review'});
    else if(page.includes('data-action="auto-day-close"'))dispatch('click',{action:'auto-day-close'});
    else break;
    await flush();
  }
  const dateCountBeforeSkip=dateRenders.length;
  dispatch('click',{action:'playback-mode',mode:'skip'});
  await window.PennantLab.advance('season');
  // Current mandatory inbox and negotiated responses; normal reports must never stop the season.
  async function serviceInterruptions(){
    const page=app.innerHTML;
    const inbox=page.match(/data-action="flow-inbox" data-key="([^"]+)"/);
    if(inbox)dispatch('click',{action:'flow-inbox',key:inbox[1]});
    else if(page.includes('data-action="flow-foreign"'))dispatch('click',{action:'flow-foreign'});
    else if(page.includes('data-action="foreign-counter-decline"'))dispatch('click',{action:'foreign-counter-decline'});
    else if(page.includes('data-action="foreign-reply-open"'))dispatch('click',{action:'foreign-reply-open'});
    else if(page.includes('data-action="foreign-close"'))dispatch('click',{action:'foreign-close'});
    else if(page.includes('data-action="rare-news-next"'))dispatch('click',{action:'rare-news-next'});
    else if(page.includes('data-action="rare-news-ack"'))dispatch('click',{action:'rare-news-ack'});
    else if(page.includes('data-action="career-event-accept"'))dispatch('click',{action:'career-event-accept'});
    else if(page.includes('data-action="career-event-confirm"'))dispatch('click',{action:'career-event-confirm'});
    else if(page.includes('data-action="career-event-dismiss"'))dispatch('click',{action:'career-event-dismiss'});
    else if(page.includes('data-action="injury-ack"'))dispatch('click',{action:'injury-ack'});
    else return false;
    await flush();return true;
  }
  for(let n=0;n<300&&window.PennantLab.getSnapshot().day<143;n++){
    await flush();
    if(!await serviceInterruptions()){dispatch('click',{action:'tab',tab:'hq'});await window.PennantLab.advance('season');}
  }
  // The final match can itself produce a mandatory injury or rare report.
  // Acknowledge via actual UI before checking that the inbox is clear.
  for(let n=0;n<100;n++){await flush();if(!await serviceInterruptions())break;}
  const full=window.PennantLab.getSnapshot();
  assert.equal(full.day,143,'Season skip must finish without routine report interruption');
  assert.equal(full.games,858,'12 teams × 143 games should result in 858 games');

  // The IndexedDB writes are serialized; read only after pending writes settle.
  await flush();
  const specialNews=store.get(1).data.milestoneNews;
  assert.equal(specialNews.filter(e=>e.type==='champion').length,2,'Both league champions have news');
  assert.equal(new Set(specialNews.map(e=>e.id)).size,specialNews.length,'No duplicate events');
  assert.equal(store.get(1).data.pendingMilestoneIds.length,0,'Routine news remains archived without mandatory review');
  const archivedMatches=store.get(1)?.data?.games||[];
  const gmOwned=full.selectedId;
  const watchedMatches=archivedMatches.filter(g=>g.home===gmOwned||g.away===gmOwned);
  assert.equal(watchedMatches.length,143,'Manager AI must preserve the full 143 game schedule');

  // All runs must have exactly one pitcher accountable, including inherited
  // runners scoring AFTER a pitching substitution. Pitch counts come only
  // from actually faced batters and scale proportionally to fatigue.
  let midInningMoves=0,seasonPitches=0;
  for(const g of watchedMatches){
    assert(g.box&&Array.isArray(g.box.pitch)&&g.box.pitch.length>=2,
      'Both teams must have actual pitching appearances');
    assert.equal(g.box.pitch.reduce((n,p)=>n+p.er,0),g.homeScore+g.awayScore,
      'Inherited runs must be charged once to the responsible pitcher');
    for(const p of g.box.pitch){
      assert(Number.isInteger(p.pitches)&&p.pitches>=2&&p.pitches<=245,
        'Every pitcher appearance must log a plausible pitch count');
      assert(Number.isInteger(p.bf)&&p.bf>=1,'Pitcher must face actual hitters');
      assert(p.pitches>=2*p.bf&&p.pitches<=7*p.bf,
        'Every plate appearance contributes a bounded number of pitches');
      seasonPitches+=p.pitches;
    }
    const mid=(g.managerMoves||[]).filter(m=>m.type==='pitch'&&m.midInning);
    for(const m of mid){
      assert(Number.isInteger(m.pitchCount)&&m.pitchCount>=12,
        'Pressure-relief changes can occur before the normal 29-pitch closer limit');
      assert(['球数による継投','走者を背負った場面での継投'].includes(m.reason));
      assert(g.box.pitch.some(p=>p.id===m.inId&&p.bf>0));
    }
    midInningMoves+=mid.length;
  }
  assert(seasonPitches>10000,'143 user games must accumulate real pitch counts');
  assert(midInningMoves>0,'Manager must make actual mid-inning relief moves');
  console.log('PASS: '+midInningMoves+' mid-inning pitching changes, '+
    seasonPitches+' actual simulated pitches, inherited runs reconciled');

  const substituted=watchedMatches.flatMap(g=>(g.managerMoves||[]).map(m=>({...m,match:g})));
  const myMoves=substituted.filter(m=>m.teamId===gmOwned);
  const pinchMoves=myMoves.filter(m=>!m.type||m.type==='pinch');
  const pitchMoves=myMoves.filter(m=>m.type==='pitch');
  const runnerMoves=myMoves.filter(m=>m.type==='runner');
  const defenseMoves=myMoves.filter(m=>m.type==='defense');
  assert(pinchMoves.length>0,'Aggressive pinch policy should produce real plate appearances');
  assert(pitchMoves.length>0,'Bullpen AI must make real pitching changes');
  for(const g of watchedMatches){
    const byTeam=new Map();
    for(const move of g.managerMoves||[]){
      assert(move.inId!==move.outId,'A substitution must change the real player');
      assert(move.inning>=(move.type==='pitch'?1:7)&&move.inning<=12,
        'Bullpen can relieve an overworked starter early; fielding and batting changes stay late-game');
      assert(typeof move.managerName==='string'&&move.managerName.length>0);
      assert(['pinch','pitch','runner','defense',undefined].includes(move.type));
      // A later trade can change the player's current club. Validate the
      // immutable match-time affiliation, not the end-of-season roster.
      const p=store.get(1).data.players.find(p=>p.id===move.inId);
      assert(p,'Substitute must have a registered player identity');
      assert([g.home,g.away].includes(move.teamId),'Substitution club must be participating');
      const appearances=move.type==='pitch'?g.box?.pitch:g.box?.bat;
      assert(appearances?.some(row=>row.id===move.inId&&row.teamId===move.teamId),'Substitute must belong to his club at the time of the match');
      const key=move.teamId+':'+move.inId;
      assert(!byTeam.has(key),'Bench player cannot enter twice in one game');
      byTeam.set(key,true);
      if(move.type==='pitch'){
        assert(g.box?.pitch.some(p=>p.id===move.inId&&p.outs>=0),
          'Actual replacement pitcher must have a recorded appearance');
      }else if(move.type==='pinch'||!move.type){
        assert(g.box?.bat.some(p=>p.id===move.inId&&p.pa>0),
          'Pinch hitter must have a plate appearance');
      }else{
        assert(g.box?.bat.some(p=>p.id===move.inId),
          'Pinch runner and defensive specialist must count as participants');
      }
    }
  }
  assert(watchedMatches.some(g=>Array.isArray(g.managerMoves)),
    'Watched game reports must persist actual manager changes');
  console.log('PASS: bench AI: '+pinchMoves.length+' pinch hitters, '+
    pitchMoves.length+' pitching changes, '+runnerMoves.length+
    ' pinch runners, '+defenseMoves.length+' defensive replacements');
  assert.equal(dateRenders.length,dateCountBeforeSkip,'Batch skip must not render date intros');
  const monthlyArchive=store.get(1)?.data?.monthlyArchive||[];
  assert(monthlyArchive.length>=6,'Skipped months remain archived');
  assert(monthlyArchive.every(m=>m.actualFinance),'Skipped months have actual finance records');
  assert.equal(store.get(1).data.pendingMonth,null,'Season skip clears routine month prompts');
  assert.equal(store.get(1).data.pendingEvent,null,'Mandatory injury reports, including the final game, are acknowledged through UI');
  const weeklies=store.get(1).data.dailyBulletins.filter(p=>p.weekly);
  assert(weeklies.length>10,'Season skip preserves weekly newspapers');
  for(const p of weeklies){
    assert.equal(new Date(p.date+'T00:00:00Z').getUTCDay(),1);
    const w=p.weekly;
    const matches=store.get(1).data.games.filter(g=>g.date>=w.start&&g.date<=w.end&&(g.home===gmOwned||g.away===gmOwned));
    assert.equal(w.record.w+w.record.l+w.record.t,matches.length);
    assert.equal(w.scores.length,matches.length);
    assert.equal(w.leagues.E.length+w.leagues.W.length,12);
  }
  const ledger=store.get(1).data.financeLedger;
  assert.equal(ledger.through,store.get(1).data.calendar.days.length);
  assert.equal(new Set(ledger.periods.map(p=>p.through)).size,ledger.periods.length);
  assert(ledger.clubs[gmOwned].revenue>=8.5,'Actual season revenue includes the base amount');
  if(medicalRenders.length)assert(medicalRenders.every(v=>v.includes('チーム医療スタッフ')));
  for(const team of full.teams)assert.equal(team.w+team.l+team.t,143,'Every club plays 143 games');

  // Every selected-club run must be traceable to a real scoring plate
  // appearance and equal the actual totals saved in the game.
  await flush();
  const matchArchive=store.get(1)?.data?.games||[];
  const selectedMatches=matchArchive.filter(g=>g.home===full.selectedId||g.away===full.selectedId);
  assert.equal(selectedMatches.length,143,'143 watched-club games are recorded');
  let recordedScoringPlays=0;
  for(const g of selectedMatches){
    assert(Array.isArray(g.scoringPlays),'Selected-club matches have actual RBI play logs');
    assert.equal(g.scoringPlays.reduce((n,p)=>n+p.runs,0),g.homeScore+g.awayScore,
      'Recorded scoring appearances equal the final runs, without fabricated scores');
    for(let inning=1;inning<=Math.max(g.inningsH.length,g.inningsA.length);inning++){
      for(const [teamId,runs] of [[g.home,g.inningsH[inning-1]],[g.away,g.inningsA[inning-1]]]){
        if(!Number.isFinite(runs))continue;
        const logged=g.scoringPlays.filter(p=>p.inning===inning&&p.teamId===teamId);
        assert.equal(logged.reduce((n,p)=>n+p.runs,0),runs,
          'Each half-inning is the sum of its real scoring plate appearances');
        for(const p of logged){
          assert(typeof p.batterName==='string'&&p.batterName.length>1);
          assert(['hr','single','double','triple','walk','out'].includes(p.kind));
          assert(p.runs>=1&&p.runs<=4);
        }
        recordedScoringPlays+=logged.length;
      }
    }
  }
  assert(recordedScoringPlays>0,'Season must contain actual player-named scoring plays');
  console.log('PASS: '+recordedScoringPlays+' real batter-attributed scoring plays across 143 watched games');

  console.log('PASS: full 143-game season, 858 games, all 12 clubs, monthly and injury interruptions');

  // Resolve final required reports before the existing offseason sequence.
  for(let i=0;i<240;i++){
    const page=app.innerHTML;
    const action=['rare-news-next','rare-news-ack','injury-ack','finish-review','milestone-ack','auto-day-close','finish-month'].find(a=>page.includes('data-action="'+a+'"'));
    if(!action)break;
    if(action==='finish-month')finishMeeting();else if(action==='milestone-ack'){
      dispatch('click',{action});
      assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'edition-exit-cancel'});
      assert(!app.innerHTML.includes('role="alertdialog"'));
      assert(app.innerHTML.includes('data-action="milestone-ack"'));
      dispatch('click',{action:'milestone-close'});
      assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'edition-exit-confirm'});
    }else dispatch('click',{action});
  }
  dispatch('click',{action:'tab',tab:'records'});
  dispatch('click',{action:'record-sub',sub:'news'});
  assert(app.innerHTML.includes('球界ニュースの履歴'));
  dispatch('click',{action:'news-edition-open',date:weeklies[0].date,year:String(weeklies[0].year)});
  assert(app.innerHTML.includes('data-medium="news"'));
  assert(app.innerHTML.includes('週刊 球界ニュース'));
  assert(app.innerHTML.includes('東西リーグ · 順位と週間成績'));
  assert(!app.innerHTML.includes('data-action="pause-calendar"'));
  dispatch('click',{action:'news-archive-medium',medium:'mail'});
  assert(app.innerHTML.includes('data-medium="mail"'));
  for(const outcome of ['win','loss','draw'])assert(app.innerHTML.includes('data-outcome="'+outcome+'"'));
  assert(!app.innerHTML.includes('data-action="pause-calendar"'));
  dispatch('click',{action:'news-archive-medium',medium:'news'});
  assert(app.innerHTML.includes('data-medium="news"'));
  dispatch('click',{action:'news-edition-close'});
  dispatch('click',{action:'tab',tab:'hq'});
  // Annual calendar replaced the old fixed ceremony-next chain.
  assert(app.innerHTML.includes('data-action="flow-day"'));
  const off=window.TestFixture.clock();assert.equal(off.mode,'off');
  for(let i=0;i<20&&window.TestFixture.clock().jobs['awards-all'].status!=='ready';i++)assert(window.TestFixture.tick());
  assert.equal(window.TestFixture.clock().jobs['awards-all'].status,'ready');
  assert.equal(window.TestFixture.clock().jobs.draft.status,'scheduled');
  // Complete actual annual engine actions in an isolated headless fixture.
  // This is not an end-to-end traversal of every annual event screen.
  window.TestFixture.annual();await flush();
  assert.equal(window.PennantLab.getSnapshot().year,full.year+1);
  const draft=store.get(1).data.draftHistory.find(d=>d.year===full.year);
  assert(draft&&draft.picks.length>0);assert(draft.picks.some(p=>p.round===5));
  assert(store.get(1).data.teams.every(t=>store.get(1).data.players.filter(p=>p.teamId===t.id).length<=50));
  assert.equal(new Set(draft.picks.map(p=>p.candidateId)).size,draft.picks.length);
  assert(draft.picks.every(p=>p.status!=='rights'));
  for(const row of draft.picks.filter(p=>p.status==='signed')){const p=store.get(1).data.players.find(p=>p.id===row.playerId);assert(p&&p.teamId===row.teamId&&p.rookieSeason===full.year+1&&p.stats.g===0);}
  for(const row of draft.picks.filter(p=>p.status!=='signed'))assert(!store.get(1).data.players.some(p=>p.id===row.candidateId));
  assert(window.PennantLab.getSnapshot().teams.every(t=>Number.isFinite(t.cash)),'Annual commerce, training and salary cash remains finite');
  assert.equal(window.PennantLab.getSnapshot().day,0);
  assert(app.innerHTML.includes('data-action="flow-inbox"'),'New-player report is a required inbox event');
  const entry=app.innerHTML.match(/data-action="flow-inbox" data-key="([^"]+)"/);assert(entry);dispatch('click',{action:'flow-inbox',key:entry[1]});
  if(app.innerHTML.includes('data-action="draft-reveal-close"')){dispatch('click',{action:'draft-reveal-close'});dispatch('click',{action:'draft-confirm-accept'});}await flush();
  await flush();
  assert.equal(store.get(1).data.pendingCeremonyIntro,null);
  dispatch('click',{action:'tab',tab:'records'});
  dispatch('click',{action:'record-sub',sub:'recordbook'});
  assert(app.innerHTML.includes('PENNANT RECORD BOOK'));
  assert(app.innerHTML.includes('class="record-leader"'));
  dispatch('click',{action:'book-mode',mode:'season'});
  dispatch('change',{change:'book-scope',value:'E'});
  assert(app.innerHTML.includes('class="record-leader"'));
  dispatch('click',{action:'book-mode',mode:'awards'});
  assert(app.innerHTML.includes('award-portrait-ring'));
  dispatch('click',{action:'book-mode',mode:'feats'});
  assert(app.innerHTML.includes('特殊記録・更新'));
  for(const key of ['三冠王','投手三冠','cycle','nohit','perfect','record'])assert(app.innerHTML.includes('data-achievement="'+key+'"'));
  assert(app.innerHTML.includes('実績には加算されません'));
  dispatch('click',{action:'record-sub',sub:'career'});
  assert(app.innerHTML.includes('歴代選手・通算記録'));
  const careerButton=app.innerHTML.match(/data-action="career-open" data-id="(\d+)"/);
  assert(careerButton,'Completed season players are available in career archive');
  dispatch('click',{action:'career-open',id:careerButton[1]});
  assert(app.innerHTML.includes('career-total'));
  assert(app.innerHTML.includes('選手経歴・最盛期'));
  assert(app.innerHTML.includes('年度別の最盛期能力'));
  const archived=store.get(1).data.players.filter(p=>p.teamId===-1);
  assert(archived.every(p=>p.retirement&&p.appearanceSeed===p.id));
  assert(archived.every(p=>p.retirement.recorded&&p.retirement.year===full.year));

  assert(app.innerHTML.includes(String(full.year)));
  dispatch('click',{action:'close-player'});
  dispatch('click',{action:'career-filter',kind:'status',value:'retired'});
  assert(app.innerHTML.includes('歴代選手・通算記録'));
  const retiredButton=app.innerHTML.match(/data-action="career-open" data-id="(\d+)"/);
  if(retiredButton){dispatch('click',{action:'career-open',id:retiredButton[1]});assert(app.innerHTML.includes('引退選手'));}
  dispatch('click',{action:'close-player'});
  dispatch('click',{action:'record-sub',sub:'legacy'});
  assert(app.innerHTML.includes('HALL OF FAME'));
  assert(app.innerHTML.includes('全12球団の引退選手'));
  assert(app.innerHTML.includes('助っ人外国人'));
  dispatch('click',{action:'legacy-filter',kind:'route',value:'foreign'});
  assert(app.innerHTML.includes('助っ人外国人'));
  const legacy=store.get(1).data.legacyArchive;
  assert(legacy&&legacy.year===full.year+1);
  assert(legacy.entries.every(e=>e.eligibleFrom<=legacy.year&&e.score>=0&&e.score<=100&&['draft','foreign'].includes(e.route)));
  assert(Array.isArray(legacy.entries));
  dispatch('click',{action:'record-sub',sub:'decade'});
  assert(app.innerHTML.includes('球界・球団10年史'));
  dispatch('click',{action:'decade-archive-open',year:'2036'});
  assert(app.innerHTML.includes('球界10年史'));
  dispatch('click',{action:'decade-open',editionId:'clubs'});
  assert(app.innerHTML.includes('最長連覇'));
  dispatch('click',{action:'decade-back'});
  dispatch('click',{action:'decade-close'});
  assert(app.innerHTML.includes('球界・球団10年史'));
  // Synthetic decade boundary fixture: preserve the normal one-season smoke above.
  // Slot selection is only legal from the title, after pending writes finish.
  dispatch('click',{action:'title'});await flush();
  assert(app.innerHTML.includes('セーブデータを選択'));
  const fixture=JSON.parse(JSON.stringify(store.get(1)));
  fixture.data.seasonArchive=Array.from({length:10},(_,i)=>({...fixture.data.seasonArchive[0],year:2027+i}));
  fixture.data.year=2037;fixture.data.pendingDecade=2036;fixture.data.pendingCeremonyIntro='opening';
  store.set(1,fixture);
  dispatch('click',{action:'continue-slot',slot:'1'});await flush();
  const decadeInbox=app.innerHTML.match(/data-action="flow-inbox" data-key="([^"]+)"/);if(decadeInbox)dispatch('click',{action:'flow-inbox',key:decadeInbox[1]});
  assert(app.innerHTML.includes('2036'));
  assert(app.innerHTML.includes('球界10年史'));
  dispatch('click',{action:'decade-open',editionId:'timeline'});
  assert(app.innerHTML.includes('年度別の優勝球団'));
  dispatch('click',{action:'decade-close'});
  assert(app.innerHTML.includes('role="alertdialog"'));
  dispatch('click',{action:'edition-exit-cancel'});
  assert(app.innerHTML.includes('年度別の優勝球団'));
  dispatch('click',{action:'decade-close'});
  dispatch('click',{action:'edition-exit-confirm'});
  await flush();
  assert.equal(store.get(1).data.pendingDecade,null);
  assert.equal(store.get(1).data.lastDecadeViewed,2036);
  assert(app.innerHTML.includes('data-event="opening"'));
  console.log('PASS: decade archive navigation and one-time event exit');
  console.log('PASS: civil-date pre/off-season checkpoints and headless annual engine rollover');
  console.log('PASS: v0.9.7 cinematic watch, manager, personalized GM reports, save and season');
})().catch(e=>{console.error(e);process.exitCode=1;});