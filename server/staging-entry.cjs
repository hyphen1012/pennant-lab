// Start a deliberately non-paying staging server with real token introspection.
// No provider SDK keys or fake purchase/ad authority. Private loopback ingress.
const path=require('node:path'),{createTokenAuthenticator,createRecentReauthVerifier}=require('./auth-introspection.cjs'),{createServiceRuntime}=require('./service-runtime.cjs');
const env=process.env,need=k=>{const v=env[k];if(!v)throw Error('missing '+k);return v;};
if(env.PL_ENV!=='staging')throw Error('Only explicit staging service is supported');
const secretFile=need('PL_AUTH_CLIENT_SECRET_FILE');
const fs=require('node:fs'),clientSecret=fs.readFileSync(secretFile,'utf8').trim();
const authenticate=createTokenAuthenticator({endpoint:need('PL_AUTH_INTROSPECTION_URL'),issuer:need('PL_AUTH_ISSUER'),audience:need('PL_AUTH_AUDIENCE'),clientId:need('PL_AUTH_CLIENT_ID'),clientSecret,scope:need('PL_AUTH_SCOPE')});
const units=JSON.parse(need('PL_AD_UNITS_JSON')),origins=JSON.parse(need('PL_ALLOWED_ORIGINS_JSON'));
const deny=async()=>null;
const runtime=createServiceRuntime({dataDir:need('PL_DATA_DIR'),authenticate,verifyRecentReauth:env.PL_REAUTH_ENABLED==='1'?createRecentReauthVerifier({authenticate}):deny,verifyReceipt:deny,verifyCurrent:deny,verifyNotification:deny,verifyEvent:deny,verifyAction:deny,verifyCompletion:deny,units,origins});
const port=Number(env.PL_PORT||8787);if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('invalid port');
runtime.server.listen(port,'127.0.0.1',()=>console.log('PENNANT LAB staging loopback ready'));
runtime.server.on('error',()=>{console.error('Staging listener failed');process.exitCode=1;void runtime.close();});
let stopping=false;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{if(stopping)return;stopping=true;void runtime.close().catch(()=>{process.exitCode=1;});});
