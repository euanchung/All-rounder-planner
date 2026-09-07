import {createAuthClient} from '@neondatabase/auth';
const auth=createAuthClient(__AUTH_URL__);
export const cloud={user:null,revision:0,status:'계정 확인 중',locked:false,pending:null,running:false,onStatus:()=>{}};
function status(text){cloud.status=text;cloud.onStatus(text);}
export async function api(path,options={}){
  const session=await auth.getSession();
  if(session.error)throw new Error('로그인 상태를 확인하지 못했습니다. 연결을 확인해 주세요.');
  const token=session.data?.session?.token;
  if(!token)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(cloud.user?{'X-Radar-User':cloud.user.id}:{})},cache:'no-store'});
  const body=await response.json();
  if(!response.ok)throw Object.assign(new Error(body.error||'요청에 실패했습니다.'),{status:response.status});
  return body;
}
export async function loadCloud(){
  const session=await auth.getSession();
  if(session.error)throw new Error('계정 연결을 확인하지 못했습니다. 새로고침해 주세요.');
  if(!session.data?.user){cloud.user=null;status('로그인 전 · 이 브라우저에 저장');return null;}
  cloud.user=null;
  const result=await api('/api/workspace');cloud.user=result.user;cloud.revision=result.revision;cloud.locked=false;
  status('클라우드 저장됨');
  const pending=sessionStorage.getItem('radar-pending-'+cloud.user.id);
  if(pending){
    const p=JSON.parse(pending);
    if(p.revision===cloud.revision){result.data=p.data;queueSave(p.data);}
    else if(canonical(p.data)===canonical(result.data))sessionStorage.removeItem('radar-pending-'+cloud.user.id);
    else{cloud.locked=true;status('저장 충돌 · 백업 후 새로고침 필요');result.recovery=p.data;}
  }
  return result;
}
export function queueSave(data){
  if(!cloud.user||cloud.locked)return;
  cloud.pending=structuredClone(data);
  try{sessionStorage.setItem('radar-pending-'+cloud.user.id,JSON.stringify({data:cloud.pending,revision:cloud.revision}));}
  catch{status('임시 보관 실패 · 창을 닫지 마세요');}
  status('클라우드 저장 중…');flush();
}
async function flush(){
  if(cloud.running||cloud.locked||!cloud.pending)return;
  cloud.running=true;
  const data=cloud.pending;cloud.pending=null;const id=cloud.user.id;
  try{
    const result=await api('/api/workspace',{method:'PUT',body:JSON.stringify({data,revision:cloud.revision})});
    cloud.revision=result.revision;
    if(cloud.pending)sessionStorage.setItem('radar-pending-'+id,JSON.stringify({data:cloud.pending,revision:cloud.revision}));
    else sessionStorage.removeItem('radar-pending-'+id);
    status(cloud.pending?'클라우드 저장 중…':'클라우드 저장됨');
  }catch(error){
    cloud.pending||=data;cloud.locked=[401,409].includes(error.status);
    status(error.status===409?'저장 충돌 · 현재 내용 백업 필요':error.status===401?'로그인 만료 · 현재 내용 백업 필요':'서버 저장 실패 · 이 탭에 임시 보관됨');
  }finally{cloud.running=false;}
  if(cloud.pending&&!cloud.locked&&cloud.status==='클라우드 저장 중…')flush();
}
export const retrySave=()=>{if(!cloud.locked){status('클라우드 저장 중…');return flush();}};
export async function authAction(action,values){
  let result;
  values={...values,...(values.email?{email:values.email.trim().toLowerCase()}:{})};
  if(action==='login')result=await auth.signIn.email({email:values.email,password:values.password});
  if(action==='signup')result=await auth.signUp.email({email:values.email,password:values.password,name:values.name});
  if(action==='send-code'){
    if(!cloud.user?.email)throw new Error('로그인한 이메일을 먼저 확인해 주세요.');
    if(Date.now()-(cloud.lastCodeRequest||0)<60000)throw new Error('재발송은 1분 뒤에 해 주세요. 여러 번 요청하면 최신 번호만 사용해야 해요.');
    result=await auth.emailOtp.sendVerificationOtp({email:cloud.user.email,type:'email-verification'});
    if(!result?.error)cloud.lastCodeRequest=Date.now();
  }
  if(action==='verify')result=await auth.emailOtp.verifyEmail({email:cloud.user.email,otp:values.otp});
  if(action==='reset-code')result=await auth.emailOtp.requestPasswordReset({email:values.email});
  if(action==='reset-password')result=await auth.emailOtp.resetPassword({email:values.email,otp:values.otp,password:values.password});
  if(result?.error){console.warn('[auth]',{action,status:result.error.status,code:result.error.code});throw new Error(result.error.status===429?'요청이 많아 잠시 제한되었어요. 잠시 후 한 번만 다시 요청해 주세요.':result.error.message||'인증에 실패했습니다.');}
  return result;
}
export async function signOut(){
  if(cloud.running||cloud.pending)throw new Error('서버 저장이 끝나지 않았습니다. 저장 재시도 또는 백업 후 새로고침해 주세요.');
  const result=await auth.signOut();if(result.error)throw new Error('로그아웃에 실패했습니다.');
  if(cloud.user)sessionStorage.removeItem('radar-draft-'+cloud.user.id);
  cloud.user=null;cloud.pending=null;cloud.revision=0;status('로그인 전 · 이 브라우저에 저장');
}
window.addEventListener('online',retrySave);
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
window.addEventListener('beforeunload',e=>{if(cloud.pending||cloud.running){e.preventDefault();e.returnValue='';}});
