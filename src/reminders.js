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
export function remindersPanel(profile,options={focus:true}){return `<details class="panel reminders-panel"><summary>알림 받기 (선택)</summary><p>브라우저 알림은 <strong>이 사이트가 열려 있을 때</strong> 지정 시각·마감 30분 전를 알려줘요. 기기 절전·브라우저 종료 상태에서는 보장하지 않아요. 알림에는 개인 과제명 대신 간단한 안내만 표시해요.</p>${schedulePanel(profile,options)}<div class="button-row"><button class="button secondary" data-action="enable-reminders">브라우저 알림 켜기 / 테스트</button><button class="text-button" data-action="disable-reminders">이 계정의 알림 끄기</button></div><p id="reminder-status" role="status"></p><hr><h3>새 채팅·공지 알림 (웹 푸시)</h3><p>기기 알림 주소를 내 계정에 등록하여 새 메시지·공지를 받습니다. 원문·개인 과제명은 알림에 노출하지 않아요. 기기/브라우저 지원과 절전 설정에 따라 늦거나 수신되지 않을 수 있어요.</p><button type="button" class="button secondary" data-action="enable-push">이 기기 소통 알림 켜기</button><button type="button" class="button secondary" data-action="disable-push">이 기기 소통 알림 끄기</button><h3>개인 마감 알림을 캘린더로 받기</h3><p>휴대폰 캘린더에 마감 일정을 가져올 수 있어요. 시각이 없으면 오전 9시, 알림은 30분 전으로 내보냅니다. 실제 알림 지원은 캘린더 앱 설정에 따라 달라요. 과제명·날짜가 파일에 포함되며, 가져온 뒤 변경 내용은 자동 동기화되지 않아요.</p><button class="button secondary" data-action="calendar-export">캘린더 알림 파일 받기 (.ics)</button><p class="muted">새 채팅·공지 웹 푸시와 개인 일정 예약 알림은 별개입니다. 개인 일정 알림은 사이트가 열려 있어야 합니다. iPhone 웹 푸시는 홈 화면에 추가한 웹앱에서 허용해야 합니다.</p></details>`;}
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
