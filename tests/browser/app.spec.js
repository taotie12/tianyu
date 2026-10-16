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
 await expect(page.getByRole('dialog').getByRole('button',{name:'复制 AI 提示词',exact:true})).toBeVisible();
});
test('作息设置、可调班车提前量与独立闹钟日历导出',async({page})=>{
 await page.getByRole('button',{name:'设置我的提醒'}).click();
 await expect(page.getByRole('heading',{name:'我的作息与闹钟'})).toBeVisible();
 await page.getByRole('checkbox',{name:'我已核对班次、起床与班车时间'}).check();
 await page.getByLabel('班车提前多久响铃').selectOption('5');
 await expect(page.getByText('夜班：前一晚 22:05 班车提醒',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'保存设置'}).click();await page.getByRole('button',{name:'设置我的提醒'}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出系统日历'}).click();const d=await pending;const text=fs.readFileSync(await d.path(),'utf8');expect(text).toContain('BEGIN:VALARM');expect(text).toContain('TRIGGER:-PT115M');expect(text).toContain('TRIGGER:-PT80M');expect(text).toContain('早班起床');
 await expect(page.getByRole('switch')).toBeDisabled();
});
test('上夜下夜标注、原表保留及下夜不再赶夜班车',async({page})=>{
 await expect(page.getByRole('gridcell',{name:'2026-10-21 上夜',exact:true})).toContainText('22:10 出发');
 await page.getByRole('gridcell',{name:'2026-10-21 上夜',exact:true}).click();
 await expect(page.getByText('次日 00:00–08:00 上班',{exact:true})).toBeVisible();
 await page.getByRole('gridcell',{name:'2026-10-23 下夜',exact:true}).click();await expect(page.getByText('当晚无下一班夜班，不安排夜班车提醒',{exact:true})).toBeVisible();
 const schedule=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')).schedule);expect(schedule['2026-10-21']).toBe('O');expect(schedule['2026-10-23']).toBe('N');
});
test('首页醒目引导、完整提示词、真实示例二维码和确认导入',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 const hero=page.getByRole('region',{name:'AI 排班二维码导入入门'});await expect(hero).toBeVisible();
 await hero.getByRole('button',{name:'复制 AI 提示词',exact:true}).click();const prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain('只提取“三值”');expect(prompt).toContain('不要用绘图模型画二维码');expect(prompt).toContain('额外新增、平移或删除夜班');
 await hero.getByRole('button',{name:'看导入示例与教程'}).click();await expect(page.getByText('同一部手机操作？用相册导入',{exact:true})).toBeVisible();await expect(page.getByAltText('6天三值排班教学二维码')).toBeVisible();
 await page.getByRole('button',{name:'展开 / 手动复制完整提示词'}).click();await expect(page.getByLabel('完整 AI 提示词')).toHaveValue(prompt);
 await page.getByRole('button',{name:'试一试：预览这 6 天的导入'}).click();await expect(page.getByRole('button',{name:'确认导入 6 天'})).toBeVisible();await expect(page.getByText('2026-10-19 — 2026-10-24',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 6 天'}).click();await expect(page.getByRole('gridcell',{name:'2026-10-21 上夜',exact:true})).toBeVisible();
});
test('旧版更新保留调整过的排班，暂停旧提醒并提示核对',async({page})=>{
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('sanzhi-calendar-v1'));x.schedule['2026-10-17']='T';x.settings={enabled:true,confirmed:true,advance:15,times:x.settings.times};localStorage.setItem('sanzhi-calendar-v1',JSON.stringify(x));});await page.reload();
 await expect(page.getByRole('gridcell',{name:'2026-10-17 培训',exact:true})).toBeVisible();await page.getByRole('button',{name:'设置我的提醒'}).click();await expect(page.getByText('已保留你的排班。旧版提醒已暂停，请核对这次新增的起床和班车安排后重新开启。',{exact:true})).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')));expect(saved.settings.schemaVersion).toBe(2);expect(saved.settings.enabled).toBe(false);expect(saved.settings.confirmed).toBe(false);
});
if(process.env.EXCEL_FIXTURE)test('从用户原始 Excel 文件直接导入整年三值排班',async({page})=>{
 await page.getByRole('button',{name:'扫码导入',exact:true}).click();await page.getByRole('button',{name:'Excel 表格',exact:true}).click();
 await page.locator('input[type=file][accept=".xlsx"]').setInputFiles(process.env.EXCEL_FIXTURE);
 await expect(page.getByRole('heading',{name:'找到你的三值排班'})).toBeVisible();
 await expect(page.getByText('2025-12-01 — 2026-12-31',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 396 天'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('新人同手机流程：保存教程二维码到相册，再从图片识别导入',async({page})=>{
 await page.getByRole('button',{name:'看导入示例与教程'}).click();await expect(page.getByAltText('6天三值排班教学二维码')).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'保存示例二维码'}).click();const d=await pending;const buffer=fs.readFileSync(await d.path());
 await page.getByRole('button',{name:'我已经有二维码，去导入'}).click();await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'AI示例二维码.png',mimeType:'image/png',buffer});
 await expect(page.getByRole('button',{name:'确认导入 6 天'})).toBeVisible();await expect(page.getByText('2026-10-19 — 2026-10-24',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 6 天'}).click();await expect(page.getByRole('gridcell',{name:'2026-10-23 下夜',exact:true})).toBeVisible();
});
