import ExcelJS from 'exceljs';
import {validatePayload,addDays} from './schedule';
const codes={'早':'D','早班':'D','中':'A','中班':'A','夜':'N','夜班':'N','休':'O','休息':'O','培训':'T',D:'D',A:'A',N:'N',O:'O',T:'T'};
export async function parseExcel(buffer){
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 for(const sheet of workbook.worksheets){
  const title=String(sheet.getCell('A1').text);const years=title.match(/(\d{2,4})年\s*(\d{1,2})月\s*[-—至~～]\s*(\d{2,4})年\s*(\d{1,2})月/);
  const heads=sheet.getRow(2);let teamCol=0;heads.eachCell((c,n)=>{if(c.text.trim()==='三值')teamCol=n;});
  if(!years||!teamCol)continue;
  let year=Number(years[1]);if(year<100)year+=2000;let prev=Number(years[2]);const entries={};
  for(let col=teamCol+1;col<=sheet.columnCount;col++){
   const match=sheet.getCell(2,col).text.trim().match(/^(\d{1,2})月$/);if(!match)continue;
   const month=Number(match[1]);if(month<prev)year++;prev=month;
   if(month<1||month>12)throw Error('Excel 中有无效月份。');
   for(let row=3;row<=sheet.rowCount;row++){
    const raw=sheet.getCell(row,col).value;if(raw==null||raw==='')continue;
    const day=Number(raw);if(!Number.isInteger(day)||day<1||day>31)continue;
    const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if(addDays(date,0)!==date)throw Error(`Excel 日期无效：${date}`);
    const code=codes[sheet.getCell(row,teamCol).text.trim()];if(!code)throw Error(`第 ${row} 行的三值班次无法识别。`);
    if(entries[date])throw Error(`Excel 日期重复：${date}`);entries[date]=code;
   }
  }
  const dates=Object.keys(entries).sort();if(!dates.length)continue;
  let days='';for(let d=dates[0];d<=dates.at(-1);d=addDays(d,1)){if(!entries[d])throw Error(`Excel 缺少 ${d} 的排班，不能自动推算。`);days+=entries[d];}
  return validatePayload({v:1,team:'三值',tz:'Asia/Shanghai',start:dates[0],days});
 }
 throw Error('未找到受支持的三值表头及年月标题。请使用随附的 AI 提示词转换为 SZ1 二维码。');
}
