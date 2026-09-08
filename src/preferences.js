export const PALETTES={violet:['보라','#4f46e5'],ocean:['파랑','#0369a1'],forest:['초록','#047857'],rose:['분홍','#be185d'],amber:['주황','#b45309']};
export const defaultAppearance=()=>({mode:'light',accent:'#4f46e5',secondary:'#0891b2',background:null});
export const defaultReminders=()=>({times:[],weekdays:[1,2,3,4,5,6,0],deadline:true,focus:true});
export const validColor=c=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c);
export function validAppearance(p){return !!p&&['light','dark','system'].includes(p.mode)&&validColor(p.accent)&&(p.secondary===undefined||validColor(p.secondary))&&(p.background===null||validColor(p.background));}
export function validReminders(p){return !!p&&Array.isArray(p.times)&&p.times.length<=3&&new Set(p.times).size===p.times.length&&p.times.every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t))&&Array.isArray(p.weekdays)&&p.weekdays.length<=7&&new Set(p.weekdays).size===p.weekdays.length&&p.weekdays.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&(!p.times.length||p.weekdays.length>0)&&typeof p.deadline==='boolean'&&typeof p.focus==='boolean';}
const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const mix=(a,b,p)=>'#'+rgb(a).map((n,i)=>Math.round(n*(1-p)+rgb(b)[i]*p).toString(16).padStart(2,'0')).join('');
export function contrastInk(color){const v=rgb(color).map(n=>{n/=255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;}),l=v[0]*.2126+v[1]*.7152+v[2]*.0722;return (l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff';}
export function applyAppearance(value){
 const p=validAppearance(value)?value:defaultAppearance(),dark=p.mode==='dark'||p.mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches;
 const page=p.background||(dark?'#111827':'#f6f7fb'),ink=contrastInk(page),surface=mix(page,'#ffffff',dark?.06:.82),surfaceInk=contrastInk(surface),tint=mix(surface,p.accent,.12);
 const secondary=p.secondary||'#0891b2',secondTint=mix(surface,secondary,.16);
 const vars={'--secondary':secondary,'--secondary-ink':contrastInk(secondary),'--second-tint':secondTint,'--second-tint-ink':contrastInk(secondTint),'--page':page,'--surface':surface,'--ink':surfaceInk,'--page-ink':ink,'--muted':mix(surfaceInk,surface,.22),'--accent':p.accent,'--accent-ink':contrastInk(p.accent),'--tint':tint,'--tint-ink':contrastInk(tint),'--border':mix(surface,surfaceInk,.27)};
 document.documentElement.dataset.theme=dark?'dark':'light';for(const [k,v]of Object.entries(vars))document.documentElement.style.setProperty(k,v);
}
export function scheduledReminderSlots(settings,now=new Date()){
 if(!validReminders(settings)||!settings.weekdays.includes(now.getDay()))return [];
 // At most a 2-minute grace window on return from a sleeping tab; no late replay flood.
 return settings.times.filter(time=>{const [h,m]=time.split(':').map(Number),at=new Date(now);at.setHours(h,m,0,0);return +now>=+at&&+now-+at<120000;});
}
