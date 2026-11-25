const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),{releaseSurface}=require('./release-surface.cjs');
const src=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),out=releaseSurface(src);
a(src.includes('DEVELOPMENT · SCENARIO LAB')&&src.includes('window.PennantLab='));
a(!out.includes('DEVELOPMENT · SCENARIO LAB')&&!out.includes('window.PennantLab=')&&!out.includes('data-action="rare-preview-open"'));
a(out.includes('function scenarioStart(kind){return false;')&&out.includes("if(action.startsWith('rare-preview-'))"));
a(out.includes('data-memorial-filter')&&out.includes('VIP GM LOUNGE')&&out.includes('data-action="new-slot"')===src.includes('data-action="new-slot"'));
a.throws(()=>releaseSurface(src.replace('data-action="rare-preview-open"','data-action="new-preview"')));
new Function(out.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log('PASS production surface: debug tools disabled, development source untouched');
