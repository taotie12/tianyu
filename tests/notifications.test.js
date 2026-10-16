import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const m=vi.hoisted(()=>({alarm:{replace:vi.fn(),clear:vi.fn(),test:vi.fn(),lockScreenSettings:vi.fn()},local:{requestPermissions:vi.fn(),checkExactNotificationSetting:vi.fn(),createChannel:vi.fn(),getPending:vi.fn(),cancel:vi.fn(),changeExactNotificationSetting:vi.fn()}}));
vi.mock('@capacitor/core',()=>({Capacitor:{isNativePlatform:()=>true},registerPlugin:()=>m.alarm}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:m.local}));
import {scheduleReminders,cancelReminders,testNotification} from '../src/notifications';
import {defaultSettings} from '../src/schedule';
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date('2025-12-30T00:00Z'));m.local.requestPermissions.mockResolvedValue({display:'granted'});m.local.checkExactNotificationSetting.mockResolvedValue({exact_alarm:'granted'});m.local.getPending.mockResolvedValue({notifications:[]});});
afterEach(()=>vi.useRealTimers());
describe('Android 闹钟桥接',()=>{
 it('只向系统安排未来工作日，起床和班车使用不同闹钟 ID',async()=>{const s={...defaultSettings(),confirmed:true};expect(await scheduleReminders({'2026-01-01':'D','2026-01-02':'O','2026-01-03':'N'},s)).toBe(3);const alarms=m.alarm.replace.mock.calls[0][0].alarms;expect(alarms.map(a=>a.id)).toEqual([202601011,202601012,202601032]);expect(alarms[0].at).toBe(Date.parse('2026-01-01T06:40:00+08:00'));expect(m.alarm.clear).toHaveBeenCalledOnce();});
 it('通知被拒绝时不会声称已安排闹钟',async()=>{m.local.requestPermissions.mockResolvedValue({display:'denied'});await expect(scheduleReminders({},defaultSettings())).rejects.toThrow('通知权限');expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('没有精确闹钟权限时明确停止安排',async()=>{m.local.checkExactNotificationSetting.mockResolvedValue({exact_alarm:'denied'});await expect(scheduleReminders({},defaultSettings())).rejects.toThrow('精确闹钟');expect(m.alarm.replace).not.toHaveBeenCalled();});
 it('关闭提醒清除系统闹钟及旧通知',async()=>{m.local.getPending.mockResolvedValue({notifications:[{id:1},{id:2}]});await cancelReminders();expect(m.alarm.clear).toHaveBeenCalledOnce();expect(m.local.cancel).toHaveBeenCalledWith({notifications:[{id:1},{id:2}]});});
 it('测试按钮调用原生响铃，而非网页定时器',async()=>{await testNotification();expect(m.alarm.test).toHaveBeenCalledOnce();});
});
