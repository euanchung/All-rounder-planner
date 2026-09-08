import {PALETTES,defaultReminders,validAppearance,validReminders,applyAppearance,scheduledReminderSlots} from './preferences.js';
import {appearancePanel} from './preferences-ui.js';
import {weekCells} from './week-view.js';
import {inspectNotice,applyNoticeRows} from './notice-intake.js';
import {noticePreview} from './notice-ui.js';
import {deadlineLabel,deadlineStamp,finishBy} from './live-time.js';
import {academic,taskCategory} from './task-kind.js';
let noticeState=null;
import {analyze, compare, plan, FIELDS, today, addDays, validDate, validateBackup} from './engine.js';

import {defaultProfile,upgrade,validProfile} from './profile.js';
import {cloud,loadCloud,queueSave,retrySave,authAction,signOut,api} from './cloud.js';
import {authPage,settingsPage} from './account-ui.js';
import {remainingMinutes,rankedTasks,resizeProblems,recordStudy,undoStudy,questionDraft,BLOCK_REASONS} from './workload.js';
import {overloadPanel,priorityPanel,studyPage} from './study-ui.js';
import {quadratic} from './math-tools.js';
import {parseQuick,parseBatch,createQuickTask,duplicateKey,CATEGORIES} from './quick-entry.js';
import {quickComposer,simpleTasks,quickEditor,planEditor} from './simple-ui.js';
import {calendarFile,remindersPanel,enableReminders,showReminder} from './reminders.js';
let quickState={text:'',batch:null,editId:'',forms:{},notes:{}},authMessage='';
const quickFormIds=['quick-edit-form','batch-form','pin-form','date-capacity-form'];
let studyState={taskId:'',problem:1,forms:{},timer:null},mathResult=null;
const studyFormIds=['progress-form','problem-count-form','problem-form','quadratic-form'];
const KEY='byeonsaeng-radar-v1';
let booting=true,forms={},adminStats=null,recovery=null;
const capacities=()=>{const weekly=data.profile?.weeklyMinutes||Array(7).fill(data.capacity),date=today();const spent=data.tasks.filter(academic).reduce((n,t)=>n+(t.studyLog||[]).reduce((sum,l)=>sum+(localDate(l.at)===date?l.minutes:0),0),0);return {weekly,today:date,spent,now:Date.now(),overrides:data.profile?.dateOverrides||{}};};
function localDate(iso){const d=new Date(iso);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function resetStudy(){noticeState=null;quickState={text:'',batch:null,editId:'',forms:{},notes:{}};studyState={taskId:'',problem:1,forms:{},timer:null};mathResult=null;}
const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayDate=value=>value?`${Number(value.slice(5,7))}.${Number(value.slice(8,10))} (${['일','월','화','수','목','금','토'][new Date(value+'T12:00:00').getDay()]})`:'날짜 미정';
const fresh=()=>upgrade({version:1,tasks:[],capacity:90,acceptedPlan:null});
let data=fresh(), demo=false, realData=null, view=location.hash.slice(1)||'dashboard', draft=null, selected='', daySelected=today(), storageError='', storageLocked=false;
try { const raw=localStorage.getItem(KEY); if(raw){const parsed=JSON.parse(raw);if(!validateBackup(parsed))throw new Error('invalid');data=upgrade(parsed);} }
catch {storageError='저장된 데이터를 읽지 못했습니다. 기존 저장본은 덮어쓰지 않습니다. 브라우저 설정을 확인하거나 정상 백업을 불러와 주세요.';storageLocked=true;}
const icons={radar:'◎',dashboard:'◫',notice:'≋',planner:'▦',history:'↶'};
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function save(){if(demo||storageLocked)return;if(cloud.user){queueSave(data);return;}try{localStorage.setItem(KEY,JSON.stringify(data));storageError='';}catch{storageError='브라우저에 저장하지 못했습니다. 백업 내려받기로 데이터를 보관해 주세요.';toast(storageError);}}
function invalidate(){data.acceptedPlan=null;save();}
function demoData(){
  const make=(id,title,source,minutes)=>({id,title,source,sourceDate:today(),fields:analyze(source,today()).fields,minutes,priority:2,done:false,history:[]});
  return upgrade({version:1,capacity:90,acceptedPlan:null,tasks:[
    make('demo-physics','물리 탐구 보고서',`물리 탐구 보고서\n${addDays(today(),4)} 17시까지 보고서 2쪽\n제출 방식: PDF\n장소: 물리실\n준비물: 실험 기록지\n평가 기준: 실험 근거와 결론`,120),
    make('demo-math','수학 문제 풀이',`수학 10문제\n${addDays(today(),2)} 16시까지\n제출 방식: 손글씨\n평가 기준: 풀이 과정`,120),
    make('demo-english','영어 발표 준비',`영어 발표 자료 3장\n${addDays(today(),1)} 15시까지\n제출 방식: PPT\n평가 기준: 발표 내용`,90)
  ]});
}
function changeDemo(){
  persistDraft();
  if(demo){demo=false;data=realData||fresh();realData=null;}
  else{realData=data;demo=true;data=demoData();}
  draft=null;forms={};resetStudy();view='dashboard';selected='';restoreDraft();render();toast(demo?'예제 공간입니다. 내 데이터는 바뀌지 않습니다.':'내 공간으로 돌아왔습니다.');
}
function nav(){return `<aside class="sidebar"><a href="#" class="brand" data-action="home"><span class="logo" aria-hidden="true"><svg viewBox="0 0 32 32" width="32" height="32"><rect x="5" y="7" width="22" height="21" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 4v6m12-6v6M5 14h22M10 23v-5l6 5 6-5v5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>메타시간표<small>META TIMETABLE</small></span></a><div class="workspace-label">나의 워크스페이스</div><nav aria-label="주 메뉴">${[['dashboard','한눈에 보기'],['notice','공지 비교'],['planner','나의 계획'],['study','실행 도우미'],['history','변경 기록'],['settings','개인 설정'],['account',cloud.user?'내 계정':'로그인 / 회원가입'],...(cloud.user?.role==='admin'?[['admin','관리자']]:[])].map(([key,label])=>`<button data-action="view" data-view="${key}" class="nav-item ${view===key?'active':''}" ${view===key?'aria-current="page"':''}><span aria-hidden="true">${icons[key]||'⚙'}</span>${label}${key==='notice'?'<b>＋</b>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="local-dot">${demo?'예제 체험 중':cloud.user?'개인별 클라우드 저장':'이 브라우저에 저장'}</div><p>${cloud.user?'내 할일과 설정은 계정별로 보관돼요.':'로그인하면 다른 기기에서도 내 계획을 이어 볼 수 있어요.'}</p><button class="text-button" data-action="export">백업 내려받기 ↗</button><label class="import-button" for="import">백업 불러오기<input id="import" type="file" accept=".json,application/json" hidden></label></div></aside>`;}
function heading(){const titles={dashboard:['한눈에 보기','한 줄로 적고, 내 시간을 확인하세요.'],notice:['공지 비교','길거나 수정된 공지만 여기서 확인하세요.'],planner:['나의 계획','마감 전에 끝낼 수 있도록 시간을 나눠요.'],study:['실행 도우미','작게 시작하고, 막힌 부분은 구체적으로.'],history:['변경 기록','어떤 공지에서 무엇이 달라졌는지 되짚어요.'],settings:['개인 설정','나의 요일, 나의 속도에 맞추세요.'],account:['내 계정','개인별로 안전하게 이어 쓰는 공간.'],admin:['관리자','개인 기록을 열람하지 않는 운영 현황.']};return `<header class="page-heading"><div><div class="eyebrow"><span id="live-clock"></span> · ${demo?'예제 워크스페이스':'MY WORKSPACE'}</div><h1>${titles[view][0]}</h1><p>${titles[view][1]}</p></div><button class="button secondary" data-action="demo">${demo?'내 공간으로 돌아가기':'예제로 체험하기'} <span aria-hidden="true">↗</span></button></header>`;}
function summary(){const p=plan(data.tasks,capacities()),active=data.tasks.filter(t=>!t.done&&academic(t));return `<div class="stats"><article><span>진행 중인 할일</span><strong>${active.length}<small>개</small></strong><p>완료한 할일 ${data.tasks.filter(t=>t.done&&academic(t)).length}개</p></article><article class="${p.totalShortage?'stat-warning':''}"><span>14일 계획 · 배치하지 못한 시간</span><strong>${p.totalShortage}<small>분</small></strong><p>${p.totalShortage?'일일 시간이나 마감을 조정해 주세요':'현재 추정 시간으로 배치 가능해요'}</p></article><article><span>마감일 확인 필요</span><strong>${p.missing.length}<small>개</small></strong><p>날짜가 없으면 계획에 포함되지 않아요</p></article></div>`;}
function graph(p){return `<div class="graph" aria-label="앞으로 7일의 계획된 작업 시간">${p.days.slice(0,7).map(d=>`<button class="day-bar ${d.date===daySelected?'chosen':''}" data-action="day" data-date="${d.date}" aria-label="${displayDate(d.date)} ${d.used}분, 가용 ${d.capacity}분"><span>${d.used}<small>분</small></span><span class="bar-track"><span style="height:${Math.round(d.used/Math.max(1,d.capacity)*100)}%"></span></span><b>${d.date===today()?'오늘':displayDate(d.date).split(' ')[0]}</b></button>`).join('')}</div>`;}
function tasksPanel(){return simpleTasks(data.tasks,capacities(),today());}
function weekPanel(){const p=plan(data.tasks,capacities());return `<section class="panel week-panel"><div class="panel-heading"><h2>이번 주 · 일일 시간 여유</h2><button class="text-button" data-action="view" data-view="planner">계획 / 시간 변경 ↗</button></div><div class="week-remaining">${weekCells(p.days,today()).map(d=>`<button ${d.disabled?'disabled aria-disabled="true"':''} class="${d.disabled?'past-day':''}" data-action="day" data-date="${d.date}"><span class="week-dayname">${['일','월','화','수','목','금','토'][new Date(d.date+'T12:00:00').getDay()]}</span><span class="week-date">${Number(d.date.slice(5,7))}.${Number(d.date.slice(8,10))}</span><strong>${d.disabled?'—':Math.max(0,d.capacity-d.used)}<small>분</small></strong><small>여유 / 배치 가능 ${d.capacity}분</small></button>`).join('')}</div><p class="muted">일일 시간에서 진행 기록을 빼고, 오늘은 자정까지 실제 남은 분으로도 제한해요. 수업·휴식 시간대는 자동 파악하지 않으니 일일 시간을 조정해 주세요.</p></section>`;}
function dashboard(){const p=plan(data.tasks,capacities());return `${quickComposer(quickState,data.tasks)}${quickEditor(data.tasks.find(t=>t.id===quickState.editId))}<div class="live-overload">${overloadPanel(data.tasks.filter(academic),capacities(),today())}</div>${tasksPanel()}<div id="live-week">${weekPanel()}</div><details class="extra-analysis"><summary>작업량·우선순위 자세히 보기</summary><div id="live-priority">${summary()}${priorityPanel(data.tasks.filter(academic),capacities(),today(),p.days[0])}</div></details>${demo?'<button class="text-button" data-action="sample-revision">물리 수정 공지 비교 예제 →</button>':''}`;}
function sourceForm(){return `<section class="panel"><h2>공지, 붙여 넣으면 돼요.</h2><form id="source-form"><label>공지 내용<textarea name="source" id="notice-text" rows="6" maxlength="12000" required placeholder="예: 물리 보고서 마감이 금요일로 변경됐어요. 소요 시간 60분"></textarea></label><details class="optional-fields"><summary>예전 공지인가요? 작성일 바꾸기</summary><label>공지 작성일<input type="date" name="sourceDate" value="${today()}" required><small>‘내일’ 등은 작성일 기준이에요. 기본값은 오늘입니다.</small></label></details><button class="button primary" type="submit">자동 대조하기 →</button></form><p class="muted">기존 할일과 제목·과목·유형을 대조해 수정 또는 신규 추가를 제안해요. 애매한 후보만 직접 확인하고 마지막에 한 번 반영하세요. 규칙 기반이므로 모든 표현을 이해하지는 못해요.</p></section>`;}
function diffPanel(){if(!draft?.old)return '';const changes=compare({fields:draft.old.fields,evidence:analyze(draft.old.source,draft.old.sourceDate).evidence},draft.analysis);return `<section class="panel"><div class="panel-heading"><h2>달라진 내용</h2><span class="pill">${changes.length}개 항목 확인</span></div>${changes.length?`<div class="diff-list">${changes.map(c=>`<article class="diff-item"><div><strong>${c.label}</strong><span class="pill ${c.kind==='확인 필요'?'warning':''}">${c.kind}</span></div><div class="diff-values"><span>${esc(c.before||'확정 값 없음')}</span><span aria-hidden="true">→</span><strong>${esc(c.after||'새 공지에서 확정할 수 없음')}</strong></div><details><summary>원문 표현 확인</summary><p>이전: ${esc(c.oldEvidence)}</p><p>수정: ${esc(c.newEvidence)}</p></details>${c.before&&!c.after?'<p class="warning-text">표현이 빠졌다고 취소된 것은 아니에요. 아래에는 기존 값을 남겨 두었으니 유지할지 지울지 확인하세요.</p>':''}</article>`).join('')}</div>`:'<p class="muted">구조화한 항목의 변화는 없습니다. 아래 원문에서 다른 내용도 확인해 주세요.</p>'}<details class="source-details"><summary>전체 원문 비교</summary><div class="form-grid"><pre>${esc(draft.old.source)}</pre><pre>${esc(draft.source)}</pre></div></details></section>`;}
function reviewForm(){if(!draft)return '';const a=draft.analysis; const effective=draft.old?{...draft.old.fields}:{};for(const key of Object.keys(FIELDS))if(a.fields[key])effective[key]=a.fields[key];
  if(draft.edit)Object.assign(effective,draft.old.fields);
  const title=draft.old?.title||draft.source.split('\n')[0].slice(0,100);
  return `<div id="review">${diffPanel()}<div class="review-grid"><section class="panel"><div class="panel-heading"><h2>확인하고 ${draft.old?'수정':'등록'}하기</h2><span class="step">최종 승인</span></div><form id="review-form"><label>할일 이름<input name="title" maxlength="200" value="${esc(title)}" required></label><div class="form-grid">${Object.entries(FIELDS).filter(([key])=>['due','time','subject'].includes(key)).map(([key,label])=>`<label>${label}${key==='due'?' <small>미정이면 비워 두세요</small>':''}<input name="${key}" type="${key==='due'?'date':key==='time'?'time':'text'}" maxlength="1000" value="${esc(effective[key]||'')}" placeholder="확인 필요"></label>`).join('')}<label>소요 시간 (분)<input name="minutes" type="number" min="0" max="10080" step="1" value="${draft.old?.totalMinutes??draft.old?.minutes??60}" required><small>완료한 시간을 포함한 총량이에요. 분량 증가만으로 자동 변경하지 않아요.</small></label><label>이미 완료한 시간 (분)<input name="completedMinutes" type="number" min="0" max="10080" step="1" value="${draft.old?.completedMinutes??0}" required><small>여기서 고친 시간은 오늘 진행 기록에 추가되지 않아요.</small></label><label>체감 난이도<select name="difficulty">${[1,2,3,4,5].map(n=>`<option value="${n}" ${(draft.old?.difficulty??3)===n?'selected':''}>${n} · ${['아주 쉬움','쉬움','보통','어려움','아주 어려움'][n-1]}</option>`).join('')}</select></label><label>문제풀이 개수 (선택)<input name="problemCount" type="number" min="0" max="200" step="1" value="${draft.old?.problems?.length??Math.min(200,Number(effective.amount?.match(/^(\d+)\s*(?:문제|문항)$/)?.[1]||0))}"><small>0이면 문제판을 만들지 않아요. 문제 수 변경은 직접 확인하세요.</small></label><label>중요도<select name="priority">${[[1,'보통'],[2,'중요'],[3,'매우 중요']].map(([value,text])=>`<option value="${value}" ${(draft.old?.priority??2)===value?'selected':''}>${text}</option>`).join('')}</select></label></div><details class="optional-fields"><summary>분량·준비물·장소·비용 등 (선택)</summary><div class="form-grid">${Object.entries(FIELDS).filter(([key])=>!['due','time','subject'].includes(key)).map(([key,label])=>`<label>${label}<input name="${key}" maxlength="1000" value="${esc(effective[key]||'')}"></label>`).join('')}</div></details><label class="checkbox-label"><input name="acknowledged" type="checkbox" required>원문과 해석 결과를 확인했습니다. 미정인 정보는 확인 후 수정하겠습니다.</label><div class="button-row"><button class="button primary" type="submit">${draft.old?'변경 승인하고 계획 재계산':'할일 등록하고 계획 보기'}</button><button class="button secondary" type="button" data-action="cancel-draft">취소</button></div></form></section><aside class="review-aside"><section class="panel warning-panel"><h2>확인이 필요한 부분</h2>${a.issues.length?`<ul>${a.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>규칙으로 발견한 충돌은 없어요. 원문과 최종 값은 한 번 더 확인해 주세요.</p>'}<h3>물어볼 질문 초안</h3><ul>${a.questions.map(q=>`<li>${esc(q)}</li>`).join('')||'<li>기본 항목이 채워져 있습니다. 추가 조건도 원문에서 확인해 주세요.</li>'}</ul><button class="button secondary" data-action="copy-questions">질문 복사</button><p class="muted">자동으로 메시지를 보내지 않아요.</p></section><section class="panel"><h3>계획에 반영되는 것</h3><p>마감일·남은 시간·중요도가 바뀌면 14일 계획을 다시 계산합니다.</p><p class="muted">시간을 초과하면 할일을 숨기지 않고 배치하지 못한 분량을 표시해요.</p></section></aside></div></div>`;
}
function notice(){return `${sourceForm()}${noticePreview(noticeState)}${reviewForm()}`;}
function planner(){return `${planEditor(data.tasks,data.profile,today())}<div id="live-plan">${plannerContents()}</div>`;}
function plannerContents(){const p=plan(data.tasks,capacities()),day=p.days.find(d=>d.date===daySelected)||p.days[0];return `${p.conflicts.length?'<div class="alert">직접 정한 계획 중 '+p.conflicts.length+'개가 변경된 시간·마감과 충돌해요. 아래 직접 계획에서 조정해 주세요.</div>':''}<div class="live-overload">${overloadPanel(data.tasks.filter(academic),capacities(),today())}</div><div class="plan-controls panel"><div><strong>요일별 일일 시간</strong><p>${[1,2,3,4,5,6,0].map(d=>['일','월','화','수','목','금','토'][d]+' '+(data.profile?.weeklyMinutes[d]??data.capacity)+'분').join(' · ')}</p><button class="button secondary" data-action="view" data-view="settings">일일 시간 설정</button></div><p>수업·식사·휴식 시간을 뺀 시간을 입력하세요.<br>앞으로 14일, 실제 마감일의 전날까지 완료하도록 배치해요.</p><button class="button primary" data-action="approve-plan" ${data.tasks.some(t=>!t.done)?'':'disabled'}>${data.acceptedPlan?'계획 승인됨 ✓':'이 계획 승인하기'}</button></div>${p.totalShortage?`<div class="alert"><strong>${p.totalShortage}분을 배치하지 못했어요.</strong> 일일 시간을 늘리거나, 남은 시간·마감을 확인해 주세요. 계획을 승인해도 부족한 작업이 해결되지는 않습니다.</div>`:''}${p.missing.length?`<div class="alert subtle">마감일이 없는 할일 ${p.missing.length}개는 계산에서 제외했어요.</div>`:''}<div class="planner-grid"><section class="panel"><div class="panel-heading"><h2>${data.acceptedPlan?'승인한 계획':'역산 계획 미리보기'}</h2><span class="pill neutral">14일</span></div><p class="muted">빠른 마감부터 시간을 확보하고, 각 할일은 마감 전날부터 거꾸로 배치해요. 직접 배치한 시간을 먼저 확보해요.</p><div class="calendar-scroll"><div class="calendar-grid">${weekCells(p.days,today(),true).map(d=>`<button ${d.disabled?'disabled aria-disabled="true"':''} class="calendar-day ${d.disabled?'past-day':''} ${d.date===day.date?'selected':''}" data-action="day" data-date="${d.date}" aria-pressed="${d.date===day.date}"><span>${displayDate(d.date)}</span><strong>${d.disabled?'—':d.used}<small> / ${d.capacity}분</small></strong><i style="--fill:${d.used/Math.max(1,d.capacity)*100}%"></i><small>${d.items.length?`${d.items.length}개 할일`:'여유 시간'}</small></button>`).join('')}</div></div></section><section class="panel day-detail"><span class="eyebrow">DAY PLAN</span><h2>${displayDate(day.date)} 할일</h2>${day.items.map(x=>`<article class="session"><span class="session-dot"></span><div><h3>${esc(x.title)}</h3><p>${x.minutes}분 작업${x.manual?' · 내가 정한 시간':''}</p></div></article>`).join('')||'<p class="muted">배치된 작업이 없어요.</p>'}<div class="day-total">남는 시간 <strong>${day.capacity-day.used}분</strong></div>${p.overflow.length?`<h3 class="warning-text">배치하지 못한 작업</h3>${p.overflow.map(x=>`<p>${esc(data.tasks.find(t=>t.id===x.id)?.title)}<br><strong>${x.minutes}분</strong> · ${x.reason}</p>`).join('')}`:''}<p class="muted">현재 시각과 마감 시각을 분 단위로 반영해요. 수업·휴식 시간대는 모르므로 실제 가능한 일일 시간을 설정하세요. 14일 이후 마감 할일은 아직 배치하지 않아요.</p></section></div>`;}
function history(){return `<section class="panel"><div class="panel-heading"><h2>할일별 원문과 수정 이력</h2><span class="pill neutral">${cloud.user&&!demo?'내 계정에 보관':'이 브라우저에 보관'}</span></div>${data.tasks.length?data.tasks.map(t=>`<details class="history-item"><summary><span>${esc(t.title)}</span><small>${t.history.length}번 수정 · 현재 ${displayDate(t.fields.due)}</small></summary><h3>현재 원문 · 작성일 ${displayDate(t.sourceDate)}</h3><pre>${esc(t.source)}</pre>${t.history.slice().reverse().map((h,i)=>`<div class="version"><strong>이전 버전 ${t.history.length-i}</strong><p class="muted">보관 시각 ${esc(h.at)} · 원문 작성일 ${displayDate(h.sourceDate)}</p><pre>${esc(h.source)}</pre>${h.fields?`<p>당시 확인한 마감: ${esc(h.fields.due||'미정')} · 남은 시간 ${esc(h.minutes)}분</p>`:''}</div>`).join('')}<button class="button danger" data-action="delete" data-id="${esc(t.id)}">이 할일 삭제</button></details>`).join(''):'<div class="empty"><h3>아직 변경 기록이 없어요</h3><p>공지를 등록하고 수정하면 이전 원문이 여기에 남아요.</p></div>'}</section>`;}
function render(){
  if(data.acceptedPlan&&(data.acceptedPlan.start!==today()||data.acceptedPlan.policy!=='previous-day'))data.acceptedPlan=null;
  if(!demo&&cloud.user&&!data.profile?.onboarded&&!['settings','account'].includes(view))view='settings';
  if(!['dashboard','notice','planner','study','history','settings','account','admin'].includes(view))view='dashboard';
  if(location.hash.slice(1)!==view){
    if(window.history.state?.radar)window.history.pushState({radar:true,depth:(window.history.state.depth||0)+1},'', '#'+view);
    else window.history.replaceState({radar:true,depth:0},'', '#'+view);
  }
  persistDraft();applyAppearance(data.profile?.appearance);
  $('#app').innerHTML=`${nav()}<div class="workspace"><div class="topbar"><span>내 시간을 알고, 가볍게 시작하기.</span><span class="status-chip">${demo?'DEMO · 실제 데이터와 분리':cloud.user?'CLOUD · 나만의 공간':'LOCAL · 로그인 전 공간'}</span></div><main id="main">${view!=='dashboard'?'<button class="text-button back-button" data-action="back">← 뒤로가기</button>':''}${heading()}<div class="save-strip"><span id="save-status" role="status">${esc(cloud.status)}</span>${cloud.user?'<button class="text-button" data-action="retry-save">저장 재시도</button>':''}</div>${storageError?`<div class="alert" role="alert">${esc(storageError)}</div>`:''}${demo?'<div class="demo-banner">예제 체험 중 · 예제를 수정해도 내 데이터는 바뀌지 않아요.</div>':''}${cloud.user&&!demo&&hasLocalTasks()?'<div class="demo-banner">이 브라우저에 로그인 전 기록이 남아 있어요. <button class="text-button" data-action="migrate-local">내 계정으로 가져오기</button></div>':''}${recovery?'<div class="alert">이전 탭의 미저장 내용과 서버 내용이 충돌합니다. <button data-action="recover-export">미저장 내용 백업</button></div>':''}${booting?'<section class="panel"><h2>내 저장 공간을 확인하고 있어요…</h2></section>':({dashboard,notice,planner,history,study:()=>studyPage(data.tasks,capacities(),today(),studyState.taskId,studyState.problem,mathResult),settings:()=>settingsPage(data.profile,!data.profile?.onboarded)+appearancePanel(data.profile)+remindersPanel(data.profile),account:()=>authPage(cloud.user)+`<p class="auth-message" role="status">${esc(authMessage)}</p>`,admin:()=>adminPanel()}[view])()}<footer>메타시간표 · 규칙 기반 해석 / 외부 AI 전송 없음 <span>${cloud.user?'승인한 내용은 계정에 저장 · 작성 중 초안은 이 탭에 임시 보관':'로그인 전 기록은 이 브라우저에만 보관됩니다.'}</span></footer></main></div>`;
  if(view==='notice'&&draft){$('#notice-text').value=draft.source;$('#source-form [name="sourceDate"]').value=draft.sourceDate;}
  restoreForms();restoreStudyForms();restoreQuickForms();updateQuickHint();updateTimer();updateLiveClock();
  $('#app').inert=booting;
}
function openRevision(id){if(draft&&!confirm('작성 중인 분석 초안을 새 공지로 바꿀까요?'))return;forms={};selected='';noticeState=null;draft=null;view='notice';render();window.scrollTo(0,0);}
document.addEventListener('submit',event=>{
  if(['source-form','review-form'].includes(event.target.id)&&(storageLocked||cloud.locked)&&!demo){event.preventDefault();return toast('저장을 할 수 없는 상태입니다. 상단 안내를 확인하고 현재 내용을 백업해 주세요.');}
  if(event.target.id==='source-form'){
    event.preventDefault();const f=new FormData(event.target),source=String(f.get('source')).trim(),sourceDate=String(f.get('sourceDate'));
    try{noticeState={source,sourceDate,rows:inspectNotice(source,data.tasks,sourceDate)};draft=null;delete forms['review-form'];delete forms['notice-apply-form'];render();$('#notice-preview')?.scrollIntoView({behavior:'smooth',block:'start'});}catch(error){toast(error.message);}
  }
  if(event.target.id==='review-form'){
    event.preventDefault();if(!draft)return toast('먼저 공지를 분석해 주세요.');if(forms['source-form']&&(forms['source-form'].source.trim()!==draft.source||forms['source-form'].sourceDate!==draft.sourceDate))return toast('원문이 바뀌었습니다. 다시 분석한 후 승인해 주세요.');const f=new FormData(event.target);const title=String(f.get('title')).trim();if(!title)return toast('할일 이름을 입력해 주세요.');
    const fields=Object.fromEntries(Object.keys(FIELDS).map(k=>[k,String(f.get(k)||'').trim()||null]));
    if(fields.due&&!validDate(fields.due))return toast('마감 날짜를 확인해 주세요.');
    const totalMinutes=Number(f.get('minutes')),completedMinutes=Number(f.get('completedMinutes')),priority=Number(f.get('priority')),difficulty=Number(f.get('difficulty')),problemCount=Number(f.get('problemCount'));
    if(!Number.isInteger(totalMinutes)||totalMinutes<0||totalMinutes>10080||!Number.isInteger(completedMinutes)||completedMinutes<0||completedMinutes>totalMinutes)return toast('소요 시간과 완료 시간을 확인해 주세요. 완료 시간이 전체보다 클 수 없어요.');
    if(!Number.isInteger(priority)||priority<1||priority>3||!Number.isInteger(difficulty)||difficulty<1||difficulty>5||!Number.isInteger(problemCount)||problemCount<0||problemCount>200)return toast('중요도·난이도·문제 수의 입력 범위를 확인해 주세요.');
    const current=draft.old&&data.tasks.find(t=>t.id===draft.old.id);
    if(draft.old&&(!current||JSON.stringify(current)!==JSON.stringify(draft.old)))return toast('초안을 연 뒤 할일 기록이 바뀌었습니다. 최신 할일을 다시 수정해 주세요.');
    if(problemCount<(draft.old?.problems?.length||0)&&!confirm('문제 수를 줄이면 뒤쪽 문제의 상태와 메모가 삭제됩니다. 계속할까요?'))return;
    const minutes=totalMinutes-completedMinutes;
    const before=plan(data.tasks,capacities()).totalShortage;
    const task={...draft.old,id:draft.old?.id||crypto.randomUUID(),title,category:draft.old?taskCategory(draft.old):parseQuick(draft.source,draft.sourceDate).category,kindVersion:1,source:draft.source,sourceDate:draft.sourceDate,fields,minutes,totalMinutes,completedMinutes,priority,difficulty,problems:resizeProblems(draft.old?.problems,problemCount),studyLog:draft.old?.studyLog||[],done:draft.old?.done||false,history:draft.old?[...draft.old.history,{source:draft.old.source,sourceDate:draft.old.sourceDate,fields:draft.old.fields,minutes:draft.old.minutes,at:new Date().toLocaleString('ko-KR')}].slice(-100):[]};
    if(draft.old)data.tasks=data.tasks.map(t=>t.id===task.id?task:t);else data.tasks.push(task);
    invalidate();draft=null;forms={};view='planner';render();window.scrollTo(0,0);const after=plan(data.tasks,capacities()).totalShortage;
    toast(`내용을 반영했어요. 배치하지 못한 시간: ${before}분 → ${after}분`);
  }
});
document.addEventListener('change',event=>{
  
  if(event.target.id==='capacity'){const n=Number(event.target.value);if(!Number.isFinite(n)||n<15||n>720||n%15){event.target.value=data.capacity;return toast('15~720분 사이에서 15분 단위로 입력해 주세요.');}data.capacity=n;invalidate();render();}
  if(event.target.id==='import'){
    const file=event.target.files[0];if(!file)return;if(file.size>5_000_000)return toast('5MB 이하의 백업만 불러올 수 있어요.');
    file.text().then(text=>{const imported=JSON.parse(text);if(!validateBackup(imported))throw new Error();if(!confirm(`${demo?'예제':'현재'} 공간의 할일 ${data.tasks.length}개를 백업 내용으로 교체할까요? 먼저 백업을 내려받는 것을 권장합니다.`))return;data=upgrade({...imported,acceptedPlan:null});resetStudy();storageLocked=false;save();draft=null;forms={};selected='';view='dashboard';render();toast('백업을 불러왔어요.');}).catch(()=>toast('올바른 메타시간표 백업 파일이 아닙니다. 현재 데이터는 그대로예요.'));
  }
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;event.preventDefault();const {action,id}=button.dataset;
  if(['done','delete','approve-plan'].includes(action)&&(storageLocked||cloud.locked)&&!demo)return toast('현재 저장이 잠겨 있습니다. 상단 안내를 확인해 주세요.');
  if(action==='view'||action==='home'){view=action==='home'?'dashboard':button.dataset.view;render();window.scrollTo(0,0);}
  if(action==='demo')changeDemo();
  if(action==='new'){if(!draft&&!forms['source-form']){selected='';forms={};}view='notice';render();window.scrollTo(0,0);$('#notice-text')?.focus();}
  if(action==='open-revision'||action==='revise')openRevision(id);
  if(action==='sample-revision'){openRevision('demo-physics');$('#notice-text').value=`물리 탐구 보고서\n${addDays(today(),2)} 17시까지 보고서 4쪽\n제출 방식: PDF\n장소: 물리실\n준비물: 실험 기록지, 그래프\n평가 기준: 실험 근거와 결론`;captureForms();toast('수정 공지를 채웠어요. 분석 후 남은 시간을 240분으로 바꿔 비교해 보세요.');}
  if(action==='edit'){if(draft&&!confirm('작성 중인 초안을 닫고 이 할일을 수정할까요?'))return;forms={};const old=data.tasks.find(t=>t.id===id);draft={old,edit:true,source:old.source,sourceDate:old.sourceDate,analysis:analyze(old.source,old.sourceDate)};selected=id;view='notice';render();$('#review').scrollIntoView({behavior:'smooth'});}
  if(action==='done'){const task=data.tasks.find(t=>t.id===id);task.done=!task.done;invalidate();render();}
  if(action==='day'){if(button.disabled||button.dataset.date<today())return;daySelected=button.dataset.date;view='planner';render();}
  if(action==='approve-plan'){data.acceptedPlan={at:new Date().toISOString(),start:today(),policy:'previous-day'};save();render();toast('계획을 승인했어요. 할일이나 일일 시간을 바꾸면 다시 확인받습니다.');}
  if(action==='cancel-draft'){if(confirm('분석 및 수정 초안을 지울까요? 승인한 할일은 유지됩니다.')){draft=null;delete forms['review-form'];render();}}
  if(action==='copy-questions'){const text=[...draft.analysis.issues,...draft.analysis.questions].join('\n');try{await navigator.clipboard.writeText(text);toast('질문을 복사했어요.');}catch{toast('복사 권한이 없습니다. 화면의 질문을 선택해서 복사해 주세요.');}}
  if(action==='delete'){const task=data.tasks.find(t=>t.id===id);if(confirm(`‘${task.title}’와 변경 이력을 삭제할까요? 앱에서는 되돌릴 수 없으며, 저장한 백업으로 복원할 수 있습니다.`)){data.tasks=data.tasks.filter(t=>t.id!==id);invalidate();render();toast('할일과 변경 이력을 삭제했어요.');}}
  if(action==='export'){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`byeonsaeng-${demo?'demo-':''}${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('백업에는 공지 원문이 포함돼요. 안전하게 보관하세요.');}
});
window.addEventListener('storage',event=>{if(event.key===KEY&&!demo&&!cloud.user){storageLocked=true;storageError='다른 탭에서 저장 내용이 바뀌었어요. 충돌을 막기 위해 이 탭의 저장을 멈췄습니다. 새로고침 후 이어서 사용하세요.';render();}});
if(data.acceptedPlan?.start!==today()||data.acceptedPlan?.policy!=='previous-day')data.acceptedPlan=null;
cloud.onStatus=text=>{if($('#save-status'))$('#save-status').textContent=text;};
window.addEventListener('popstate',()=>{view=location.hash.slice(1)||'dashboard';render();});
document.addEventListener('input',event=>{if(event.target.closest('#source-form,#review-form,#settings-form,#notice-apply-form,#appearance-form,#reminder-settings-form'))captureForms();});
document.addEventListener('change',event=>{if(event.target.closest('#source-form,#review-form,#settings-form,#notice-apply-form,#appearance-form,#reminder-settings-form'))captureForms();});
render();
bootstrap();
function draftKey(){return 'radar-draft-'+(demo?'demo':cloud.user?.id||'guest');}
function persistDraft(){if(booting||demo)return;try{sessionStorage.setItem(draftKey(),JSON.stringify({forms,draft,selected,studyState,quickState,noticeState}));}catch{storageError='작성 중 초안을 임시 보관하지 못했습니다. 이 탭을 닫기 전에 내용을 복사해 주세요.';}}
function restoreDraft(){try{const p=JSON.parse(sessionStorage.getItem(draftKey())||'null');if(p&&typeof p.forms==='object'){forms=p.forms;if(p.noticeState?.rows)noticeState=p.noticeState;if(p.quickState?.forms&&p.quickState?.notes)quickState=p.quickState;if(p.studyState?.forms&&typeof p.studyState.forms==='object')studyState=p.studyState;selected=typeof p.selected==='string'?p.selected:'';if(p.draft?.analysis&&typeof p.draft.source==='string'&&validDate(p.draft.sourceDate))draft=p.draft;}}catch{toast('이 탭의 초안을 읽지 못했습니다. 저장된 할일에는 영향이 없어요.');}}
function captureForms(){
  for(const id of ['source-form','review-form','settings-form','notice-apply-form','appearance-form','reminder-settings-form']){
    const f=document.getElementById(id);if(!f)continue;
    forms[id]=Object.fromEntries(new FormData(f));for(const c of f.querySelectorAll('[type="checkbox"]'))forms[id][c.name]=c.checked;if(id==='review-form')forms[id].acknowledged=!!f.elements.acknowledged.checked;
  }
  persistDraft();
}
function restoreForms(){for(const [id,values] of Object.entries(forms)){const f=document.getElementById(id);if(!f)continue;for(const [key,value] of Object.entries(values)){const el=f.elements.namedItem(key);if(!el)continue;if(el.type==='checkbox')el.checked=!!value;else el.value=value;}}}
function hasLocalTasks(){try{return !!JSON.parse(localStorage.getItem(KEY))?.tasks?.length;}catch{return false;}}
function quickKey(f){return f.id+':'+(f.id==='quick-edit-form'?f.elements.namedItem('taskId')?.value||'':'');}
function restoreQuickForms(){
  for(const id of quickFormIds){const f=document.getElementById(id);if(!f)continue;const values=quickState.forms[quickKey(f)];if(values)for(const [k,v] of Object.entries(values)){const el=f.elements.namedItem(k);if(el&&el.type!=='hidden'){if(el.type==='checkbox')el.checked=!!v;else el.value=v;}}}
  for(const f of document.querySelectorAll('.task-note-form'))if(Object.hasOwn(quickState.notes,f.dataset.taskId))f.elements.note.value=quickState.notes[f.dataset.taskId];
}
function captureQuickForms(){
  for(const id of quickFormIds){const f=document.getElementById(id);if(!f)continue;const values=Object.fromEntries(new FormData(f));for(const c of f.querySelectorAll('[type="checkbox"]'))values[c.name]=c.checked;quickState.forms[quickKey(f)]=values;}
  persistDraft();
}
function updateQuickHint(){const hint=$('#quick-hint');if(!hint)return;if(!quickState.text.trim()){hint.textContent='날짜·과목·소요 시간·준비물·구매를 문장에서 읽어요.';return;}try{const rows=parseBatch(quickState.text,today());if(rows.length!==1){hint.textContent=rows.length+'개 할일 후보 · 추가를 누르면 한 번에 확인할 수 있어요.';return;}const r=rows[0];hint.textContent=[r.fields.due||'마감 미정',CATEGORIES[r.category],r.fields.subject,r.totalMinutes+'분'+(r.minutesEstimated?' (추정)':''),r.fields.materials?'준비물: '+r.fields.materials:'',...r.warnings].filter(Boolean).join(' · ');}catch(error){hint.textContent=error.message;}}
function addQuickRows(rows){
  if(data.tasks.length+rows.length>300)throw new Error('할일은 최대 300개까지 저장할 수 있어요.');
  const made=rows.map(r=>createQuickTask(r,crypto.randomUUID())),known=new Set(data.tasks.map(duplicateKey)),unique=[];
  for(const t of made){const key=duplicateKey(t);if(known.has(key))continue;known.add(key);unique.push(t);}
  if(!unique.length)throw new Error('같은 제목·마감·분류의 할일이 이미 있어요. 기존 할일의 수정 버튼을 이용하세요.');
  data.tasks.push(...unique);quickState.text='';quickState.batch=null;delete quickState.forms['batch-form:'];invalidate();render();toast(unique.length+'개 추가했어요.'+(made.length>unique.length?' 중복 항목은 제외했어요.':''));$('#quick-text')?.focus();
}
document.addEventListener('input',event=>{
  if(event.target.id==='quick-text'){quickState.text=event.target.value;quickState.batch=null;delete quickState.forms['batch-form:'];$('#batch-form')?.remove();event.target.rows=Math.min(6,Math.max(1,event.target.value.split('\n').length));updateQuickHint();persistDraft();}
  if(quickFormIds.some(id=>event.target.closest('#'+id)))captureQuickForms();
  const note=event.target.closest('.task-note-form');if(note){quickState.notes[note.dataset.taskId]=note.elements.note.value;persistDraft();}
});
document.addEventListener('change',event=>{if(quickFormIds.some(id=>event.target.closest('#'+id)))captureQuickForms();});
document.addEventListener('keydown',event=>{if(event.target.id==='quick-text'&&event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('#quick-form').requestSubmit();}});
document.addEventListener('submit',event=>{
  const f=event.target;if(!['quick-form',...quickFormIds].includes(f.id)&&!f.matches('.task-note-form'))return;event.preventDefault();
  if((storageLocked||cloud.locked)&&!demo)return toast('저장이 잠겨 있어요. 상단 안내를 확인해 주세요.');
  const values=Object.fromEntries(new FormData(f));
  try{
    if(f.id==='quick-form'){const rows=parseBatch(values.text,today());if(!rows.length)throw new Error('할일을 한 줄 입력해 주세요.');if(rows.length===1)return addQuickRows(rows);quickState.batch=rows;render();return;}
    if(f.id==='batch-form'){
      const rows=quickState.batch.flatMap((r,i)=>values['include-'+i]?[{...r,title:values['title-'+i],category:values['category-'+i],totalMinutes:Number(values['minutes-'+i]),fields:{...r.fields,due:values['due-'+i]||null,subject:values['subject-'+i].trim()||null}}]:[]);
      if(!rows.length)throw new Error('추가할 항목을 선택해 주세요.');return addQuickRows(rows);
    }
    if(f.matches('.task-note-form')){const task=data.tasks.find(t=>t.id===f.dataset.taskId);if(!task||values.note.length>2000)throw new Error('메모를 확인해 주세요.');task.note=values.note.trim();delete quickState.notes[task.id];save();persistDraft();return toast('메모를 저장했어요.');}
    if(f.id==='quick-edit-form'){
      const t=data.tasks.find(t=>t.id===values.taskId),totalMinutes=Number(values.totalMinutes),completedMinutes=Number(values.completedMinutes),priority=Number(values.priority),difficulty=Number(values.difficulty);
      if(!t)throw new Error('할일을 다시 선택해 주세요.');
      if(!values.title.trim()||!Number.isInteger(totalMinutes)||totalMinutes<1||totalMinutes>10080||!Number.isInteger(completedMinutes)||completedMinutes<0||completedMinutes>totalMinutes||![1,2,3].includes(priority)||![1,2,3,4,5].includes(difficulty)||!Object.hasOwn(CATEGORIES,values.category)||values.due&&!validDate(values.due)||values.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.time))throw new Error('제목·날짜·시간을 확인해 주세요. 완료 시간은 총 시간 이하로 입력해 주세요.');
      const next={...t,title:values.title.trim(),totalMinutes,completedMinutes,minutes:totalMinutes-completedMinutes,minutesEstimated:false,priority,difficulty,category:values.category,kindVersion:1,note:values.note.trim(),fields:{...t.fields,...Object.fromEntries(['due','time','subject','materials','place','cost','amount','format'].map(k=>[k,values[k].trim()||null]))},history:[...t.history,{source:t.source,sourceDate:t.sourceDate,fields:t.fields,minutes:t.minutes,at:new Date().toLocaleString('ko-KR')}].slice(-100)};
      if(!validateBackup({...upgrade(data),tasks:data.tasks.map(x=>x.id===t.id?next:x)}))throw new Error('입력 길이와 범위를 확인해 주세요.');
      data.tasks=data.tasks.map(x=>x.id===t.id?next:x);quickState.editId='';delete quickState.forms[quickKey(f)];delete quickState.notes[t.id];invalidate();render();return toast('할일을 수정하고 계획을 다시 계산했어요.');
    }
    if(f.id==='pin-form'){
      const t=data.tasks.find(t=>t.id===values.taskId),minutes=Number(values.minutes),date=values.date;
      if(!t||t.done||!academic(t)||!validDate(date)||date<today()||!t.fields.due||date>finishBy(t)||!Number.isInteger(minutes)||minutes<1)throw new Error('오늘부터 전날 완료 목표 사이 날짜와 양수 시간을 입력해 주세요. 마감 미정이면 먼저 마감을 정해 주세요.');
      const slots=(t.planSlots||[]).filter(s=>s.date!==date&&s.date>=today());
      if(slots.length>=100||slots.reduce((n,s)=>n+s.minutes,0)+minutes>remainingMinutes(t))throw new Error('직접 배치한 합계가 남은 시간을 넘어요. 기존 직접 계획을 먼저 줄여 주세요.');
      const occupied=data.tasks.filter(x=>!x.done&&x.id!==t.id).reduce((n,x)=>n+(x.planSlots||[]).filter(s=>s.date===date).reduce((a,s)=>a+s.minutes,0),0),day=plan([],capacities(),date,1).days[0];
      if(occupied+minutes>day.capacity)throw new Error('이 날의 일일 시간을 넘어요. 직접 계획을 줄이거나 날짜별 시간을 조정해 주세요.');
      t.planSlots=[...slots,{date,minutes}];delete quickState.forms[quickKey(f)];invalidate();render();return toast('직접 정한 시간을 먼저 확보했어요. 다른 할일의 부족 경고도 확인해 주세요.');
    }
    if(f.id==='date-capacity-form'){
      const date=values.date,n=Number(values.minutes);if(!validDate(date)||!Number.isInteger(n)||n<0||n>720||!['add','subtract','set'].includes(values.mode))throw new Error('날짜와 0~720분 사이 시간을 확인해 주세요.');
      data=upgrade(data);const overrides={...data.profile.dateOverrides},base=overrides[date]??data.profile.weeklyMinutes[new Date(date+'T12:00:00').getDay()],value=values.mode==='set'?n:base+(values.mode==='add'?n:-n);
      if(value<0||value>720)throw new Error('변경 후 일일 시간은 0~720분이어야 해요.');
      overrides[date]=value;if(Object.keys(overrides).length>366)throw new Error('날짜별 조정은 366개까지 보관할 수 있어요. 지난 조정을 해제해 주세요.');
      data.profile.dateOverrides=overrides;delete quickState.forms[quickKey(f)];invalidate();render();return toast(date+'의 일일 시간을 '+value+'분으로 바꿨어요.');
    }
  }catch(error){toast(error.message);}
});
function reminderKey(){return 'meta-reminders-'+(cloud.user?.id||'guest');}
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;
  if(action==='quick-focus'){view='dashboard';render();$('#quick-text')?.focus();$('#quick-text')?.scrollIntoView({block:'center'});}
  if(action==='quick-edit'){quickState.editId=id;view='dashboard';render();$('#quick-editor')?.scrollIntoView({block:'start'});}
  if(action==='quick-close'){quickState.editId='';render();}
  if(action==='batch-cancel'){quickState.batch=null;delete quickState.forms['batch-form:'];render();}
  if(['unpin','reset-date'].includes(action)){if((storageLocked||cloud.locked)&&!demo)return toast('현재 저장이 잠겨 있습니다.');if(action==='unpin'){const t=data.tasks.find(t=>t.id===id);if(t)t.planSlots=(t.planSlots||[]).filter(s=>s.date!==b.dataset.date);}else if(data.profile?.dateOverrides)delete data.profile.dateOverrides[b.dataset.date];invalidate();render();}
  try{
    if(action==='enable-reminders'){await enableReminders();localStorage.setItem(reminderKey(),'enabled');$('#reminder-status').textContent='이 계정의 브라우저 알림을 켰어요. 사이트를 열어 두어야 작동해요.';}
    if(action==='disable-reminders'){localStorage.removeItem(reminderKey());$('#reminder-status').textContent='이 계정의 자동 알림을 껐어요.';}
    if(action==='calendar-export'){
      if(!data.tasks.some(t=>!t.done&&t.fields.due))return toast('마감일이 있는 진행 중 할일을 먼저 추가해 주세요.');
      const url=URL.createObjectURL(new Blob([calendarFile(data.tasks)],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='meta-timetable.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('캘린더 앱에서 가져오세요. 개인 할일 정보가 포함된 파일입니다.');
    }
  }catch(error){if($('#reminder-status'))$('#reminder-status').textContent=error.message;else toast(error.message);}
});
async function checkReminders(){
  if(booting||demo||typeof Notification==='undefined'||Notification.permission!=='granted')return;
  try{if(localStorage.getItem(reminderKey())!=='enabled')return;const now=Date.now(),key=reminderKey()+'-sent',sent=JSON.parse(localStorage.getItem(key)||'{}'),prefs=data.profile?.reminderSettings||defaultReminders();
    if(data.tasks.some(t=>!t.done&&academic(t)))for(const time of scheduledReminderSlots(prefs,new Date(now))){const tag='daily:'+today()+':'+time;if(!sent[tag]){await showReminder('설정한 알림 시각이에요. 오늘의 할일과 계획을 확인해 보세요.');sent[tag]=now;}}
    for(const t of data.tasks.filter(t=>prefs.deadline&&!t.done&&t.fields.due)){const due=deadlineStamp(t),tag=t.id+':'+due;if(due>=now&&due-now<=1800000&&!sent[tag]){await showReminder('곧 마감인 할일이 있어요. 메타시간표에서 확인하세요.');sent[tag]=now;}}
    for(const [k,n] of Object.entries(sent))if(now-n>172800000)delete sent[k];localStorage.setItem(key,JSON.stringify(sent));
    if(prefs.focus&&studyState.timer&&studyState.timer.endsAt<=now&&!studyState.timer.notified){await showReminder('5분이 지났어요. 실제로 진행한 시간을 기록해 보세요.');studyState.timer.notified=true;persistDraft();}
  }catch{/* No personal data in browser logs; permissions/storage may be unavailable. */}
}
setInterval(checkReminders,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkReminders();});
function studyFormKey(form){return form.id+':'+(form.elements.namedItem('taskId')?.value||'')+':'+(form.elements.namedItem('number')?.value||'');}
function captureStudyForms(){for(const id of studyFormIds){const f=document.getElementById(id);if(f)studyState.forms[studyFormKey(f)]=Object.fromEntries(new FormData(f));}persistDraft();}
function restoreStudyForms(){for(const id of studyFormIds){const f=document.getElementById(id);if(!f)continue;const values=studyState.forms[studyFormKey(f)];if(values)for(const [k,v] of Object.entries(values)){const input=f.elements.namedItem(k);if(input&&input.type!=='hidden')input.value=v;}}}
function updateTimer(){
  const clock=$('#focus-clock'),note=$('#focus-note');if(!clock)return;
  const timer=studyState.timer,taskId=$('#study-select')?.value;
  if(!timer||timer.taskId!==taskId){clock.textContent='05:00';return;}
  const seconds=Math.max(0,Math.ceil((timer.endsAt-Date.now())/1000));
  clock.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  note.textContent=seconds?'다른 화면에 갔다 와도 이어집니다. 자동으로 진행 시간에 더하지 않아요.':'5분이 지났어요. 실제로 진행한 시간만 아래에 기록해 주세요.';
  const start=$('[data-action="focus-start"]');if(start){start.disabled=seconds>0;start.textContent=seconds?'5분 시작 진행 중':'다시 5분 시작';}
}
setInterval(updateTimer,1000);
document.addEventListener('input',event=>{if(studyFormIds.some(id=>event.target.closest('#'+id))){if(event.target.closest('#quadratic-form')){mathResult=null;$('#quadratic-result')?.remove();}captureStudyForms();}});
document.addEventListener('change',event=>{
  if(event.target.id==='study-select'){captureStudyForms();studyState.taskId=event.target.value;studyState.problem=1;render();}
  else if(studyFormIds.some(id=>event.target.closest('#'+id)))captureStudyForms();
});
document.addEventListener('submit',event=>{
  if(!studyFormIds.includes(event.target.id))return;event.preventDefault();
  const form=event.target,f=Object.fromEntries(new FormData(form)),task=data.tasks.find(t=>t.id===f.taskId);
  if(form.id!=='quadratic-form'&&(storageLocked||cloud.locked)&&!demo)return toast('현재 저장이 잠겨 있습니다. 상단 안내를 확인해 주세요.');
  try{
    captureStudyForms();
    if(form.id==='quadratic-form'){mathResult=quadratic(Number(f.a),Number(f.b),Number(f.c));render();return;}
    if(!task)throw new Error('할일을 찾지 못했습니다. 다시 선택해 주세요.');
    if(form.id==='progress-form'){
      const next=recordStudy(task,Number(f.worked),crypto.randomUUID(),new Date().toISOString());
      data.tasks=data.tasks.map(t=>t.id===task.id?next:t);studyState.timer=null;invalidate();
    }
    if(form.id==='problem-count-form'){
      const count=Number(f.count);if(!Number.isInteger(count)||count<0||count>200)throw new Error('문제 수는 0~200 사이 정수로 입력해 주세요.');
      if(count<(task.problems?.length||0)&&!confirm('뒤쪽 문제의 상태와 메모가 삭제됩니다. 문제 수를 줄일까요?'))return;
      task.problems=resizeProblems(task.problems,count);studyState.problem=Math.min(studyState.problem,count)||1;
      for(const key of Object.keys(studyState.forms))if(key.startsWith('problem-form:'+task.id+':')&&Number(key.split(':').at(-1))>count)delete studyState.forms[key];save();
    }
    if(form.id==='problem-form'){
      const problem=task.problems?.find(p=>p.number===Number(f.number));
      if(!problem||!['todo','stuck','solved'].includes(f.status)||!Object.hasOwn(BLOCK_REASONS,f.reason)||f.note.length>2000||f.tried.length>2000)throw new Error('문제 상태와 입력 길이를 확인해 주세요.');
      Object.assign(problem,{status:f.status,reason:f.reason,note:f.note.trim(),tried:f.tried.trim()});save();
    }
    delete studyState.forms[studyFormKey(form)];render();toast(form.id==='progress-form'?'진행 시간을 기록하고 남은 계획을 다시 계산했어요.':'문제판에 반영했어요. 상단 저장 상태를 확인해 주세요.');
  }catch(error){toast(error.message);}
});
document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;
  if(!['study-task','problem-open','focus-start','focus-reset','undo-study','math-copy'].includes(action))return;
  event.preventDefault();captureStudyForms();const task=data.tasks.find(t=>t.id===id);
  try{
    if(action==='study-task'){studyState.taskId=id;studyState.problem=1;view='study';render();window.scrollTo(0,0);}
    if(action==='problem-open'){studyState.taskId=id;studyState.problem=Number(b.dataset.number);render();}
    if(action==='focus-start'){
      if(!task||task.done)return;
      if(studyState.timer&&studyState.timer.endsAt>Date.now()&&studyState.timer.taskId!==id&&!confirm('다른 할일의 타이머를 중단하고 이 할일로 시작할까요?'))return;
      studyState.timer={taskId:id,endsAt:Date.now()+300000};persistDraft();updateTimer();
    }
    if(action==='focus-reset'){studyState.timer=null;persistDraft();render();}
    if(action==='undo-study'){
      if((storageLocked||cloud.locked)&&!demo)throw new Error('현재 저장이 잠겨 있습니다.');
      if(!confirm('이 진행 기록을 취소하고 완료 시간을 되돌릴까요?'))return;
      const next=undoStudy(task,b.dataset.log);data.tasks=data.tasks.map(t=>t.id===id?next:t);invalidate();render();toast('진행 기록을 취소하고 계획을 다시 계산했어요.');
    }
    if(action==='math-copy'){const p=task?.problems?.find(p=>p.number===Number(b.dataset.number));if(p){try{await navigator.clipboard.writeText(questionDraft(task,p));toast('질문 초안을 복사했어요.');}catch{toast('복사 권한이 없습니다. 화면의 질문을 선택해서 복사해 주세요.');}}}
  }catch(error){toast(error.message);}
});
function adminPanel(){return cloud.user?.role==='admin'?'<section class="panel"><h2>운영 현황</h2><p>전체 계정 '+(adminStats?.accounts??'…')+'개 · 첫 설정 완료 '+(adminStats?.configured??'…')+'개</p><p class="muted">다른 회원의 할일·학교·시간표는 표시하지 않습니다.</p><button class="button secondary" data-action="admin-refresh">현황 새로고침</button></section>':'<div class="alert">관리자만 볼 수 있는 페이지입니다.</div>';}
async function bootstrap(){
  booting=true;
  try{
    const result=await loadCloud();
    if(result){if(!validateBackup(result.data))throw new Error('서버 저장 데이터를 읽지 못했습니다.');data=upgrade(result.data);recovery=result.recovery||null;storageLocked=!!recovery;}
    view=location.hash.slice(1)||'dashboard';forms={};draft=null;restoreDraft();
    if(cloud.user?.role==='admin')adminStats=await api('/api/admin');
  }catch(error){storageError=error.message;storageLocked=true;}
  booting=false;render();
}
document.addEventListener('submit',async event=>{
  const id=event.target.id;
  if(!['settings-form','login-form','signup-form','reset-code-form','reset-password-form'].includes(id))return;
  event.preventDefault();const f=Object.fromEntries(new FormData(event.target)),button=event.target.querySelector('button[type="submit"],button');
  if(id==='settings-form'){
    if((storageLocked||cloud.locked)&&!demo)return toast('현재 저장이 잠겨 있습니다. 상단 안내에 따라 백업 후 다시 불러와 주세요.');
    const profile={...data.profile,dateOverrides:data.profile?.dateOverrides||{},name:f.name.trim(),school:f.school.trim(),grade:f.grade.trim(),className:f.className.trim(),weeklyMinutes:Array.from({length:7},(_,d)=>Number(f['capacity-'+d])),timetable:Array.from({length:5},(_,d)=>Array.from({length:8},(_,i)=>f['slot-'+d+'-'+i].trim())),onboarded:true};
    if(!validProfile(profile))return toast('설정 값을 확인해 주세요.');
    data=upgrade(data);data.profile=profile;delete forms[id];invalidate();view='dashboard';render();return toast('개인 설정을 반영했어요. 상단 저장 상태를 확인해 주세요.');
  }
  button.disabled=true;
  try{
    await authAction(id.replace('-form',''),f);
    if(id==='reset-code-form'||id==='reset-password-form')return toast(id==='reset-code-form'?'재설정 이메일을 확인해 주세요.':'비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.');
    demo=false;realData=null;forms={};draft=null;resetStudy();selected='';storageError='';storageLocked=false;view='dashboard';window.history.replaceState({radar:true},'','#dashboard');await bootstrap();
    toast('내 계정에 연결했어요.');
  }catch(error){toast('인증 실패: '+error.message);}
  finally{button.disabled=false;}
});
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button)return;
  const action=button.dataset.action;
  try{
    if(action==='back'){if(window.history.state?.depth>0)window.history.back();else{view='dashboard';render();}}
    if(action==='retry-save'){if(cloud.locked)return toast('충돌 또는 로그인 만료 상태입니다. 백업을 내려받은 후 새로고침해 주세요.');await retrySave();}
    if(action==='logout'){
      persistDraft();await signOut();data=fresh();try{const p=JSON.parse(localStorage.getItem(KEY)||'null');if(validateBackup(p))data=upgrade(p);}catch{}
      draft=null;forms={};resetStudy();selected='';storageError='';storageLocked=false;demo=false;realData=null;view='account';render();
    }
    if(action==='admin-refresh'){adminStats=await api('/api/admin');render();}
    if(action==='migrate-local'){
      const local=JSON.parse(localStorage.getItem(KEY));
      if(!validateBackup(local))throw new Error('이전 기록의 형식을 확인해 주세요.');
      if(!confirm('로그인 전 할일 '+local.tasks.length+'개를 현재 계정에 추가할까요? 원래 브라우저 기록은 그대로 남깁니다.'))return;
      if(data.tasks.length+local.tasks.length>300)throw new Error('합계 300개를 초과합니다.');
      data.tasks.push(...local.tasks.map(t=>({...t,id:crypto.randomUUID()})));invalidate();render();toast('기존 기록을 계정에 추가했습니다. 중복으로 가져오지 않도록 주의해 주세요.');
    }
    if(action==='recover-export'){
      const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(recovery,null,2)],{type:'application/json'}));a.download='radar-unsaved-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
      if(confirm('미저장 백업을 보관했다면 서버 저장본을 다시 불러올까요?')){sessionStorage.removeItem('radar-pending-'+cloud.user.id);location.reload();}
    }
  }catch(error){toast(error.message);}finally{button.disabled=false;}
});

document.addEventListener('submit',event=>{
 if(event.target.id!=='notice-apply-form')return;event.preventDefault();
 if((storageLocked||cloud.locked)&&!demo)return toast('현재 저장이 잠겨 있습니다.');
 try{
  if(!noticeState)throw new Error('먼저 공지를 분석해 주세요.');
  const current=new FormData($('#source-form'));
  if(String(current.get('source')).trim()!==noticeState.source||current.get('sourceDate')!==noticeState.sourceDate)throw new Error('원문이 바뀌었어요. 다시 자동 대조해 주세요.');
  const values=new FormData(event.target),rows=noticeState.rows.flatMap((r,i)=>{
   if(!values.has('include-'+i))return [];
   const n=Number(values.get('minutes-'+i)),due=String(values.get('due-'+i)||'');
   if(!Number.isInteger(n)||n<1||n>10080||due&&!validDate(due))throw new Error('마감일과 소요 시간을 확인해 주세요.');
   const original=r.parsed.minutesEstimated?(r.old?.totalMinutes??r.old?.minutes??r.parsed.totalMinutes):r.parsed.totalMinutes;
   return [{...r,editTitle:String(values.get('title-'+i))!==(r.old?.title||r.parsed.title),editCategory:String(values.get('category-'+i))!==r.parsed.category,parsed:{...r.parsed,title:String(values.get('title-'+i)).trim(),category:String(values.get('category-'+i)),totalMinutes:n,minutesEstimated:n===original?r.parsed.minutesEstimated:false,fields:{...r.parsed.fields,due:due||null,subject:String(values.get('subject-'+i)||'').trim()||null}}}];
  });
  if(!rows.length)throw new Error('반영할 항목을 선택해 주세요.');
  const result=applyNoticeRows(data.tasks,rows,()=>crypto.randomUUID());
  const next={...upgrade(data),tasks:result.tasks};if(!validateBackup(next))throw new Error('입력 범위를 확인해 주세요.');
  data=next;noticeState=null;draft=null;forms={};invalidate();view='dashboard';render();toast(result.updated+'개 수정 · '+result.added+'개 추가 · '+result.skipped+'개 중복/동일 내용 유지');
 }catch(error){toast(error.message);}
});
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-action]');if(!b)return;
 if(b.dataset.action==='notice-cancel'){noticeState=null;delete forms['notice-apply-form'];render();}
 if(b.dataset.action==='notice-target'&&noticeState){
  const r=noticeState.rows[Number(b.dataset.index)],old=data.tasks.find(t=>t.id===b.dataset.id);
  if(!r)return;r.targetId=old?.id||null;r.old=old?structuredClone(old):null;r.choice=old?'update':'new';
  const edited=forms['notice-apply-form'];if(edited)for(const name of Object.keys(edited))if(name.endsWith('-'+b.dataset.index))delete edited[name];render();
 }
});
function updateLiveClock(){
 const now=Date.now(),clock=$('#live-clock');
 if(clock)clock.textContent=new Date(now).toLocaleString('ko-KR',{month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 for(const el of document.querySelectorAll('[data-deadline-id]')){const t=data.tasks.find(t=>t.id===el.dataset.deadlineId);if(t)el.textContent=deadlineLabel(t,now);}
}
let liveMinute=Math.floor(Date.now()/60000),liveDate=today();
function refreshLive(){
 updateLiveClock();const date=today(),minute=Math.floor(Date.now()/60000);
 if(booting||minute===liveMinute&&date===liveDate)return;
 const dateChanged=date!==liveDate;liveMinute=minute;liveDate=date;
 if(dateChanged){data.acceptedPlan=null;if(daySelected<date)daySelected=date;updateQuickHint();const input=$('#source-form [name="sourceDate"]');if(input&&!forms['source-form']?.source)input.value=date;}
 if($('#live-week'))$('#live-week').innerHTML=weekPanel();
 if($('#live-priority')){const opened=$('#live-priority .score-help')?.open;$('#live-priority').innerHTML=summary()+priorityPanel(data.tasks.filter(academic),capacities(),date,plan(data.tasks,capacities()).days[0]);if(opened&&$('#live-priority .score-help'))$('#live-priority .score-help').open=true;}
 if($('#live-plan')){const focused=document.activeElement; if(!$('#live-plan').contains(focused))$('#live-plan').innerHTML=plannerContents();}
 for(const el of document.querySelectorAll('.live-overload'))el.innerHTML=overloadPanel(data.tasks.filter(academic),capacities(),date);
 // Only replace the read-only metrics; never replace a form or steal focus.
 const metrics=$('.study-metrics');if(metrics){const wrapper=document.createElement('div');wrapper.innerHTML=studyPage(data.tasks,capacities(),date,studyState.taskId,studyState.problem,mathResult);const next=wrapper.querySelector('.study-metrics');if(next)metrics.replaceWith(next);}
}
setInterval(refreshLive,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){liveMinute=-1;refreshLive();}});
window.addEventListener('focus',()=>{liveMinute=-1;refreshLive();});

function appearanceValues(form){const f=new FormData(form);return {mode:f.get('mode'),accent:f.get('accent'),background:f.has('customBackground')?f.get('background'):null};}
document.addEventListener('input',event=>{if(event.target.closest('#appearance-form'))applyAppearance(appearanceValues(event.target.closest('form')));});
document.addEventListener('change',event=>{if(event.target.closest('#appearance-form'))applyAppearance(appearanceValues(event.target.closest('form')));});
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-action="palette"]');if(!b||!PALETTES[b.dataset.palette])return;
 const f=$('#appearance-form');f.elements.accent.value=PALETTES[b.dataset.palette][1];captureForms();applyAppearance(appearanceValues(f));
});
document.addEventListener('submit',event=>{
 const f=event.target;if(!['appearance-form','reminder-settings-form'].includes(f.id))return;event.preventDefault();
 if((storageLocked||cloud.locked)&&!demo)return toast('현재 저장이 잠겨 있어요.');
 try{
  data=upgrade(data);
  if(f.id==='appearance-form'){const p=appearanceValues(f);if(!validAppearance(p))throw new Error('색상과 테마를 확인해 주세요.');data.profile.appearance=p;}
  else{const values=new FormData(f),p={times:[0,1,2].map(i=>values.get('time-'+i)).filter(Boolean).sort(),weekdays:[1,2,3,4,5,6,0].filter(d=>values.has('day-'+d)),deadline:values.has('deadline'),focus:values.has('focus')};if(!validReminders(p))throw new Error('중복되지 않는 알림 시각(최대 3개)과 받을 요일을 선택해 주세요.');data.profile.reminderSettings=p;}
  delete forms[f.id];save();render();toast(f.id==='appearance-form'?'테마를 저장했어요.':'알림 시각을 저장했어요. 아래에서 브라우저 알림도 허용해 주세요.');
 }catch(error){toast(error.message);}
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>applyAppearance(data.profile?.appearance));
