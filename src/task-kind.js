// Explicit categories take precedence; infer only legacy mixed study/assignment records.
export function inferCategory(text, subject) {
  if (/구매|구입|(?:^|\s)(?:사기|사오기)(?:\s|$|[.!])/.test(text)) return 'buy';
  if (/챙기|챙겨|가져오|가져가|준비물/.test(text)) return 'bring';
  if (/보고서|발표\s*(?:자료|준비)|숙제|과제|제출|제작|만들기|작성/.test(text)) return 'assignment';
  if (/공부|복습|예습|암기|시험\s*준비|수행평가\s*준비/.test(text)) return 'study';
  return subject || /문제|수행|시험/.test(text) ? 'assignment' : 'other';
}
export function taskCategory(task) {
  if (task.category && (task.category !== 'study' || task.kindVersion === 1)) return task.category;
  const inferred=inferCategory(task.title || (task.source || '').split('\n')[0], task.fields?.subject);
  return inferred==='other'?'assignment':inferred;
}
export const academic = task => ['study', 'assignment'].includes(taskCategory(task));
