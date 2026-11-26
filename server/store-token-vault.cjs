// Encrypt opaque Google tokens inside the existing purchase database. The
// separately stored 32-byte key is required for backup recovery; never log it.
const {createHash,randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
function createTokenVault({db,key}={}){
 if(!db||!Buffer.isBuffer(key)||key.length!==32)throw Error('32-byte store token key required');
 db.exec('CREATE TABLE IF NOT EXISTS google_tokens(chain TEXT PRIMARY KEY,account TEXT NOT NULL,nonce BLOB NOT NULL,tag BLOB NOT NULL,cipher BLOB NOT NULL)');
 const get=db.prepare('SELECT * FROM google_tokens WHERE chain=?'),add=db.prepare('INSERT INTO google_tokens VALUES(?,?,?,?,?)');
 const valid=(chain,account)=>/^[a-f0-9]{64}$/.test(chain||'')&&/^[a-f0-9]{64}$/.test(account||'');
 const aad=(chain,account)=>Buffer.from(JSON.stringify([chain,account]));
 function read(chain,account){if(!valid(chain,account))throw Error('invalid token key');const r=get.get(chain);if(!r)return null;if(r.account!==account)throw Error('token binding conflict');
  const d=createDecipheriv('aes-256-gcm',key,r.nonce);d.setAAD(aad(chain,account));d.setAuthTag(r.tag);const token=Buffer.concat([d.update(r.cipher),d.final()]).toString('utf8');if(createHash('sha256').update(token).digest('hex')!==chain)throw Error('token integrity failure');return token;
 }
 function put(chain,account,token){
  if(!valid(chain,account)||typeof token!=='string'||token.length>2048||createHash('sha256').update(token).digest('hex')!==chain)throw Error('invalid token');
  const old=read(chain,account);if(old!==null){if(old!==token)throw Error('token conflict');return;}
  const nonce=randomBytes(12),c=createCipheriv('aes-256-gcm',key,nonce);c.setAAD(aad(chain,account));const cipher=Buffer.concat([c.update(token,'utf8'),c.final()]);add.run(chain,account,nonce,c.getAuthTag(),cipher);
 }
 return {get:read,put};
}
module.exports={createTokenVault};
