// Older workload tests include an explicit duration in their fixture label.
// Feed it through the manual field; the production parser must NOT extract it.
import {parseQuick,createQuickTask} from '../src/quick-entry.js';
export function manualTask(s,base,id='a'){const parsed=parseQuick(s,base),n=Number(s.match(/(\d+)분\s*$/)?.[1]||parsed.totalMinutes);return createQuickTask({...parsed,totalMinutes:n,minutesEstimated:false,durationRequired:false},id);}
