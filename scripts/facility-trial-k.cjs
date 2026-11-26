// K: controlled cost-efficiency sensitivity on the J baseline. Never modifies index.html.
const assert=require('node:assert/strict');
const pairs=[
 ['attendance*(900+18*(x.park-1))','attendance*(900+18*Math.min(14,x.park-1)+8*Math.max(0,x.park-15))'],
 ['for(let i=1;i<lv;i++)sum+=facilityCost(k,i);return sum;},0));return {staff,travel,camp,venue,admin,renewal','for(let i=1;i<lv;i++)sum+=facilityCost(k,i)*(i>=15?.5:1);return sum;},0));return {staff,travel,camp,venue,admin,renewal']
];
function replaceExactly(s,a,b){assert.equal(s.split(a).length,2,'K anchor missing or ambiguous: '+a);return s.replace(a,b);}
function applyTrialK(html){for(const [a,b] of pairs)html=replaceExactly(html,a,b);return html;}
module.exports={applyTrialK,replaceExactly};
