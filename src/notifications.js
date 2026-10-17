import {Capacitor,registerPlugin} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
import {reminderEvents,validateTeam,DEFAULT_TEAM} from './schedule';
const ShiftAlarm=registerPlugin('ShiftAlarm');
export const native=Capacitor.isNativePlatform();
export async function cancelReminders(){if(!native)return;await ShiftAlarm.clear();const {notifications}=await LocalNotifications.getPending();if(notifications.length)await LocalNotifications.cancel({notifications:notifications.map(n=>({id:n.id}))});}
export async function scheduleReminders(schedule,settings,{request=true,team=DEFAULT_TEAM}={}){
 if(!native)throw Error('网页版不能保证后台响铃。请安装 Android APK，或导出到系统日历。');
 const status=await LocalNotifications[request?'requestPermissions':'checkPermissions']();
 if(status.display!=='granted')throw Error('通知权限未开启，请在系统设置中允许通知。');
 const exact=await LocalNotifications.checkExactNotificationSetting();if(exact.exact_alarm!=='granted')throw Error('请先允许精确闹钟，授权后再重试。');
 team=validateTeam(team);const events=reminderEvents(schedule,settings);
 // Native replace commits the complete plan and rolls back on failure. Never
 // pre-clear: a transient bridge/permission failure must not destroy old alarms.
 await ShiftAlarm.replace({alarms:events.map(e=>({id:e.id,at:e.at,title:`${team} · ${e.title}`,body:e.body}))});
 return events.length;
}
export async function restoreReminders(){return ShiftAlarm.restore();}
export async function getAlarmHealth(){return native?ShiftAlarm.health():null;}
export async function openAlarmSettings(target){if(!native)throw Error('请在 Android 安装版中打开系统设置。');return ShiftAlarm.openSettings({target});}
export async function requestExact(){return openAlarmSettings('exact');}
export async function requestLockScreen(){return openAlarmSettings('fullScreen');}
export async function testNotification(delaySeconds=5){
 if(native){const p=await LocalNotifications.requestPermissions();if(p.display!=='granted')throw Error('请允许通知权限。');await ShiftAlarm.test({delaySeconds});return;}
 if(!('Notification'in window))throw Error('此浏览器不支持通知，请使用 Android 安装版。');
 if(await Notification.requestPermission()!=='granted')throw Error('通知权限未获允许。');new Notification('值日 · 提醒测试',{body:'这是网页测试通知，关闭网页后不会定时提醒。',icon:'/icon.svg'});
}
