import React, {useEffect, useRef} from 'react';
import {X} from 'lucide-react';

export default function Modal({title, description, children, onClose, wide=false}) {
 const box=useRef(), close=useRef(onClose);
 close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement;
  const overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  box.current?.querySelector('button')?.focus({preventScroll:true});
  const back=e=>{e.preventDefault();close.current();};
  const keyboard=e=>{
   if(e.key==='Escape'){e.preventDefault();close.current();}
   if(e.key!=='Tab')return;
   const nodes=[...box.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href]')].filter(n=>n.offsetParent!==null);
   const first=nodes[0], last=nodes.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  };
  window.addEventListener('sanzhi-android-back',back);
  document.addEventListener('keydown',keyboard);
  return()=>{
   window.removeEventListener('sanzhi-android-back',back);
   document.removeEventListener('keydown',keyboard);
   document.body.style.overflow=overflow;
   if(previous?.isConnected)previous.focus({preventScroll:true});
  };
 },[]);
 // Only the content scrolls. The header remains outside the scroll container,
 // including in WebViews without dynamic viewport units.
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={box} className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-label={title}>
   <div className="modal-title"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>
    <button className="icon-btn modal-close" aria-label="关闭" onClick={onClose}><X size={20}/></button>
   </div>
   <div className="modal-content">{children}</div>
  </section>
 </div>;
}
