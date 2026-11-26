// Isolated UI state controller. Real game store must implement atomic CAS and backup.
// No production session, provider, or game-save mutation is enabled by this module.
function createSaveImportFlow({transport,migration,onChange=()=>{}}={}){
 if(!transport||!migration||typeof onChange!=='function')throw Error('save flow adapters required');
 let generation=0,owner=null,state={phase:'signed_out'},busy=false;
 const publish=s=>{state=s;onChange({...state});return {...state};};
 function setSession(session){migration.setSession(session);generation++;owner=session?.account??null;busy=false;publish({phase:owner?'idle':'signed_out'});}
 async function run(work,phase,success){
  if(!owner||busy)throw Error('save flow unavailable');
  const gen=generation;busy=true;publish({phase});
  try{const value=await work();if(gen!==generation)throw Error('session changed');return publish(success(value));}
  catch(e){if(gen===generation)publish({phase:'error',code:e?.code||'save_operation_failed',uncertain:phase==='importing'||e?.uncertain===true});throw e;}
  finally{if(gen===generation)busy=false;}
 }
 function list(){return run(()=>transport.list(),'loading',items=>({phase:'list',items}));}
 function history(slot){return run(()=>transport.history(slot),'loading',items=>({phase:'history',slot,items}));}
 function preview(selection){return run(()=>migration.stage(selection),'downloading',summary=>({phase:'confirm',summary}));}
 function confirm(confirmed){if(confirmed!==true||state.phase!=='confirm')throw Error('explicit confirmation required');return run(()=>migration.commit({confirmed:true}),'importing',result=>({phase:'complete',slot:result.slot}));}
 function cancel(){if(busy||state.phase!=='confirm')return false;migration.cancel();publish({phase:'idle'});return true;}
 return {setSession,list,history,preview,confirm,cancel,status:()=>({...state})};
}
module.exports={createSaveImportFlow};
