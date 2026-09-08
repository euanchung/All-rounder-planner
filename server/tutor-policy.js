export const MODEL='google/gemini-3.8-flash';
export const USER_DAILY=5, SITE_DAILY=30, SITE_MONTHLY=40;
export const koreaDay=(now=new Date())=>new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
export function tutorInput(body){
 const bad=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!body||body.consent!==true)bad('AI 제공자에게 질문·사진을 전송하는 안내에 동의해 주세요.');
 if(!['concept','problem'].includes(body.mode)||!['수학','물리','화학','생명과학','지구과학','국어','영어','정보','기타'].includes(body.subject))bad('과목과 공부 방식을 선택해 주세요.');
 if(typeof body.question!=='string'||body.question.length>6000)bad('질문은 6,000자 이내로 적어 주세요.');
 let image=null;
 if(body.image){
  if(typeof body.image!=='string'||body.image.length>2800000)bad('사진은 2MB 이하로 올려 주세요.');
  const match=body.image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)bad('PNG·JPG·WebP 사진만 사용할 수 있어요.');
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.length>2097152||bytes.length<12)bad('사진 파일을 확인해 주세요.');
  const signature=match[1]==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='image/jpeg'?bytes[0]===255&&bytes[1]===216:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!signature)bad('사진의 형식을 확인해 주세요.');
  image={data:bytes,mediaType:match[1]};
 }
 const question=body.question.trim();if(!question&&!image)bad('질문이나 문제 사진을 넣어 주세요.');
 return {subject:body.subject,mode:body.mode,question,image};
}
export const answerSchema={type:'object',additionalProperties:false,required:['title','concept','steps'],properties:{title:{type:'string',maxLength:200},concept:{type:'string',maxLength:16000},steps:{type:'array',minItems:3,maxItems:3,items:{type:'string',maxLength:8000}}}};
export function validAnswer(v){return !!v&&typeof v.title==='string'&&v.title.length<=200&&typeof v.concept==='string'&&v.concept.length<=16000&&Array.isArray(v.steps)&&v.steps.length===3&&v.steps.every(x=>typeof x==='string'&&x.length<=8000);}
