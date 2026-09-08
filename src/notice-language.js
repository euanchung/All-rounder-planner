// Bounded Korean aliases and explicit change syntax, never a learned confidence score.
export function normalizeLanguage(text){
 return text.normalize('NFKC').replace(/\r\n/g,'\n')
 .replace(/물리학/g,'물리').replace(/생명\s+과학/g,'생명과학').replace(/(?<![가-힣])(?:생과|생물)(?=\s|[I12]|$)/g,'생명과학')
 .replace(/확통/g,'확률과 통계')
 .replace(/(?<![가-힣])낼(?=[\s까지,.]|$)/g,'내일').replace(/(?<![가-힣])담주(?=\s|[월화수목금토일])/g,'다음 주')
 .replace(/(이번|다음)\s*주\s*([월화수목금토일])(?!요일)(?=\s|까지|[,.]|$)/g,'$1 주 $2요일');
}
export function matchWords(text){
 const normalized=normalizeLanguage(text).replace(/(?:제출|마감|기한|날짜|일정|소요|예상|시간|분량|안내|공지|변경|수정|연장|완료|까지)(?:일|이|은|는|을|를|됐어요|되었어요|됩니다|합니다|된|됨)?/g,' ').replace(/(?<![가-힣])(?:오늘|내일|모레|글피|[월화수목금토일]요일(?:로|까지)?|이번|다음|주)(?![가-힣])|[\p{P}\p{S}]/gu,' ');
 return new Set(normalized.split(/\s+/).map(w=>w.replace(/(?:입니다|합니다|해주세요|해요|으로|에서|의|을|를|은|는|이|가)$/,'')).filter(w=>w.length>1));
}
