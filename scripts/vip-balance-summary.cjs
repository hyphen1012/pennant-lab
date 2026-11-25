// Paired VIP analysis of actual CI artifacts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.argv[2]||'vip-results',seeds=[1937,8821],years=50,selected=2;
function read(seed,vip){
 const d=JSON.parse(fs.readFileSync(path.join(root,'vip-'+vip+'-'+seed,'year-cycle--1.json'),'utf8'));
 assert.equal(d.years,years);assert.equal(d.rows.length,years);assert.equal(d.totalGames,years*858);assert.equal(d.reserveTopUps,0);assert(d.minCash>=0);
 const rows=d.rows.map(r=>{assert.equal(r.clubs.length,12);const c=r.clubs.find(c=>c.id===selected);assert(c&&c.levels.length===8&&c.levels.every(l=>Number.isInteger(l)&&l>=1&&l<=20));assert(Number.isFinite(r.vipIncome)&&r.vipIncome>=0);if(!vip)assert.equal(r.vipIncome,0);return {year:r.year,cash:c.cash,levels:c.levels,minimum:r.minCash,vipIncome:r.vipIncome,allClubs:r.clubs.map(x=>({id:x.id,cash:x.cash,levels:x.levels}))};});
 const milestone=n=>rows.find(r=>r.levels.every(l=>l>=n))?.year??null;
 const totalBonus=Math.round(rows.reduce((n,r)=>n+r.vipIncome,0)*100)/100;if(vip)assert(totalBonus>0);
 return {totalBonus,minCash:d.minCash,firstAll10:milestone(10),firstAll15:milestone(15),firstAll20:milestone(20),firstMaxCheckpoint:d.firstMax??null,last:rows.at(-1),rows};
}
const pairs=seeds.map(seed=>{const free=read(seed,0),vip=read(seed,1);return {seed,free,vip,cashDelta:Math.round((vip.last.cash-free.last.cash)*100)/100,levelDelta:vip.last.levels.map((x,i)=>x-free.last.levels[i])};});
const report={scope:'50 years, two seeds, simulated verified VIP only. Selected club follows delegated headless economy decisions; year-end level milestones are not proof of player progression or exact first attainment.',pairs};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/vip-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify({scope:report.scope,pairs:pairs.map(({seed,free,vip,cashDelta,levelDelta})=>({seed,free:{...free,rows:undefined},vip:{...vip,rows:undefined},cashDelta,levelDelta}))},null,2));
