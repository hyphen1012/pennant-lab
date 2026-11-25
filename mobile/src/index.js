import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {AdMob,AdmobConsentStatus} from '@capacitor-community/admob';
import {createGate,createReward} from './gate.cjs';
const config=__PL_CONFIG__;
const native=Capacitor.isNativePlatform();
if(native){
  let backup=null,overlay=null,content=null,consentInfo=null;
  function update(online){
    const root=document.querySelector('#app');if(root)root.inert=!online;
    if(!overlay){
      overlay=document.createElement('section');
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','通信状態');
      overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#07101f;color:#fff;display:grid;place-items:center;padding:24px;text-align:center;font:16px system-ui';
      overlay.innerHTML='<div style="max-width:360px"><h2>PENNANT LAB</h2><p>インターネット接続が必要です。セーブデータを保持したまま進行を停止しています。</p><button id="pl-retry" style="padding:14px 28px">再接続を確認</button><p id="pl-status" aria-live="polite"></p><button id="pl-backup" style="padding:12px" hidden>バックアップを共有</button></div>';
      document.body.appendChild(overlay);
      content=overlay.querySelector('#pl-status');
      overlay.querySelector('#pl-retry').onclick=async()=>{content.textContent='接続確認中…';const ok=await gate.check(true);content.textContent=ok?'':'接続できません。通信環境を確認してください。';};
      overlay.querySelector('#pl-backup').onclick=async()=>{try{if(backup)await backup();}catch{content.textContent='バックアップ共有に失敗しました。保存データは保持されています。';}};
    }
    overlay.hidden=online;overlay.style.display=online?'none':'grid';overlay.querySelector('#pl-backup').hidden=!backup;
  }
  const gate=createGate({probe:async()=>{
    const response=await CapacitorHttp.get({url:config.health+'?n='+Date.now(),headers:{'Cache-Control':'no-cache'},connectTimeout:5000,readTimeout:5000,responseType:'text'});
    return response.status===200&&String(response.data).trim()==='PENNANT-LAB-ONLINE-v1';
  },onChange:update});
  let consentPending=null;
  async function refreshConsent(){
    if(consentPending)return consentPending;
    consentPending=AdMob.requestConsentInfo();
    try{consentInfo=await consentPending;return consentInfo;}finally{consentPending=null;}
  }
  const reward=createReward({
    online:()=>gate.check(true),
    consent:async()=>{
      let info=consentInfo||await refreshConsent();
      if(info.isConsentFormAvailable&&info.status===AdmobConsentStatus.REQUIRED)info=await AdMob.showConsentForm();
      consentInfo=info;return info.canRequestAds===true;
    },
    initialize:()=>AdMob.initialize(),
    prepare:()=>AdMob.prepareRewardVideoAd({adId:config.units[Capacitor.getPlatform()],npa:true}),
    show:()=>AdMob.showRewardVideoAd()
  });
  window.PennantNative={
    ready:gate.ready,check:gate.check,reward,
    setBackup(fn){backup=fn;update(gate.ready());},
    async exportSave(json,name){
      const path='pennant-'+Date.now()+'-'+name;
      const result=await Filesystem.writeFile({path,data:json,directory:Directory.Cache,encoding:Encoding.UTF8});
      try{await Share.share({title:'PENNANT LAB セーブデータ',files:[result.uri]});}
      finally{await Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>{});}
    },
    async privacy(){await AdMob.showPrivacyOptionsForm();await refreshConsent();}
  };
  document.addEventListener('visibilitychange',()=>{gate.setVisible(!document.hidden);if(!document.hidden)void gate.check(true);});
  window.addEventListener('offline',()=>gate.invalidate());
  window.addEventListener('online',()=>void gate.check(true));
  App.addListener('appStateChange',({isActive})=>{gate.setAppActive(isActive);if(isActive)void gate.check(true);});
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-mobile-privacy]')){e.preventDefault();e.stopImmediatePropagation();void window.PennantNative.privacy().catch(()=>alert('広告のプライバシー設定を開けませんでした。'));}},true);
  gate.setVisible(!document.hidden);
  update(false);
  void gate.check(true).then(ok=>{if(ok)void refreshConsent().catch(()=>{});});
  setInterval(()=>{if(!document.hidden)void gate.check(true);},10000);
}
