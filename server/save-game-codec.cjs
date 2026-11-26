// Format validation for save service injection. Not authoritative game simulation.
const {gunzip}=require('node:zlib'),{promisify}=require('node:util');
const {validateGameData,LIMIT}=require('../mobile/src/save-gzip-codec.cjs');
const unzip=promisify(gunzip);
function createGameSaveValidator({maxBytes=LIMIT}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>LIMIT)throw Error('invalid decoded limit');
 return async bytes=>{
  if(!Buffer.isBuffer(bytes)||bytes.length<18||bytes.length>LIMIT||bytes[0]!==31||bytes[1]!==139)return false;
  try{const raw=await unzip(bytes,{maxOutputLength:maxBytes});return validateGameData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)));}catch{return false;}
 };
}
module.exports={createGameSaveValidator};
