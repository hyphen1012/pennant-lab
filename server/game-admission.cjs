// Bounded admission, not a worker pool. Never queue or replay mutations here.
const {performance}=require('node:perf_hooks');
function createGameAdmission({heavyLimit=4,metadataLimit=4,now=()=>performance.now(),rssLimitBytes=null,readRss=()=>process.memoryUsage.rss()}={}){
 if([heavyLimit,metadataLimit].some(n=>!Number.isSafeInteger(n)||n<1||n>64)||typeof now!=='function')throw Error('invalid game admission limits');
 if(rssLimitBytes!==null&&(!Number.isSafeInteger(rssLimitBytes)||rssLimitBytes<1)||typeof readRss!=='function')throw Error('invalid RSS admission policy');
 const memory={rejected:0,lastRssBytes:null,rssLimitBytes};
 const lanes={heavy:{limit:heavyLimit,active:0,peak:0,accepted:0,rejected:0,completed:0,failed:0,totalMs:0,maxMs:0},metadata:{limit:metadataLimit,active:0,peak:0,accepted:0,rejected:0,completed:0,failed:0,totalMs:0,maxMs:0}};
 function enter(kind){
  if(!Object.hasOwn(lanes,kind))throw Error('invalid game admission lane');
  const s=lanes[kind];if(s.active>=s.limit){s.rejected++;return null;}
  if(kind==='heavy'&&rssLimitBytes!==null){
   let rss;try{rss=readRss();}catch{rss=null;}
   memory.lastRssBytes=Number.isSafeInteger(rss)&&rss>0?rss:null;
   if(memory.lastRssBytes===null||rss>=rssLimitBytes){memory.rejected++;s.rejected++;return null;}
  }
  const start=now();s.active++;s.accepted++;s.peak=Math.max(s.peak,s.active);let done=false;
  return function release(success=false){if(done)return;done=true;s.active--;s.completed++;if(!success)s.failed++;const ms=Math.max(0,now()-start);if(Number.isFinite(ms)){s.totalMs+=ms;s.maxMs=Math.max(s.maxMs,ms);}};
 }
 return {enter,metrics:()=>({...Object.fromEntries(Object.entries(lanes).map(([k,v])=>[k,{...v,meanMs:v.completed?v.totalMs/v.completed:0}])),memory:{...memory}})};
}
module.exports={createGameAdmission};
