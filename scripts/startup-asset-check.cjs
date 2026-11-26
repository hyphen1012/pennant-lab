// Exact original bytes only; no generated substitutions or LFS pointers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const expected={
  "PARALAB_GAMES_startup_v8_SFX_reverb.mp4": "29a216ef4da027bb7883b120d082c37695d8c49ee31ae453b7a21a53bf1e77be",
  "PENNANT_LAB_title.webp": "8333353a897d7cfc6bd16f759b8eb251078daf4ab1a23efe53fdf3d5ef0587b2"
};
function verifyStartupAssets(root,{allowMissing=false}={}){
 const missing=[];
 for(const [name,hash] of Object.entries(expected)){
  const p=path.join(root,'assets','startup',name);
  if(!fs.existsSync(p)){missing.push(name);continue;}
  if(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')!==hash)throw Error('Official asset differs from approved original: '+name);
 }
 if(missing.length&&!allowMissing)throw Error('Official startup assets missing: '+missing.join(', '));
 if(missing.length)console.warn('DRAFT ONLY: startup original missing: '+missing.join(', '));else console.log('PASS both exact official startup SHA-256 fingerprints');
 return missing.length===0;
}
if(require.main===module)verifyStartupAssets(path.resolve(__dirname,'..'),{allowMissing:process.argv.includes('--allow-missing')});
module.exports={verifyStartupAssets};
