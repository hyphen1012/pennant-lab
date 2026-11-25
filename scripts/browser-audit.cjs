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
 try{for(const width of [360,430]){
  const page=await browser.newPage({viewport:{width,height:850},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  let current='startup';page.on('pageerror',e=>errors.push({width,screen:current,error:e.message}));
  const click=async selector=>{const b=page.locator(selector).first();await b.click({timeout:8000});await page.waitForTimeout(180);};
  const shot=async name=>{current=name;await page.waitForTimeout(100);const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,text:document.querySelector('#app')?.innerText?.length||0}));rows.push({width,name,...metrics});await page.screenshot({path:path.join('test-results/browser',width+'-'+name+'.png')});if(!metrics.text||metrics.scroll>metrics.width+2)errors.push({width,screen:name,error:'blank or document horizontal overflow '+JSON.stringify(metrics)});};
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
    if(k==='facilities'){
     for(const t of tabs){current='tab-'+t;await click('[data-action="tab"][data-tab="'+t+'"]');await shot('tab-'+t);}
     await click('[data-action="tab"][data-tab="business"]');
     for(const t of business){current='business-'+t;await click('[data-action="business-sub"][data-sub="'+t+'"]');await shot('business-'+t);}
    }
   }
  }catch(e){errors.push({width,screen:current,error:e.message});}
  await page.close();
 }}finally{await browser.close();fs.writeFileSync('test-results/browser/report.json',JSON.stringify({rows,errors},null,2));}
 console.log(JSON.stringify({screens:rows.length,errors},null,2));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
