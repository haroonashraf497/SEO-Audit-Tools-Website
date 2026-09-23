
(function(){
  var d=document;
  d.addEventListener('click',function(ev){
    var btn=ev.target.closest('.nav__btn');
    d.querySelectorAll('.nav__item.open').forEach(function(it){
      if(!btn||it!==btn.parentElement){it.classList.remove('open');it.querySelector('.nav__btn').setAttribute('aria-expanded','false');}
    });
    if(btn){var item=btn.parentElement;var open=item.classList.toggle('open');btn.setAttribute('aria-expanded',open?'true':'false');ev.stopPropagation();}
  });
  var burger=d.querySelector('.nav__burger');var mnav=d.getElementById('mnav');
  if(burger&&mnav){burger.addEventListener('click',function(){var o=mnav.classList.toggle('open');burger.setAttribute('aria-expanded',o?'true':'false');});}
})();
