import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';
import {addDays,validatePayload} from '../src/schedule.js';

const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/generate-ot105-qrs.mjs /path/to/OT105.xlsx');
const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(input);
assert(!workbook.properties.date1904,'Expected Excel 1900 date system');
const sheet=workbook.worksheets.find(s=>s.name==='OT105运行值倒班表');
assert(sheet,'Missing OT105 schedule worksheet');
assert(sheet.getCell('E1').text.includes('OT105大修运行值倒班表'));
const codes={'早':'D','中':'A','夜':'N','休':'O','培训':'T'};
const weekdays=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const weekday=date=>weekdays[new Date(date+'T12:00:00Z').getUTCDay()];
const excelDate=value=>value instanceof Date?value.toISOString().slice(0,10):new Date((value-25569)*86400000).toISOString().slice(0,10);

// The companion table has full Excel dates. Use these to establish the year,
// never the current clock or file modification time. Its pre-overhaul dates
// are reference data, not part of the main monthly overhaul schedule.
const anchors=[];
for(let row=6;row<=22;row++){
 const value=sheet.getCell(row,21).value;
 assert(value instanceof Date||typeof value==='number'&&value>40000,'Missing full reference date');
 const date=excelDate(value);assert.equal(weekday(date),sheet.getCell(row,14).text.trim());
 if(anchors.length)assert.equal(date,addDays(anchors.at(-1).date,1));
 anchors.push({row,date});
}
const initialYear=Number(anchors[0].date.slice(0,4));
const monthColumns=[];
sheet.getRow(2).eachCell((cell,col)=>{const match=cell.text.trim().match(/^(\d{1,2})月$/);if(match)monthColumns.push({col,month:Number(match[1])});});
assert.deepEqual(monthColumns.map(m=>m.month),[10,11,12,1,2]);
assert.equal(Number(anchors[0].date.slice(5,7)),monthColumns[0].month);
const output=path.resolve('docs/ot105-overhaul');await fs.mkdir(output,{recursive:true});
const summaries=[];
for(const [number,baseTeam,referenceCol] of [[1,'一值',15],[5,'五值',19]]){
 let teamCol=0;sheet.getRow(2).eachCell((cell,col)=>{if(cell.text.trim()===baseTeam)teamCol=col;});
 assert(teamCol,'Missing '+baseTeam);assert.equal(sheet.getCell(5,referenceCol).text.trim(),baseTeam);
 let year=initialYear,previousMonth=monthColumns[0].month;const entries={};
 for(const {col,month} of monthColumns){
  if(month<previousMonth)year++;previousMonth=month;
  for(let row=3;row<=sheet.rowCount;row++){
   const value=sheet.getCell(row,col).value;if(value===null||value==='')continue;
   assert(Number.isInteger(value)&&value>=1&&value<=31,'Invalid day cell');
   const date=`${year}-${String(month).padStart(2,'0')}-${String(value).padStart(2,'0')}`;
   assert.equal(addDays(date,0),date);assert.equal(weekday(date),sheet.getCell(row,1).text.trim());
   assert(!entries[date],'Duplicate date '+date);
   const code=codes[sheet.getCell(row,teamCol).text.trim()];assert(code,'Unknown shift '+date);entries[date]=code;
  }
 }
 const dates=Object.keys(entries).sort();let days='';
 for(let date=dates[0];date<=dates.at(-1);date=addDays(date,1)){assert(entries[date],'Missing date '+date);days+=entries[date];}
 let referenceMatches=0;
 for(const {row,date} of anchors)if(entries[date]){assert.equal(entries[date],codes[sheet.getCell(row,referenceCol).text.trim()]);referenceMatches++;}
 assert.equal(referenceMatches,10);
 assert.match(sheet.getCell('G3').text,/10\.26日/);
 assert.equal(dates[0],`${initialYear}-10-26`);
 const payload=validatePayload({v:1,team:`${baseTeam}（大修中）`,start:dates[0],days,tz:'Asia/Shanghai'});
 const raw='SZ1:'+JSON.stringify(payload),filename=`ot105-team${number}-overhaul`;
 const png=await QRCode.toBuffer(raw,{width:1200,margin:4,errorCorrectionLevel:'M'});
 const pixels=PNG.sync.read(png),decoded=jsQR(new Uint8ClampedArray(pixels.data),pixels.width,pixels.height);
 assert.equal(decoded?.data,raw,'QR round-trip failed');assert.deepEqual(validatePayload(decoded.data),payload);
 await fs.writeFile(path.join(output,filename+'.png'),png);
 await fs.writeFile(path.join(output,filename+'.txt'),raw+'\n');
 await fs.writeFile(path.join(output,filename+'.json'),JSON.stringify(payload,null,2)+'\n');
 const summary={team:payload.team,sourceTeam:baseTeam,start:dates[0],end:dates.at(-1),count:days.length,counts:Object.fromEntries(Object.entries(codes).map(([name,code])=>[name,[...days].filter(c=>c===code).length])),referenceMatches,weekdayChecks:dates.length,qrVerified:true};
 summaries.push(summary);console.log(JSON.stringify(summary));
}
await fs.writeFile(path.join(output,'summary.json'),JSON.stringify({source:'OT105.xlsx',sheet:sheet.name,yearAnchor:anchors[0].date,sourceScope:'主表 H2:L37（10月至次年2月）；右侧 U6:U22 仅用于年份及重叠日期核对，不导入 10月19日至25日。',schedules:summaries},null,2)+'\n');
