export function deadlineStamp(task) {
  if (!task.fields?.due) return null;
  const d = new Date(task.fields.due + 'T' + (task.fields.time || '00:00') + ':00');
  if (!task.fields.time) d.setDate(d.getDate() + 1); // '~까지' includes the full day.
  return Number.isFinite(+d) ? +d : null;
}
export function deadlineLabel(task, now = Date.now()) {
  const due = deadlineStamp(task);
  if (due === null) return '마감 미정';
  if (due <= now) return '마감 지남';
  const m = Math.ceil((due - now) / 60000), days = Math.floor(m / 1440), hours = Math.floor(m % 1440 / 60);
  return '마감까지 ' + (days ? days + '일 ' : '') + (hours ? hours + '시간 ' : '') + m % 60 + '분';
}
export function minutesBefore(date, time, now) {
  const begin = +new Date(date + 'T00:00:00'), end = time ? +new Date(date + 'T' + time + ':00') : +new Date(new Date(date + 'T12:00:00').setHours(24,0,0,0));
  return Math.max(0, Math.floor((end - Math.max(begin, now ?? begin)) / 60000));
}
