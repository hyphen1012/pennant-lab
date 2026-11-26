import {Capacitor,CapacitorHttp,registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {createNativeOAuth} from './native-oauth.cjs';
import {createAccountBootstrap} from './account-bootstrap.cjs';
import {createEntitlementBridge} from './entitlement-bridge.cjs';
import {createCommerceLifecycle} from './commerce-lifecycle.cjs';
import {openNativeBillingDialog} from './native-billing-dialog.cjs';
import {openDeletionDialog} from './deletion-dialog.cjs';
import {createAccountClient} from './account-client.cjs';
import {createCanonicalGameSession} from './canonical-game-session.cjs';
import {createSsvAdAdapter} from './ssv-adapter.cjs';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {AdMob,AdmobConsentStatus} from '@capacitor-community/admob';
import {createGate,createReward} from './gate.cjs';
const config=__PL_CONFIG__;
const native=Capacitor.isNativePlatform();
if(native){
  let backup=null,overlay=null,content=null,consentInfo=null;
  const accountEnabled=!!(config.accountApi&&config.oauth);
  let accountAccess=!accountEnabled,accountInitialized=false,authStarted=false,accountEpoch=0,checkingIdentity=null,identityAt=-Infinity;
  let appActive=true,visible=!document.hidden;
  let bootstrap=null,provider=null,life=null,bridge=null,billingDialog=null,deletionBusy=false,reauthProvider=null,evidenceClient=null,ssv=null,canonicalGame=null;
  const billingPlugin=registerPlugin('PennantBilling');
  function usable(){return gate.ready()&&accountAccess;}
  // Prior to title tap, only the startup movie and title may be shown.
  function interfaceReady(){return usable()||(accountEnabled&&!authStarted&&!accountInitialized&&gate.ready());}
  function paint(online){
    if(!online)window.dispatchEvent(new Event('pl-native-suspend'));
    const root=document.querySelector('#app');if(root)root.inert=!online;
    if(!overlay){
      overlay=document.createElement('section');
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','通信状態');
      overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#07101f;color:#fff;display:grid;place-items:center;padding:24px;text-align:center;font:16px system-ui';
      overlay.innerHTML='<div style="max-width:360px"><h2>PENNANT LAB</h2><p>インターネット接続が必要です。セーブデータを保持したまま進行を停止しています。</p><button id="pl-retry" style="padding:14px 28px">再接続を確認</button><p id="pl-status" aria-live="polite"></p><button id="pl-backup" style="padding:12px" hidden>バックアップを共有</button></div>';
      document.body.appendChild(overlay);
      content=overlay.querySelector('#pl-status');
      overlay.querySelector('#pl-retry').onclick=async()=>{
        if(accountEnabled&&accountInitialized&&!bootstrap.context()){provider.logout();window.location.reload();return;}
        content.textContent='接続確認中…';
        await gate.check(true);if(accountEnabled&&accountInitialized)await verifyIdentity();
        content.textContent=interfaceReady()?'':'接続または認証を確認できません。';
      };
      overlay.querySelector('#pl-backup').onclick=async()=>{try{if(backup&&(!accountEnabled||bootstrap?.context()?.isCurrent()))await backup();}catch{content.textContent='バックアップ共有に失敗しました。保存データは保持されています。';}};
    }
    overlay.hidden=online;overlay.style.display=online?'none':'grid';overlay.querySelector('#pl-backup').hidden=!backup||(accountEnabled&&!bootstrap?.context()?.isCurrent());
    const lost=accountEnabled&&accountInitialized&&!bootstrap?.context();
    overlay.querySelector('#pl-retry').textContent=lost?'再ログインする':'再接続を確認';
    overlay.querySelector('p').textContent=lost?'認証セッションが失効しました。再ログインしてください。保存データは削除していません。':'インターネット接続と認証の確認が必要です。セーブデータを保持したまま進行を停止しています。';
  }
  function suspendAccount(){
    if(!accountEnabled)return;
    accountEpoch++;accountAccess=false;identityAt=-Infinity;bootstrap?.suspend();canonicalGame?.suspend();billingDialog?.abort();ssv?.invalidate();life?.invalidate();
  }
  async function verifyIdentity(){
    if(!accountEnabled)return true;
    if(!accountInitialized||!bootstrap?.context()||!gate.ready()||!appActive||!visible)return false;
    if(checkingIdentity)return checkingIdentity;
    const epoch=accountEpoch;
    const task=(async()=>{
      const ok=await bootstrap.revalidate();
      if(epoch!==accountEpoch||!gate.ready()||!appActive||!visible)return false;
      accountAccess=ok===true;identityAt=accountAccess?performance.now():-Infinity;
      paint(usable());if(accountAccess)void life.refresh();
      return accountAccess;
    })();
    checkingIdentity=task;try{return await task;}finally{if(checkingIdentity===task)checkingIdentity=null;}
  }
  function update(online){
    life?.setConnected(online===true);
    if(!online)suspendAccount();
    if(online&&accountEnabled&&accountInitialized){
      if(performance.now()-identityAt>=60000)accountAccess=false;
      if(!accountAccess)void verifyIdentity();
      else if(!life.status().verified)void life.refresh();
    }
    paint(interfaceReady());
  }
  // Monotonic time is independent of manual device clock changes.
  const gate=createGate({now:()=>performance.now(),probe:async()=>{
    const response=await CapacitorHttp.get({url:config.health+'?n='+Date.now(),headers:{'Cache-Control':'no-cache'},connectTimeout:5000,readTimeout:5000,responseType:'text'});
    return response.status===200&&String(response.data).trim()==='PENNANT-LAB-ONLINE-v1';
  },onChange:update});
  if(accountEnabled){
    provider=createNativeOAuth({config:config.oauth,openExternal:url=>Browser.open({url}),closeExternal:()=>Browser.close()});
    bridge=createEntitlementBridge({baseUrl:config.accountApi});
    evidenceClient=createAccountClient({baseUrl:config.accountApi});
    if(config.canonicalUiPilot&&!config.production)canonicalGame=createCanonicalGameSession({client:createAccountClient({baseUrl:config.accountApi}),online:async()=>usable()&&await gate.check(true)&&usable()});
    if(config.production)ssv=createSsvAdAdapter({client:evidenceClient,sdk:AdMob,platform:Capacitor.getPlatform(),adId:config.units[Capacitor.getPlatform()],online:async()=>await gate.check(true)&&usable(),consent:rewardConsent});
    life=createCommerceLifecycle({bridge,online:async()=>usable()});
    life.setVisible(visible);life.setActive(appActive);
    bootstrap=createAccountBootstrap({baseUrl:config.accountApi,provider,online:usable,onSession:s=>{billingDialog?.abort();ssv?.invalidate();evidenceClient.setSession(s);life.setSession(s);if(canonicalGame){canonicalGame.setSession(s);window.dispatchEvent(new Event('pl-canonical-identity-changed'));}}});
  }
  let accountReadyTask=null;
  async function accountReady(){
    if(!accountEnabled)return;
    if(accountReadyTask)return accountReadyTask;
    authStarted=true;paint(false);
    accountReadyTask=(async()=>{
      await App.addListener('appUrlOpen',({url})=>{void (async()=>{if(reauthProvider&&await reauthProvider.handleCallback(url))return;await provider.handleCallback(url);})();});
      await Browser.addListener('browserFinished',()=>{const target=reauthProvider||provider;setTimeout(()=>target.cancel(),500);});
      await new Promise(resolve=>{
        const dlg=document.createElement('dialog');
        dlg.style.cssText='width:min(90vw,420px);padding:24px;border-radius:18px;background:#101d32;color:#fff;border:1px solid #8394b1;text-align:center';
        dlg.setAttribute('aria-label','PENNANT LAB ログイン');
        dlg.innerHTML='<h2>PENNANT LAB</h2><p>セーブデータを保護するため、アカウントにログインしてください。</p><button class="btn primary full" type="button">ログイン・新規登録</button><p role="status" aria-live="polite"></p>';
        const btn=dlg.querySelector('button'),status=dlg.querySelector('[role="status"]');
        dlg.addEventListener('cancel',e=>e.preventDefault());
        btn.onclick=async()=>{
          if(btn.disabled)return;btn.disabled=true;status.textContent='認証画面を開いています…';
          try{
            await provider.login();
            const ctx=await bootstrap.start();
            if(!ctx?.isCurrent())throw Error('identity unavailable');
            accountInitialized=true;accountAccess=gate.ready()&&appActive&&visible;identityAt=accountAccess?performance.now():-Infinity;
            dlg.close();dlg.remove();paint(usable());if(accountAccess)void life.refresh();else void gate.check(true);resolve();
          }catch{provider.logout();bootstrap.invalidate();status.textContent='ログインできませんでした。再度お試しください。';btn.disabled=false;}
        };
        document.body.append(dlg);dlg.showModal();
      });
    })();
    return accountReadyTask;
  }
  let consentPending=null;
  async function refreshConsent(){
    if(consentPending)return consentPending;
    consentPending=AdMob.requestConsentInfo();
    try{consentInfo=await consentPending;return consentInfo;}finally{consentPending=null;}
  }
  async function rewardConsent(){
      let info=consentInfo||await refreshConsent();
      if(info.isConsentFormAvailable&&info.status===AdmobConsentStatus.REQUIRED)info=await AdMob.showConsentForm();
      consentInfo=info;return info.canRequestAds===true;
  }
  const reward=config.canonicalUiPilot?null:createReward({
    online:async()=>await gate.check(true)&&usable(),consent:rewardConsent,
    initialize:()=>AdMob.initialize(),
    prepare:()=>AdMob.prepareRewardVideoAd({adId:config.units[Capacitor.getPlatform()],npa:true}),
    show:()=>AdMob.showRewardVideoAd()
  });
  window.PennantNative={
    ready:interfaceReady,check:async force=>await gate.check(force)&&interfaceReady(),accountRequired:accountEnabled,reward:config.production?null:reward,
    get accountContext(){return bootstrap?.context()??null;},accountReady,canonicalGame,
    deletionAvailable:config.deletionEnabled===true,
    // Evidence-only. No production reward application is connected here.
    requestAdProof:config.production&&ssv?o=>ssv.requestAdProof(o):null,
    async openDeletion({purgeLocal}={}){
      const ctx=bootstrap?.context();if(!config.deletionEnabled||!ctx?.isCurrent()||!usable()||deletionBusy||typeof purgeLocal!=='function')throw Error('deletion unavailable');
      deletionBusy=true;const client=createAccountClient({baseUrl:config.accountApi});
      try{
        const token=await provider.getAccessToken();if(!ctx.isCurrent()||!token)throw Error('session changed');
        client.setSession({account:ctx.account,token});
        return await openDeletionDialog({client,purgeLocal:()=>purgeLocal(ctx.account),externalUrl:config.deletionUrl,openExternal:url=>Browser.open({url}),
          reauthenticate:async()=>{
            if(!ctx.isCurrent())throw Error('session changed');
            const reauth=createNativeOAuth({config:config.oauth,openExternal:url=>Browser.open({url}),closeExternal:()=>Browser.close()});reauthProvider=reauth;
            try{const proof=await reauth.login({reauthenticate:true});if(!ctx.isCurrent()||!proof||!appActive||!visible)throw Error('reauthentication interrupted');return proof;}
            finally{reauth.logout();if(reauthProvider===reauth)reauthProvider=null;}
          },
          onAccepted:()=>window.PennantNative.logoutAccount()
        });
      }finally{client.setSession(null);deletionBusy=false;}
    },
    billingAvailable:!!config.billingCatalog,
    async openBilling(){const ctx=bootstrap?.context();if(!ctx?.isCurrent()||!usable()||billingDialog||!config.billingCatalog)throw Error('billing unavailable');const ctl=new AbortController();billingDialog=ctl;try{await openNativeBillingDialog({plugin:billingPlugin,platform:Capacitor.getPlatform(),catalog:config.billingCatalog[Capacitor.getPlatform()],account:()=>ctx.isCurrent()?ctx.account:null,online:usable,bridge,signal:ctl.signal,transactionsEnabled:false});}finally{if(billingDialog===ctl)billingDialog=null;}},
    logoutAccount(){if(!accountEnabled)return;accountAccess=false;provider.logout();bootstrap.invalidate();suspendAccount();paint(false);window.location.reload();}, // SDK callback is development-only; no production reward authority
    setBackup(fn){backup=fn;paint(interfaceReady());},
    async exportSave(json,name){
      const path='pennant-'+Date.now()+'-'+name;
      const result=await Filesystem.writeFile({path,data:json,directory:Directory.Cache,encoding:Encoding.UTF8});
      try{await Share.share({title:'PENNANT LAB セーブデータ',files:[result.uri]});}
      finally{await Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>{});}
    },
    async shareImage(data,name){
      if(typeof data!=='string'||data.length>20*1024*1024||!/^PENNANT_LAB_\d+_memorial\.png$/.test(name))throw Error('invalid memorial image');
      const path='pennant-'+Date.now()+'-'+name;
      const result=await Filesystem.writeFile({path,data,directory:Directory.Cache});
      try{await Share.share({title:'PENNANT LAB 記念アート',files:[result.uri]});}
      finally{await Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>{});}
    },
    async privacy(){await AdMob.showPrivacyOptionsForm();await refreshConsent();}
  };
  document.addEventListener('visibilitychange',()=>{visible=!document.hidden;life?.setVisible(visible);if(!visible)suspendAccount();gate.setVisible(visible);if(visible)void gate.check(true);});
  window.addEventListener('offline',()=>gate.invalidate());
  window.addEventListener('online',()=>void gate.check(true));
  App.addListener('appStateChange',({isActive})=>{appActive=isActive===true;life?.setActive(appActive);if(!appActive)suspendAccount();gate.setAppActive(appActive);if(appActive)void gate.check(true);});
  // If the main thread was paused, enforce expiry before an app control acts.
  window.addEventListener('click',e=>{const root=document.querySelector('#app');if(root?.contains(e.target)&&!interfaceReady()){gate.expire();e.preventDefault();e.stopImmediatePropagation();void gate.check(true);}},true);
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-mobile-privacy]')){e.preventDefault();e.stopImmediatePropagation();void window.PennantNative.privacy().catch(()=>alert('広告のプライバシー設定を開けませんでした。'));}},true);
  gate.setVisible(!document.hidden);
  update(false);
  void gate.check(true).then(ok=>{if(ok)void refreshConsent().catch(()=>{});});
  setInterval(()=>{if(!document.hidden)gate.expire();},1000);
  setInterval(()=>{if(!document.hidden)void gate.check(true);},10000);
}
