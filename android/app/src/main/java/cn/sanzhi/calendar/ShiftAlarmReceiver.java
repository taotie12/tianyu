package cn.sanzhi.calendar;
import android.app.AlarmManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
public class ShiftAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  String action=intent.getAction();
  if(Intent.ACTION_BOOT_COMPLETED.equals(action)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)||Intent.ACTION_TIME_CHANGED.equals(action)||Intent.ACTION_TIMEZONE_CHANGED.equals(action)||AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action)){
   PendingResult pending=goAsync();
   ShiftAlarmPlugin.WORKER.execute(()->{try{ShiftAlarmPlugin.restore(context);}catch(RuntimeException e){android.util.Log.e("ShiftAlarm","System restore failed",e);}finally{pending.finish();}});return;
  }
  if("cn.sanzhi.STOP".equals(action)||"cn.sanzhi.SNOOZE".equals(action)){
   context.stopService(new Intent(context,ShiftAlarmService.class));
   if("cn.sanzhi.SNOOZE".equals(action))ShiftAlarmPlugin.snooze(context,intent);return;
  }
  if(!"cn.sanzhi.FIRE".equals(action))return;
  try{if(!ShiftAlarmPlugin.consume(context,intent.getIntExtra("id",0),intent.getLongExtra("at",0)))return;}
  catch(RuntimeException e){android.util.Log.e("ShiftAlarm","Consume failed; delivering due alarm",e);}
  Intent service=new Intent(context,ShiftAlarmService.class);if(intent.getExtras()!=null)service.putExtras(intent.getExtras());
  if(Build.VERSION.SDK_INT>=26)context.startForegroundService(service);else context.startService(service);
 }
}
