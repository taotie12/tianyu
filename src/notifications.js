import {Capacitor,registerPlugin} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
import {reminderEvents,SHIFTS} from './schedule';
const ShiftAlarm=registerPlugin('ShiftAlarm');
export const native=Capacitor.isNativePlatform();
export async function cancelReminders(){if(!native)return;await ShiftAlarm.clear();const {notifications}=await LocalNotifications.getPending();if(notifications.length)await LocalNotifications.cancel({notifications:notifications.map(n=>({id:n.id}))});}
export async function scheduleReminders(schedule,settings){
 if(!native)throw Error('网页版不能保证后台响铃。请安装 Android APK，或导出到系统日历。');
 const status=await LocalNotifications.requestPermissions();if(status.display!=='granted')throw Error('通知权限未开启，请在系统设置中允许通知。');
 const exact=await LocalNotifications.checkExactNotificationSetting();if(exact.exact_alarm!=='granted')throw Error('请先点击“允许精确闹钟”，授权后再开启提醒。');
 await LocalNotifications.createChannel({id:'shift-alarms',name:'上班提醒',description:'三值上班前提醒',importance:5,visibility:1,vibration:true,sound:'default'});
 const events=reminderEvents(schedule,settings);await cancelReminders();
 if(events.length)await ShiftAlarm.replace({alarms:events.map(e=>({id:Number(e.date.replaceAll('-','')),at:e.at,title:`三值 · ${SHIFTS[e.code].name}`,body:`${e.date} ${settings.times[e.code].start} 上班，提前 ${settings.advance} 分钟提醒`}))});
 return events.length;
}
export async function requestExact(){if(native)await LocalNotifications.changeExactNotificationSetting();else throw Error('精确闹钟授权仅在 Android 安装版中提供。');}
export async function requestLockScreen(){if(native)await ShiftAlarm.lockScreenSettings();}
export async function testNotification(){
 if(native){const p=await LocalNotifications.requestPermissions();if(p.display!=='granted')throw Error('请允许通知权限。');await ShiftAlarm.test();return;}
 if(!('Notification'in window))throw Error('此浏览器不支持通知，请使用 Android 安装版。');
 if(await Notification.requestPermission()!=='granted')throw Error('通知权限未获允许。');new Notification('值日 · 提醒测试',{body:'这是网页测试通知，关闭网页后不会定时提醒。',icon:'/icon.svg'});
}
