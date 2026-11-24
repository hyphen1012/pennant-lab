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
  appendChild(){},click(){},setAttribute(){}});
const document={
  hidden:false,
  body:{appendChild() {},insertAdjacentHTML(where,markup){overlays.push(markup)}},
  querySelector:sel=>sel==='#app'?app:null,
  querySelectorAll:()=>[],
  createElement:()=>domElement(),
  addEventListener:(type,callback,capture)=>listeners.push({type,callback,capture:!!capture})
};
const window={
  indexedDB,scrollTo(){},location:{href:'https://localhost/'}
};
const localStorage={
  getItem:key=>local.has(key)?local.get(key):null,
  setItem:(key,value)=>local.set(key,String(value)),
  removeItem:key=>local.delete(key)
};
const fakeTimeout=(fn,ms,...args)=>ms>=3000?0:setTimeout(fn,ms>=300?0:ms,...args);
const context={window,document,localStorage,console,setTimeout:fakeTimeout,
  clearTimeout,Date,Math,JSON,Number,String,Array,Object,Set,Map,
  Promise,Blob:global.Blob,URL:global.URL};
vm.runInNewContext(script,context,{filename:'pennant-lab.js'});

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
  assert.match(app.innerHTML,/VERSION 0\.9\.43 · DRAFT PRESENCE/);
  const snap=window.PennantLab.getSnapshot();
  assert.equal(snap.teams.length,12);
  assert.equal(snap.playerCount>250,true);
  dispatch('click',{action:'finish-setup'});
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
  assert.match(app.innerHTML,/class="profile-row"/);
  assert.match(app.innerHTML,/class="avatar player-portrait/);
  assert.match(app.innerHTML,/class="face-artwork"/);
  dispatch('click',{action:'detail-tab',sub:'stats'});
  assert(app.innerHTML.includes('通算成績'));
  assert(app.innerHTML.includes('年度別成績'));
  assert(app.innerHTML.includes('タイトル獲得歴'));
  assert(app.innerHTML.includes('記録達成履歴'));

  // Both starting lineup and starting rotation show the same player overall badge
  // on top of the five-stat ring; the swap list must use it too.
  dispatch('click',{action:'tab',tab:'roster'});
  assert.match(app.innerHTML,/スターティングメンバー/);
  assert.match(app.innerHTML,/class="player-pick-btn roster-pick-btn"/);
  assert.match(app.innerHTML,/class="portrait-overall"/);
  assert.match(app.innerHTML,/has-overall/);
  assert.match(app.innerHTML,/data-kind="lineup"/);
  dispatch('click',{action:'swap-open',kind:'lineup',slot:'0'});
  assert(overlays.some(markup=>markup.includes('class="swap-candidate"')),
    'The swap modal must show replacement player candidates');
  const modal=overlays.at(-1);
  assert.match(modal,/class="face-mini [^"]*has-overall"/);
  assert.match(modal,/class="portrait-overall"/);
  assert.match(modal,/--avatar-color:#/);
  dispatch('click',{action:'swap-close'});
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
  assert.match(app.innerHTML,/class="face-mini [^"]*has-overall"/);
  assert.match(app.innerHTML,/class="portrait-overall"/);
  assert.match(app.innerHTML,/data-action="sign"/);
  assert.match(app.innerHTML,/契約金/);
  assert(!app.innerHTML.includes('<table class="data-table">'),
    'Recruitment screen should not gain a wide horizontal table');
  dispatch('click',{action:'tab',tab:'hq'});

  assert.match(app.innerHTML,/data-action="mgr-open"/);
  assert.match(app.innerHTML,/class="desk-task" data-action="mgr-open" data-priority="(?:optional|recommended)"/);
  assert(app.innerHTML.includes('GM DESK · FRONT OFFICE'));
  assert(app.innerHTML.includes('class="hero-context"'));
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
  dispatch('click',{action:'auto-day-close'});
  const dateCountBeforeSkip=dateRenders.length;
  dispatch('click',{action:'playback-mode',mode:'skip'});
  // A new explicit season skip must finish in one invocation.
  const pageBeforeSkip=app.innerHTML;
  if(pageBeforeSkip.includes('data-action="injury-ack"'))dispatch('click',{action:'injury-ack'});
  if(app.innerHTML.includes('data-action="finish-month"'))finishMeeting();
  if(app.innerHTML.includes('data-action="finish-review"'))dispatch('click',{action:'finish-review'});
  await window.PennantLab.advance('season');
  const full=window.PennantLab.getSnapshot();
  assert.equal(full.day,143,'Season skip must finish without routine report interruption');
  assert.equal(full.games,858,'12 teams × 143 games should result in 858 games');

  // The IndexedDB writes are serialized; read only after pending writes settle.
  await flush();
  const specialNews=store.get(1).data.milestoneNews;
  assert.equal(specialNews.filter(e=>e.type==='champion').length,2,'Both league champions have news');
  assert.equal(new Set(specialNews.map(e=>e.id)).size,specialNews.length,'No duplicate events');
  assert(store.get(1).data.pendingMilestoneIds.length>0,'Skipped news awaits review only after season');
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
      const p=store.get(1).data.players.find(p=>p.id===move.inId);
      assert(p&&p.teamId===move.teamId,'Substitute must belong to his team');
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
  assert.equal(store.get(1).data.pendingEvent,null,'Season skip clears routine injury prompts');
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
    const action=['injury-ack','finish-review','milestone-ack','auto-day-close','finish-month'].find(a=>page.includes('data-action="'+a+'"'));
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
  assert(app.innerHTML.includes('data-action="ceremony-start"'));
  assert(app.innerHTML.includes('class="panel season-action" data-priority="required"'));
  dispatch('click',{action:'ceremony-start'});
  const cashBeforeOffseason=window.PennantLab.getSnapshot().teams.map(t=>t.cash);
  const titles=['awards-all','settlement','draft','roster-cut','winter','self','camp','opening'];
  for(const key of titles){
    if(key==='opening'&&app.innerHTML.includes('data-action="draft-reveal-close"')){
      const reveal=app.innerHTML.match(/data-action="draft-reveal" data-id="(\d+)"/);
      if(reveal){dispatch('click',{action:'draft-reveal',id:reveal[1]});assert(app.innerHTML.includes('基礎測定結果'));dispatch('click',{action:'draft-reveal',id:reveal[1]});assert(app.innerHTML.includes('入団時能力確定'));}
      dispatch('click',{action:'draft-reveal-close'});dispatch('click',{action:'draft-confirm-accept'});
    }
    assert(app.innerHTML.includes('data-event="'+key+'"'),'Milestone title: '+key);
    assert(!app.innerHTML.includes('data-action="ceremony-next"'),'No underlying transition on title');
    const before=window.PennantLab.getSnapshot();
    dispatch('click',{action:'event-intro-continue',event:key});
    assert(!app.innerHTML.includes('data-event="'+key+'"'));
    if(['winter','self','camp'].includes(key)){
      const tone=key==='camp'?'spring':'winter';
      assert(app.innerHTML.includes('class="panel ceremony-panel" data-tone="'+tone+'"'),'Training panel palette must match title: '+key);
    }
    assert.equal(window.PennantLab.getSnapshot().year,before.year);
    assert.equal(window.PennantLab.getSnapshot().day,before.day);
    if(key==='opening')break;
    if(key==='awards-all'){
      assert(app.innerHTML.includes('data-action="ceremony-open"'));
      assert(app.innerHTML.includes('data-action="ceremony-close"'));
      dispatch('click',{action:'ceremony-open',editionId:'E-nine'});
      assert(app.innerHTML.includes('東リーグ · ベストナイン'));
      assert(app.innerHTML.includes('edition-compact'));
      dispatch('click',{action:'ceremony-back'});
      assert(app.innerHTML.includes('data-action="ceremony-open"'));
      dispatch('click',{action:'ceremony-close'});
      assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'edition-exit-cancel'});
      assert(!app.innerHTML.includes('role="alertdialog"'));
      assert(app.innerHTML.includes('data-action="ceremony-open"'));
      dispatch('click',{action:'ceremony-next'});
      assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'edition-exit-confirm'});
    }else if(key==='draft'){
      assert(app.innerHTML.includes('SCOUTING STAFF'));
      const candidate=app.innerHTML.match(/data-action="draft-detail" data-id="(\d+)"/);
      assert(candidate);
      dispatch('click',{action:'draft-detail',id:candidate[1]});
      assert(app.innerHTML.includes('推定には誤差'));
      dispatch('click',{action:'draft-research',id:candidate[1]});
      assert(app.innerHTML.includes('スカウト面談メモ'));
      dispatch('click',{action:'draft-research',id:candidate[1],value:'analysis'});
      assert(app.innerHTML.includes('映像・データ分析 完了'));
      dispatch('click',{action:'draft-research',id:candidate[1],value:'interview'});
      assert(app.innerHTML.includes('本人・関係者面談 完了'));
      dispatch('click',{action:'draft-report-view',id:candidate[1],value:'field'});
      assert(app.innerHTML.includes('現地視察 完了'));
      dispatch('click',{action:'draft-start'});dispatch('click',{action:'draft-confirm-accept'});
      const choice=app.innerHTML.match(/data-action="draft-choose" data-id="(\d+)"/);
      assert(choice);
      const rumor=app.innerHTML.match(/data-action="draft-rumor" data-id="(\d+)" data-value="([^"]+)"/);assert(rumor);dispatch('click',{action:'draft-rumor',id:rumor[1],value:rumor[2]});assert(app.innerHTML.includes('実際の指名を保証するものではありません'));dispatch('click',{action:'draft-confirm-cancel'});
      dispatch('click',{action:'draft-choose',id:choice[1]});
      assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'draft-confirm-cancel'});
      assert(!app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'draft-choose',id:choice[1]});
      dispatch('click',{action:'draft-confirm-accept'});
      const drainAnnouncements=async()=>{for(let n=0;n<80&&app.innerHTML.includes('data-draft-announcement="true"');n++){assert(app.innerHTML.includes('12球団 指名リアルタイム状況'));await flush();}};
      assert(app.innerHTML.includes('data-draft-announcement="true"'));
      const drainDraws=async()=>{
        await drainAnnouncements();
        for(let n=0;n<80&&app.innerHTML.includes('class="draft-draw-stage"');n++){
          if(app.innerHTML.includes('data-own-draw="false"')){
            assert(app.innerHTML.includes('自動進行'));
            assert(!app.innerHTML.includes('data-action="draft-draw-delegate"'));
            await flush();continue;
          }
          assert(app.innerHTML.includes('自球団の競合抽選'));
          dispatch('click',{action:'draft-draw-delegate'});
          assert(app.innerHTML.includes('data-action="draft-draw-open"'));
          dispatch('click',{action:'draft-draw-open'});
          assert(app.innerHTML.includes('LOTTERY RESULT'));
          dispatch('click',{action:'draft-draw-next'});
        }
      };
      await drainDraws();
      assert(app.innerHTML.includes('指名・抽選結果'));
      dispatch('click',{action:'draft-first-next'});await drainAnnouncements();
      for(let n=0;n<40&&!app.innerHTML.includes('2巡目 · 順番指名');n++){
        if(app.innerHTML.includes('data-action="draft-cpu-next"'))dispatch('click',{action:'draft-cpu-next'});
        else if(app.innerHTML.includes('data-action="draft-pass"')){dispatch('click',{action:'draft-pass'});dispatch('click',{action:'draft-confirm-accept'});}
        await drainDraws();if(app.innerHTML.includes('data-action="draft-first-next"'))dispatch('click',{action:'draft-first-next'});await drainAnnouncements();
      }
      assert(app.innerHTML.includes('2巡目 · 順番指名'));
      const second=app.innerHTML.match(/data-action="draft-choose" data-id="(\d+)"/);assert(second);
      dispatch('click',{action:'draft-choose',id:second[1]});dispatch('click',{action:'draft-confirm-accept'});await drainAnnouncements();
      assert(app.innerHTML.includes('3巡目 · 順番指名'));
      const third=app.innerHTML.match(/data-action="draft-choose" data-id="(\d+)"/);assert(third);
      dispatch('click',{action:'draft-choose',id:third[1]});dispatch('click',{action:'draft-confirm-accept'});await drainAnnouncements();
      for(let round=4;round<=5;round++){
        assert(app.innerHTML.includes(round+'巡目 · 順番指名'));
        const later=app.innerHTML.match(/data-action="draft-choose" data-id="(\d+)"/);assert(later);
        dispatch('click',{action:'draft-choose',id:later[1]});dispatch('click',{action:'draft-confirm-accept'});await drainAnnouncements();
      }
      dispatch('click',{action:'draft-auto'});
      assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'draft-confirm-accept'});
      for(let n=0;n<40&&!app.innerHTML.includes('data-action="draft-finish"');n++){await drainDraws();if(app.innerHTML.includes('data-action="draft-first-next"'))dispatch('click',{action:'draft-first-next'});else break;}
      assert(app.innerHTML.includes('data-action="draft-finish"'));
      dispatch('click',{action:'draft-finish'});
      dispatch('click',{action:'draft-confirm-accept'});
    }else if(key==='roster-cut'){
      assert(app.innerHTML.includes('戦力外通告'));
      for(let i=0;i<8&&/data-action="draft-cut-finish" disabled/.test(app.innerHTML);i++){
        const option=app.innerHTML.match(/data-action="draft-cut-toggle" data-id="(\d+)">放出候補にする/);assert(option);
        dispatch('click',{action:'draft-cut-toggle',id:option[1]});
        assert(app.innerHTML.includes('本当にこの選手に戦力外通告しますか？'));
        dispatch('click',{action:'draft-confirm-accept'});
        if(app.innerHTML.includes('重要選手への戦力外通告'))dispatch('click',{action:'draft-confirm-accept'});
      }
      assert(!/data-action="draft-cut-finish" disabled/.test(app.innerHTML));
      dispatch('click',{action:'draft-cut-finish'});assert(app.innerHTML.includes('role="alertdialog"'));
      dispatch('click',{action:'draft-confirm-accept'});
    }else dispatch('click',{action:'ceremony-next'});
  }
  assert.equal(window.PennantLab.getSnapshot().year,full.year+1);
  await flush();
  const draft=store.get(1).data.draftHistory.find(d=>d.year===full.year);
  assert(draft&&draft.picks.length>0);assert(draft.picks.some(p=>p.round===5));
  assert(store.get(1).data.teams.every(t=>store.get(1).data.players.filter(p=>p.teamId===t.id).length<=50));
  assert.equal(new Set(draft.picks.map(p=>p.candidateId)).size,draft.picks.length);
  assert(draft.picks.every(p=>p.status!=='rights'));
  for(const row of draft.picks.filter(p=>p.status==='signed')){const p=store.get(1).data.players.find(p=>p.id===row.playerId);assert(p&&p.teamId===row.teamId&&p.rookieSeason===full.year+1&&p.stats.g===0);}
  for(const row of draft.picks.filter(p=>p.status!=='signed'))assert(!store.get(1).data.players.some(p=>p.id===row.candidateId));
  assert.deepEqual(window.PennantLab.getSnapshot().teams.map((t,i)=>t.cash),cashBeforeOffseason.map((cash,i)=>Math.round((cash-draft.picks.filter(p=>p.teamId===i&&p.status==='signed').reduce((n,p)=>n+p.contract.fee,0))*100)/100),'Only signed draft fees change cash');
  assert.equal(window.PennantLab.getSnapshot().day,0);
  assert(app.innerHTML.includes('data-action="advance-day"'));
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
  assert(app.innerHTML.includes('該当する引退選手はまだいません'));
  const legacy=store.get(1).data.legacyArchive;
  assert(legacy&&legacy.year===full.year+1);
  assert(legacy.entries.every(e=>e.eligibleFrom<=legacy.year&&e.score>=0&&e.score<=100&&e.route==='draft'));
  assert(legacy.entries.some(e=>e.tier),'Retired players include eligible historical figures');
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
  const fixture=JSON.parse(JSON.stringify(store.get(1)));
  fixture.data.seasonArchive=Array.from({length:10},(_,i)=>({...fixture.data.seasonArchive[0],year:2027+i}));
  fixture.data.year=2037;fixture.data.pendingDecade=2036;fixture.data.pendingCeremonyIntro='opening';
  store.set(1,fixture);
  dispatch('click',{action:'continue-slot',slot:'1'});await flush();
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
  console.log('PASS: six milestone titles, full offseason sequence and next-year opening');
  console.log('PASS: v0.9.7 cinematic watch, manager, personalized GM reports, save and season');
})().catch(e=>{console.error(e);process.exitCode=1;});