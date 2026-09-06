(function(){
  const pointRe=/\s*\+?\d+\s*(points?|pts?)\b/gi;
  function cleanText(){
    document.querySelectorAll('body *').forEach(el=>{
      if(el.children.length===0 && el.tagName!=='SCRIPT' && el.tagName!=='STYLE' && el.tagName!=='INPUT' && el.tagName!=='TEXTAREA'){
        const old=el.textContent||''; let t=old.replace(pointRe,'').replace(/points\b/gi,'steps');
        if(t!==old)el.textContent=t;
      }
    });
    const replacements={
      'Available steps':'Next steps',
      'The next part of the story':'The next chapter starts here',
      'Other Stories':'Stories',
      'The story so far':'Your journey so far',
      'Log a Journey Entry':'Add to Journey'
    };
    document.querySelectorAll('body *').forEach(el=>{
      if(el.children.length===0){const t=el.textContent?.trim();if(t&&replacements[t])el.textContent=replacements[t]}
    });
  }
  function enhance(){
    cleanText();
    document.querySelectorAll('.step,.step-button,.go,[data-complete],[data-do]').forEach(el=>el.classList.add('story-v6-step'));
    document.querySelectorAll('.journey,.track,.journey-track').forEach(el=>el.classList.add('story-v6-journey'));
    document.querySelectorAll('.goal,.goalHero,.goal-hero,.goal-feature').forEach(el=>el.classList.add('story-v6-goal'));
  }
  const boot=()=>{enhance();new MutationObserver(()=>enhance()).observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
