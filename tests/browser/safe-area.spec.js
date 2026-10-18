import {test,expect} from '@playwright/test';

// Inject the same four variables supplied by Capacitor's Android SystemBars
// plugin. Chromium's env(safe-area-inset-*) remains zero in these tests.
async function insets(page,{top=0,right=0,bottom=0,left=0}){
 await page.evaluate(values=>{for(const [edge,value] of Object.entries(values))document.documentElement.style.setProperty('--safe-area-inset-'+edge,value+'px');},{top,right,bottom,left});
}
async function inside(locator,{top=0,right=0,bottom=0,left=0,width,height}){
 const box=await locator.boundingBox();expect(box).not.toBeNull();
 expect(box.x).toBeGreaterThanOrEqual(left-1);expect(box.y).toBeGreaterThanOrEqual(top-1);
 expect(box.x+box.width).toBeLessThanOrEqual(width-right+1);expect(box.y+box.height).toBeLessThanOrEqual(height-bottom+1);
}
test.beforeEach(async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('gridcell').first()).toBeVisible();
});

test('安卓三键导航：状态栏和导航栏的原生数值在 env 为零时仍生效',async({page})=>{
 const safe={top:38,bottom:48,left:0,right:0,width:390,height:844};await insets(page,safe);
 const menu=page.getByRole('button',{name:'更多菜单',exact:true}),alarm=page.getByRole('button',{name:'提醒设置',exact:true});
 await inside(menu,safe);await inside(alarm,safe);
 const nav=page.getByRole('navigation',{name:'底部导航',exact:true});
 for(const button of await nav.getByRole('button').all())await inside(button,safe);
 expect((await nav.boundingBox()).height).toBe(113);
 await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 for(const button of await nav.getByRole('button').all())await inside(button,safe);
 await expect(nav.getByRole('button',{name:'分享',exact:true})).toBeVisible();
});

test('长弹窗及关闭按钮避开上下系统栏，滚动后关闭按钮仍可点击',async({page})=>{
 const safe={top:44,bottom:48,width:390,height:844};await insets(page,safe);
 await page.getByRole('button',{name:'提醒设置',exact:true}).click();
 const dialog=page.getByRole('dialog'),close=page.getByRole('button',{name:'关闭',exact:true}),content=page.locator('.modal-content');
 await inside(dialog,safe);await inside(close,safe);
 const before=await close.boundingBox();await content.hover();await page.mouse.wheel(0,3000);
 await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(300);
 await inside(close,safe);expect((await close.boundingBox()).y).toBeCloseTo(before.y,1);
 await page.getByRole('button',{name:'保存设置',exact:true}).scrollIntoViewIfNeeded();await inside(page.getByRole('button',{name:'保存设置',exact:true}),safe);
 await close.click();await expect(dialog).toHaveCount(0);
});

test('手势导航、三键导航与旧 WebView 的零间距可以动态切换，不累加空白',async({page})=>{
 const nav=page.getByRole('navigation',{name:'底部导航',exact:true});
 for(const [top,bottom] of [[28,24],[28,48],[0,0],[28,24]]){
  await insets(page,{top,bottom});expect((await nav.boundingBox()).height).toBe(65+bottom);
  const padding=await page.locator('.app-shell').evaluate(el=>{const css=getComputedStyle(el);return [parseFloat(css.paddingTop),parseFloat(css.paddingBottom)];});expect(padding).toEqual([top,bottom]);
  await inside(page.getByRole('button',{name:'更多菜单',exact:true}),{top,bottom,width:390,height:844});
 }
});

test('横屏刘海和侧边虚拟按键：头部、侧栏和弹窗都留出左右间距',async({page})=>{
 await page.setViewportSize({width:844,height:390});const safe={top:24,bottom:0,left:44,right:48,width:844,height:390};await insets(page,safe);
 await inside(page.locator('.sidebar'),safe);await inside(page.getByRole('button',{name:'更多菜单',exact:true}),safe);
 await page.getByRole('button',{name:'提醒设置',exact:true}).click();await inside(page.getByRole('dialog'),safe);await inside(page.getByRole('button',{name:'关闭',exact:true}),safe);
 await page.getByRole('button',{name:'保存设置',exact:true}).scrollIntoViewIfNeeded();await inside(page.getByRole('button',{name:'保存设置',exact:true}),safe);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('键盘缩小视口后弹窗仍可滚动，恢复视口后重新应用底部系统间距',async({page})=>{
 await insets(page,{top:32,bottom:48});await page.getByRole('button',{name:'更多菜单',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'导入排班',exact:true}).click();
 await page.getByRole('button',{name:'粘贴内容',exact:true}).click();await page.locator('textarea').focus();
 await page.setViewportSize({width:390,height:480});await insets(page,{top:32,bottom:0});await inside(page.getByRole('dialog'),{top:32,width:390,height:480});await inside(page.getByRole('button',{name:'关闭',exact:true}),{top:32,width:390,height:480});
 await page.getByRole('button',{name:'解析并预览',exact:true}).scrollIntoViewIfNeeded();await inside(page.getByRole('button',{name:'解析并预览',exact:true}),{top:32,width:390,height:480});
 await page.setViewportSize({width:390,height:844});await insets(page,{top:32,bottom:48});await inside(page.getByRole('dialog'),{top:32,bottom:48,width:390,height:844});
 await page.getByRole('button',{name:'关闭',exact:true}).click();await inside(page.getByRole('navigation',{name:'底部导航'}).getByRole('button',{name:'提醒',exact:true}),{top:32,bottom:48,width:390,height:844});
});
