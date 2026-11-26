// UI is a read-only staging catalog until the transaction guard is reviewed.
const {createNativeBillingAdapter}=require('./native-billing-adapter.cjs');
const {createStorePurchaseFlow}=require('./store-purchase-flow.cjs');
function openNativeBillingDialog({plugin,platform,catalog,account,online,bridge,signal,transactionsEnabled=false,document:doc=globalThis.document}={}){
 if(!doc||signal?.aborted)throw Error('billing unavailable');
 const initial=account();if(!initial||!online())throw Error('authentication required');
 const sdk=createNativeBillingAdapter({plugin,platform,catalog,account,online});
 const flow=createStorePurchaseFlow({sdk,bridge,catalog:catalog.map(r=>r.id),authorizeFinish:r=>bridge.authorizeFinish(r)});
 flow.setAuthenticated(true);
 const dialog=doc.createElement('dialog');dialog.className='slot-delete-dialog';dialog.setAttribute('aria-label','ストア・購入管理');dialog.style.cssText='width:min(92vw,440px);max-height:82dvh;overflow:auto;background:#101d32;color:#fff;padding:20px;border-radius:18px;border:1px solid #8394b1';
 const el=(tag,text)=>{const x=doc.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
 const status=el('p','価格を取得しています…'),body=el('div'),footer=el('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 dialog.append(el('h2','ストア・購入管理'),el('p','価格は公式ストアから取得します。'),status,body,footer);
 let live=true,busy=false,resolveDone;
 const done=new Promise(r=>resolveDone=r);
 const current=()=>live&&!signal?.aborted&&online()===true&&account()===initial;
 const button=(label,fn,parent=body)=>{const b=el('button',label);b.className='btn outline full';b.type='button';b.onclick=fn;parent.append(b);return b;};
 function close(){if(!live)return;live=false;flow.invalidate();signal?.removeEventListener('abort',close);try{dialog.close();}catch{}dialog.remove();resolveDone();}
 const messages={pending:'購入は保留中です。確定後に購入復元で確認できます。',cancelled:'購入はキャンセルされました。',verification_required:'サーバーで確認できません。再購入せず購入復元をお試しください。',verified:'ストア取引を確認しました。権限はサーバーの検証結果に従います。'};
 async function run(work){if(busy||!current())return;busy=true;for(const b of body.querySelectorAll('button'))b.disabled=true;try{await work();}catch{if(live)status.textContent='取引状態を確認できません。再購入せず、購入履歴を確認してください。';}finally{busy=false;if(live)for(const b of body.querySelectorAll('button'))b.disabled=b.dataset.blocked==='true';}}
 async function list(){
  const rows=await flow.list();if(!current())return;body.replaceChildren();
  status.textContent=transactionsEnabled?'公式ストアの現在価格です。':'接続試験中のため購入・復元は停止しています。';
  for(const row of rows){
   const product=catalog.find(x=>x.id===row.id),section=el('section');section.style.cssText='padding:10px 0;border-top:1px solid #52637b';
   section.append(el('h3',product.label||row.id),el('p',row.formattedPrice));
   const b=button('購入内容を確認',()=>{if(!transactionsEnabled||busy||!current())return;
    body.replaceChildren(el('h3','購入確認'),el('p',(product.label||row.id)+' ／ '+row.formattedPrice),el('p','最終確認はストアの購入画面で行います。'));
    button('購入へ進む',()=>run(async()=>{const result=await flow.purchase(row.id,true);if(current()){await list();status.textContent=messages[result.phase]||'ストア取引を確認してください。';}}));
    button('キャンセル',()=>run(list));
   },section);
   b.disabled=!transactionsEnabled;b.dataset.blocked=String(!transactionsEnabled);body.append(section);
  }
  const b=button('購入を復元',()=>run(async()=>{if(!transactionsEnabled)return;const r=await flow.restore();if(current())status.textContent=r.some(x=>x.phase==='verification_required')?messages.verification_required:'復元処理を確認しました。';}));b.disabled=!transactionsEnabled;b.dataset.blocked=String(!transactionsEnabled);
 }
 button('閉じる',close,footer);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});signal?.addEventListener('abort',close,{once:true});doc.body.append(dialog);dialog.showModal();void run(list);return done;
}
module.exports={openNativeBillingDialog};
