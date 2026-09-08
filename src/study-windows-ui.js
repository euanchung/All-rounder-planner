import {emptyStudyWeek,validStudyWindows,studyWeeklyMinutes} from './study-windows.js';
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function studyRows(day,rows){
 return '<input type="hidden" name="study-count-'+day+'" value="'+rows.length+'">'+rows.map((r,i)=>'<div class="study-time-row"><label>시작<input type="text" inputmode="numeric" placeholder="19:30" maxlength="5" name="study-start-'+day+'-'+i+'" value="'+e(r.start)+'" required></label><span>~</span><label>종료<input type="text" inputmode="numeric" placeholder="19:30" maxlength="5" name="study-end-'+day+'-'+i+'" value="'+e(r.end)+'" required></label><button type="button" class="button secondary" data-action="study-remove" data-day="'+day+'" data-index="'+i+'" aria-label="자습 구간 삭제">삭제</button></div>').join('');
}
export function studyEditor(week=emptyStudyWeek(),days=[0,1,2,3,4,5,6]){
 return '<div class="study-window-editor"><p class="muted">시각을 직접 입력하세요: 19:30, 1930, 19 모두 가능. 복사한 구간은 다른 요일의 붙여넣기로 적용할 수 있어요. 실제로 공부·과제에 쓸 수 있는 구간을 추가하세요. 여러 구간 가능 · 쉬는 날은 비워 두세요. 종료가 시작보다 이르면 다음날 종료(예: 23:40~00:50)입니다. 합계·남은 시간은 달력 날짜별로 계산하며 겹치는 구간은 저장할 수 없어요. 한국 시간 기준입니다.</p>'+days.map(d=>'<section class="study-window-day" data-day="'+d+'"><div class="panel-heading"><h3>'+('일월화수목금토'[d])+'요일</h3><button type="button" class="button secondary" data-action="study-add" data-day="'+d+'">＋ 구간 추가</button></div><div class="button-row"><button type="button" class="button secondary" data-action="study-copy" data-day="'+d+'">구간 복사</button><button type="button" class="button secondary" data-action="study-paste" data-day="'+d+'">붙여넣기</button></div><div class="study-window-rows">'+studyRows(d,week[d]||[])+'</div><output class="study-window-total" aria-live="polite"></output></section>').join('')+'</div>';
}
export function normalizeStudyTime(value){
 const v=String(value||'').trim(),m=v.match(/^(\d{1,2})(?::(\d{1,2}))?$/)||v.match(/^(\d{2})(\d{2})$/);
 if(!m||Number(m[1])>23||Number(m[2]||0)>59)return v;
 return m[1].padStart(2,'0')+':'+(m[2]||'0').padStart(2,'0');
}
export function studyDraft(values,day){
 const n=Math.max(0,Math.min(12,Number(values['study-count-'+day])||0));
 return Array.from({length:n},(_,i)=>({start:normalizeStudyTime(values['study-start-'+day+'-'+i]),end:normalizeStudyTime(values['study-end-'+day+'-'+i])}));
}
export function readStudyWeek(values){
 const week=Array.from({length:7},(_,d)=>studyDraft(values,d));
 if(!validStudyWindows(week))throw new Error('자습 시작·종료 시각을 확인하세요. 겹치는 시간(전날 야자 포함), 같은 시작·종료, 하루 12시간 초과는 저장할 수 없어요.');
 return week;
}
export function refreshStudyTotals(form){
 if(!form)return;
 try{const week=readStudyWeek(Object.fromEntries(new FormData(form))),totals=studyWeeklyMinutes(week);form.querySelectorAll('.study-window-day').forEach(box=>{box.querySelector('output').textContent='일일 시간 '+totals[Number(box.dataset.day)]+'분';});}
 catch{form.querySelectorAll('.study-window-total').forEach(el=>el.textContent='시작·종료와 겹치는 구간을 확인해 주세요.');}
}
