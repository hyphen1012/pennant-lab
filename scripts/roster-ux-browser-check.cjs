// Focused mobile browser regression for v190. Fixture access only in this
// intercepted test document, never the shipping HTML. Real UI and save queue.
const fs=require('node:fs'),a=require('node:assert/strict'),{chromium}=require('playwright');
const base='http://127.0.0.1:8765/',marker="  const appRoot=document.querySelector('#app');";
const source=fs.readFileSync('index.html','utf8');a.equal(source.split(marker).length,2);
const fixture=String.raw`
window.__rosterAudit={
 snapshot:()=>({lineup:myTeam().lineup.slice(),roles:{...myTeam().fieldingRoles},year:game.year,day:game.day,cash:myTeam().cash}),
 persisted:async()=>{await saveQueue;const d=await readDatabaseSlot(activeSlot),t=d.teams.find(x=>x.id===d.selectedId);return {lineup:t.lineup,roles:t.fieldingRoles,year:d.year,day:d.day,cash:t.cash};},
 colors:()=>{const t=myTeam(),p=getPlayer(t.lineup[0]),q=firstHitters(t).find(x=>!t.lineup.includes(x.id)&&availableForGame(x));if(!q)throw Error('missing bench');p.specialCategory='PARALLEL';q.specialCategory='LEGEND';render();return {starter:p.id,bench:q.id,starterName:p.name,benchName:q.name};},
 seed:()=>{game.pendingCeremonyIntro=null;game.ceremonyStage=null;game.pendingReview=null;game.pendingMonth=null;game.pendingEvent=null;game.reportIntroPending=false;game.calendarFlow=null;game.offseasonDesk=null;ui.page='game';ui.tab='roster';ui.rosterMode='lineup';repairTeam(myTeam());save();render();},
 rest:()=>[reportCampVisit({}, {first:'club'}),reportCampVisit({visit:'rest',visitPending:true},{first:'club'})],
 facility:()=>{const t=myTeam();ui.tab='business';ui.businessSub='facilities';render();openCampusDetail(t,'training',null);},
 photos:()=>!!photoSource('training',campusTier(infraLevel(myTeam(),'training'))),
 stadium:()=>{ui.tab='business';ui.businessSub='stadium';stadiumVisualEffect={team:game.selectedId,key:'park',from:1,to:2,oldPark:1};render();}
};
`;
(async()=>{const browser=await chromium.launch({headless:true});fs.mkdirSync('test-results/roster-ux',{recursive:true});
try{for(const width of [320,390,430]){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route(base,route=>route.fulfill({contentType:'text/html',body:source.replace(marker,fixture+'\n'+marker)}));
 await page.route('**/*.mp4',route=>route.abort());
 await page.goto(base);
 const click=async sel=>{await page.locator(sel).first().click({timeout:12000});};
 const act=(name,attr='',value='')=>'[data-action="'+name+'"]'+(attr?'[data-'+attr+'="'+value+'"]':'');
 await page.waitForFunction(()=>!document.body.classList.contains('official-startup-active'));
 await click(act('launch-start'));
 await click(act('new-slot','slot','1'));
 await click(act('finish-setup'));
 await click(act('report-intro-skip'));
 await page.evaluate(()=>window.__rosterAudit.seed());
 const state=()=>page.evaluate(()=>window.__rosterAudit.snapshot());
 const special=await page.evaluate(()=>window.__rosterAudit.colors());
 const verifyColors=async(selector)=>{const values=await page.locator(selector).evaluateAll(es=>es.map(e=>({rank:e.dataset.rank,color:getComputedStyle(e).color,gradient:getComputedStyle(e).backgroundImage})));a.ok(values.length>0);const palette={S:'rgb(241, 197, 75)',A:'rgb(245, 177, 184)',B:'rgb(232, 80, 98)',C:'rgb(232, 170, 63)',D:'rgb(161, 207, 71)',E:'rgb(67, 200, 107)',F:'rgb(65, 182, 230)'};for(const v of values){if(v.rank==='SS'||v.rank==='S+')a.match(v.gradient,/linear-gradient/);else a.equal(v.color,palette[v.rank]);}};
 const verifyName=async(selector,category)=>{const e=page.locator(selector+' .order-name[data-special="'+category+'"]').first();await e.waitFor();a.match(await e.evaluate(el=>getComputedStyle(el).backgroundImage),/linear-gradient/);};
 const before=await state();
 a.equal(await page.locator('.order-node').count(),9);await verifyColors('.order-node .order-grade');await verifyName('.order-node','PARALLEL');
 const bounds=await page.locator('.order-field').evaluate(e=>{const f=e.getBoundingClientRect();const rs=[...e.querySelectorAll('.order-node')].map(b=>{const r=b.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:r.width,h:r.height,role:b.dataset.role};});return {outside:rs.filter(r=>r.left<f.left-1||r.right>f.right+1||r.top<f.top-1||r.bottom>f.bottom+1||r.w<44||r.h<44),overlap:rs.flatMap((r,i)=>rs.slice(i+1).filter(q=>r.left<q.right-1&&r.right>q.left+1&&r.top<q.bottom-1&&r.bottom>q.top+1).map(q=>[r.role,q.role]))};});
 a.deepEqual(bounds,{outside:[],overlap:[]});await page.screenshot({path:'test-results/roster-ux/'+width+'-field.png'});
 await click(act('order190-auto'));const auto=await state();a.equal(auto.lineup.length,9);a.equal(new Set(auto.lineup).size,9);a.equal(new Set(Object.values(auto.roles)).size,9);a.equal(auto.cash,before.cash);a.equal(auto.day,before.day);
 await click(act('order190-undo'));a.deepEqual(await state(),before);
 await click(act('order190-mode','mode','order'));await verifyColors('.order-row .order-grade');await verifyName('.order-row','PARALLEL');await click(act('order190-order','index','0'));await click(act('order190-order','index','1'));
 const swapped=await state();a.equal(swapped.lineup[0],before.lineup[1]);a.equal(swapped.lineup[1],before.lineup[0]);a.deepEqual(swapped.roles,before.roles);
 await click(act('order190-order-mode','mode','move'));await click(act('order190-order','index','0'));await click(act('order190-order','index','3'));
 const moved=await state();a.deepEqual(moved.lineup.slice(0,4),[...swapped.lineup.slice(1,4),swapped.lineup[0]]);a.deepEqual(moved.roles,swapped.roles);a.deepEqual(await page.evaluate(()=>window.__rosterAudit.persisted()),moved);await page.screenshot({path:'test-results/roster-ux/'+width+'-order.png'});
 await click(act('order190-mode','mode','field'));await click(act('order190-role','role','DH'));
 await verifyColors('.order-candidate .order-grade');await verifyName('.order-candidate','LEGEND');
 const candidates=page.locator('.order-candidate:not([disabled])');a.ok(await candidates.count()>0);
 const id=Number(await candidates.first().getAttribute('data-id'));await candidates.first().click();const replaced=await state();a.equal(replaced.roles[id],'DH');a.equal(new Set(replaced.lineup).size,replaced.lineup.length);a.deepEqual(await page.evaluate(()=>window.__rosterAudit.persisted()),replaced);
 await click(act('order190-undo'));a.deepEqual(await state(),moved);
 const rest=await page.evaluate(()=>window.__rosterAudit.rest());a.ok(rest.every(x=>x.includes('camp-rest.svg')&&x.includes('休養に充てる')));const art=await page.request.get(base+'assets/scenes/camp-rest.svg');a.equal(art.status(),200);
 await page.waitForFunction(()=>window.__rosterAudit.photos());await page.evaluate(()=>window.__rosterAudit.facility());
 const image=page.locator('.campus-detail-dialog .facility-detail-photo');await image.waitFor();await image.evaluate(e=>e.decode());
 const im=await image.evaluate(e=>({fit:getComputedStyle(e).objectFit,padding:getComputedStyle(e).padding,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}));a.equal(im.fit,'cover');a.equal(im.padding,'0px');a.ok(Math.abs(im.w/im.h-4/3)<.08);
 await page.screenshot({path:'test-results/roster-ux/'+width+'-facility.png'});await page.locator('[data-campus-detail-close]').click();
 await page.evaluate(()=>window.__rosterAudit.stadium());const banner=page.locator('.pl-upgrade-banner');await banner.waitFor();
 a.equal(await page.locator('.stadium-map .pl-upgrade-banner').count(),0);const separate=await banner.evaluate(e=>e.getBoundingClientRect().bottom<=document.querySelector('.stadium-map').getBoundingClientRect().top+1);a.ok(separate);
 a.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));a.deepEqual(errors,[]);console.log('PASS roster UX, persistence and visual bounds',width);await page.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
