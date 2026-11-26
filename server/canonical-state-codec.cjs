// Versioned server-only canonical world storage. Legacy JSON rows remain
// readable. The payload is never taken from a cloud save or client request.
const {gzipSync,gunzipSync}=require('node:zlib'),{createHash}=require('node:crypto');
const RAW_LIMIT=256*1024*1024,ZIP_LIMIT=64*1024*1024,SMALL_LIMIT=256*1024;
const sha=b=>createHash('sha256').update(b).digest('hex');
function createCanonicalStateCodec({rawLimit=RAW_LIMIT,zipLimit=ZIP_LIMIT,smallLimit=SMALL_LIMIT}={}){
 if(!Number.isSafeInteger(rawLimit)||rawLimit<1||rawLimit>RAW_LIMIT||!Number.isSafeInteger(zipLimit)||zipLimit<1||zipLimit>ZIP_LIMIT||!Number.isSafeInteger(smallLimit)||smallLimit<0||smallLimit>rawLimit)throw Error('invalid canonical storage bounds');
 function validate(v){if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)throw Error('invalid canonical world object');return v;}
 function encode(state){
  validate(state);
  const text=JSON.stringify(state),raw=Buffer.from(text,'utf8');
  if(raw.length>rawLimit)throw Error('canonical raw state exceeds limit');
  if(raw.length<=smallLimit)return text;
  const zip=gzipSync(raw,{level:3});if(zip.length>zipLimit)throw Error('canonical compressed state exceeds limit');
  return 'pl-gzip-v1:'+raw.length+':'+sha(raw)+':'+zip.toString('base64');
 }
 function decode(value){
  if(typeof value!=='string')throw Error('invalid canonical stored state');
  if(!value.startsWith('pl-gzip-v1:')){
   if(Buffer.byteLength(value)>rawLimit)throw Error('canonical legacy state exceeds limit');
   return validate(JSON.parse(value));
  }
  const m=/^pl-gzip-v1:([1-9][0-9]{0,8}):([a-f0-9]{64}):([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!m||Number(m[1])>rawLimit||m[3].length>Math.ceil(zipLimit/3)*4)throw Error('invalid canonical compressed state');
  const zipped=Buffer.from(m[3],'base64');
  if(zipped.length>zipLimit||zipped.toString('base64')!==m[3])throw Error('invalid canonical compression encoding');
  const raw=gunzipSync(zipped,{maxOutputLength:Math.min(rawLimit,Number(m[1]))});
  if(raw.length!==Number(m[1])||sha(raw)!==m[2])throw Error('canonical state integrity failure');
  return validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));
 }
 return {encode,decode};
}
module.exports={createCanonicalStateCodec,RAW_LIMIT,ZIP_LIMIT};
