export const SHIFTS = {
 D:{name:'早班',short:'早',color:'#d08a25',start:'08:00',end:'16:00'},
 A:{name:'中班',short:'中',color:'#5386cc',start:'16:00',end:'00:00'},
 N:{name:'夜班',short:'夜',color:'#8870b5',start:'00:00',end:'08:00'},
 O:{name:'休息',short:'休',color:'#319779',start:'',end:''},
 T:{name:'培训',short:'训',color:'#c47855',start:'08:00',end:'16:00'}
};
export const dateKey = (date=new Date()) => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const DEFAULT_TEAM='三值';
export const COMMON_TEAMS=['一值','二值','三值','四值','五值'];
export function validateTeam(value){
 if(typeof value!=='string'||!value.trim()||[...value.trim()].length>32||/[\u0000-\u001f\u007f]/.test(value))throw Error('请填写有效的值别名称（1–32 个字），例如一值、五值或其他值别。');
 return value.trim();
}
export function validatePayload(input){
 let p=input;
 if(typeof p==='string'){
  if(p.length>12000)throw Error('二维码内容过长，请按年拆分。');
  let s=p.trim();if(s.startsWith('SZ1:'))s=s.slice(4);
  try{p=JSON.parse(s);}catch{throw Error('无法识别二维码，请使用 SZ1 排班格式。');}
 }
 if(!p||Array.isArray(p)||p.v!==1)throw Error('不支持此排班版本，需要 v: 1。');
 const team=validateTeam(p.team);
 if(p.tz!=='Asia/Shanghai')throw Error('排班时区必须是 Asia/Shanghai。');
 if(typeof p.start!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.start)||!Number.isFinite(Date.parse(p.start+'T00:00:00Z'))||addDays(p.start,0)!==p.start)throw Error('起始日期无效。');
 if(p.start<'2000-01-01'||p.start>'2099-12-31')throw Error('仅支持 2000 至 2099 年的排班。');
 if(typeof p.days!=='string'||!p.days.length||p.days.length>400||!/^[DANOT]+$/.test(p.days))throw Error('班次必须是 D/A/N/O/T，且每次导入 1–400 天。');
 if(addDays(p.start,p.days.length-1)>'2099-12-31')throw Error('结束日期超出支持范围。');
 return {v:1,team,start:p.start,days:p.days,tz:'Asia/Shanghai'};
}
export function unpack(input){const p=validatePayload(input);return Object.fromEntries([...p.days].map((c,i)=>[addDays(p.start,i),c]));}
export function pack(schedule,start,end,team=DEFAULT_TEAM){
 let days='';for(let d=start;d<=end;d=addDays(d,1)){if(!schedule[d])throw Error(`${d} 没有排班，请选择连续且完整的日期范围。`);days+=schedule[d];if(days.length>400)throw Error('最多分享 400 天，请缩短日期范围。');}
 return validatePayload({v:1,team,start,days,tz:'Asia/Shanghai'});
}
export function importSummary(payload,schedule){const entries=unpack(payload);return {entries,count:Object.keys(entries).length,end:addDays(payload.start,payload.days.length-1),conflicts:Object.entries(entries).filter(([d,c])=>schedule[d]&&schedule[d]!==c).length};}
// Keep the Excel codes unchanged. U/L are display labels, never extra shifts.
export const DISPLAY_SHIFTS={...SHIFTS,U:{name:'上夜',short:'上夜',color:'#8b6bb1'},L:{name:'下夜',short:'下夜',color:'#69869e'}};
export function dayInfo(schedule,date){
 const code=schedule[date],next=schedule[addDays(date,1)];
 if(code==='O'&&next==='N')return {code,kind:'U',...DISPLAY_SHIFTS.U,workDate:addDays(date,1)};
 if(code==='N'&&next&&next!=='N')return {code,kind:'L',...DISPLAY_SHIFTS.L,workDate:date};
 return {code,kind:code,...SHIFTS[code],workDate:date};
}
export const defaultSettings=()=>({
 schemaVersion:2,confirmed:true,enabled:false,advance:30,
 times:Object.fromEntries(Object.entries(SHIFTS).filter(([k])=>k!=='O').map(([k,v])=>[k,{start:v.start,end:v.end}])),
 routine:{wakeEnabled:true,wakeTime:'06:40',busEnabled:true,busAdvance:10,bus:{D:'07:10',A:'15:10',N:'22:10'},startEnabled:false,trainingEnabled:false}
});
export function validTime(t){return typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);}
export function normalizeSettings(saved){
 const defaults=defaultSettings();if(!saved)return defaults;
 const legacy=saved.schemaVersion!==2;
 return {...defaults,...saved,schemaVersion:2,enabled:legacy?false:!!saved.enabled,confirmed:legacy?false:!!saved.confirmed,
  times:{...defaults.times,...(!legacy?saved.times:{}),T:{...defaults.times.T,...saved.times?.T}},
  routine:{...defaults.routine,...saved.routine,bus:{...defaults.routine.bus,...saved.routine?.bus}},needsReview:legacy||!!saved.needsReview};
}
export function validateSettings(settings){
 const r=settings.routine;
 if(!r)throw Error('提醒设置缺失，请重新保存。');
 for(const k of ['D','A','N','T']){const t=settings.times[k];if(!t||!validTime(t.start)||!validTime(t.end)||t.start===t.end)throw Error('请填写有效且不同的班次开始、结束时间。');}
 if(!validTime(r.wakeTime)||['D','A','N'].some(k=>!validTime(r.bus[k])))throw Error('请填写有效的起床和班车时间。');
 if(!Number.isInteger(r.busAdvance)||r.busAdvance<0||r.busAdvance>60)throw Error('班车提前提醒须为 0–60 分钟。');
 if(!Number.isInteger(settings.advance)||settings.advance<0||settings.advance>180)throw Error('上班提前提醒须为 0–180 分钟。');
 if(r.bus.D>=settings.times.D.start||r.bus.A>=settings.times.A.start)throw Error('早班和中班班车应在当天上班前出发。');
 if(r.wakeEnabled&&r.busEnabled&&r.wakeTime>=r.bus.D)throw Error('起床时间应早于早班班车出发时间。');
 if(settings.enabled&&!settings.confirmed)throw Error('请先核对并确认作息和提醒时间。');
 if(settings.enabled&&!r.wakeEnabled&&!r.busEnabled&&!r.startEnabled&&!r.trainingEnabled)throw Error('请至少选择一类提醒。');
 return settings;
}
export const shanghaiTime=(date,time)=>Date.parse(`${date}T${time}:00+08:00`);
export const timeLabel=n=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(n));
export function workSessions(schedule,settings){
 return Object.entries(schedule).sort(([a],[b])=>a.localeCompare(b)).flatMap(([date,code])=>{
  if(code==='O'||!SHIFTS[code])return [];
  const time=settings.times[code];if(!time||!validTime(time.start)||!validTime(time.end))throw Error('请设置有效的班次时间。');
  return [{date,code,start:shanghaiTime(date,time.start),end:shanghaiTime(date,time.end)+(time.end<=time.start?86400000:0)}];
 });
}
export function reminderEvents(schedule,settings,now=Date.now()){
 if(!settings.confirmed)return [];
 validateSettings(settings);const r=settings.routine;const result=[];
 for(const session of workSessions(schedule,settings)){
  const {date,code,start}=session;
  const add=(kind,at,title,body,index)=>{if(at>now)result.push({...session,kind,at,title,body,id:Number(date.replaceAll('-',''))*10+index,reminderDate:dateKey(new Date(at))});};
  const shiftText=`${date} ${settings.times[code].start}–${settings.times[code].end} ${SHIFTS[code].name}`;
  if(code==='T'){
   if(r.trainingEnabled)add('training',start-settings.advance*60000,'培训提醒',`${shiftText}，提前 ${settings.advance} 分钟提醒。`,4);
   continue;
  }
  if(code==='D'&&r.wakeEnabled)add('wake',shanghaiTime(date,r.wakeTime),'早班起床',`${date} ${r.wakeTime} 起床；${r.bus.D} 班车，08:00 上早班。`,1);
  if(r.busEnabled){
   const busDate=code==='N'?addDays(date,-1):date;
   const depart=shanghaiTime(busDate,r.bus[code]);
   if(depart>=start)throw Error('班车出发时间必须早于上班时间。');
   add('bus',depart-r.busAdvance*60000,`${SHIFTS[code].name}班车`,`${busDate} ${r.bus[code]} 班车出发（提前 ${r.busAdvance} 分钟提醒）；${shiftText}。`,2);
  }
  if(r.startEnabled)add('start',start-settings.advance*60000,`${SHIFTS[code].name}上班`,`${shiftText}，提前 ${settings.advance} 分钟提醒。`,3);
 }
 return result.sort((a,b)=>a.at-b.at||a.id-b.id);
}
const utcStamp=n=>new Date(n).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
const icsEscape=s=>s.replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;');
function foldICS(line){const lines=[];let part='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>75){lines.push(part);part=' ';bytes=1;}part+=c;bytes+=n;}return [...lines,part].join('\r\n');}
export function toICS(schedule,settings,now=Date.now(),team=DEFAULT_TEAM){
 team=validateTeam(team);
 const alarms=reminderEvents(schedule,settings,now);const dates=[...new Set(alarms.map(e=>e.date))];
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sanzhi//Shift Calendar//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const date of dates){
  const events=alarms.filter(e=>e.date===date),e=events[0];
  lines.push('BEGIN:VEVENT',`UID:sanzhi-${team===DEFAULT_TEAM?'':encodeURIComponent(team)+'-'}${date}@sanzhi.local`,`DTSTAMP:${utcStamp(now)}`,`DTSTART:${utcStamp(e.start)}`,`DTEND:${utcStamp(e.end)}`,`SUMMARY:${icsEscape(team)} · ${SHIFTS[e.code].name}`,`DESCRIPTION:${icsEscape(events.map(x=>`${dateKey(new Date(x.at))} ${timeLabel(x.at)} ${x.title}`).join('\n'))}`);
  for(const alarm of events)lines.push('BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(alarm.title+'：'+alarm.body)}`,`TRIGGER:-PT${Math.round((alarm.start-alarm.at)/60000)}M`,'END:VALARM');
  lines.push('END:VEVENT');
 }
 return lines.concat('END:VCALENDAR').map(foldICS).join('\r\n')+'\r\n';
}
