const {createSaveRecordStore}=require('./save-record-store.cjs');
const {createSaveTransferClient}=require('./save-transfer-client.cjs');
const {createSaveTransport}=require('./save-transport.cjs');
const {decodeGzip,toGameRecord,exportGameRecord}=require('./save-gzip-codec.cjs');
const sha256=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
const describe=d=>({year:d.year,day:d.day,team:d.teams.find(t=>t.id===d.selectedId)?.name||'球団不明'});
const stamp=n=>Number.isSafeInteger(n)&&n>0?new Date(n).toLocaleString('ja-JP'):'不明';
const bytes=n=>Math.ceil(n/1024).toLocaleString('ja-JP')+' KB';
// Real DOM management screen; only the game title lock can authorize local writes.
// The verified session is supplied by the native bootstrap, not a local account ID.
function openCloudSaveDialog({document:doc=globalThis.document,session,baseUrl,fetcher,openDatabase,canWrite,online,signal}={}){
 if(!session||typeof online!=='function'||typeof canWrite!=='function'||signal?.aborted)throw Error('cloud session unavailable');
 const transport=createSaveTransport({baseUrl,fetcher,sha256});
 let live=true,busy=false,closing=false,resolveDone,remote=[],staged=null;
 const done=new Promise(resolve=>{resolveDone=resolve;});
 const allowed=(a,s)=>live&&canWrite(a,s)&&online()===true;
 const local=createSaveRecordStore({openDatabase,sha256,canWrite:allowed,encode:toGameRecord,validate:r=>r?.encoding==='pl-gzip-json-v1'&&r.bytes instanceof Blob});
 const migration=createSaveTransferClient({transport,local,sha256,validatePayload:async b=>describe(await decodeGzip(b))});
 migration.setSession(session);
 const dlg=doc.createElement('dialog');dlg.className='slot-delete-dialog';dlg.dataset.cloudSaveDialog='true';
 dlg.setAttribute('aria-label','クラウドセーブ管理');
 dlg.style.cssText='width:min(92vw,480px);max-height:84dvh;overflow:auto;background:#101d32;color:#f4f2eb;border:1px solid #8394b1;border-radius:18px;padding:16px;';
 const node=(tag,value)=>{const el=doc.createElement(tag);if(value!==undefined)el.textContent=String(value);return el;};
 const heading=node('h2','クラウドセーブ管理'),note=node('p','端末とクラウドのデータは別々です。選択・確認なしに上書きしません。');
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const body=node('div'),footer=node('div');
 dlg.append(heading,note,status,body,footer);
 function button(label,action,parent=body){const b=node('button',label);b.type='button';b.className='btn outline full';b.onclick=action;parent.append(b);return b;}
 function clear(){body.replaceChildren();staged=null;}
 function setStatus(s){if(live)status.textContent=s;}
 function finishClose(){if(!busy&&closing){signal?.removeEventListener('abort',close);dlg.remove();resolveDone();}}
 function close(){if(closing)return;closing=true;live=false;staged=null;migration.setSession(null);try{dlg.close();}catch{}finishClose();}
 function failMessage(e){return e?.code==='revision_conflict'||e?.message==='local save conflict'?'別の端末または画面で更新されています。再取得してから確認してください。':e?.uncertain?'通信が途切れ、書き込み結果が不明です。再送せず一覧を確認してください。':'操作を完了できませんでした。データを再確認してください。';}
 async function run(fn){if(!live||busy)return;busy=true;for(const b of body.querySelectorAll('button,select'))b.disabled=true;setStatus('確認中…');try{if(!online())throw Error('offline');await fn();}catch(e){if(live){migration.cancel();clear();setStatus(failMessage(e));button('一覧を再取得',()=>run(refresh));}}finally{busy=false;if(live)for(const b of body.querySelectorAll('button,select'))b.disabled=false;finishClose();}}
 function showConfirm(title,lines,action){
  clear();body.append(node('h3',title));for(const line of lines)body.append(node('p',line));
  button('内容を確認して実行する',()=>run(action));button('キャンセル',()=>{migration.cancel();void run(refresh);});
 }
 async function refresh(){
  remote=await transport.list();if(!live)return;
  const localRows=await Promise.all([1,2,3].map(slot=>local.read({account:session.account,slot})));
  if(!live)return;clear();setStatus('最新の一覧を取得しました。');
  for(const slot of [1,2,3]){
   const row=remote.find(x=>x.slot===slot),lr=localRows[slot-1],section=node('section');section.style.cssText='padding:12px 0;border-top:1px solid #53647b';
   section.append(node('h3','DATA 0'+slot),node('p',lr.data?'端末：世代 '+lr.revision+' ／ 更新 '+stamp(lr.updatedAt):'端末：空きデータ'),node('p',row?'クラウド：世代 '+row.revision+' ／ '+bytes(row.bytes)+' ／ 更新 '+stamp(row.updatedAt):'クラウド：空きデータ'));
   if(lr.data)button('端末からアップロード',()=>run(()=>prepareUpload(slot,row)),section);
   if(row){button('端末へ取り込む',()=>run(()=>prepareImport(slot,row,false)),section);button('過去世代を確認',()=>run(()=>history(slot)),section);}
   body.append(section);
  }
 }
 async function prepareUpload(slot,row){
  const record=await local.read({account:session.account,slot}),exported=await exportGameRecord(record.data);
  if(!live)return;const d=describe(exported.data),expected=row?.revision??0;
  showConfirm('クラウドへ保存しますか？',['対象：DATA 0'+slot,'端末の世代 '+record.revision+' ／ '+d.team+' '+d.year+'年 '+d.day+'/143試合','クラウドの現在世代 '+expected+' ／ '+bytes(exported.bytes.length),expected?'現在のクラウドデータはサーバーの旧世代として保持されます。':'新規クラウド保存です。'],async()=>{
   const current=await local.inspect({account:session.account,slot});
   if(current.revision!==record.revision)throw Error('local save conflict');
   if(!live||!allowed(session.account,slot))throw Error('session changed');
   await transport.upload({slot,expectedRevision:expected,payload:exported.bytes,confirmed:true});
   if(live){await refresh();setStatus('クラウドに保存しました。');}
  });
 }
 async function prepareImport(slot,row,historical){
  clear();body.append(node('h3','取込先を選択'),node('p','取込元：DATA 0'+slot+' ／ 世代 '+row.revision+' ／ '+bytes(row.bytes)+' ／ 更新 '+stamp(row.updatedAt)));
  const label=node('label','端末の取込先 '),select=node('select');select.setAttribute('aria-label','端末の取込先');
  for(const target of [1,2,3]){const o=node('option','DATA 0'+target);o.value=String(target);select.append(o);}select.value=String(slot);label.append(select);body.append(label);
  button('内容を取得して確認',()=>run(async()=>{
   const target=Number(select.value),summary=await migration.stage({sourceSlot:slot,targetSlot:target,...(historical?{sourceRevision:row.revision}:{})});
   if(!live)return;
   if(summary.sourceRevision!==row.revision){migration.cancel();throw Object.assign(Error('remote changed'),{code:'revision_conflict'});}
   const d=summary.details;
   showConfirm('端末のデータを置き換えますか？',['取込元：DATA 0'+slot+' ／ 世代 '+summary.sourceRevision,'球団：'+d.team+' ／ '+d.year+'年 '+d.day+'/143試合','取込先：DATA 0'+target+' ／ 現在世代 '+summary.targetRevision,'現在の端末データがある場合、同一DB内に直前世代の復旧コピーを作ります。他のスロットは変更しません。'],async()=>{
    await migration.commit({confirmed:true});if(live){await refresh();setStatus('取り込みが完了しました。');}
   });
  }));button('戻る',()=>run(refresh));
 }
 async function history(slot){
  const rows=await transport.history(slot);if(!live)return;clear();body.append(node('h3','DATA 0'+slot+' のクラウド履歴'));
  for(const row of rows)button('世代 '+row.revision+' ／ '+bytes(row.bytes)+' ／ '+stamp(row.updatedAt),()=>run(()=>prepareImport(slot,row,true)));
  if(!rows.length)body.append(node('p','保存された旧世代はありません。'));button('一覧へ戻る',()=>run(refresh));
 }
 button('閉じる',close,footer);dlg.addEventListener('cancel',e=>{e.preventDefault();close();});signal?.addEventListener('abort',close,{once:true});
 doc.body.append(dlg);dlg.showModal();void run(refresh);
 return done;
}
module.exports={openCloudSaveDialog};
