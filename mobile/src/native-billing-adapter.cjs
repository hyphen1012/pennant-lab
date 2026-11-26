// Store-specific real SDK bridge; not exposed in a shipping build until the
// provider verification / transaction-specific acknowledgement API is connected.
function createNativeBillingAdapter({plugin,platform,catalog,account,online}={}){
 if(!plugin||!['ios','android'].includes(platform)||!Array.isArray(catalog)||!catalog.length||catalog.length>20||typeof account!=='function'||typeof online!=='function')throw Error('billing config required');
 const products=new Map();
 for(const row of catalog){
  if(!row||typeof row.id!=='string'||!row.id||row.id.length>200||products.has(row.id)||!['inapp','subs'].includes(row.type)||platform==='android'&&row.type==='subs'&&(typeof row.basePlan!=='string'||!row.basePlan))throw Error('invalid store catalog');
  products.set(row.id,{id:row.id,type:row.type,basePlan:row.basePlan??null});
 }
 const shown=new Map();let owner=null;
 const getOwner=()=>{const a=account();if(typeof a!=='string'||!/^[a-f0-9]{64}$/.test(a)||online()!==true)throw Error('verified account required');return a;};
 const current=a=>{if(getOwner()!==a)throw Error('session changed');};
 function appleToken(a){const h=a.slice(0,32);return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);}
 async function list(ids){
  const a=getOwner();shown.clear();owner=a;const rows=[];
  for(const id of ids){const p=products.get(id);if(!p)throw Error('unknown product');const r=await plugin.product(p);current(a);
   if(r?.id!==id||typeof r.formattedPrice!=='string'||!r.formattedPrice)throw Error('invalid price');
   shown.set(id,r.formattedPrice);rows.push({id,formattedPrice:r.formattedPrice});
  }return rows;
 }
 async function purchase(id){
  const a=getOwner();if(owner!==a||!shown.has(id))throw Error('price confirmation required');
  const r=await plugin.purchase({...products.get(id),account:platform==='ios'?appleToken(a):a,confirmedPrice:shown.get(id),confirmed:true});current(a);return r;
 }
 async function restore(){
  const a=getOwner(),r=await plugin.restore();current(a);
  if(!Array.isArray(r?.rows))throw Error('invalid restore');return r.rows.filter(x=>products.has(x?.id));
 }
 async function finish(r){const a=getOwner();if(!products.has(r?.id)||r?.store!==(platform==='ios'?'apple':'google')||typeof r.proof!=='string'||!r.proof)throw Error('invalid receipt');await plugin.finish({proof:r.proof});current(a);}
 return {products:list,purchase,restore,finish};
}
module.exports={createNativeBillingAdapter};
