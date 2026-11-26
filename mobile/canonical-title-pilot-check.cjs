const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{releaseSurface}=require('./release-surface.cjs'),{canonicalTitlePilot}=require('./canonical-title-pilot.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),out=canonicalTitlePilot(releaseSurface(html));
new Function(out.match(/<script>([\s\S]*?)<\/script>/)[1]);
a.ok(out.includes('Canonical staging bridge required')&&out.includes('if(canonicalPilot)return true;')&&out.includes('Legacy load unavailable in canonical mode'));
a.ok(out.includes('await canonicalPilot.create({team:t.id,identity},true)')&&out.includes('await canonicalPilot.refresh()'));
a.ok(out.includes('portalTransitScreen(ui.portalSlot,ui.portalOrigin)')&&out.includes('worldOrb(i,t,!!row)')&&out.includes('clubIdentityEditor(t,true)'));
a.ok(!out.includes('window.PennantLab=')&&!out.includes('DEVELOPMENT · SCENARIO LAB'));
a.throws(()=>canonicalTitlePilot(html.replace('  function save(){','  function saveChanged(){')));
console.log('PASS canonical staging title source anchors, compile, original visual components and legacy-write fence');
