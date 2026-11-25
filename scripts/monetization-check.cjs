const a=require('node:assert/strict'),p=require('../shared/monetization.cjs');
const s=p.newAccount(),free={verified:true,vip:false,adSkip:false},vip={verified:true,vip:true,adSkip:true},owner={verified:true,adSkip:true};
const claim=(eventId,now,entitlements=free,choice='ticket')=>p.claim(s,{eventId,now,entitlements,choice});
a.equal(claim('a',100).kind,'ticket');a.equal(claim('b',100).kind,'ticket');a.equal(claim('c',100,owner).kind,'point');a.equal(claim('d',101).reason,'cooldown');a.equal(claim('a',102).reason,'duplicate');
a.equal(claim('d',100+p.HOUR,vip).amount,2);a.equal(s.points,3);a.equal(s.tickets,2);a.equal(p.exchange(s,'frame'),true);a.equal(p.exchange(s,'frame'),false);
a.throws(()=>claim('e',0));a.equal(claim('e',100+10*p.HOUR).ok,true);a.equal(claim('f',100+10*p.HOUR).reason,'cooldown');
a.equal(p.reserve(s,'op1',free,'ticket').mode,'ticket');a.equal(p.reserve(s,'op1',free,'ticket').mode,'ticket');a.equal(p.finish(s,'op1',true),true);a.equal(p.finish(s,'op1',true),true);a.equal(s.tickets,2);p.reserve(s,'op2',free,'ticket');p.finish(s,'op2',false);a.equal(s.tickets,2);a.equal(p.reserve(s,'op3',vip,'ticket').mode,'entitlement');p.finish(s,'op3',true);a.equal(s.tickets,2);a.equal(p.reserve(s,'ad',free,'ad').mode,'ad');
const cap=p.newAccount();cap.tickets=30;a.equal(p.claim(cap,{eventId:'cap',now:10,entitlements:free}).reason,'capacity');a.equal(cap.claimCount,0);a.equal(p.claim(cap,{eventId:'cap',now:10,entitlements:free,choice:'point'}).ok,true);
for(const k of ['ticket','goods','fanclub','sponsor','broadcast','food','prize']){a.equal(p.vipBonus(k,100000000,vip),20000000);a.equal(p.vipBonus(k,100000000,free),0);}
for(const k of ['transfer','posting','playerSale','insurance','investment','unknown'])a.equal(p.vipBonus(k,100000000,vip),0);
a.equal(p.vipBonus('ticket',100000000,{vip:true}),0);
const q={};a.equal(p.promptDecision(q,'1','special'),false);a.equal(p.promptDecision(q,'2','special'),false);a.equal(p.promptDecision(q,'3','special'),true);a.equal(p.promptDecision(q,'3','special'),false);a.equal(p.promptDecision(q,'4','top'),true);a.equal(p.promptDecision(q,'5','unmeasurable',false),false);
console.log('PASS memorial reward timing, idempotency, reservation, cap, point exchange, entitlement priority, VIP scope, prompt cadence');