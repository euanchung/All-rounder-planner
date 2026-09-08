// Explicit tokens only. Durations such as '2분 스피치' are content, never workload.
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const known=['물리학','물리','화학','생명과학','생물','지구과학','지구','수학','미적분','확률과 통계','확통','적통','기백','기하','국어','영어','한국사','역사','정보','사회','음악','미술','체육','회화','R&E'];
export function subjectsFrom(profile={},classTable){return [...new Set([...(classTable?.table||[]).flat(),...(profile.timetable||[]).flat(),...Object.values(profile.timetableWeeks||{}).flat(2)].map(x=>x.replace(/\([^)]*\)/g,'').trim()).filter(x=>x&&!/자습|기숙사|자율|조회|청소|급식/.test(x)))];}
export function recognizeEntry(source,analysis,subjects=[]){
 let title=source.split('\n')[0],recognized=[];const warnings=[];
 const consume=(regex,label,value)=>{title=title.replace(regex,raw=>{recognized.push({raw:raw.trim(),label,value});return ' ';});};
 const candidates=[...new Set([...subjects,...known])].sort((a,b)=>b.length-a.length);
 const found=[];for(const name of candidates){const re=new RegExp('(?<![가-힣A-Za-z])'+esc(name)+'(?=\\s|[,.!?:;\\[\\]()·]|$|(?:의|을|를)(?:\\s|$))','g');if(re.test(title))found.push(name);}
 // Longest matching subject wins over a contained prefix, but distinct subjects need review.
 const names=found.filter(n=>!found.some(other=>other!==n&&other.includes(n)));
 let subject=null;if(names.length===1){subject=names[0];consume(new RegExp('(?<![가-힣A-Za-z])'+esc(subject)+'(?:의|을|를)?','g'),'과목',subject);}else if(names.length>1)warnings.push('과목이 여러 개예요. 한 줄에 한 할일씩 나누거나 과목을 직접 선택하세요.');
 if(analysis.fields.due)consume(/(?:20\d{2}[-./년\s]+)?\d{1,2}(?:월|[/.])\s*\d{1,2}일?(?:까지)?|(?:(?:이번|다음)\s*주\s*|담주\s*)[월화수목금토일](?:요일)?(?:까지)?|[월화수목금토일]요일(?:까지)?|오늘(?:까지)?|내일(?:까지)?|낼(?:까지)?|모레(?:까지)?|글피(?:까지)?|\d{1,3}\s*일\s*(?:뒤|후)(?:까지)?/g,'마감',analysis.fields.due);
 if(analysis.fields.time)consume(/(?:오전|오후)?\s*\d{1,2}(?::\d{2}|시(?!간)(?:\s*\d{1,2}분)?)(?:까지)?/g,'마감 시각',analysis.fields.time);
 const low=/(?<![가-힣])(?:안\s*중요(?:함|한)?|중요하지\s*않(?:음|은)?|덜\s*중요(?:함|한)?|선택(?:사항)?)(?![가-힣])/g,high=/(?<![가-힣])(?:매우\s*중요(?:함|한)?|중요(?:함|한)?|필수)(?![가-힣])/g;
 let priority=2;if(low.test(title)){priority=1;low.lastIndex=0;consume(low,'중요도','안 중요');}if(high.test(title)){if(priority===1)warnings.push('중요도 표현이 충돌해요. 직접 확인하세요.');else priority=3;high.lastIndex=0;consume(high,'중요도','중요');}
 let difficulty=2;const hard=/(?<![가-힣])(?:어려움|어려운|어렵다|어려워|고난도|고난이도)(?![가-힣])/g,easy=/(?<![가-힣])(?:쉬움|쉬운|쉽다|쉬워|기초|저난도)(?![가-힣])/g;
 const isHard=hard.test(title),isEasy=easy.test(title);if(isHard)difficulty=4;if(isHard&&isEasy)warnings.push('난이도 표현이 충돌해요. 직접 확인하세요.');hard.lastIndex=0;easy.lastIndex=0;consume(hard,'난이도','어려움');consume(easy,'난이도','쉬움');
 const studyOverride=/수행평가\s*(?:공부|대비|준비)|시험\s*(?:공부|대비|준비)/.test(title);
 const rules=[['assessment','수행평가',/수행\s*평가|수행평가/g],['report','보고서',/보고서|실험\s*리포트|레포트/g],['presentation','발표 준비',/발표\s*(?:준비|자료)|프레젠테이션/g],['contest','대회 준비',/대회\s*준비|공모전\s*준비/g],['assignment','일반 과제',/프린트|숙제|문제\s*(?:풀이|풀기)|학습지|연습\s*문제|과제/g],['study','공부',/시험\s*공부|시험\s*대비|복습|예습|공부/g],['bring','준비물',/챙기기|챙겨오기|가져오기/g],['buy','구매',/(?<![가-힣])(?:구매하기|구매|사기)(?![가-힣])/g]];
 let taskType=null;for(const [type,label,re]of rules){if(re.test(title)){taskType||=type;re.lastIndex=0;consume(re,'분류',label);}}
 title=title.replace(/^\s*[-•·*]\s*|^\s*\d+[.)]\s*/,'').replace(/\s+/g,' ').replace(/^[,;:·\s]+|[,;:·\s]+$/g,'').trim();
 if(studyOverride)taskType='study';
 return {title:title||'할일',subject,taskType,priority,difficulty,recognized,warnings};
}
