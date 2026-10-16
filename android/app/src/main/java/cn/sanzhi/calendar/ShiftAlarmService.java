package cn.sanzhi.calendar;
import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
public class ShiftAlarmService extends Service {
 private MediaPlayer player; private PowerManager.WakeLock lock; private Vibrator vibrator;
 private final Handler handler=new Handler(Looper.getMainLooper());
 @Override public IBinder onBind(Intent i){return null;}
 @Override public int onStartCommand(Intent intent,int flags,int startId){
  if(intent==null){stopSelf();return START_NOT_STICKY;}
  NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
  if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel("shift-ringing","上班闹钟",NotificationManager.IMPORTANCE_HIGH);channel.setDescription("上班前持续响铃提醒");channel.setSound(null,null);channel.enableVibration(false);manager.createNotificationChannel(channel);}
  Intent screen=new Intent(this,ShiftAlarmActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);screen.putExtras(intent);
  PendingIntent full=PendingIntent.getActivity(this,0,screen,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  Intent stop=new Intent(this,ShiftAlarmReceiver.class).setAction("cn.sanzhi.STOP");stop.putExtras(intent);
  Intent snooze=new Intent(this,ShiftAlarmReceiver.class).setAction("cn.sanzhi.SNOOZE");snooze.putExtras(intent);
  Notification notification=new NotificationCompat.Builder(this,"shift-ringing").setSmallIcon(R.drawable.ic_stat_calendar)
   .setContentTitle(intent.getStringExtra("title")).setContentText(intent.getStringExtra("body")).setCategory(NotificationCompat.CATEGORY_ALARM)
   .setPriority(NotificationCompat.PRIORITY_MAX).setOngoing(true).setContentIntent(full).setFullScreenIntent(full,true)
   .addAction(0,"停止响铃",PendingIntent.getBroadcast(this,1,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE))
   .addAction(0,"延后 10 分钟",PendingIntent.getBroadcast(this,2,snooze,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE)).build();
  startForeground(500,notification);
  if(player!=null){player.release();player=null;}
  try{Uri sound=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);if(sound==null)sound=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);player=new MediaPlayer();player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());player.setDataSource(this,sound);player.setLooping(true);player.prepare();player.start();}catch(Exception e){android.util.Log.e("ShiftAlarm","Alarm audio failed",e);}
  vibrator=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(vibrator!=null){if(Build.VERSION.SDK_INT>=26)vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,500,500},0));else vibrator.vibrate(new long[]{0,500,500},0);}
  if(lock==null){PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);lock=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"sanzhi:alarm");lock.acquire(6*60*1000L);}
  handler.removeCallbacksAndMessages(null);handler.postDelayed(this::stopSelf,5*60*1000L);return START_NOT_STICKY;
 }
 @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);if(player!=null){player.release();player=null;}if(vibrator!=null)vibrator.cancel();if(lock!=null&&lock.isHeld())lock.release();stopForeground(true);super.onDestroy();}
}
