package cn.sanzhi.calendar;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
public class ShiftAlarmReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context, Intent intent){
  String action=intent.getAction();
  if(Intent.ACTION_BOOT_COMPLETED.equals(action)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)){ShiftAlarmPlugin.restore(context);return;}
  if("cn.sanzhi.STOP".equals(action)||"cn.sanzhi.SNOOZE".equals(action)){
   context.stopService(new Intent(context,ShiftAlarmService.class));
   if("cn.sanzhi.SNOOZE".equals(action))ShiftAlarmPlugin.snooze(context,intent);return;
  }
  ShiftAlarmPlugin.consume(context,intent.getIntExtra("id",0));
  Intent service=new Intent(context,ShiftAlarmService.class);if(intent.getExtras()!=null)service.putExtras(intent.getExtras());
  if(Build.VERSION.SDK_INT>=26)context.startForegroundService(service);else context.startService(service);
 }
}
