const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(script);
const listeners=[];
const store=new Map(), local=new Map();
const app={innerHTML:''};
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
const fakeTimeout=(fn,ms,...args)=>ms>=500?0:setTimeout(fn,ms,...args);
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
  const event={target:el,preventDefault(){},stopImmediatePropagation(){this.stopped=true;},stopped:false};
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
  assert.match(app.innerHTML,/VERSION 0\.7\.0 · MANAGER/);
  const snap=window.PennantLab.getSnapshot();
  assert.equal(snap.teams.length,12);
  assert.equal(snap.playerCount>250,true);
  dispatch('click',{action:'finish-setup'});
  assert.match(app.innerHTML,/data-action="mgr-open"/);
  dispatch('click',{action:'mgr-open'});
  assert.match(app.innerHTML,/現監督・GM方針/);
  assert.match(app.innerHTML,/data-action="mgr-offer"/);
  const oldCash=window.PennantLab.getSnapshot().teams.find(t=>t.id===2).cash;
  dispatch('click',{action:'mgr-offer',slot:'1'});
  assert.match(app.innerHTML,/監督の雇用契約/);
  dispatch('click',{action:'confirm'});
  const cash=window.PennantLab.getSnapshot().teams.find(t=>t.id===2).cash;
  assert(cash<oldCash,'Manager hiring spends the disclosed signing fee');
  dispatch('change',{change:'manager-order',key:'bullpen',value:'attack'});
  assert.match(app.innerHTML,/value="attack" selected/);
  await window.PennantLab.advance('day');
  const after=window.PennantLab.getSnapshot();
  assert(after.day>=0&&after.day<=1);
  assert(after.games>=0);
  await flush();
  assert(store.get(1)?.data,'Game save should be persisted');
  console.log('PASS: cold boot, 12 teams, manager room, hiring, GM policy, day progression and save');
})().catch(e=>{console.error(e);process.exitCode=1;});