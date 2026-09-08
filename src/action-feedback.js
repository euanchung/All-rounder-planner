export function authFailure(error,action='login'){
 const code=String(error?.code||'').toUpperCase(),status=Number(error?.status||error?.statusCode);
 if(status===429)return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
 if(error?.name==='AbortError'||error?.code==='REQUEST_TIMEOUT')return '응답 시간이 길어지고 있습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.';
 if(status>=500||error instanceof TypeError)return '로그인 서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
 if(action==='login')return '이메일 또는 비밀번호가 올바르지 않습니다. 가입한 계정인지 확인해 주세요.';
 if(action==='signup')return /EXIST|TAKEN|DUPLICATE/.test(code)?'이 이메일로 가입할 수 없습니다. 기존 계정으로 로그인하거나 비밀번호 재설정을 이용해 주세요.':'회원가입에 실패했습니다. 이메일 형식과 비밀번호 길이(12자 이상)를 확인해 주세요.';
 if(action==='reset-password')return '비밀번호 변경에 실패했습니다. 인증번호가 정확하고 유효한지 확인해 주세요.';
 return '인증 메일 요청에 실패했습니다. 이메일과 인터넷 연결을 확인해 주세요.';
}
export function actionMessages(path,options={}){
 if(!['POST','PUT','PATCH','DELETE'].includes(options.method))return null;
 let b={};try{b=JSON.parse(options.body||'{}');}catch{}
 if(path==='/api/workspace'||b.action==='read-room')return null;
 if(path==='/api/tutor'||path==='/api/schedule')return {pending:'AI가 분석 중입니다. 잠시만 기다려 주세요.',success:'분석을 완료했습니다.',failure:'분석에 실패했습니다.'};
 const map={message:['전송 중입니다. 잠시만 기다려 주세요.','전송했습니다.','전송에 실패했습니다.'],notice:['공지를 게시하고 있습니다.','공지를 게시했습니다.','공지 게시에 실패했습니다.'],'create-group':['개설을 신청하고 있습니다.','그룹 개설을 신청했습니다. 관리자 승인을 기다려 주세요.','그룹 개설 신청에 실패했습니다.'],'create-class':['학급을 개설하고 있습니다.','학급을 개설했습니다.','학급 개설에 실패했습니다.'],join:['학급에 입장하고 있습니다.','학급에 입장했습니다.','학급 입장에 실패했습니다.'],'join-group':['그룹에 입장하고 있습니다.','그룹에 입장했습니다.','그룹 입장에 실패했습니다.'],'leave-room':['탈퇴 처리 중입니다.','대화방에서 탈퇴했습니다.','탈퇴에 실패했습니다.'],'leave-class':['탈퇴 처리 중입니다.','학급에서 탈퇴했습니다.','탈퇴에 실패했습니다.'],'approve-group':['그룹을 승인하고 있습니다.','그룹 개설을 승인했습니다.','승인에 실패했습니다.'],'close-room':['그룹을 폐쇄하고 있습니다.','그룹을 폐쇄했습니다.','폐쇄에 실패했습니다.'],'close-class':['학급을 폐쇄하고 있습니다.','학급을 폐쇄했습니다.','폐쇄에 실패했습니다.'],'kick-class':['추방 처리 중입니다.','학급에서 추방했습니다.','추방에 실패했습니다.'],'kick-room':['추방 처리 중입니다.','그룹에서 추방했습니다.','추방에 실패했습니다.'],block:['차단 처리 중입니다.','사용자를 차단했습니다.','차단에 실패했습니다.'],report:['신고를 접수하고 있습니다.','신고를 접수했습니다.','신고에 실패했습니다.']};
 const [pending,success,failure]=map[b.action]||['변경 중입니다. 잠시만 기다려 주세요.','변경했습니다.','변경에 실패했습니다.'];return {pending,success,failure};
}
export async function bounded(promise,ms=20000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('서버 응답을 기다리는 시간이 길어졌습니다. 결과를 확인한 뒤 다시 시도해 주세요.'),{code:'REQUEST_TIMEOUT'})),ms);})]);}finally{clearTimeout(timer);}}
