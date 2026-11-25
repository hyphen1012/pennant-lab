// Production packaging boundary. Dev Pages and native debug retain all scenarios.
// Not a tamper-proof security boundary: paid rights still require a trusted server.
function releaseSurface(html){
 const swap=(a,b)=>{if(html.split(a).length!==2)throw Error('release anchor changed: '+a.slice(0,80));html=html.replace(a,()=>b);};
 swap('<button class="btn outline full" data-action="rare-preview-open">特殊選手の演出確認モード ›</button>','');
 swap('<br>v0.3以前のテストセーブは引き継がれません。','');
 const lab=html.match(/^  titleScreen=function\(\)\{return labTitleBase\(\).*?\};$/m);
 if(!lab||!lab[0].includes('DEVELOPMENT · SCENARIO LAB'))throw Error('scenario menu anchor');
 swap(lab[0],'  titleScreen=function(){return labTitleBase();};');
 swap("  function scenarioStart(kind){","  function scenarioStart(kind){return false; // disabled in production\n");
 swap("    if(ui.page==='title'&&(ui.rarePreview||action==='rare-preview-open')){","    if(action.startsWith('rare-preview-')){e.preventDefault();e.stopImmediatePropagation();return;}\n    if(ui.page==='title'&&(ui.rarePreview||action==='rare-preview-open')){");
 swap("${mode==='feats'?achievementPreview():''}","");
 const debug=html.match(/^  window\.PennantLab=\{.*?\};$/m);if(!debug)throw Error('debug inspection anchor');swap(debug[0],'');
 return html;
}
module.exports={releaseSurface};
