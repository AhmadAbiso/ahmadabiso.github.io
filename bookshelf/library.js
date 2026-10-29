(() => {
  'use strict';
  const books = Array.isArray(window.LIBRARY_BOOKS) ? window.LIBRARY_BOOKS : [];
  const $ = id => document.getElementById(id);
  const rail = $('rail'), track = $('track'), dialog = $('book-dialog'), tooltip = $('hover-card');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = books.slice(), genre = 'all', segmentWidth = 0, loop = false, selected = -1;
  let focusBeforeOpen = null, returnTransform = '', closing = false, drag = null, dragged = false, frame = 0, leaveTimer;
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g,'ا').toLowerCase();
  const searchText = b => normalize([b.title,b.originalTitle,b.author,b.blurb,b.personalNote,...b.genres,...b.years].join(' '));
  const searchIndex = new Map(books.map(b => [b.id,searchText(b)]));
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function setBookStyle(node, book) {
    const vars = {w:book.width+'px',h:book.height+'px',spine:book.spine,band:book.band,'ink-book':book.ink,lean:book.lean+'deg',depth:book.depth+'px',wear:book.wear,'book-font':book.face==='sans'?'var(--body)':book.face==='mono'?'var(--mono)':'var(--serif)','title-size':(book.width>38?16:14)+'px'};
    Object.entries(vars).forEach(([key,value])=>node.style.setProperty('--'+key,value));
  }
  function fallback(book) {
    const box = element('span','cover-fallback');
    const title = element('strong','',book.title); title.dir='auto';
    const author = element('small','',book.author || ''); author.dir='auto';
    box.append(title,author,element('em','','Cover unavailable'));
    return box;
  }
  function cover(book, lazy=true) {
    if (!book.cover) return fallback(book);
    const img = element('img');
    img.src=book.cover; img.alt='Cover of '+book.title; img.decoding='async';
    img.loading=lazy?'lazy':'eager';
    img.addEventListener('error',()=>img.replaceWith(fallback(book)),{once:true});
    return img;
  }
  function bookButton(book,index) {
    const button = element('button','book-slot finish-'+book.finish);
    button.type='button'; button.dataset.index=index; button.dataset.id=book.id;
    button.setAttribute('aria-label',book.title+(book.author?', by '+book.author:'')+'. '+book.status+' '+book.years.join(', ')+'. Open book.');
    button.setAttribute('aria-haspopup','dialog'); setBookStyle(button,book);
    const model=element('span','book-model'); model.setAttribute('aria-hidden','true');
    const spine=element('span','book-spine');
    if(book.cover){const wrap=element('span','spine-wrap');wrap.style.backgroundImage='url("'+book.cover+'")';spine.append(wrap);}
    spine.append(element('span','spine-settle'),element('span','spine-rule'),element('span','spine-rule bottom'));
    const title=element('span','spine-title'+(book.script==='arabic'?' rtl':''),book.title); spine.append(title);
    if(book.width>=44 && book.script!=='arabic')spine.append(element('span','spine-author',book.author));
    if(book.width>=30)spine.append(element('span','publisher-dot'));
    spine.append(element('span','spine-material'),element('span','spine-wear'));
    const face=element('span','book-face');face.append(cover(book));
    model.append(spine,face,element('span','book-pages'));button.append(model);
    return button;
  }
  function updatePerspective() {
    frame=0;
    const bounds=rail.getBoundingClientRect(), center=bounds.left+bounds.width/2;
    track.querySelectorAll('.book-slot').forEach(button=>{
      const r=button.getBoundingClientRect();
      if(r.right<bounds.left-240 || r.left>bounds.right+240)return;
      const t=Math.max(-1,Math.min(1,((r.left+r.width/2)-center)/(bounds.width/2)));
      button.style.setProperty('--ry',(Math.sign(t)*Math.pow(Math.abs(t),1.35)*34).toFixed(2)+'deg');
    });
  }
  function schedulePerspective(){if(!frame)frame=requestAnimationFrame(updatePerspective);}
  function hideTooltip(){clearTimeout(leaveTimer);tooltip.hidden=true;}
  function showTooltip(button){
    if(dialog.open||dragged||window.innerWidth<721)return;
    clearTimeout(leaveTimer);
    const b=visible[Number(button.dataset.index)]; if(!b)return;
    const r=button.getBoundingClientRect();
    tooltip.querySelector('h2').textContent=b.title;
    tooltip.querySelector('p').textContent=b.author || 'Author not recorded';
    tooltip.querySelector('span').textContent=b.years.join(' · ')+' · '+b.genres.join(' / ');
    tooltip.style.left=Math.max(135,Math.min(window.innerWidth-135,r.left+r.width/2))+'px';
    tooltip.style.top=Math.max(170,r.top-38)+'px'; tooltip.hidden=false;
  }
  function renderShelf(){
    hideTooltip();track.replaceChildren();rail.scrollLeft=0;segmentWidth=0;loop=false;
    const hasBooks=visible.length>0;
    rail.hidden=!hasBooks;document.querySelector('.shelf-ground').hidden=!hasBooks;
    $('empty').hidden=hasBooks;
    $('result-count').textContent=visible.length+' '+(visible.length===1?'book':'books');
    $('browse-prev').disabled=!hasBooks;$('browse-next').disabled=!hasBooks;
    if(!hasBooks)return;
    const segment=element('div','shelf-segment');segment.dataset.primary='true';
    visible.forEach((book,index)=>segment.append(bookButton(book,index)));
    track.append(segment);segmentWidth=segment.getBoundingClientRect().width;
    loop=segmentWidth>2600;
    if(loop){
      const left=segment.cloneNode(true),right=segment.cloneNode(true);
      [left,right].forEach(clone=>{delete clone.dataset.primary;clone.setAttribute('aria-hidden','true');clone.querySelectorAll('button').forEach(button=>button.tabIndex=-1);});
      track.prepend(left);track.append(right);rail.scrollLeft=segmentWidth;
    }
    const overflowing=segmentWidth+72>rail.clientWidth;
    track.classList.toggle('centered',!overflowing);
    $('browse-prev').disabled=!overflowing;$('browse-next').disabled=!overflowing;
    schedulePerspective();
  }
  function filter(){
    const tokens=normalize($('search').value).split(/\s+/).filter(Boolean);
    const year=$('year').value;
    visible=books.filter(b=>(genre==='all'||b.genres.includes(genre))&&(year==='all'||b.years.includes(Number(year)))&&tokens.every(t=>searchIndex.get(b.id).includes(t)));
    renderShelf();
  }
  const genres=new Map();books.forEach(b=>b.genres.forEach(g=>genres.set(g,(genres.get(g)||0)+1)));
  [['all',books.length],...Array.from(genres).sort((a,b)=>b[1]-a[1])].forEach(([name])=>{
    const button=element('button','genre-pill',name==='all'?'All books':name);
    button.type='button';button.dataset.genre=name;button.setAttribute('aria-pressed',String(name==='all'));
    button.addEventListener('click',()=>{genre=name;$('genres').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter();});
    $('genres').append(button);
  });
  const years=[...new Set(books.flatMap(b=>b.years))].sort((a,b)=>b-a);
  years.forEach(year=>{const option=element('option','',year);option.value=year;$('year').append(option);});
  $('total-count').textContent=books.length+' volumes';
  const noteCount=books.filter(b=>b.personalNote).length;
  $('archive-caption').textContent=years.length+' reading years · '+noteCount+' personal notes · English, Arabic & Hausa';
  let searchTimer;
  $('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(filter,180);});
  $('year').addEventListener('change',filter);
  $('reset').addEventListener('click',()=>{$('search').value='';$('year').value='all';genre='all';$('genres').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.genre==='all')));filter();$('search').focus();});
  function browse(amount){hideTooltip();rail.scrollBy({left:amount,behavior:reducedMotion.matches?'auto':'smooth'});}
  $('browse-prev').addEventListener('click',()=>browse(-320));$('browse-next').addEventListener('click',()=>browse(320));
  rail.addEventListener('scroll',()=>{
    if(loop){if(rail.scrollLeft<segmentWidth)rail.scrollLeft+=segmentWidth;else if(rail.scrollLeft>=segmentWidth*2)rail.scrollLeft-=segmentWidth;}
    hideTooltip();schedulePerspective();
  },{passive:true});
  rail.addEventListener('wheel',event=>{
    if(dialog.open||rail.scrollWidth<=rail.clientWidth)return;
    if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.preventDefault();rail.scrollLeft+=event.deltaY*(event.deltaMode===1?22:1);}
  },{passive:false});
  rail.addEventListener('pointerdown',event=>{
    dragged=false;if(event.pointerType!=='mouse'||event.button!==0)return;
    drag={x:event.clientX,scroll:rail.scrollLeft,id:event.pointerId};
  });
  rail.addEventListener('pointermove',event=>{
    if(!drag)return;
    const delta=event.clientX-drag.x;
    if(Math.abs(delta)>5){dragged=true;rail.classList.add('dragging');hideTooltip();rail.scrollLeft=drag.scroll-delta;}
  });
  function endDrag(){drag=null;rail.classList.remove('dragging');setTimeout(()=>{dragged=false;},0);}
  window.addEventListener('pointerup',endDrag);rail.addEventListener('pointerleave',()=>{if(drag)endDrag();leaveTimer=setTimeout(hideTooltip,90);});
  rail.addEventListener('dragstart',event=>event.preventDefault());
  rail.addEventListener('pointerover',event=>{const button=event.target.closest('.book-slot');if(button)showTooltip(button);});
  rail.addEventListener('pointerout',event=>{if(!event.relatedTarget?.closest?.('.book-slot'))leaveTimer=setTimeout(hideTooltip,90);});
  rail.addEventListener('focusin',event=>{const button=event.target.closest('.book-slot');if(button)showTooltip(button);});
  rail.addEventListener('focusout',hideTooltip);
  rail.addEventListener('click',event=>{const button=event.target.closest('.book-slot');if(button&&!dragged)openBook(Number(button.dataset.index),button);});
  rail.addEventListener('keydown',event=>{if(!dialog.open&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();browse(event.key==='ArrowLeft'?-320:320);}});
  new ResizeObserver(()=>{if(!dialog.open)renderShelf();}).observe(rail);
  function fillDetail(index){
    const b=visible[index];if(!b)return;selected=index;
    $('detail-title').textContent=b.title;$('detail-author').textContent=b.author||'Author not recorded';
    $('detail-date').textContent=(b.status==='In progress'?'Reading in ':'Read in ')+b.years.join(' · ');
    $('detail-blurb').textContent=b.blurb||'';
    $('detail-tags').replaceChildren(...b.genres.map(g=>element('span','',g)));
    const metadata=[['My rating','Unrated']];
    if(b.year)metadata.unshift(['Publication year',b.year]);
    if(b.publisher)metadata.push(['Publisher',b.publisher]);
    const times=Object.values(b.readCounts||{}).reduce((a,n)=>a+n,0);
    if(times>1)metadata.push(['Recorded readings',times]);
    $('detail-metadata').replaceChildren(...metadata.map(([key,value])=>{const group=element('div');group.append(element('dt','',key),element('dd','',value));return group;}));
    $('note-section').hidden=!b.personalNote;
    $('detail-note').replaceChildren(...(b.personalNote||'').split(/\n\n/).filter(Boolean).map(t=>element('p','',t)));
    $('cover-notice').textContent=b.cover?'Cover shown for reference; the edition may differ from the copy I read.'+(b.matchNote?' '+b.matchNote:''):'A verified cover has not been located for this title.';
    $('source-link').hidden=!b.sourceUrl;if(b.sourceUrl)$('source-link').href=b.sourceUrl;
    $('source-link').textContent=b.cover?'View cover source':'View book reference';
    $('detail-position').textContent=(selected+1)+' / '+visible.length;
    $('previous-book').disabled=visible.length<2;$('next-book').disabled=visible.length<2;
    const coverBox=$('detail-cover');setBookStyle(coverBox,b);coverBox.replaceChildren(cover(b,false));
  }
  function openBook(index,button){
    if(closing)return;hideTooltip();focusBeforeOpen=button;fillDetail(index);
    const origin=button.getBoundingClientRect();dialog.classList.remove('book-out','closing-book');dialog.showModal();dialog.scrollTop=0;document.body.style.overflow='hidden';
    const box=$('detail-cover'), target=box.getBoundingClientRect();
    const dx=origin.left+origin.width/2-target.left-target.width/2,dy=origin.top+origin.height/2-target.top-target.height/2;
    returnTransform=`translate3d(${dx}px,${dy}px,0) scale(${origin.height/target.height}) rotateY(78deg)`;
    box.style.transition='none';box.style.transform=reducedMotion.matches?'none':returnTransform;box.style.opacity='1';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{box.style.transition='';box.style.transform='translate3d(0,0,0) scale(1) rotateY(0deg)';dialog.classList.add('book-out');}));
    $('close-detail').focus({preventScroll:true});
  }
  function closeBook(){
    if(!dialog.open||closing)return;closing=true;dialog.classList.add('closing-book');dialog.classList.remove('book-out');
    $('detail-cover').style.transform=reducedMotion.matches?'none':returnTransform;$('detail-cover').style.opacity='0';
    setTimeout(()=>{dialog.close();document.body.style.overflow='';closing=false;$('detail-cover').style.opacity='1';focusBeforeOpen?.focus({preventScroll:true});hideTooltip();},reducedMotion.matches?0:620);
  }
  function nextBook(direction){if(closing)return;fillDetail((selected+direction+visible.length)%visible.length);dialog.scrollTop=0;}
  $('close-detail').addEventListener('click',closeBook);$('shelve-book').addEventListener('click',closeBook);
  $('previous-book').addEventListener('click',()=>nextBook(-1));$('next-book').addEventListener('click',()=>nextBook(1));
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeBook();});
  dialog.addEventListener('click',event=>{if(event.target===dialog)closeBook();});
  dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();nextBook(event.key==='ArrowLeft'?-1:1);}});
  filter();
})();
