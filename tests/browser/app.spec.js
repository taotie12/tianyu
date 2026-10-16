import {test,expect} from '@playwright/test';
import QRCode from 'qrcode';
import fs from 'node:fs';
const sample=JSON.parse(fs.readFileSync('public/sample-schedule.json','utf8'));
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-17T04:00:00Z')});await page.goto('/');await expect(page.getByRole('gridcell',{name:'2026-10-17 早班',exact:true})).toBeVisible();});
test('月历、班次调整、持久保存与移动端布局',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.getByRole('heading',{name:/我的倒班日历/})).toBeVisible();
 await page.getByRole('gridcell',{name:'2026-10-17 早班',exact:true}).click();
 await page.getByRole('button',{name:'调整当天班次'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'休息'}).click();
 await expect(page.getByRole('gridcell',{name:'2026-10-17 休息',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('gridcell',{name:'2026-10-17 休息',exact:true})).toBeVisible();
 await page.screenshot({path:'/workspace/tianyu/docs/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('heading',{name:/我的倒班日历/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/workspace/tianyu/docs/mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('二维码图片识别、预览覆盖确认、拒绝错误值组',async({page})=>{
 await page.getByRole('button',{name:'扫码导入',exact:true}).click();
 const png=await QRCode.toBuffer('SZ1:'+JSON.stringify(sample),{width:960,margin:4,errorCorrectionLevel:'M'});
 await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'schedule.png',mimeType:'image/png',buffer:png});
 await expect(page.getByRole('heading',{name:'找到你的三值排班'})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 396 天'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'扫码导入',exact:true}).click();await page.getByRole('button',{name:'粘贴内容',exact:true}).click();
 await page.locator('textarea').fill('SZ1:'+JSON.stringify({...sample,team:'二值'}));await page.getByRole('button',{name:'解析并预览'}).click();await expect(page.getByRole('alert')).toContainText('不是三值');
});
test('分享二维码下载及 AI 提示词',async({page})=>{
 await page.getByRole('button',{name:'分享排班',exact:true}).click();await expect(page.getByAltText('三值排班导入二维码')).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'保存二维码'}).click();const d=await pending;expect(d.suggestedFilename()).toBe('三值排班-2025-12-01.png');
 await expect(page.getByRole('button',{name:'复制提示词'})).toBeVisible();
});
test('确认班次时间后导出含闹钟的系统日历',async({page})=>{
 await page.getByRole('button',{name:'设置我的提醒'}).click();
 await page.getByRole('checkbox',{name:'我已确认上述时间符合实际班次'}).check();
 await page.getByLabel('夜班开始时间').fill('23:00');await page.getByLabel('夜班结束时间').fill('07:00');
 await page.getByRole('button',{name:'保存设置'}).click();
 await page.getByRole('button',{name:'设置我的提醒'}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出系统日历'}).click();const d=await pending;const text=fs.readFileSync(await d.path(),'utf8');expect(text).toContain('BEGIN:VALARM');expect(text).toContain('TRIGGER:-PT30M');expect(text).toContain('SUMMARY:三值');
 await expect(page.getByRole('switch')).toBeDisabled();
});
if(process.env.EXCEL_FIXTURE)test('从用户原始 Excel 文件直接导入整年三值排班',async({page})=>{
 await page.getByRole('button',{name:'扫码导入',exact:true}).click();await page.getByRole('button',{name:'Excel 表格',exact:true}).click();
 await page.locator('input[type=file][accept=".xlsx"]').setInputFiles(process.env.EXCEL_FIXTURE);
 await expect(page.getByRole('heading',{name:'找到你的三值排班'})).toBeVisible();
 await expect(page.getByText('2025-12-01 — 2026-12-31',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 396 天'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
