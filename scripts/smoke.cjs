const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script);
const listeners=[];
const store=new Map(), local=new Map();
const watchRenders=[],introRenders=[],gameSetRenders=[],resultRenders=[];
const app={
  _html:'',
  get innerHTML(){return this._html;},
  set innerHTML(markup){
    this._html=markup;
    if(markup.includes('watch-game-screen'))watchRenders.push(markup);
    if(markup.includes('game-cinematic-intro'))introRenders.push(markup);
    if(markup.includes('game-cinematic-outro'))gameSetRenders.push(markup);
    if(markup.includes('game-result-hero'))resultRenders.push(markup);
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
  body:{appendChild() {},insertAdjacentHTML(){}},
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
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0));}
(async()=>{
  await flush();
  assert(window.PennantLab,'Game API must bootstrap');
  assert.match(app.innerHTML,/VERSION 0\.8\.1 · GAME FEEL/);
  const snap=window.PennantLab.getSnapshot();
  assert.equal(snap.teams.length,12);
  assert.equal(snap.playerCount>250,true);
  dispatch('click',{action:'finish-setup'});
  assert.match(app.innerHTML,/data-action="mgr-open"/);
  assert.match(app.innerHTML,/class="desk-task" data-action="mgr-open"/);
  assert(!app.innerHTML.includes('class="panel manager-home"'),'Manager must appear in GM desk, not a separate panel');
  dispatch('click',{action:'mgr-open'});
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
  await window.PennantLab.advance('day');
  // The day action must show the simulated inning-by-inning watch before the final score.
  for(let tries=0;tries<12&&watchRenders.length===0;tries++){
    if(app.innerHTML.includes('data-action="auto-day-close"'))dispatch('click',{action:'auto-day-close'});
    if(app.innerHTML.includes('data-action="finish-month"'))dispatch('click',{action:'finish-month'});
    if(app.innerHTML.includes('data-action="injury-ack"'))dispatch('click',{action:'injury-ack'});
    await window.PennantLab.advance('day');
  }
  assert(introRenders.length>0,'One-day game starts with a PLAY BALL introduction');
  assert(introRenders[0].includes('PLAY BALL'));
  assert(!introRenders[0].includes('result-score-row'),'Pregame must not reveal the result');
  assert(gameSetRenders.length>0,'Game-set moment precedes the detailed result');
  assert(gameSetRenders.some(x=>x.includes('GAME SET')));
  assert(resultRenders.some(x=>x.includes('result-verdict')),'The result must use a cinematic result card');
  assert(resultRenders.some(x=>x.includes('result-score-row')),'The final score is in the result card');
  assert(resultRenders.some(x=>x.includes('result-table')),'The detailed result fits the no-scroll scoreboard');
  assert(watchRenders.length>1,'One-day action should replay half innings before the final score');
  assert(watchRenders.some(x=>x.includes('試合観戦モード')));
  assert(watchRenders.some(x=>x.includes('イニング別スコア')));
  assert(watchRenders.some(x=>x.includes('data-action="watch-skip"')));
  assert(watchRenders.some(x=>x.includes('data-action="pause-calendar"')));
  assert(!app.innerHTML.includes('watch-game-screen'),'After replay, show the normal game report');
  const after=window.PennantLab.getSnapshot();
  assert(after.day>=1&&after.day<=12);
  assert(after.games>=0);
  await flush();
  assert(store.get(1)?.data,'Game save should be persisted');

  // Play a complete season with skip mode, acknowledging month-end and injury reports.
  dispatch('click',{action:'auto-day-close'});
  dispatch('click',{action:'playback-mode',mode:'skip'});
  let done=false;
  for(let attempt=0;attempt<120;attempt++){
    const before=window.PennantLab.getSnapshot().day;
    if(before===143){done=true;break;}
    const page=app.innerHTML;
    if(page.includes('data-action="injury-ack"'))dispatch('click',{action:'injury-ack'});
    else if(page.includes('data-action="finish-month"'))dispatch('click',{action:'finish-month'});
    else if(page.includes('data-action="finish-review"'))dispatch('click',{action:'finish-review'});
    await window.PennantLab.advance(attempt===0?143:'resume');
    const now=window.PennantLab.getSnapshot().day;
    if(now===before&&!app.innerHTML.includes('data-action="injury-ack"')&&
      !app.innerHTML.includes('data-action="finish-month"')&&
      !app.innerHTML.includes('data-action="finish-review"')){
      throw new Error('Season made no progress at game '+now);
    }
  }
  const full=window.PennantLab.getSnapshot();
  assert(done||full.day===143,'The full 143-game schedule must complete');
  assert.equal(full.games,858,'12 teams × 143 games should result in 858 games');
  for(const team of full.teams)assert.equal(team.w+team.l+team.t,143,'Every club plays 143 games');
  console.log('PASS: full 143-game season, 858 games, all 12 clubs, monthly and injury interruptions');

  console.log('PASS: cinematic v0.8.1 manager portraits/ratings, custom GM orders, game flow and season');
})().catch(e=>{console.error(e);process.exitCode=1;});