import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({native:true,plugin:{sync:vi.fn(),status:vi.fn(),pin:vi.fn()}}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>m.native},registerPlugin:()=>m.plugin}));
import {syncStoredWidget,widgetStatus,requestWidget} from '../src/widgets';
import {defaultSettings} from '../src/schedule';
import {normalizeCalendarStore,importCalendar,deleteCalendar} from '../src/calendars';

function memoryStore(data){let raw=JSON.stringify(data);return {getItem:()=>raw,set:data=>{raw=JSON.stringify(data);}};}
function calendar(){return normalizeCalendarStore({team:'五值（大修中）',schedule:{'2026-10-19':'A','2026-10-20':'O','2026-10-21':'N','2026-10-22':'N','2026-10-23':'O'},settings:defaultSettings()});}
beforeEach(()=>{vi.resetAllMocks();m.native=true;m.plugin.sync.mockResolvedValue({count:1});m.plugin.status.mockResolvedValue({supported:true,count:1});m.plugin.pin.mockResolvedValue({requested:true});});

describe('桌面小部件同步',()=>{
 it('关闭闹钟也同步完整原始排班及真实值别，不把上夜转换成额外班次',async()=>{
  const data=calendar();await syncStoredWidget({store:memoryStore(data)});
  expect(data.settings.enabled).toBe(false);
  expect(m.plugin.sync).toHaveBeenCalledWith({team:'五值（大修中）',schedule:data.schedule,times:data.settings.times,bus:data.settings.routine.bus});
  expect(m.plugin.sync.mock.calls[0][0].schedule['2026-10-20']).toBe('O');
 });
 it('独立同步自定义班车和工作时间，不包含其他班组或权限信息',async()=>{
  const data=calendar();data.settings.routine.bus.N='22:20';data.settings.times.N.end='08:10';data.profiles.push({team:'三值',schedule:{'2026-10-19':'D'}});
  await syncStoredWidget({store:memoryStore(data)});const payload=m.plugin.sync.mock.calls[0][0];expect(payload.bus.N).toBe('22:20');expect(payload.times.N.end).toBe('08:10');expect(payload.profiles).toBeUndefined();expect(payload.settings).toBeUndefined();
 });
 it('保存全部日期，超过当前7天的排班可供安卓后台跨天读取',async()=>{
  const data=importCalendar({v:1,team:'五值',start:'2027-01-01',days:'DANOO'.repeat(80),tz:'Asia/Shanghai'},calendar());await syncStoredWidget({store:memoryStore(data)});
  expect(Object.keys(m.plugin.sync.mock.calls[0][0].schedule)).toHaveLength(400);
 });
 it('删除当前班组后同步剩余值别，最后一个删除后明确清空',async()=>{
  const two=importCalendar({v:1,team:'一值',start:'2026-10-19',days:'D',tz:'Asia/Shanghai'},calendar());const one=deleteCalendar(two,'一值');const store=memoryStore(one);
  await syncStoredWidget({store});expect(m.plugin.sync.mock.calls[0][0].team).toBe('五值（大修中）');
  store.set(deleteCalendar(one,'五值（大修中）'));await syncStoredWidget({store});expect(m.plugin.sync.mock.calls[1][0]).toMatchObject({team:null,schedule:{}});
 });
 it('读取持久化最新值别并串行更新，旧异步请求不会最后覆盖新值',async()=>{
  const store=memoryStore(calendar());let finish;m.plugin.sync.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const first=syncStoredWidget({store});await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  store.set(importCalendar({v:1,team:'四值',start:'2026-10-19',days:'T',tz:'Asia/Shanghai'},calendar()));
  const second=syncStoredWidget({store});expect(m.plugin.sync).toHaveBeenCalledTimes(1);finish({count:1});await Promise.all([first,second]);expect(m.plugin.sync.mock.calls[1][0]).toMatchObject({team:'四值',schedule:{'2026-10-19':'T'}});
 });
 it('一次桥接失败后可以重试，失败不会修改网页排班',async()=>{
  const data=calendar(),store=memoryStore(data);m.plugin.sync.mockRejectedValueOnce(Error('disk full'));
  await expect(syncStoredWidget({store})).rejects.toThrow('disk full');expect(JSON.parse(store.getItem())).toEqual(data);await syncStoredWidget({store});expect(m.plugin.sync).toHaveBeenCalledTimes(2);
 });
 it('无法读取的本机数据不覆盖原生排班，尚未初始化时不发送空数据',async()=>{
  await expect(syncStoredWidget({store:{getItem:()=>'{bad'}})).rejects.toThrow();await syncStoredWidget({store:{getItem:()=>null}});expect(m.plugin.sync).not.toHaveBeenCalled();
 });
 it('网页版不调用安卓桥接',async()=>{
  m.native=false;expect(await syncStoredWidget({store:memoryStore(calendar())})).toBeNull();expect(await widgetStatus()).toEqual({supported:false,count:0});expect(await requestWidget()).toEqual({requested:false});expect(m.plugin.sync).not.toHaveBeenCalled();expect(m.plugin.pin).not.toHaveBeenCalled();
 });
 it('添加前先同步成功；系统只确认已发起请求，不保证用户已添加',async()=>{
  vi.stubGlobal('localStorage',memoryStore(calendar()));
  try{expect(await requestWidget()).toEqual({requested:true});expect(m.plugin.pin).toHaveBeenLastCalledWith({size:'4x2'});expect(m.plugin.sync.mock.invocationCallOrder[0]).toBeLessThan(m.plugin.pin.mock.invocationCallOrder[0]);expect(await requestWidget('2x2')).toEqual({requested:true});expect(m.plugin.pin).toHaveBeenLastCalledWith({size:'2x2'});expect(await widgetStatus()).toEqual({supported:true,count:1});}
  finally{vi.unstubAllGlobals();}
 });
 it('添加前同步失败时停止，不添加显示旧排班的小部件',async()=>{
  vi.stubGlobal('localStorage',memoryStore(calendar()));m.plugin.sync.mockRejectedValueOnce(Error('bridge failed'));
  try{await expect(requestWidget()).rejects.toThrow('bridge failed');expect(m.plugin.pin).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
 });
 it('拒绝不支持的尺寸，不发送同步或桌面请求',async()=>{
  await expect(requestWidget('4x3')).rejects.toThrow('4×2 或 2×2');expect(m.plugin.pin).not.toHaveBeenCalled();expect(m.plugin.sync).not.toHaveBeenCalled();
 });
});
