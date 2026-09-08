let timer,lastKind='',serial=0;
export function feedback(message,kind='info'){
 let box=document.getElementById('toast');if(!box){box=document.createElement('div');box.id='toast';document.body.append(box);}const dialog=Array.from(document.querySelectorAll('dialog[open]')).at(-1);const host=dialog||document.body;if(box.parentElement!==host){if(typeof box.hidePopover==='function'&&box.matches(':popover-open'))box.hidePopover();host.append(box);}
 // A background status update must not erase an error before the user can read it.
 if(lastKind==='error'&&kind==='success')return;
 clearTimeout(timer);lastKind=kind;box.dataset.kind=kind;box.setAttribute('role',kind==='error'?'alert':'status');box.setAttribute('aria-live',kind==='error'?'assertive':'polite');
 box.replaceChildren();const text=document.createElement('span');text.textContent=message;box.append(text);
 if(kind!=='pending'){const close=document.createElement('button');close.type='button';close.textContent='닫기';close.setAttribute('aria-label','안내 닫기');close.onclick=()=>dismissFeedback();box.append(close);}
 box.classList.add('is-visible');if(typeof box.showPopover==='function'){box.setAttribute('popover','manual');if(!box.matches(':popover-open'))box.showPopover();}
 const ticket=++serial;if(kind==='success'||kind==='info')timer=setTimeout(()=>{if(ticket===serial)dismissFeedback();},8000);
}
export function dismissFeedback(){const box=document.getElementById('toast');clearTimeout(timer);lastKind='';serial++;if(!box)return;if(typeof box.hidePopover==='function'&&box.matches(':popover-open'))box.hidePopover();box.classList.remove('is-visible');box.replaceChildren();}
export function formFeedback(form,message,kind='error'){
 if(!form?.isConnected)return;let box=form.querySelector('.form-feedback');if(!box){box=document.createElement('p');box.className='form-feedback';form.append(box);}box.dataset.kind=kind;box.setAttribute('role',kind==='error'?'alert':'status');box.textContent=message;
}

// Keep the notice alive and interactive when a modal closes.
document.addEventListener('close',event=>{if(event.target.tagName!=='DIALOG')return;const box=event.target.querySelector('#toast');if(!box)return;const visible=box.classList.contains('is-visible');if(typeof box.hidePopover==='function'&&box.matches(':popover-open'))box.hidePopover();document.body.append(box);if(visible&&typeof box.showPopover==='function')box.showPopover();},true);
