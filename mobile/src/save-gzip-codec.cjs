// Wire format: gzip of UTF-8 JSON, compatible with pl-gzip-json-v1 records.
// Structural validation is not proof of paid rights, rewards or achievements.
const LIMIT=256*1024*1024;
function validateGameData(d){
 if(!d||d.v!==2||!Number.isSafeInteger(d.year)||d.year<2027||!Number.isInteger(d.day)||d.day<0||d.day>143||!Array.isArray(d.teams)||d.teams.length!==12||!Array.isArray(d.players)||!Array.isArray(d.schedule)||d.schedule.length!==143||!Number.isInteger(d.selectedId)||d.selectedId<0||d.selectedId>11)return false;
 if(new Set(d.teams.map(t=>t?.id)).size!==12||d.teams.some(t=>!t||!Number.isInteger(t.id)||t.id<0||t.id>11||!Number.isFinite(t.cash)||typeof t.name!=='string'))return false;
 const ids=new Set();
 for(const p of d.players){if(!p||!Number.isSafeInteger(p.id)||p.id<1||ids.has(p.id))return false;ids.add(p.id);}
 return d.schedule.every(day=>Array.isArray(day));
}
async function decodeGzip(bytes,{maxBytes=LIMIT}={}){
 if(!(bytes instanceof Uint8Array)||bytes.length<18||bytes.length>LIMIT||bytes[0]!==31||bytes[1]!==139||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>LIMIT)throw Error('invalid gzip');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const decoder=new TextDecoder('utf-8',{fatal:true});let n=0;const parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>maxBytes)throw Error('decoded save exceeds limit');parts.push(decoder.decode(value,{stream:true}));}parts.push(decoder.decode());}
 catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const data=JSON.parse(parts.join(''));
 if(!validateGameData(data))throw Error('incompatible game save');
 return data;
}
async function toGameRecord(bytes,options){
 await decodeGzip(bytes,options);
 return {encoding:'pl-gzip-json-v1',bytes:new Blob([bytes],{type:'application/gzip'})};
}
module.exports={validateGameData,decodeGzip,toGameRecord,LIMIT};
