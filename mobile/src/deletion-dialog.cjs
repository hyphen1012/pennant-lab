// The app offers deletion itself; an external URL is optional additional access.
// No local or remote mutation without explicit confirmation and reauthentication.
function openDeletionDialog({client,reauthenticate,purgeLocal,onAccepted,document:doc=globalThis.document,externalUrl,openExternal}={}){
 if(!doc||[client?.deletionStatus,client?.requestDeletion,reauthenticate,purgeLocal,onAccepted].some(f=>typeof f!=='function'))throw Error('deletion adapters required');
 const dlg=doc.createElement('dialog');dlg.className='slot-delete-dialog';dlg.setAttribute('aria-label','アカウント削除');dlg.style.cssText='width:min(92vw,450px);max-height:84dvh;overflow:auto;background:#101d32;color:#fff;padding:20px;border-radius:18px;border:1px solid #8394b1';
 const el=(tag,text)=>{const x=doc.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const status=el('p','状態を確認中…'),body=el('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 dlg.append(el('h2','アカウント削除'),el('p','削除を申し込むと、このアカウントの3つのセーブデータと利用情報が削除対象になります。購入済みサブスクリプションの解約は別途ストアで行ってください。必要な法定保持情報がある場合は別途管理されます。'),status,body);
 let busy=false,closed=false,accepted=false,resolveDone;
 const done=new Promise(r=>resolveDone=r);
 function button(label,fn){const b=el('button',label);b.className='btn outline full';b.type='button';b.onclick=fn;body.append(b);return b;}
 function close(){if(busy||closed)return;closed=true;try{dlg.close();}catch{}dlg.remove();resolveDone(accepted);}
 async function showRequest(request){
  if(!request||!['requested','processing','completed'].includes(request.status)||typeof request.requestId!=='string')throw Error('invalid deletion status');
  accepted=true;body.replaceChildren();
  try{await purgeLocal();}catch{status.textContent='申請を受け付けました。端末データの消去状態は未確認です。';}
  status.textContent+=(status.textContent.includes('申請を受け付け')?' ':'')+(request.status==='completed'?'サーバーの削除完了を確認しました。':'削除申請を受け付けました。サーバーでの削除完了とは異なります。')+' 受付番号：'+request.requestId;
  button('閉じてログアウト',()=>{close();onAccepted();});
 }
 async function run(fn){if(busy||closed)return;busy=true;for(const b of body.querySelectorAll('button,input'))b.disabled=true;try{await fn();}catch{if(!closed){status.textContent='処理結果を確認できません。再送せず、申請状況を確認してください。';body.replaceChildren();button('申請状況を確認',()=>run(check));button('閉じる',close);}}finally{busy=false;if(!closed)for(const b of body.querySelectorAll('button,input'))b.disabled=false;}}
 async function check(){
  const r=await client.deletionStatus();body.replaceChildren();
  if(r.request)return showRequest(r.request);
  status.textContent='削除は申し込まれていません。';
  const label=el('label','削除対象と注意事項を確認しました。 '),box=el('input');box.type='checkbox';label.append(box);body.append(label);
  button('本人確認へ進む',()=>run(async()=>{if(!box.checked){status.textContent='注意事項を確認してください。';return;}
   const proof=await reauthenticate();if(typeof proof!=='string'||!proof)throw Error('reauthentication unavailable');
   const result=await client.requestDeletion(proof,true);await showRequest(result.request);
  }));
  if(externalUrl&&typeof openExternal==='function')button('Webの削除窓口を開く',()=>openExternal(externalUrl));
  button('閉じる',close);
 }
 dlg.addEventListener('cancel',e=>{e.preventDefault();if(accepted){if(!busy){close();onAccepted();}}else close();});doc.body.append(dlg);dlg.showModal();void run(check);return done;
}
module.exports={openDeletionDialog};
