export const SHIFTS = {
 D:{name:'早班',short:'早',color:'#d08a25',start:'08:00',end:'16:00'},
 A:{name:'中班',short:'中',color:'#5386cc',start:'16:00',end:'00:00'},
 N:{name:'夜班',short:'夜',color:'#8870b5',start:'00:00',end:'08:00'},
 O:{name:'休息',short:'休',color:'#319779',start:'',end:''},
 T:{name:'培训',short:'训',color:'#c47855',start:'08:00',end:'16:00'}
};
export const dateKey = (date=new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function validatePayload(input){
 let p=input;
 if(typeof p==='string'){
  if(p.length>12000)throw Error('二维码内容过长，请按年拆分。');
  let s=p.trim();if(s.startsWith('SZ1:'))s=s.slice(4);
  try{p=JSON.parse(s);}catch{throw Error('无法识别二维码，请使用 SZ1 排班格式。');}
 }
 if(!p||Array.isArray(p)||p.v!==1)throw Error('不支持此排班版本，需要 v: 1。');
 if(p.team!=='三值')throw Error('这不是三值排班，请让 AI 提取“三值”后重新生成。');
 if(p.tz!=='Asia/Shanghai')throw Error('排班时区必须是 Asia/Shanghai。');
 if(typeof p.start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.start)||!Number.isFinite(Date.parse(p.start+'T00:00:00Z'))||addDays(p.start,0)!==p.start)throw Error('起始日期无效。');
 if(p.start<'2000-01-01'||p.start>'2099-12-31')throw Error('仅支持 2000 至 2099 年的排班。');
 if(typeof p.days!=='string'||!p.days.length||p.days.length>400||!/^[DANOT]+$/.test(p.days))throw Error('班次必须是 D/A/N/O/T，且每次导入 1–400 天。');
 if(addDays(p.start,p.days.length-1)>'2099-12-31')throw Error('结束日期超出支持范围。');
 return {v:1,team:'三值',start:p.start,days:p.days,tz:'Asia/Shanghai'};
}
export function unpack(input){const p=validatePayload(input);return Object.fromEntries([...p.days].map((c,i)=>[addDays(p.start,i),c]));}
export function pack(schedule,start,end){
 let days='';for(let d=start;d<=end;d=addDays(d,1)){if(!schedule[d])throw Error(`${d} 没有排班，请选择连续且完整的日期范围。`);days+=schedule[d];if(days.length>400)throw Error('最多分享 400 天，请缩短日期范围。');}
 return validatePayload({v:1,team:'三值',start,days,tz:'Asia/Shanghai'});
}
export function importSummary(payload,schedule){const entries=unpack(payload);return {entries,count:Object.keys(entries).length,end:addDays(payload.start,payload.days.length-1),conflicts:Object.entries(entries).filter(([d,c])=>schedule[d]&&schedule[d]!==c).length};}
export const defaultSettings=()=>({confirmed:false,enabled:false,advance:30,times:Object.fromEntries(Object.entries(SHIFTS).filter(([k])=>k!=='O').map(([k,v])=>[k,{start:v.start,end:v.end}]))});
export function validTime(t){return typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);}
export function reminderEvents(schedule,settings,now=Date.now()){
 if(!settings.confirmed)return [];
 return Object.entries(schedule).sort(([a],[b])=>a.localeCompare(b)).flatMap(([date,code])=>{
  if(code==='O')return [];const time=settings.times[code];if(!time||!validTime(time.start)||!validTime(time.end))throw Error('请设置有效的班次时间。');
  const start=Date.parse(`${date}T${time.start}:00+08:00`);const at=start-Number(settings.advance)*60000;
  return at>now?[{date,code,start,end:Date.parse(`${date}T${time.end}:00+08:00`)+(time.end<=time.start?86400000:0),at}]:[];
 });
}
const utcStamp=n=>new Date(n).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
export function toICS(schedule,settings,now=Date.now()){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sanzhi//Shift Calendar//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const e of reminderEvents(schedule,settings,now))lines.push('BEGIN:VEVENT',`UID:sanzhi-${e.date}@sanzhi.local`,`DTSTAMP:${utcStamp(now)}`,`DTSTART:${utcStamp(e.start)}`,`DTEND:${utcStamp(e.end)}`,`SUMMARY:三值 · ${SHIFTS[e.code].name}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:三值${SHIFTS[e.code].name}提醒`,`TRIGGER:-PT${settings.advance}M`,'END:VALARM','END:VEVENT');
 return lines.concat('END:VCALENDAR','').join('\r\n');
}
