import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';
import {normalizeCalendarStore,importCalendar,calendarFor,previewImport,updateCalendar} from '../src/calendars';
import {createAIPrompt} from '../src/aiPrompt';
import {addDays,validatePayload,unpack,pack,importSummary,defaultSettings,normalizeSettings,validateSettings,dayInfo,reminderEvents,toICS,dateKey,timeLabel} from '../src/schedule';
import {parseExcel,readExcel} from '../src/excel';
const sample=JSON.parse(readFileSync(new URL('../public/sample-schedule.json',import.meta.url),'utf8'));
const payload=(days='DANOT')=>({v:1,team:'三值',start:'2026-01-01',days,tz:'Asia/Shanghai'});
describe('排班数据协议',()=>{
 it('保留原 Excel 全部 396 天，跨月跨年准确',()=>{const data=unpack(sample);expect(Object.keys(data)).toHaveLength(396);expect(data['2025-12-01']).toBe('O');expect(data['2026-01-01']).toBe('T');expect(data['2026-10-17']).toBe('D');expect(data['2026-12-31']).toBe('N');expect(pack(data,'2025-12-01','2026-12-31')).toEqual(sample);});
 it('支持原始 JSON 与 SZ1 前缀',()=>{expect(validatePayload('SZ1:'+JSON.stringify(payload()))).toEqual(payload());expect(validatePayload(JSON.stringify(payload()))).toEqual(payload());});
 it.each([{...payload(),team:''},{...payload(),team:5},{...payload(),team:'五\n值'},{...payload(),v:2},{...payload(),start:'2026-02-30'},{...payload(),days:'DAX'},{...payload(),days:''},{...payload(),days:'D'.repeat(401)},{...payload(),tz:'UTC'},{...payload(),start:'2099-12-31'}])('拒绝无效排班 %j',p=>expect(()=>validatePayload(p)).toThrow());
 it('保持二维码大小可扫描，396天完整编解码无损',()=>{const raw='SZ1:'+JSON.stringify(sample);const qr=QRCode.create(raw,{errorCorrectionLevel:'M'});const scale=8,pad=4,n=(qr.modules.size+pad*2)*scale;const image=new Uint8ClampedArray(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.floor(y/scale)-pad,c=Math.floor(x/scale)-pad;const black=r>=0&&c>=0&&r<qr.modules.size&&c<qr.modules.size&&qr.modules.get(r,c);const i=(y*n+x)*4;image[i]=image[i+1]=image[i+2]=black?0:255;image[i+3]=255;}expect(validatePayload(jsQR(image,n,n).data.slice(4))).toEqual(sample);});
 it('预览冲突，只覆盖选定范围',()=>{const old={'2025-12-31':'O','2026-01-01':'N','2026-01-02':'A'};const s=importSummary(payload('DA'),old);expect(s.conflicts).toBe(1);expect({...old,...s.entries}).toEqual({'2025-12-31':'O','2026-01-01':'D','2026-01-02':'A'});});
 it('拒绝不连续日期分享',()=>expect(()=>pack({'2026-01-01':'D','2026-01-03':'A'},'2026-01-01','2026-01-03')).toThrow('没有排班'));
 it('闰日与上海日期正确',()=>{expect(addDays('2028-02-28',1)).toBe('2028-02-29');expect(addDays('2026-12-31',1)).toBe('2027-01-01');expect(dateKey(new Date('2026-01-01T20:00:00Z'))).toBe('2026-01-02');});
});
describe('实际作息与夜班交接',()=>{
 const sampleData=unpack(sample);
 it('中班后的休显示上夜，最后一个夜显示下夜，原始编码保持不变',()=>{
  expect(dayInfo(sampleData,'2026-10-21').kind).toBe('U');expect(dayInfo(sampleData,'2026-10-22').kind).toBe('N');expect(dayInfo(sampleData,'2026-10-23').kind).toBe('L');
  expect(sampleData['2026-10-21']).toBe('O');expect(sampleData['2026-10-23']).toBe('N');expect(pack(sampleData,'2026-10-19','2026-10-24').days).toBe('AAONNO');
 });
 it('跨月、跨年识别；缺少下一天时不猜测下夜',()=>{
  const data={'2026-12-30':'A','2026-12-31':'O','2027-01-01':'N','2027-01-02':'N','2027-01-03':'O'};
  expect(dayInfo(data,'2026-12-31').kind).toBe('U');expect(dayInfo(data,'2027-01-02').kind).toBe('L');expect(dayInfo({'2027-01-01':'N'},'2027-01-01').kind).toBe('N');
 });
 it('单个夜班也会标下夜；真实休息日不误标',()=>{expect(dayInfo({'2026-01-01':'O','2026-01-02':'N','2026-01-03':'O'},'2026-01-02').kind).toBe('L');expect(dayInfo({'2026-01-01':'A','2026-01-02':'O','2026-01-03':'O'},'2026-01-02').kind).toBe('O');});
 it('早班起床06:40、班车07:00提醒；中班15:00提醒；夜班前晚22:00提醒',()=>{
  const events=reminderEvents({'2026-01-01':'D','2026-01-02':'A','2026-01-03':'N'},defaultSettings(),0);
  expect(events.map(e=>[e.code,e.kind,e.reminderDate,timeLabel(e.at)])).toEqual([['D','wake','2026-01-01','06:40'],['D','bus','2026-01-01','07:00'],['A','bus','2026-01-02','15:00'],['N','bus','2026-01-02','22:00']]);
  expect(events.at(-1).body).toContain('2026-01-02 22:10');expect(events.at(-1).body).toContain('2026-01-03 00:00');
 });
 it('上夜不增加虚构第三班，下夜当天晚上没有夜班车提醒',()=>{
  const data=unpack({v:1,team:'三值',start:'2026-10-19',days:'AAONNO',tz:'Asia/Shanghai'});
  const events=reminderEvents(data,defaultSettings(),0).filter(e=>e.code==='N');
  expect(events.map(e=>[e.date,e.reminderDate,timeLabel(e.at)])).toEqual([['2026-10-22','2026-10-21','22:00'],['2026-10-23','2026-10-22','22:00']]);
  expect(events.some(e=>e.reminderDate==='2026-10-23')).toBe(false);
 });
 it('夜班1月1日00点的班车提醒落在上一年12月31日',()=>{
  const e=reminderEvents({'2027-01-01':'N'},defaultSettings(),0)[0];expect(new Date(e.at).toISOString()).toBe('2026-12-31T14:00:00.000Z');expect(e.reminderDate).toBe('2026-12-31');
 });
 it('班车提前量可改为5分钟或发车时；不改变实际发车时间',()=>{
  const s=defaultSettings();s.routine.busAdvance=5;let e=reminderEvents({'2026-01-01':'N'},s,0)[0];expect(timeLabel(e.at)).toBe('22:05');expect(e.body).toContain('22:10');s.routine.busAdvance=0;e=reminderEvents({'2026-01-01':'N'},s,0)[0];expect(timeLabel(e.at)).toBe('22:10');
 });
 it('未确认作息不安排闹钟；培训默认不套用早班',()=>{
  const s=defaultSettings();s.confirmed=false;expect(reminderEvents({'2026-01-01':'D'},s,0)).toEqual([]);s.confirmed=true;expect(reminderEvents({'2026-01-01':'T'},s,0)).toEqual([]);s.routine.trainingEnabled=true;const events=reminderEvents({'2026-01-01':'T'},s,0);expect(events).toHaveLength(1);expect(events[0].kind).toBe('training');
 });
 it('不补发已过的起床闹钟，但保留稍后的班车提醒',()=>{
  const now=Date.parse('2026-01-01T06:50:00+08:00');const events=reminderEvents({'2026-01-01':'D'},defaultSettings(),now);expect(events).toHaveLength(1);expect(events[0].kind).toBe('bus');expect(reminderEvents({'2026-01-01':'D'},defaultSettings(),Date.parse('2026-01-01T07:05:00+08:00'))).toHaveLength(0);
 });
 it('400天三类提醒的ID全部唯一，修改日期不会覆盖另一种闹钟',()=>{
  const s=defaultSettings();s.routine.startEnabled=true;const events=reminderEvents(unpack(payload('D'.repeat(400))),s,0);expect(events).toHaveLength(1200);expect(new Set(events.map(e=>e.id)).size).toBe(1200);expect(events.every(e=>e.id<2147483647)).toBe(true);
 });
 it('旧版设置安全迁移：保留自定义排班以外的提前量、暂停旧闹钟并要求确认',()=>{
  const s=normalizeSettings({confirmed:true,enabled:true,advance:15,times:{N:{start:'23:00',end:'07:00'},T:{start:'09:00',end:'17:00'}}});expect(s.enabled).toBe(false);expect(s.confirmed).toBe(false);expect(s.needsReview).toBe(true);expect(s.times.N.start).toBe('00:00');expect(s.times.T.start).toBe('09:00');expect(s.advance).toBe(15);expect(s.routine.bus.N).toBe('22:10');
  const existing={...defaultSettings(),enabled:true};expect(normalizeSettings(existing).enabled).toBe(true);
 });
 it('拒绝无效时间和起床晚于班车的设置',()=>{
  const s=defaultSettings();s.routine.wakeTime='08:30';expect(()=>validateSettings(s)).toThrow('起床时间');s.routine.wakeTime='06:40';s.routine.bus.N='25:00';expect(()=>validateSettings(s)).toThrow('班车时间');
 });
 it('日历按工作班次生成，并包含独立的起床与班车闹钟',()=>{
  const text=toICS({'2026-01-01':'D','2026-01-02':'N','2026-01-03':'O'},defaultSettings(),0).replace(/\r\n /g,'');
  expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);expect(text.match(/BEGIN:VALARM/g)).toHaveLength(3);expect(text).toContain('TRIGGER:-PT80M');expect(text).toContain('TRIGGER:-PT60M');expect(text).toContain('TRIGGER:-PT120M');expect(text).toContain('DTSTART:20260101T160000Z');expect(text).toContain('早班起床');expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
 });
});
describe('Excel 导入',()=>{
 it('按日期所在行匹配三值，不把行号误当日期',async()=>{const w=new ExcelJS.Workbook();const s=w.addWorksheet('排班');s.getCell('A1').value='倒班表（25年12月-26年12月）';s.getCell('D2').value='三值';s.getCell('G2').value='12月';s.getCell('H2').value='1月';s.getCell('D3').value='早';s.getCell('D4').value='夜';s.getCell('G3').value=31;s.getCell('H4').value=1;expect(await parseExcel(await w.xlsx.writeBuffer())).toEqual({v:1,team:'三值',start:'2025-12-31',days:'DN',tz:'Asia/Shanghai'});});
 it('日期缺失时阻止推算',async()=>{const w=new ExcelJS.Workbook();const s=w.addWorksheet('排班');s.getCell('A1').value='倒班表（26年1月-26年12月）';s.getCell('D2').value='三值';s.getCell('G2').value='1月';s.getCell('D3').value='早';s.getCell('D4').value='夜';s.getCell('G3').value=1;s.getCell('G4').value=3;await expect(parseExcel(await w.xlsx.writeBuffer())).rejects.toThrow('缺少');});
 if(process.env.EXCEL_FIXTURE)it('用户上传原始 Excel 与内置排班逐字一致',async()=>expect(await parseExcel(readFileSync(process.env.EXCEL_FIXTURE))).toEqual(sample));
});

describe('任意值别与旧二维码兼容',()=>{
 it.each(['一值','二值','三值','四值','五值','运行六值','检修甲班'])('%s 导入和分享保留真实值别',team=>{
  const p={...payload(),team};expect(validatePayload('SZ1:'+JSON.stringify(p))).toEqual(p);expect(pack(unpack(p),p.start,addDays(p.start,p.days.length-1),team)).toEqual(p);
 });
 it.each([1,2,4,5])('直接读取之前发布的第 %s 值二维码图片',number=>{
  const expected=JSON.parse(readFileSync(new URL(`../docs/unit2-teams/unit2-team${number}.json`,import.meta.url),'utf8'));
  const png=PNG.sync.read(readFileSync(new URL(`../docs/unit2-teams/unit2-team${number}.png`,import.meta.url)));
  const raw=jsQR(new Uint8ClampedArray(png.data),png.width,png.height).data;
  expect(validatePayload(raw)).toEqual(expected);expect(Object.keys(unpack(raw))).toHaveLength(396);
 });
 it('旧版本没有值别字段时保留原三值排班、作息及已启用选择',()=>{
  const old={schedule:{'2026-01-01':'N'},settings:{...defaultSettings(),enabled:true},alarmSyncPending:false};
  const next=normalizeCalendarStore(old);expect(next.team).toBe('三值');expect(next.schedule).toEqual(old.schedule);expect(next.settings.enabled).toBe(true);expect(next.profiles).toEqual([{team:'三值',schedule:old.schedule}]);expect(next.alarmSyncPending).toBe(false);
 });
 it('导入其他值与原值独立保存，导入冲突只比较目标值别',()=>{
  const old=normalizeCalendarStore({schedule:{'2025-12-31':'N','2026-01-01':'N'},settings:defaultSettings()});
  const p={...payload('D'),team:'五值'};
  expect(previewImport(p,old)).toMatchObject({conflicts:0,switching:true,team:'五值'});
  const next=importCalendar(p,old);expect(next.team).toBe('五值');expect(next.schedule).toEqual({'2026-01-01':'D'});expect(calendarFor(next,'三值')).toEqual(old.schedule);
  const changed=importCalendar({...p,start:'2026-01-02',days:'A'},next);expect(changed.schedule).toEqual({'2026-01-01':'D','2026-01-02':'A'});
  const back=updateCalendar(changed,calendarFor(changed,'三值'),changed.settings,'三值');expect(back.schedule).toEqual(old.schedule);expect(calendarFor(back,'五值')).toEqual(changed.schedule);
  expect(previewImport({...p,days:'N'},back)).toMatchObject({conflicts:1,switching:true});expect(old.profiles).toHaveLength(1);
 });
 it('不同值的 ICS 标题和事件标识独立，旧三值标识保持兼容',()=>{
  const data={'2026-01-01':'D'},s=defaultSettings();const three=toICS(data,s,0,'三值'),five=toICS(data,s,0,'五值');
  expect(five).toContain('SUMMARY:五值 · 早班');expect(five).not.toContain('SUMMARY:三值');expect(three).toContain('UID:sanzhi-2026-01-01@');expect(five).not.toContain('UID:sanzhi-2026-01-01@');
 });
 it.each(['一值','二值','三值','四值','五值','运行六值','甲"值'])('AI 提示词提取 %s 并提供正确 JSON team',team=>{
  const text=createAIPrompt(team);expect(text).toContain(`只提取“${team}”列`);const templates=text.split('\n').filter(l=>l.startsWith('SZ1:')).map(l=>JSON.parse(l.slice(4)));expect(templates).toHaveLength(2);expect(templates.every(p=>p.team===team)).toBe(true);expect(text).not.toContain('team 固定为“三值”');
 });
 if(process.env.EXCEL_FIXTURE)it('原表的五个值均与之前发布的二维码逐日一致',async()=>{
  const source=await readExcel(readFileSync(process.env.EXCEL_FIXTURE));expect(source.teams).toEqual(['一值','二值','三值','四值','五值']);
  for(const [number,team] of [[1,'一值'],[2,'二值'],[3,'三值'],[4,'四值'],[5,'五值']]){
   const expected=number===3?sample:JSON.parse(readFileSync(new URL(`../docs/unit2-teams/unit2-team${number}.json`,import.meta.url),'utf8'));
   expect(source.parse(team)).toEqual(expected);
  }
 });
 it('Excel 支持表中的其他值别，并读取位于值别左侧的月份',async()=>{
  const w=new ExcelJS.Workbook(),sheet=w.addWorksheet('排班');sheet.getCell('A1').value='倒班表（26年1月-26年12月）';sheet.getCell('A2').value='1月';sheet.getCell('C2').value='运行六值';sheet.getCell('A3').value=1;sheet.getCell('C3').value='早';
  expect(await parseExcel(await w.xlsx.writeBuffer(),'运行六值')).toEqual({...payload('D'),team:'运行六值'});
 });
});
