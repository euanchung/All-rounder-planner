// Bounded arithmetic helper, not a general-purpose equation solver.
export function quadratic(a,b,c){
  if(![a,b,c].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000))throw new Error('계수는 -10000~10000 사이 정수로 입력해 주세요.');
  if(a===0){if(b===0)return {kind:'constant',steps:[`a=0, b=0이므로 ${c}=0인 상수식입니다.`],answer:c===0?'모든 실수가 해입니다.':'해가 없습니다.'};return {kind:'linear',steps:['a=0이므로 일차방정식입니다.',`${b}x = ${-c}`,`x = (${-c}) / (${b})`],answer:`x ≈ ${format(-c/b)}`};}
  const D=b*b-4*a*c,steps=[`판별식 D = b² − 4ac = (${b})² − 4×(${a})×(${c}) = ${D}`,`근의 공식: x = (−b ± √D) / (2a)`];
  if(D<0)return {kind:'complex',D,steps,answer:`실수 해는 없습니다. 복소수 해: x = (${-b} ± i√${-D}) / (${2*a})`};
  if(D===0)return {kind:'double',D,steps:[...steps,`D=0이므로 중근입니다.`],answer:`x = (${-b}) / (${2*a}) ≈ ${format(-b/(2*a))}`};
  // Stable numeric evaluation avoids cancellation for very different roots.
  const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(D));
  const roots=[q/a,c/q].sort((x,y)=>x-y);
  return {kind:'real',D,roots,steps:[...steps,`D>0이므로 서로 다른 두 실근입니다.`,`x = (${-b} ± √${D}) / (${2*a})`],answer:`x ≈ ${format(roots[0])}, ${format(roots[1])}`};
}
function format(n){return Number(n.toPrecision(10)).toString();}
