const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const html=fs.readFileSync('index.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/);
assert(inline,'Game script must exist');
new vm.Script(inline[1],{filename:'pennant-lab-inline.js'});
assert.match(html,/VERSION 0\.7\.0 · MANAGER/);
assert.match(html,/const VERSION = 2;/);
assert.match(html,/managerDecision\(t,'bullpen'\)/);
assert.match(html,/managerDecision\(batTeam,'bunt'\)/);
assert.match(html,/data-action="mgr-offer"/);
assert.match(html,/auto-paused-toolbar/);
assert.match(html,/injury-alert-screen/);
assert.match(html,/managers:game\.teams\.map/);

// Check manager decisions independent of the browser and saved data.
const begin=inline[1].indexOf('  const MANAGER_TACTICS=');
const end=inline[1].indexOf('  const prevEnsure07=ensureGameExtras;',begin);
assert(begin>=0&&end>begin,'Manager functions should be present');
const managerCode=inline[1].slice(begin,end);
const managerApi=vm.runInNewContext('(function(){let game={year:2027,teams:[],managerHistory:[]};\n'
  +managerCode+'\nreturn {game,makeManager,ensureManagers,managerDecision,managerDisagreement,managerDailyRelations};})()',
  {r2:n=>Math.round(n*100)/100,clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),h:s=>String(s),fmtMoney:n=>String(n)});
const first=managerApi.makeManager(2,2027,1);
assert.equal(first.id,'mgr-2-2027-1');
assert.equal(first.name,managerApi.makeManager(2,2027,1).name,'Candidate generation must be stable');
assert.notEqual(first.id,managerApi.makeManager(2,2027,2).id);
const team={id:2};
managerApi.game.teams.push(team);
managerApi.ensureManagers();
assert(team.manager,'Existing saves get an appointed manager');
assert.equal(team.gmOrders.bullpen,'auto');
const native=managerApi.managerDecision(team,'bullpen');
assert.equal(native,team.manager.tendency.bullpen);
team.gmOrders.bullpen='attack';
const attack=managerApi.managerDecision(team,'bullpen');
team.gmOrders.bullpen='safe';
const safe=managerApi.managerDecision(team,'bullpen');
assert(attack>safe,'GM direction must affect tactical choices');
assert(managerApi.managerDisagreement(team)>=0);
team.gmOrders.bullpen='auto';
const before=team.manager.discontent;
managerApi.managerDailyRelations();
assert(team.manager.discontent<=before,'No contradictory orders allows tension to subside');
console.log('PASS: HTML script syntax, v0.6 regression markers, manager creation, GM strategy and relations');