import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';
const input=process.argv[2];
if(!input)throw Error('Usage: node scripts/generate-team-qrs.mjs /path/to/倒班表.xlsx');
const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(input);
const sheet=workbook.worksheets[0];
const years=sheet.getCell('A1').text.match(/(\d{2,4})年\s*(\d{1,2})月\s*[-—至~～]\s*(\d{2,4})年\s*(\d{1,2})月/);
if(!years)throw Error('Missing year/month title.');
const codes={'早':'D','中':'A','夜':'N','休':'O','培训':'T'};
const out=path.resolve('docs/unit2-teams');await fs.mkdir(out,{recursive:true});
const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const summaries=[];
for(const [number,team] of [[1,'一值'],[2,'二值'],[4,'四值'],[5,'五值']]){
 let teamColumn=0;sheet.getRow(2).eachCell((cell,col)=>{if(cell.text.trim()===team)teamColumn=col;});
 if(!teamColumn)throw Error('Missing team '+team);
 let year=Number(years[1]);if(year<100)year+=2000;let previousMonth=Number(years[2]);const days={};
 for(let col=7;col<=sheet.columnCount;col++){
  const match=sheet.getCell(2,col).text.trim().match(/^(\d{1,2})月$/);if(!match)continue;
  const month=Number(match[1]);if(month<previousMonth)year++;previousMonth=month;
  for(let row=3;row<=sheet.rowCount;row++){
   const value=sheet.getCell(row,col).value;if(value==null||value==='')continue;
   const day=Number(value);if(!Number.isInteger(day)||day<1||day>31)continue;
   const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   if(addDays(date,0)!==date||days[date])throw Error('Invalid/duplicate date '+date);
   const code=codes[sheet.getCell(row,teamColumn).text.trim()];if(!code)throw Error(`Unknown ${team} shift on ${date}`);
   days[date]=code;
  }
 }
 const dates=Object.keys(days).sort();let sequence='';
 for(let date=dates[0];date<=dates.at(-1);date=addDays(date,1)){if(!days[date])throw Error('Missing date '+date);sequence+=days[date];}
 if(sequence.length!==396)throw Error('Unexpected date count '+sequence.length);
 const payload={v:1,team,start:dates[0],days:sequence,tz:'Asia/Shanghai'};
 const text='SZ1:'+JSON.stringify(payload);const filename=`unit2-team${number}`;
 const png=await QRCode.toBuffer(text,{width:1200,margin:4,errorCorrectionLevel:'M'});
 const decodedPNG=PNG.sync.read(png);const decoded=jsQR(new Uint8ClampedArray(decodedPNG.data),decodedPNG.width,decodedPNG.height);
 if(decoded?.data!==text)throw Error('QR round-trip mismatch '+team);
 await fs.writeFile(path.join(out,filename+'.png'),png);
 await fs.writeFile(path.join(out,filename+'.txt'),text+'\n');
 await fs.writeFile(path.join(out,filename+'.json'),JSON.stringify(payload,null,2)+'\n');
 const summary={team,number,start:dates[0],end:dates.at(-1),count:sequence.length,counts:Object.fromEntries(Object.keys(codes).map(label=>[label,[...sequence].filter(c=>c===codes[label]).length]))};
 summaries.push(summary);console.log(JSON.stringify({...summary,qr_verified:true}));
}
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(summaries,null,2)+'\n');
