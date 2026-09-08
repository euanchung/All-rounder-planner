import {schedulePanel} from './preferences-ui.js';
const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
function fold(line){let out='',part='';for(const c of line){if(new TextEncoder().encode(part+c).length>73){out+=part+'\r\n ';part='';}part+=c;}return out+part;}
export function calendarFile(tasks,now=new Date()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Meta Timetable//KO','CALSCALE:GREGORIAN'];
 for(const t of tasks.filter(t=>!t.done&&t.fields.due)){
  const date=t.fields.due.replaceAll('-',''),time=(t.fields.time||'09:00').replace(':','')+'00';
  lines.push('BEGIN:VEVENT','UID:'+esc(t.id)+'@meta-timetable','DTSTAMP:'+now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),'DTSTART:'+date+'T'+time,'SUMMARY:'+esc(t.title),'DESCRIPTION:'+esc('메타시간표 마감 알림. 시각이 없던 할일은 오전 9시로 내보냈습니다. 앱 수정 내용은 자동 동기화되지 않습니다.'),'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:할일 마감 30분 전','END:VALARM','END:VEVENT');
 }
 lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
export function remindersPanel(profile){return `<details class="panel reminders-panel"><summary>알림 받기 (선택)</summary><p>브라우저 알림은 <strong>이 사이트가 열려 있을 때</strong> 마감 30분 전·5분 타이머 종료를 알려줘요. 기기 절전·브라우저 종료 상태에서는 보장하지 않아요. 알림에는 개인 과제명 대신 간단한 안내만 표시해요.</p>${schedulePanel(profile)}<div class="button-row"><button class="button secondary" data-action="enable-reminders">브라우저 알림 켜기 / 테스트</button><button class="text-button" data-action="disable-reminders">이 계정의 알림 끄기</button></div><p id="reminder-status" role="status"></p><hr><h3>사이트를 닫아도 알림이 필요하다면</h3><p>휴대폰 캘린더에 마감 일정을 가져올 수 있어요. 시각이 없으면 오전 9시, 알림은 30분 전으로 내보냅니다. 실제 알림 지원은 캘린더 앱 설정에 따라 달라요. 과제명·날짜가 파일에 포함되며, 가져온 뒤 변경 내용은 자동 동기화되지 않아요.</p><button class="button secondary" data-action="calendar-export">캘린더 알림 파일 받기 (.ics)</button><p class="muted">웹 푸시를 이용한 상시 알림은 별도 서버 예약 발송·기기 등록이 필요하여 이번 버전에는 포함하지 않았어요. iPhone 웹 푸시는 홈 화면에 추가한 웹앱에서 허용해야 합니다.</p></details>`;}
export async function showReminder(body){
 const registration=await navigator.serviceWorker?.getRegistration();
 if(registration)return registration.showNotification('메타시간표',{body,icon:'/favicon.svg',tag:'meta-timetable-reminder',data:{url:'/#planner'}});
 if(typeof Notification!=='undefined'&&Notification.permission==='granted')new Notification('메타시간표',{body,tag:'meta-timetable-reminder'});
}
export async function enableReminders(){
 if(typeof Notification==='undefined'||!window.isSecureContext)throw new Error('이 브라우저에서는 알림을 지원하지 않아요. 캘린더 알림 파일을 이용해 주세요.');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw new Error('알림이 허용되지 않았어요. 브라우저의 사이트 권한 설정에서 변경할 수 있어요.');
 if('serviceWorker' in navigator){await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;}
 await showReminder('알림 테스트입니다. 사이트를 열어 둔 동안 마감과 타이머를 알려드려요.');
}
