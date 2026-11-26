// Fail closed across overlapping OS lifecycle, visibility and network events.
// A verified bridge remains unavailable until a real identity provider supplies a session.
function createCommerceLifecycle({bridge,online=async()=>false}={}){
 if(!bridge||typeof bridge.invalidate!=='function'||typeof bridge.refresh!=='function'||typeof bridge.setSession!=='function')throw Error('bridge required');
 let visible=false,active=false,connected=false,session=false,epoch=0,ready=false,pending=null;
 const allowed=()=>visible&&active&&connected&&session;
 function invalidate(){epoch++;ready=false;pending=null;bridge.invalidate();}
 function change(key,value){value=value===true;let old;
  if(key==='visible'){old=visible;visible=value;}else if(key==='active'){old=active;active=value;}else{old=connected;connected=value;}
  if(old!==value)invalidate();
 }
 function setSession(next){invalidate();session=false;bridge.setSession(null);if(next!==null){bridge.setSession(next);session=true;}}
 async function refresh(){
  if(!allowed())return false;
  if(pending)return pending;
  ready=false;const gen=epoch;
  const task=Promise.resolve().then(async()=>{
   if(!await online()||gen!==epoch||!allowed())return false;
   const result=await bridge.refresh();
   if(gen!==epoch||!allowed())return false;
   ready=result?.verified===true;return ready;
  }).catch(()=>false);
  pending=task;try{return await task;}finally{if(pending===task)pending=null;}
 }
 function status(){if(!allowed()||!ready)return {verified:false,adSkip:false,vip:false};const s=bridge.status();return s?.verified===true?s:{verified:false,adSkip:false,vip:false};}
 return {setSession,setVisible:v=>change('visible',v),setActive:v=>change('active',v),setConnected:v=>change('connected',v),invalidate,refresh,status};
}
module.exports={createCommerceLifecycle};
