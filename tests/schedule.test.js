import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {addDays,validatePayload,unpack,pack,importSummary,defaultSettings,reminderEvents,toICS,dateKey} from '../src/schedule';
import {parseExcel} from '../src/excel';
const sample=JSON.parse(readFileSync(new URL('../public/sample-schedule.json',import.meta.url),'utf8'));
const payload=(days='DANOT')=>({v:1,team:'三值',start:'2026-01-01',days,tz:'Asia/Shanghai'});
describe('排班数据协议',()=>{
 it('保留原 Excel 全部 396 天，跨月跨年准确',()=>{const data=unpack(sample);expect(Object.keys(data)).toHaveLength(396);expect(data['2025-12-01']).toBe('O');expect(data['2026-01-01']).toBe('T');expect(data['2026-10-17']).toBe('D');expect(data['2026-12-31']).toBe('N');expect(pack(data,'2025-12-01','2026-12-31')).toEqual(sample);});
 it('支持原始 JSON 与 SZ1 前缀',()=>{expect(validatePayload('SZ1:'+JSON.stringify(payload()))).toEqual(payload());expect(validatePayload(JSON.stringify(payload()))).toEqual(payload());});
 it.each([{...payload(),team:'二值'},{...payload(),v:2},{...payload(),start:'2026-02-30'},{...payload(),days:'DAX'},{...payload(),days:''},{...payload(),days:'D'.repeat(401)},{...payload(),tz:'UTC'},{...payload(),start:'2099-12-31'}])('拒绝无效或错误值组排班 %j',p=>expect(()=>validatePayload(p)).toThrow());
 it('保持二维码大小可扫描，396天完整编解码无损',()=>{const raw='SZ1:'+JSON.stringify(sample);const qr=QRCode.create(raw,{errorCorrectionLevel:'M'});const scale=8,pad=4,n=(qr.modules.size+pad*2)*scale;const image=new Uint8ClampedArray(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const r=Math.floor(y/scale)-pad,c=Math.floor(x/scale)-pad;const black=r>=0&&c>=0&&r<qr.modules.size&&c<qr.modules.size&&qr.modules.get(r,c);const i=(y*n+x)*4;image[i]=image[i+1]=image[i+2]=black?0:255;image[i+3]=255;}expect(validatePayload(jsQR(image,n,n).data.slice(4))).toEqual(sample);});
 it('预览冲突，只覆盖选定范围',()=>{const old={'2025-12-31':'O','2026-01-01':'N','2026-01-02':'A'};const s=importSummary(payload('DA'),old);expect(s.conflicts).toBe(1);expect({...old,...s.entries}).toEqual({'2025-12-31':'O','2026-01-01':'D','2026-01-02':'A'});});
 it('拒绝不连续日期分享',()=>expect(()=>pack({'2026-01-01':'D','2026-01-03':'A'},'2026-01-01','2026-01-03')).toThrow('没有排班'));
 it('闰日与上海日期正确',()=>{expect(addDays('2028-02-28',1)).toBe('2028-02-29');expect(addDays('2026-12-31',1)).toBe('2027-01-01');expect(dateKey(new Date('2026-01-01T20:00:00Z'))).toBe('2026-01-02');});
});
describe('提醒',()=>{
 it('未确认时间不安排提醒',()=>expect(reminderEvents(unpack(payload()),defaultSettings(),0)).toEqual([]));
 it('按北京时间提前提醒，休息不提醒，过滤已过时间',()=>{const s={...defaultSettings(),confirmed:true};const events=reminderEvents(unpack(payload()),s,Date.parse('2025-12-31T00:00Z'));expect(events).toHaveLength(4);expect(new Date(events[0].at).toISOString()).toBe('2025-12-31T23:30:00.000Z');expect(events.find(x=>x.code==='A').end-events.find(x=>x.code==='A').start).toBe(8*3600000);expect(reminderEvents(unpack(payload()),s,Date.parse('2027-01-01T00:00Z'))).toEqual([]);});
 it('零点夜班提前提醒在前一天；23点夜班跨天',()=>{const s=defaultSettings();s.confirmed=true;const first=reminderEvents(unpack(payload('N')),s,0)[0];expect(new Date(first.at).toISOString()).toBe('2025-12-31T15:30:00.000Z');s.times.N={start:'23:00',end:'07:00'};const e=reminderEvents(unpack(payload('N')),s,0)[0];expect(e.end-e.start).toBe(8*3600000);});
 it('日历文件含有效时区时间及提前提醒',()=>{const s={...defaultSettings(),confirmed:true};const text=toICS(unpack(payload('DO')),s,0);expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(1);expect(text).toContain('DTSTART:20260101T000000Z');expect(text).toContain('TRIGGER:-PT30M');expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);});
});
describe('Excel 导入',()=>{
 it('按日期所在行匹配三值，不把行号误当日期',async()=>{const w=new ExcelJS.Workbook();const s=w.addWorksheet('排班');s.getCell('A1').value='倒班表（25年12月-26年12月）';s.getCell('D2').value='三值';s.getCell('G2').value='12月';s.getCell('H2').value='1月';s.getCell('D3').value='早';s.getCell('D4').value='夜';s.getCell('G3').value=31;s.getCell('H4').value=1;expect(await parseExcel(await w.xlsx.writeBuffer())).toEqual({v:1,team:'三值',start:'2025-12-31',days:'DN',tz:'Asia/Shanghai'});});
 it('日期缺失时阻止推算',async()=>{const w=new ExcelJS.Workbook();const s=w.addWorksheet('排班');s.getCell('A1').value='倒班表（26年1月-26年12月）';s.getCell('D2').value='三值';s.getCell('G2').value='1月';s.getCell('D3').value='早';s.getCell('D4').value='夜';s.getCell('G3').value=1;s.getCell('G4').value=3;await expect(parseExcel(await w.xlsx.writeBuffer())).rejects.toThrow('缺少');});
 if(process.env.EXCEL_FIXTURE)it('用户上传原始 Excel 与内置排班逐字一致',async()=>expect(await parseExcel(readFileSync(process.env.EXCEL_FIXTURE))).toEqual(sample));
});
