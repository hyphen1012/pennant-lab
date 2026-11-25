// Desktop headless browser with mobile viewports: NOT a physical-device audit.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const base=process.env.PL_AUDIT_URL||'http://127.0.0.1:8765/';
const categories=['PARALLEL','STAR','LEGEND','IMMORTAL','再来','転生','輪廻転生','異界転生','星煌転生','伝説転生'];
const cases=['fa','reply','camp','facilities','sponsor','commerce','opening-promo'];
const tabs=['team','roster','hq','business','records'];
const business=['finance','stadium','facilities','market','scout','foreign','manager','care','staff','club'];
(async()=>{
 const browser=await chromium.launch({headless:true});const rows=[],errors=[];
 fs.mkdirSync('test-results/browser',{recursive:true});
 try{for(const width of [320,360,430]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:width===320?'reduce':'no-preference'});
  let current='startup';page.on('pageerror',e=>errors.push({width,screen:current,error:e.message}));
  const click=async selector=>{const b=page.locator(selector).first();await b.click({timeout:8000});await page.waitForTimeout(180);};
  const shot=async name=>{current=name;await page.waitForTimeout(100);const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.querySelector('#app')?.innerText?.length||0,smallControls:[...document.querySelectorAll('#app button:not([disabled])')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<24||r.height<24)}).map(e=>({action:e.dataset.action||'',label:e.innerText.slice(0,50)}))}));rows.push({width,name,...metrics});await page.screenshot({path:path.join('test-results/browser',width+'-'+name+'.png')});if(!metrics.text||metrics.scroll>metrics.width+2)errors.push({width,screen:name,error:'blank or document horizontal overflow '+JSON.stringify(metrics)});};
  const action=(a,v)=>'[data-action="'+a+'"]'+(v===undefined?'':'[data-value="'+v+'"]');
  const dayTo=async(a,v)=>{const target=page.locator(action(a,v)).first();for(let i=0;i<40&&!(await target.isVisible());i++){await click(action('flow-day'));await page.waitForTimeout(1250);}await target.waitFor({state:'visible',timeout:5000});};
  const title=async()=>{await page.goto(base);await page.locator('[data-action="rare-preview-open"]').waitFor({timeout:20000});};
  try{
   await title();await shot('title');await click('[data-action="rare-preview-open"]');await shot('rare-gallery');
   for(let i=0;i<categories.length;i++){
    current='rare-'+i;await click('[data-action="rare-preview-category"][data-value="'+categories[i]+'"]');
    await click('[data-action="rare-preview-start"]');await shot('rare-'+i);
    // Reopen the preview through the title for an isolated replay.
    await title();await click('[data-action="rare-preview-open"]');
   }
   for(const k of cases){
    current='scenario-'+k;await title();await click('[data-action="scenario-start"][data-value="'+k+'"]');await shot('scenario-'+k);
    if(k==='commerce'){
     await dayTo('commerce-open','fan-fest');await click(action('commerce-open','fan-fest'));await shot('fest-brief');
     await click(action('commerce-start'));await shot('fest-selection');await click(action('commerce-plan',2));await click(action('commerce-confirm'));await shot('fest-booking');
     await click(action('commerce-schedule-finish'));await dayTo('commerce-open','fan-fest');await click(action('commerce-open','fan-fest'));await shot('fest-live');
     await click(action('commerce-live-finish'));await shot('fest-result');await click(action('commerce-finish'));
     await dayTo('commerce-open','fanclub');await click(action('commerce-open','fanclub'));await click(action('commerce-start'));await shot('fanclub-selection');
     await page.locator('#commerce-fan-name').fill('PENNANT AUDIT');await click(action('commerce-fee',500));await click(action('commerce-perk','uniform'));await shot('fanclub-preview');
     await click(action('commerce-confirm'));await shot('fanclub-result');await click(action('commerce-finish'));
     await click(action('commerce-open','tv'));await click(action('commerce-start'));await shot('tv-selection');
     const guests=await page.locator(action('commerce-player')).evaluateAll(els=>els.slice(0,5).map(e=>e.dataset.value));
     if(guests.length!==5)throw Error('five TV guests required');for(const id of guests)await click(action('commerce-player',id));
     await click(action('commerce-confirm'));await shot('tv-booking');await click(action('commerce-schedule-finish'));
     await dayTo('commerce-open','tv');await click(action('commerce-open','tv'));await shot('tv-live');await click(action('commerce-tv-finish'));await shot('tv-result');await click(action('commerce-finish'));
     await dayTo('sponsor-open');await click(action('sponsor-open'));await click(action('sponsor-start'));await shot('sponsor-selection');await click(action('sponsor-confirm'));await shot('sponsor-result');await click(action('sponsor-finish'));
     await click(action('commerce-open','broadcast'));await click(action('commerce-start'));await click(action('commerce-delta',3));await shot('broadcast-negotiation');await click(action('commerce-confirm'));await shot('broadcast-result');await click(action('commerce-finish'));
     await click(action('commerce-open','naming'));await click(action('commerce-start'));await shot('naming-selection');await click(action('commerce-confirm'));await shot('naming-result');await click(action('commerce-finish'));
    }
    if(k==='opening-promo'){
     await dayTo('commerce-open','opening-promo');await click(action('commerce-open','opening-promo'));await click(action('commerce-start'));
     for(let i=0;i<3;i++){await click(action('commerce-plan',i));await shot('opening-promo-plan-'+i);}
     await click(action('commerce-confirm'));await shot('opening-promo-result');await click(action('commerce-finish'));
    }
    if(k==='facilities'){
     for(const t of tabs){current='tab-'+t;await click('[data-action="tab"][data-tab="'+t+'"]');await shot('tab-'+t);}
     await click('[data-action="tab"][data-tab="business"]');
     for(const t of business){current='business-'+t;await click('[data-action="business-sub"][data-sub="'+t+'"]');await shot('business-'+t);}
    }
   }
  }catch(e){errors.push({width,screen:current,error:e.message});}
  await page.close();
 }}finally{await browser.close();fs.writeFileSync('test-results/browser/report.json',JSON.stringify({scope:'Headless Chromium, not physical devices; screenshots do not prove artistic quality',rows,errors},null,2));}
 console.log(JSON.stringify({screens:rows.length,errors},null,2));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
