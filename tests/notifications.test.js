import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const m=vi.hoisted(()=>({alarm:{replace:vi.fn(),clear:vi.fn(),test:vi.fn(),lockScreenSettings:vi.fn(),restore:vi.fn()},local:{requestPermissions:vi.fn(),checkPermissions:vi.fn(),checkExactNotificationSetting:vi.fn(),createChannel:vi.fn(),getPending:vi.fn(),cancel:vi.fn(),changeExactNotificationSetting:vi.fn()}}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true},registerPlugin:()=>m.alarm}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:m.local}));
import {scheduleReminders,cancelReminders,testNotification} from '../src/notifications';
import {defaultSettings} from '../src/schedule';
import {normalizeCalendarStore,importCalendar} from '../src/calendars';
import {syncStoredReminders,deleteStoredCalendar,STORAGE} from '../src/alarmSync';
beforeEach(()=>{vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2025-12-30T00:00Z'));m.local.requestPermissions.mockResolvedValue({display:'granted'});m.local.checkPermissions.mockResolvedValue({display:'granted'});m.alarm.restore.mockResolvedValue({count:3});m.local.checkExactNotificationSetting.mockResolvedValue({exact_alarm:'granted'});m.local.getPending.mockResolvedValue({notifications:[]});});
afterEach(()=>vi.useRealTimers());
describe('Android 闹钟桥接',()=>{
 it('只向系统安排未来工作日，起床和班车使用不同闹钟 ID',async()=>{const s={...defaultSettings(),confirmed:true};expect(await scheduleReminders({'2026-01-01':'D','2026-01-02':'O','2026-01-03':'N'},s)).toBe(3);const alarms=m.alarm.replace.mock.calls[0][0].alarms;expect(alarms.map(a=>a.id)).toEqual([202601011,202601012,202601032]);expect(alarms[0].at).toBe(Date.parse('2026-01-01T06:40:00+08:00'));expect(m.alarm.clear).not.toHaveBeenCalled();});
 it('通知被拒绝时不会声称已安排闹钟',async()=>{m.local.requestPermissions.mockResolvedValue({display:'denied'});await expect(scheduleReminders({},defaultSettings())).rejects.toThrow('通知权限');expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('没有精确闹钟权限时明确停止安排',async()=>{m.local.checkExactNotificationSetting.mockResolvedValue({exact_alarm:'denied'});await expect(scheduleReminders({},defaultSettings())).rejects.toThrow('精确闹钟');expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('关闭提醒清除系统闹钟及旧通知',async()=>{m.local.getPending.mockResolvedValue({notifications:[{id:1},{id:2}]});await cancelReminders();expect(m.alarm.clear).toHaveBeenCalledOnce();expect(m.local.cancel).toHaveBeenCalledWith({notifications:[{id:1},{id:2}]});});
 it('测试按钮调用原生响铃，而非网页定时器',async()=>{await testNotification();expect(m.alarm.test).toHaveBeenCalledOnce();});
});

function memoryStore(data){let value=JSON.stringify(data);return {getItem:key=>key===STORAGE?value:null,setItem:(key,next)=>{if(key===STORAGE)value=next;},data:()=>JSON.parse(value)};}
function plan(pending=false){return {schedule:{'2026-01-01':'D'},settings:{...defaultSettings(),enabled:true},alarmSyncPending:pending};}
describe('页面刷新与原生闹钟恢复',()=>{
 it('普通刷新恢复原生计划，不覆盖正在延后的闹钟，不弹权限申请',async()=>{const store=memoryStore(plan());expect(await syncStoredReminders({store})).toBe(3);expect(m.alarm.restore).toHaveBeenCalledOnce();expect(m.alarm.replace).not.toHaveBeenCalled();expect(m.alarm.clear).not.toHaveBeenCalled();expect(m.local.requestPermissions).not.toHaveBeenCalled();});
 it('恢复失败保留启用选择与排班，不清空闹钟',async()=>{const store=memoryStore(plan());m.alarm.restore.mockRejectedValue(Error('bridge unavailable'));await expect(syncStoredReminders({store})).rejects.toThrow('bridge unavailable');expect(store.data()).toEqual(plan());expect(m.alarm.clear).not.toHaveBeenCalled();});
 it('保存失败留下待同步标记，下次刷新重试最新计划',async()=>{const store=memoryStore(plan(true));m.alarm.replace.mockRejectedValueOnce(Error('busy'));await expect(syncStoredReminders({store,request:true})).rejects.toThrow('busy');expect(store.data().alarmSyncPending).toBe(true);expect(store.data().settings.enabled).toBe(true);expect(m.alarm.clear).not.toHaveBeenCalled();await syncStoredReminders({store});expect(store.data().alarmSyncPending).toBe(false);expect(m.alarm.replace).toHaveBeenCalledTimes(2);expect(m.local.requestPermissions).toHaveBeenCalledTimes(1);expect(m.local.checkPermissions).toHaveBeenCalledOnce();});
 it('原生计划丢失时从持久排班重建，不请求权限也不预先清除',async()=>{m.alarm.restore.mockResolvedValue({count:0});const store=memoryStore(plan());expect(await syncStoredReminders({store})).toBe(2);expect(m.alarm.replace).toHaveBeenCalledOnce();expect(m.local.requestPermissions).not.toHaveBeenCalled();expect(m.alarm.clear).not.toHaveBeenCalled();});
 it('用户主动关闭才取消闹钟；取消失败会在下次启动重试',async()=>{const data=plan(true);data.settings.enabled=false;const store=memoryStore(data);m.alarm.clear.mockRejectedValueOnce(Error('busy'));await expect(syncStoredReminders({store})).rejects.toThrow('busy');expect(store.data().alarmSyncPending).toBe(true);await syncStoredReminders({store});expect(m.alarm.clear).toHaveBeenCalledTimes(2);expect(store.data().alarmSyncPending).toBe(false);expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('同步期间的新保存不会被旧操作覆盖，串行操作应用最新排班',async()=>{
  const store=memoryStore(plan(true));let finish;m.alarm.replace.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const first=syncStoredReminders({store});await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));
  const newer=plan(true);newer.schedule={'2026-01-02':'A'};store.setItem(STORAGE,JSON.stringify(newer));const second=syncStoredReminders({store});finish();await first;
  expect(store.data().alarmSyncPending).toBe(true);await second;expect(store.data().alarmSyncPending).toBe(false);expect(store.data().schedule).toEqual(newer.schedule);expect(m.alarm.replace.mock.calls[1][0].alarms[0].id).toBe(202601022);
 });
 it('自动恢复遇到通知被撤销，只报告失败并保留待同步计划',async()=>{const store=memoryStore(plan(true));m.local.checkPermissions.mockResolvedValue({display:'denied'});await expect(syncStoredReminders({store})).rejects.toThrow('通知权限');expect(m.alarm.clear).not.toHaveBeenCalled();expect(m.local.requestPermissions).not.toHaveBeenCalled();expect(store.data().settings.enabled).toBe(true);expect(store.data().alarmSyncPending).toBe(true);});
});

 it('五值闹钟使用实际值别，持久同步不会继续套用三值标题',async()=>{
  const data=plan(true);data.team='五值';const store=memoryStore(data);await syncStoredReminders({store});
  expect(m.alarm.replace.mock.calls[0][0].alarms.every(a=>a.title.startsWith('五值 · '))).toBe(true);expect(store.data().team).toBe('五值');
 });

function twoGroups(){return importCalendar({v:1,team:'五值',start:'2026-01-01',days:'D',tz:'Asia/Shanghai'},normalizeCalendarStore({schedule:{'2026-01-01':'A'},settings:{...defaultSettings(),enabled:true}}));}
describe('删除班组与原生闹钟一致性',()=>{
 it('删除其他班组不取消当前提醒',async()=>{const data=twoGroups();data.alarmSyncPending=false;const store=memoryStore(data);await deleteStoredCalendar('三值',{store});expect(store.data().team).toBe('五值');expect(store.data().settings.enabled).toBe(true);expect(store.data().alarmSyncPending).toBe(false);expect(m.alarm.clear).not.toHaveBeenCalled();expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('当前班组先取消闹钟再删除，之后的前台恢复不重新安排旧提醒',async()=>{const store=memoryStore(twoGroups());await deleteStoredCalendar('五值',{store});expect(m.alarm.clear).toHaveBeenCalledOnce();expect(store.data().team).toBe('三值');expect(store.data().settings.enabled).toBe(false);await syncStoredReminders({store});expect(m.alarm.restore).not.toHaveBeenCalled();expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('取消失败时保留原班组、排班和启用选择',async()=>{const data=twoGroups(),store=memoryStore(data);m.alarm.clear.mockRejectedValueOnce(Error('cancel failed'));await expect(deleteStoredCalendar('五值',{store})).rejects.toThrow('cancel failed');expect(store.data()).toEqual(data);});
 it('删除操作与正在提交的提醒串行，随后恢复不会复活旧提醒',async()=>{
  const data=twoGroups();data.alarmSyncPending=true;const store=memoryStore(data);let finish;m.alarm.replace.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const saving=syncStoredReminders({store});await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));const deleting=deleteStoredCalendar('五值',{store}),resume=syncStoredReminders({store});expect(m.alarm.clear).not.toHaveBeenCalled();finish();await Promise.all([saving,deleting,resume]);expect(m.alarm.clear).toHaveBeenCalledOnce();expect(m.alarm.replace).toHaveBeenCalledOnce();expect(m.alarm.restore).not.toHaveBeenCalled();expect(store.data().settings.enabled).toBe(false);
 });
 it('保存失败不会删除本机记录，可重试并彻底清空最后一个班组',async()=>{
  const data=normalizeCalendarStore({schedule:{'2026-01-01':'D'},settings:defaultSettings()});const store=memoryStore(data),save=store.setItem;store.setItem=()=>{throw Error('disk full');};await expect(deleteStoredCalendar('三值',{store})).rejects.toThrow('disk full');expect(store.data()).toEqual(data);store.setItem=save;await deleteStoredCalendar('三值',{store});expect(store.data()).toMatchObject({team:null,profiles:[],schedule:{}});
 });
});

 it('之前切换失败时先同步当前值，避免删除其他值后留下其旧闹钟',async()=>{
  const data=twoGroups();data.alarmSyncPending=true;const store=memoryStore(data);const result=await deleteStoredCalendar('三值',{store});expect(result.alarmsChanged).toBe(true);expect(store.data().profiles.map(p=>p.team)).toEqual(['五值']);expect(store.data().alarmSyncPending).toBe(false);expect(m.alarm.replace.mock.calls[0][0].alarms.every(a=>a.title.startsWith('五值 · '))).toBe(true);expect(m.alarm.clear).not.toHaveBeenCalled();expect(m.local.requestPermissions).not.toHaveBeenCalled();
 });
 it('未完成的切换仍失败时保留待删除班组，不把旧闹钟变成无主记录',async()=>{
  const data=twoGroups();data.alarmSyncPending=true;const store=memoryStore(data);m.alarm.replace.mockRejectedValueOnce(Error('still pending'));await expect(deleteStoredCalendar('三值',{store})).rejects.toThrow('still pending');expect(store.data()).toEqual(data);
 });
