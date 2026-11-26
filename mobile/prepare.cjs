const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'www');
const production=process.env.PL_PRODUCTION==='1';
if(production)require('./production-readiness.cjs').assertProductionReady();
const sample='ca-app-pub-3940256099942544';
const units={android:process.env.PL_ADMOB_ANDROID_UNIT||sample+'/5224354917',ios:process.env.PL_ADMOB_IOS_UNIT||sample+'/1712485313'};
const apps={android:process.env.PL_ADMOB_ANDROID_APP||sample+'~3347511713',ios:process.env.PL_ADMOB_IOS_APP||sample+'~1458002511'};
if(production&&[...Object.values(units),...Object.values(apps)].some(x=>x.startsWith(sample)))throw Error('Production requires real AdMob application and reward IDs for both platforms');
if(!production&&[...Object.values(units),...Object.values(apps)].some(x=>!x.startsWith(sample)))throw Error('Development must use Google demo IDs only');
if(Object.values(units).some(x=>!/^ca-app-pub-\d+\/\d+$/.test(x))||Object.values(apps).some(x=>!/^ca-app-pub-\d+~\d+$/.test(x)))throw Error('Invalid AdMob IDs');
// No OAuth values or provider secrets are committed. Configure all or none.
const accountApi=process.env.PL_ACCOUNT_API_URL||'';
const oauthFields={authorizeUrl:process.env.PL_OAUTH_AUTHORIZE_URL,tokenUrl:process.env.PL_OAUTH_TOKEN_URL,issuer:process.env.PL_OAUTH_ISSUER,clientId:process.env.PL_OAUTH_CLIENT_ID,scope:process.env.PL_OAUTH_SCOPE,redirectUri:process.env.PL_OAUTH_REDIRECT_URI};
const oauthEnabled=!!accountApi||Object.values(oauthFields).some(Boolean);
const validHttps=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}};
if(oauthEnabled&&(!validHttps(accountApi)||!['authorizeUrl','tokenUrl','issuer'].every(k=>validHttps(oauthFields[k]))||!oauthFields.clientId||!oauthFields.scope||oauthFields.redirectUri!==require('./capacitor.config.json').appId+'://auth/callback'))throw Error('Complete valid OAuth/API configuration required');
const oauth=oauthEnabled?oauthFields:null;
const health=process.env.PL_HEALTH_URL||'https://hyphen1012.github.io/pennant-lab/health.txt';
if(!health.startsWith('https://'))throw Error('HTTPS health endpoint required');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});fs.cpSync(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
// Release packaging must not silently ship the temporary title or an absent video.
if(production){
 require('../scripts/startup-asset-check.cjs').verifyStartupAssets(out);
 const media=html.match(/const STARTUP_MEDIA=Object\.freeze\(\{video:'([^']*)',title:'([^']*)',hasStartText:(?:true|false)\}\);/);
 if(!media||!media[1]||!media[2])throw Error('Official startup video and title image are required for production');
 for(const name of media.slice(1,3)){
  if(!/^assets\/startup\/[A-Za-z0-9_.-]+$/.test(name))throw Error('Invalid official startup asset path');
  const file=path.join(out,name);if(!fs.existsSync(file)||!fs.statSync(file).isFile()||!fs.statSync(file).size)throw Error('Missing bundled startup asset: '+name);
 }
}

function replace(a,b){if(html.split(a).length!==2)throw Error('native integration anchor missing: '+a);html=html.replace(a,b);}
replace('  const rewardAdProvider=null;', '  const rewardAdProvider=window.PennantNative?.reward||null;');
replace('      const entry=processCalendarDay();','      if(!window.PennantNative||!await window.PennantNative.check()||ui.pauseRequested||document.hidden||storageFailure||!window.PennantNative.ready())break;\n      const entry=processCalendarDay();');
replace('    if(!offDayCanStart(f))return false;\n    const token=', '    if(!offDayCanStart(f)||!window.PennantNative?.ready())return false;\n    const token=');
replace('const valid=game===token.owner&&flowGet()===token.flow&&token.flow.date===token.from&&!document.hidden;', 'const valid=game===token.owner&&flowGet()===token.flow&&token.flow.date===token.from&&!document.hidden&&window.PennantNative?.ready();');
replace('      f.date=calendarOffsetDate(f.date,1);flowTick(f);\n      if(flowGet()!==f', '      if(!window.PennantNative?.ready())break;\n      f.date=calendarOffsetDate(f.date,1);flowTick(f);\n      if(flowGet()!==f');
replace("    if(act==='export-save'){", "    if(act==='export-save'){\n      if(window.PennantNative){void window.PennantNative.exportSave(JSON.stringify(game), 'PENNANT_LAB_'+game.year+'_save.json').catch(()=>showToast('バックアップ共有に失敗しました',true));return;}");
replace("  const appRoot=document.querySelector('#app');","  const appRoot=document.querySelector('#app');\n  window.PennantNative?.setBackup(()=>{if(!game||ui.busy||scenarioLab)throw Error('busy');save();return window.PennantNative.exportSave(JSON.stringify(game),'PENNANT_LAB_'+game.year+'_save.json');});");
replace('<script>','<script src="native-runtime.js"></script>\n<script>');
// Native-only privacy entry is inserted beside the title slot list.
html=html.replace('<div class="title-slot-title">','<button type="button" class="btn outline full" data-mobile-privacy>広告プライバシー設定</button><div class="title-slot-title">');
if(production)html=require('./release-surface.cjs').releaseSurface(html);
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];if(!script)throw Error('game script missing');new Function(script);
fs.writeFileSync(path.join(out,'index.html'),html);
esbuild.buildSync({entryPoints:[path.join(__dirname,'src/index.js')],bundle:true,format:'iife',platform:'browser',outfile:path.join(out,'native-runtime.js'),define:{__PL_CONFIG__:JSON.stringify({health,units,production,accountApi,oauth})}});
fs.writeFileSync(path.join(__dirname,'native-build-config.json'),JSON.stringify({apps,production,oauth},null,2));
console.log('Prepared native web assets',production?'production configuration':'Google test ads');
