const fs=require('node:fs'),path=require('node:path');
const {apps,oauth}=JSON.parse(fs.readFileSync(path.join(__dirname,'native-build-config.json'),'utf8'));
const manifest=path.join(__dirname,'android/app/src/main/AndroidManifest.xml'),plist=path.join(__dirname,'ios/App/App/Info.plist');
if(fs.existsSync(manifest)){let xml=fs.readFileSync(manifest,'utf8');xml=xml.replace(/\s*<meta-data\s+android:name="com.google.android.gms.ads.APPLICATION_ID"[^>]*\/>/g,'');if(!xml.includes('</application>'))throw Error('application missing');xml=xml.replace('</application>','<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="'+apps.android+'"/>\n    </application>');fs.writeFileSync(manifest,xml);}
if(fs.existsSync(plist)){let xml=fs.readFileSync(plist,'utf8');xml=xml.replace(/\s*<key>GADApplicationIdentifier<\/key>\s*<string>[^<]*<\/string>/g,'');if(!xml.includes('</dict>'))throw Error('plist dictionary missing');const at=xml.lastIndexOf('</dict>');xml=xml.slice(0,at)+'<key>GADApplicationIdentifier</key>\n<string>'+apps.ios+'</string>\n'+xml.slice(at);fs.writeFileSync(plist,xml);}

if(oauth){
 const appId=require('./capacitor.config.json').appId;
 if(!/^[a-z][a-z0-9]*(?:\.[a-z0-9]+)+$/.test(appId)||oauth.redirectUri!==appId+'://auth/callback')throw Error('invalid native redirect');
 if(fs.existsSync(manifest)){
  let xml=fs.readFileSync(manifest,'utf8');
  const filter='<intent-filter android:label="PENNANT_LAB_OAUTH"><action android:name="android.intent.action.VIEW"/><category android:name="android.intent.category.DEFAULT"/><category android:name="android.intent.category.BROWSABLE"/><data android:scheme="'+appId+'" android:host="auth" android:path="/callback"/></intent-filter>';
  if(!xml.includes('android:label="PENNANT_LAB_OAUTH"')){if(xml.split('</activity>').length!==2)throw Error('OAuth activity anchor');xml=xml.replace('</activity>',filter+'\n</activity>');fs.writeFileSync(manifest,xml);}
 }
 if(fs.existsSync(plist)){
  let xml=fs.readFileSync(plist,'utf8');
  const entry='<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>pennantlab.oauth</string><key>CFBundleURLSchemes</key><array><string>'+appId+'</string></array></dict></array>';
  if(!xml.includes('pennantlab.oauth')){
   if(xml.includes('<key>CFBundleURLTypes</key>'))throw Error('Review existing URL scheme configuration before adding OAuth');
   const at=xml.lastIndexOf('</dict>');if(at<0)throw Error('plist missing dictionary');xml=xml.slice(0,at)+entry+'\n'+xml.slice(at);fs.writeFileSync(plist,xml);
  }
 }
}
