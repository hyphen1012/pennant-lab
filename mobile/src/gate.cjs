// Native connectivity and rewarded-ad state machines; no synthetic rewards.
function createGate({probe,now=Date.now,onChange=()=>{},ttl=15000}){
  let validAt=-Infinity,pending=null,generation=0,active=true;
  const ready=()=>active&&now()-validAt<ttl;
  function invalidate(){generation++;validAt=-Infinity;pending=null;onChange(false);}
  function setActive(value){active=value;if(!active)invalidate();}
  async function check(force=false){
    if(!active)return false;
    if(!force&&ready())return true;
    if(pending)return pending;
    const token=generation;
    const task=Promise.resolve().then(probe).then(ok=>{
      if(token!==generation||!active)return false;
      validAt=ok===true?now():-Infinity;onChange(ready());return ready();
    },()=>{if(token===generation){validAt=-Infinity;onChange(false);}return false;});
    pending=task;
    try{return await task;}finally{if(pending===task)pending=null;}
  }
  return {ready,check,invalidate,setActive};
}
function createReward({online,consent,initialize,prepare,show}){
  let busy=false,initialized=false;
  return async function reward(){
    if(busy)return false;
    busy=true;
    try{
      if(!await online())throw Error('offline');
      if(!await consent())throw Error('consent not available');
      if(!initialized){await initialize();initialized=true;}
      await prepare();
      if(!await online())throw Error('offline');
      const result=await show();
      return !!(result&&typeof result.type==='string'&&result.type.length&&Number.isFinite(result.amount)&&result.amount>0);
    }finally{busy=false;}
  };
}
module.exports={createGate,createReward};
