import {test,expect} from '@playwright/test';
import QRCode from 'qrcode';
import fs from 'node:fs';
const sample=JSON.parse(fs.readFileSync('public/sample-schedule.json','utf8'));
async function openMenuAction(page,name){await page.getByRole('button',{name:'更多菜单',exact:true}).click();await page.getByRole('dialog',{name:'更多',exact:true}).getByRole('button',{name,exact:true}).click();}
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-10-17T04:00:00Z')});await page.goto('/');await expect(page.getByRole('gridcell',{name:'2026-10-17 早班',exact:true})).toBeVisible();});
test('月历、班次调整、持久保存与移动端布局',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await expect(page.getByRole('heading',{name:/我的倒班日历/})).toBeVisible();
 await page.getByRole('gridcell',{name:'2026-10-17 早班',exact:true}).click();
 await page.getByRole('button',{name:'调整当天班次'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'休息'}).click();
 await expect(page.getByRole('gridcell',{name:'2026-10-17 休息',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('gridcell',{name:'2026-10-17 休息',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'已阅读',exact:true}).click();
 await page.screenshot({path:'/workspace/tianyu/docs/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByRole('heading',{name:/我的倒班日历/})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/workspace/tianyu/docs/mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('二维码图片识别、预览覆盖确认、拒绝错误协议',async({page})=>{
 await openMenuAction(page,'导入排班');
 const png=await QRCode.toBuffer('SZ1:'+JSON.stringify(sample),{width:960,margin:4,errorCorrectionLevel:'M'});
 await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'schedule.png',mimeType:'image/png',buffer:png});
 await expect(page.getByRole('heading',{name:'找到你的三值排班'})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 396 天'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await openMenuAction(page,'导入排班');await page.getByRole('button',{name:'粘贴内容',exact:true}).click();
 await page.locator('textarea').fill('SZ1:'+JSON.stringify({...sample,v:2}));await page.getByRole('button',{name:'解析并预览'}).click();await expect(page.getByRole('alert')).toContainText('不支持此排班版本');
});
test('分享二维码下载及 AI 提示词',async({page})=>{
 await openMenuAction(page,'分享排班');await expect(page.getByAltText('三值排班导入二维码')).toBeVisible();
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
 await hero.getByRole('button',{name:'复制 AI 提示词',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'复制 AI 提示词',exact:true}).click();const prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain('只提取“三值”');expect(prompt).toContain('不要用绘图模型画二维码');expect(prompt).toContain('额外新增、平移或删除夜班');
 await expect(page.getByText('同一部手机操作？用相册导入',{exact:true})).toBeVisible();await expect(page.getByAltText('6天三值排班教学二维码')).toBeVisible();
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
 await openMenuAction(page,'导入排班');await page.getByRole('button',{name:'Excel 表格',exact:true}).click();
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

test('首次提示确认已阅读后持久隐藏，右上角菜单可重看教程',async({page})=>{
 const intro=page.getByRole('region',{name:'AI 排班二维码导入入门'});await expect(intro).toBeVisible();
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')));
 await intro.getByRole('button',{name:'已阅读',exact:true}).click();await expect(intro).toHaveCount(0);
 await page.reload();await expect(page.getByRole('gridcell',{name:'2026-10-17 早班',exact:true})).toBeVisible();await expect(intro).toHaveCount(0);
 const after=await page.evaluate(()=>({read:localStorage.getItem('sanzhi-ai-guide-read-v1'),data:JSON.parse(localStorage.getItem('sanzhi-calendar-v1'))}));expect(after.read).toBe('1');expect(after.data.schedule).toEqual(before.schedule);expect(after.data.settings).toMatchObject(before.settings);
 await openMenuAction(page,'查看 AI 导入教程');await expect(page.getByAltText('6天三值排班教学二维码')).toBeVisible();await expect(page.getByRole('dialog').getByRole('button',{name:'复制 AI 提示词',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'返回日历',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(intro).toHaveCount(0);
});
test('手机首页移除重复操作，底部导入分享及菜单继续可用',async({page})=>{
 await page.setViewportSize({width:390,height:844});await expect(page.locator('.page-heading').getByRole('button')).toHaveCount(0);
 await page.getByRole('button',{name:'已阅读',exact:true}).click();
 const bottom=page.getByRole('navigation',{name:'底部导航'});await expect(bottom).toBeVisible();
 await bottom.getByRole('button',{name:'导入',exact:true}).click();await expect(page.getByRole('dialog',{name:'导入我的排班'})).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await bottom.getByRole('button',{name:'分享',exact:true}).click();await expect(page.getByAltText('三值排班导入二维码')).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await openMenuAction(page,'查看 AI 导入教程');await expect(page.getByRole('dialog',{name:'Excel → AI → 二维码导入教程'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('长弹窗只滚动正文，关闭按钮保持右上角且恢复页面滚动',async({page})=>{
 await page.setViewportSize({width:390,height:700});
 const before=await page.evaluate(()=>({overflow:document.body.style.overflow,y:scrollY}));
 await page.getByRole('button',{name:'提醒设置',exact:true}).click();
 const close=page.getByRole('button',{name:'关闭',exact:true}),content=page.locator('.modal-content');
 const box=await close.boundingBox();expect(box.x).toBeGreaterThan(300);
 await expect.poll(()=>content.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
 await content.hover();await page.mouse.wheel(0,2500);
 await expect.poll(()=>content.evaluate(e=>e.scrollTop)).toBeGreaterThan(400);
 const after=await close.boundingBox();expect(after.y).toBeCloseTo(box.y,1);await expect(close).toBeInViewport();
 expect(await page.evaluate(()=>scrollY)).toBe(before.y);
 await close.click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>document.body.style.overflow)).toBe(before.overflow);
 await page.mouse.wheel(0,500);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before.y);
});
test('安卓返回事件关闭所有类型弹窗，首页不拦截返回',async({page})=>{
 for(const action of ['导入排班','分享排班','提醒与作息','查看 AI 导入教程','闹钟权限与后台设置']){
  await openMenuAction(page,action);await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>window.dispatchEvent(new Event('sanzhi-android-back',{cancelable:true})))).toBe(false);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>window.dispatchEvent(new Event('sanzhi-android-back',{cancelable:true})))).toBe(true);
 }
 await page.getByRole('button',{name:'更多菜单',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('小屏触摸可滚动正文，横屏可访问底部，关闭按钮不移动',async({browser})=>{
 const context=await browser.newContext({viewport:{width:360,height:640},hasTouch:true,isMobile:true});const page=await context.newPage();
 await page.goto('/');await page.getByRole('button',{name:'提醒设置',exact:true}).click();
 const content=page.locator('.modal-content');const close=page.getByRole('button',{name:'关闭',exact:true});const initial=await close.boundingBox();
 const session=await context.newCDPSession(page),bounds=await content.boundingBox();
 for(let step=0;step<4;step++){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:bounds.y+bounds.height-45}]});
  for(let i=1;i<=8;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y:bounds.y+bounds.height-45-i*35}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await expect.poll(()=>content.evaluate(e=>e.scrollTop)).toBeGreaterThan(300);
 expect((await close.boundingBox()).y).toBeCloseTo(initial.y,1);await close.click();
 await page.setViewportSize({width:640,height:360});await page.getByRole('button',{name:'提醒设置',exact:true}).click();
 await page.getByRole('button',{name:'保存设置',exact:true}).scrollIntoViewIfNeeded();await expect(close).toBeInViewport();
 await context.close();
});
test('权限指南说明厂商开关、后台测试和强行停止限制，菜单显示作者',async({page})=>{
 await page.getByRole('button',{name:'更多菜单',exact:true}).click();await expect(page.getByText('作者：taotie',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'闹钟权限与后台设置',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'闹钟权限与后台设置',exact:true})).toBeVisible();
 await expect(page.getByText('4. 锁屏显示',{exact:true})).toBeVisible();
 await expect(page.getByText('需手动确认',{exact:true})).toHaveCount(3);
 await expect(page.getByText('已开启',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'30 秒后测试锁屏与后台响铃',exact:true})).toBeDisabled();
 await expect(page.getByText(/“强行停止\/结束运行”会阻止闹钟/)).toBeVisible();
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.getByRole('button',{name:'提醒设置',exact:true}).click();
 await page.getByRole('button',{name:'闹钟权限与后台设置',exact:true}).click();await expect(page.getByRole('heading',{name:'闹钟权限与后台设置',exact:true})).toBeVisible();
});

async function mockAndroid(page){
 await page.addInitScript(()=>{
  window.CapacitorCustomPlatform={name:'android'};
  window.__alarmMock={calls:[],failRestore:localStorage.getItem('test-fail-restore')==='1'};
  const methods={ShiftAlarm:['restore','replace','clear','health','openSettings','test'],LocalNotifications:['checkPermissions','requestPermissions','checkExactNotificationSetting','getPending','cancel']};
  window.Capacitor={PluginHeaders:Object.entries(methods).map(([name,names])=>({name,methods:names.map(name=>({name,rtype:'promise'}))})),nativePromise:async(plugin,method,options)=>{
   window.__alarmMock.calls.push({plugin,method,options});
   if(method==='restore'){if(window.__alarmMock.failRestore)throw Error('模拟后台恢复失败');return {count:3};}
   if(method==='health')return {manufacturer:'Xiaomi',androidVersion:35,notifications:true,alarmChannel:true,exact:true,fullScreen:true,battery:true,count:3};
   if(method==='checkPermissions'||method==='requestPermissions')return {display:'granted'};
   if(method==='checkExactNotificationSetting')return {exact_alarm:'granted'};
   if(method==='getPending')return {notifications:[]};
   if(method==='openSettings')return {fallback:false};
   return {};
  }};
 });
}
test('安卓桥接故障后仍保留提醒选择，前台恢复成功后清除故障提示',async({page})=>{
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('sanzhi-calendar-v1'));x.settings.enabled=true;localStorage.setItem('sanzhi-calendar-v1',JSON.stringify(x));localStorage.setItem('test-fail-restore','1');});
 await mockAndroid(page);await page.reload();await expect(page.getByText('模拟后台恢复失败',{exact:true})).toBeVisible();await expect(page.locator('.status-text')).toHaveText('需检查');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')).settings.enabled)).toBe(true);
 expect(await page.evaluate(()=>window.__alarmMock.calls.filter(x=>x.method==='clear'||x.method==='replace'))).toEqual([]);
 await page.evaluate(()=>{window.__alarmMock.failRestore=false;window.dispatchEvent(new Event('sanzhi-native-resume'));});await expect(page.locator('.status-text')).toHaveText('已开启');await expect(page.getByText('模拟后台恢复失败',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'提醒设置',exact:true}).click();await page.getByRole('switch',{name:'启用闹钟',exact:true}).uncheck();await page.getByRole('button',{name:'保存设置',exact:true}).click();
 expect(await page.evaluate(()=>window.__alarmMock.calls.filter(x=>x.method==='clear').length)).toBe(1);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')));expect(saved.settings.enabled).toBe(false);expect(saved.alarmSyncPending).toBe(false);
});
test('安卓首次启用后打开权限向导，核对完成隐藏提示，测试使用30秒原生闹钟',async({page})=>{
 await mockAndroid(page);await page.reload();await page.getByRole('button',{name:'提醒设置',exact:true}).click();await page.getByRole('switch',{name:'启用闹钟',exact:true}).check();await page.getByRole('button',{name:'保存设置',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'闹钟权限与后台设置',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'30 秒后测试锁屏与后台响铃',exact:true}).click();await expect(page.getByText(/测试闹钟已安排，30 秒后响铃/)).toBeVisible();
 expect(await page.evaluate(()=>window.__alarmMock.calls.find(x=>x.method==='test').options.delaySeconds)).toBe(30);
 const checks=page.getByRole('checkbox',{name:'我已在系统设置中核对并允许',exact:true});for(let i=0;i<3;i++)await checks.nth(i).check();
 await page.getByRole('button',{name:'已完成权限核对',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('region',{name:'闹钟权限提示',exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-alarm-permissions-v1')).reviewed)).toBe(true);
 expect(await page.evaluate(()=>window.__alarmMock.calls.filter(x=>x.method==='replace').length)).toBe(1);
});

async function importPublishedQR(page,number){
 const team={1:'一值',2:'二值',4:'四值',5:'五值'}[number];await openMenuAction(page,'导入排班');
 await page.locator('input[type=file][accept="image/*"]').setInputFiles(`docs/unit2-teams/unit2-team${number}.png`);
 await expect(page.getByRole('heading',{name:`找到你的${team}排班`,exact:true})).toBeVisible();
 await page.getByRole('button',{name:'确认导入 396 天',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
}
for(const [number,team] of [[1,'一值'],[2,'二值'],[4,'四值'],[5,'五值']])test(`之前发布的${team}二维码可直接导入，分享与重开均保留值别`,async({page})=>{
 await page.setViewportSize({width:390,height:844});const expected=JSON.parse(fs.readFileSync(`docs/unit2-teams/unit2-team${number}.json`,'utf8'));
 await importPublishedQR(page,number);await expect(page.getByRole('combobox',{name:'当前值别',exact:true})).toHaveValue(team);
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')));expect(saved.team).toBe(team);expect(Object.keys(saved.schedule)).toHaveLength(396);expect(Object.values(saved.schedule).join('')).toBe(expected.days);expect(saved.profiles.find(p=>p.team==='三值').schedule['2026-10-17']).toBe('D');
 await openMenuAction(page,'分享排班');await expect(page.getByAltText(`${team}排班导入二维码`)).toBeVisible();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出二维码文字',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toBe(`${team}排班-2025-12-01.txt`);expect(fs.readFileSync(await download.path(),'utf8')).toBe('SZ1:'+JSON.stringify(expected));
 await page.getByRole('button',{name:'关闭',exact:true}).click();await page.reload();await expect(page.getByRole('combobox',{name:'当前值别',exact:true})).toHaveValue(team);await expect(page.locator('.schedule-label')).toHaveText(`${team}排班`);
});
test('值别切换保留各自修改，部分日期导入不会混入其他值的日期',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'调整当天班次',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'休息',exact:true}).click();
 await openMenuAction(page,'导入排班');await page.getByRole('button',{name:'粘贴内容',exact:true}).click();await page.locator('textarea').fill('SZ1:'+JSON.stringify({v:1,team:'运行六值',start:'2026-10-17',days:'NA',tz:'Asia/Shanghai'}));await page.getByRole('button',{name:'解析并预览',exact:true}).click();
 await expect(page.getByText(/当前是三值，确认后切换到运行六值/)).toBeVisible();await page.getByRole('button',{name:'确认导入 2 天',exact:true}).click();
 const picker=page.getByRole('combobox',{name:'当前值别',exact:true});await expect(picker).toHaveValue('运行六值');expect(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('sanzhi-calendar-v1')).schedule).length)).toBe(2);
 await expect(page.getByRole('gridcell',{name:'2026-10-17 下夜',exact:true})).toBeVisible();await picker.selectOption('三值');await expect(page.getByRole('gridcell',{name:'2026-10-17 休息',exact:true})).toBeVisible();
 await picker.selectOption('运行六值');await page.getByRole('button',{name:'调整当天班次',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'早班',exact:true}).click();await page.reload();await expect(picker).toHaveValue('运行六值');await expect(page.getByRole('gridcell',{name:'2026-10-17 早班',exact:true})).toBeVisible();
 await picker.selectOption('三值');await expect(page.getByRole('gridcell',{name:'2026-10-17 休息',exact:true})).toBeVisible();
});
if(process.env.EXCEL_FIXTURE)test('同一份 Excel 可选择五值，按真实列导入后导出五值日历',async({page})=>{
 const expected=JSON.parse(fs.readFileSync('docs/unit2-teams/unit2-team5.json','utf8'));await openMenuAction(page,'导入排班');await page.getByRole('button',{name:'Excel 表格',exact:true}).click();await page.locator('input[type=file][accept=".xlsx"]').setInputFiles(process.env.EXCEL_FIXTURE);
 await page.getByRole('combobox',{name:'Excel 值别',exact:true}).selectOption('五值');await expect(page.getByRole('heading',{name:'找到你的五值排班',exact:true})).toBeVisible();await page.getByRole('button',{name:'确认导入 396 天',exact:true}).click();
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('sanzhi-calendar-v1')).schedule).join(''))).toBe(expected.days);
 await page.getByRole('button',{name:'提醒设置',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出系统日历',exact:true}).click();const file=await pending;expect(file.suggestedFilename()).toBe('五值起床班车提醒.ics');const content=fs.readFileSync(await file.path(),'utf8');expect(content).toContain('SUMMARY:五值');expect(content).not.toContain('SUMMARY:三值');
});
test('AI 提示词可选五值和任意其他名称，演示二维码也保留所选值别',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await openMenuAction(page,'查看 AI 导入教程');await page.getByLabel('提示词值别',{exact:true}).fill('五值');await page.getByRole('dialog').getByRole('button',{name:'复制 AI 提示词',exact:true}).click();let prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain('只提取“五值”列');expect(prompt).toContain('"team":"五值"');expect(prompt).not.toContain('team 固定为“三值”');
 await expect(page.getByAltText('6天五值排班教学二维码')).toBeVisible();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'保存示例二维码',exact:true}).click();const file=await pending;
 await page.getByRole('button',{name:'我已经有二维码，去导入',exact:true}).click();await page.locator('input[type=file][accept="image/*"]').setInputFiles({name:'example.png',mimeType:'image/png',buffer:fs.readFileSync(await file.path())});await expect(page.getByRole('heading',{name:'找到你的五值排班',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'关闭',exact:true}).click();await openMenuAction(page,'查看 AI 导入教程');await page.getByLabel('提示词值别',{exact:true}).fill('运行六值');await page.getByRole('dialog').getByRole('button',{name:'复制 AI 提示词',exact:true}).click();prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain('只提取“运行六值”列');
});
test('安卓切换到五值只安排五值闹钟，切回三值重新安排三值闹钟',async({page})=>{
 await page.evaluate(()=>{const x=JSON.parse(localStorage.getItem('sanzhi-calendar-v1'));x.settings.enabled=true;delete x.team;delete x.profiles;localStorage.setItem('sanzhi-calendar-v1',JSON.stringify(x));});await mockAndroid(page);await page.reload();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('sanzhi-calendar-v1')).settings.enabled)).toBe(true);
 await importPublishedQR(page,5);let calls=await page.evaluate(()=>window.__alarmMock.calls.filter(c=>c.method==='replace'));expect(calls.at(-1).options.alarms.length).toBeGreaterThan(0);expect(calls.at(-1).options.alarms.every(a=>a.title.startsWith('五值 · '))).toBe(true);
 await page.getByRole('combobox',{name:'当前值别',exact:true}).selectOption('三值');await expect.poll(()=>page.evaluate(()=>window.__alarmMock.calls.filter(c=>c.method==='replace').length)).toBe(2);calls=await page.evaluate(()=>window.__alarmMock.calls.filter(c=>c.method==='replace'));expect(calls.at(-1).options.alarms.every(a=>a.title.startsWith('三值 · '))).toBe(true);expect(await page.evaluate(()=>window.__alarmMock.calls.filter(c=>c.method==='clear').length)).toBe(0);
});
