import {authFailure,actionMessages,bounded} from './action-feedback.js';
import {createAuthClient} from '@neondatabase/auth';
const auth=createAuthClient(__AUTH_URL__);
export const cloud={user:null,revision:0,status:'계정 확인 중',locked:false,pending:null,running:false,onStatus:()=>{},onFeedback:()=>{}};
function status(text){cloud.status=text;cloud.onStatus(text);}
export async function api(path,options={}){
 const messages=actionMessages(path,options);if(messages)cloud.onFeedback(messages.pending,'pending');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),['/api/tutor','/api/schedule'].includes(path)?65000:25000);
 try{
  const session=await bounded(auth.getSession());
  if(session.error)throw Object.assign(new Error('로그인 상태를 확인하지 못했습니다. 연결을 확인해 주세요.'),{status:401});
  const token=session.data?.session?.token;if(!token)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401});
  const response=await fetch(path,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(cloud.user?{'X-Radar-User':cloud.user.id}:{})},cache:'no-store'});
  let body;try{body=await response.json();}catch{throw Object.assign(new Error('서버 응답을 읽지 못했습니다. 결과를 확인한 뒤 다시 시도해 주세요.'),{status:response.status||503});}
  if(!response.ok)throw Object.assign(new Error(body.error||'요청에 실패했습니다.'),{status:response.status});
  if(messages)cloud.onFeedback(messages.success,'success');return body;
 }catch(cause){
  let error=cause;if(cause.name==='AbortError'||cause.code==='REQUEST_TIMEOUT')error=Object.assign(new Error('응답 시간이 길어지고 있습니다. 서버에서 처리되었을 수 있으니 결과를 확인한 뒤 다시 시도해 주세요.'),{code:'REQUEST_TIMEOUT'});
  else if(cause instanceof TypeError)error=new Error('서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요. 전송 결과가 불확실하므로 목록을 확인한 뒤 다시 시도해 주세요.');
  if(messages){error=Object.assign(new Error(messages.failure+' '+error.message),{status:error.status,code:error.code});cloud.onFeedback(error.message,'error');}
  throw error;
 }finally{clearTimeout(timer);}
}
export async function loadCloud(){
  const session=await bounded(auth.getSession());
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
  cloud.onFeedback(action==='login'?'로그인 중입니다. 잠시만 기다려 주세요.':action==='signup'?'가입 중입니다. 잠시만 기다려 주세요.':'요청 중입니다. 잠시만 기다려 주세요.','pending');
  try{
  values={...values,...(values.email?{email:values.email.trim().toLowerCase()}:{})};
  if(action==='login')result=await bounded(auth.signIn.email({email:values.email,password:values.password}));
  if(action==='signup')result=await bounded(auth.signUp.email({email:values.email,password:values.password,name:values.name}));
  if(action==='reset-code')result=await bounded(auth.emailOtp.requestPasswordReset({email:values.email}));
  if(action==='reset-password')result=await bounded(auth.emailOtp.resetPassword({email:values.email,otp:values.otp,password:values.password}));
  if(result?.error)throw result.error;
  cloud.onFeedback(action==='login'?'로그인했습니다. 화면을 불러오고 있습니다.':action==='signup'?'가입했습니다. 첫 설정 화면을 불러오고 있습니다.':action==='reset-password'?'비밀번호를 변경했습니다. 새 비밀번호로 로그인하세요.':'인증 메일을 요청했습니다. 가입된 이메일이라면 받은편지함과 스팸함을 확인해 주세요.','success');
  return result;
  }catch(cause){const message=authFailure(cause,action);cloud.onFeedback(message,'error');throw new Error(message);}
}
export async function signOut(){
  if(cloud.running||cloud.pending)throw new Error('서버 저장이 끝나지 않았습니다. 저장 재시도 또는 백업 후 새로고침해 주세요.');
  cloud.onFeedback('로그아웃 중입니다. 잠시만 기다려 주세요.','pending');
  const result=await bounded(auth.signOut());if(result.error)throw new Error('로그아웃에 실패했습니다.');
  if(cloud.user)sessionStorage.removeItem('radar-draft-'+cloud.user.id);
  cloud.user=null;cloud.pending=null;cloud.revision=0;status('로그인 전 · 이 브라우저에 저장');cloud.onFeedback('로그아웃했습니다.','success');
}
window.addEventListener('online',retrySave);
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
window.addEventListener('beforeunload',e=>{if(cloud.pending||cloud.running){e.preventDefault();e.returnValue='';}});
