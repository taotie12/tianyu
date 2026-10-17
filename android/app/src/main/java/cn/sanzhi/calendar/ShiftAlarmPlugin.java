package cn.sanzhi.calendar;

import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.*;
import java.util.*;

@CapacitorPlugin(name = "ShiftAlarm")
public class ShiftAlarmPlugin extends Plugin {
    static final String PREFS = "shift_alarms";
    static final String CHANNEL = "shift-ringing";
    static final java.util.concurrent.ExecutorService WORKER = java.util.concurrent.Executors.newSingleThreadExecutor();
    static synchronized JSONArray saved(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREFS, 0).getString("alarms", "[]")); }
        catch (JSONException e) { throw new IllegalStateException("本机闹钟计划损坏，请重新保存提醒设置。", e); }
    }
    static void persist(Context c, JSONArray a) {
        if(!c.getSharedPreferences(PREFS, 0).edit().putString("alarms", a.toString()).commit())
            throw new IllegalStateException("闹钟计划保存失败，请检查手机存储空间。");
    }
    static void ensureChannel(Context c) {
        if(Build.VERSION.SDK_INT<26)return;
        NotificationChannel channel=new NotificationChannel(CHANNEL,"上班闹钟",NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("上班前持续响铃提醒");channel.setSound(null,null);channel.enableVibration(false);
        c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    @Override public void load(){ensureChannel(getContext());}
    static Intent intent(Context c, JSONObject a) {
        return new Intent(c, ShiftAlarmReceiver.class).setAction("cn.sanzhi.FIRE")
            .putExtra("id", a.optInt("id")).putExtra("title", a.optString("title"))
            .putExtra("body", a.optString("body")).putExtra("at", a.optLong("at"));
    }
    static void requireExact(Context c) {
        AlarmManager m=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(Build.VERSION.SDK_INT>=31&&!m.canScheduleExactAlarms())throw new SecurityException("请允许精确闹钟权限。");
    }
    static void arm(Context c, JSONObject a) {
        requireExact(c);
        AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent fire=PendingIntent.getBroadcast(c,a.optInt("id"),intent(c,a),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        PendingIntent show=PendingIntent.getActivity(c,a.optInt("id"),new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(a.optLong("at"),show),fire);
    }
    static JSONArray active(JSONArray source) {
        ArrayList<JSONObject> items=new ArrayList<>();
        // A recently delayed alarm can still ring after process recovery. Do not
        // discard it just because Android delivered it a few seconds late.
        long cutoff=System.currentTimeMillis()-5*60*1000L;
        for(int i=0;i<source.length();i++){JSONObject a=source.optJSONObject(i);if(a!=null&&a.optLong("at")>cutoff)items.add(a);}
        items.sort(Comparator.comparingLong(a->a.optLong("at")));
        JSONArray next=new JSONArray();for(JSONObject a:items)next.put(a);return next;
    }
    static void armWindow(Context c,JSONArray plan){for(int i=0;i<Math.min(64,plan.length());i++)arm(c,plan.optJSONObject(i));}
    static void cancelObsolete(Context c,JSONArray old,JSONArray next){
        HashSet<Integer> keep=new HashSet<>();for(int i=0;i<Math.min(64,next.length());i++)keep.add(next.optJSONObject(i).optInt("id"));
        AlarmManager m=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        for(int i=0;i<old.length();i++){
            JSONObject a=old.optJSONObject(i);if(a==null||keep.contains(a.optInt("id")))continue;
            PendingIntent p=PendingIntent.getBroadcast(c,a.optInt("id"),intent(c,a),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);
            if(p!=null){m.cancel(p);p.cancel();}
        }
    }
    static synchronized void clear(Context c){
        JSONArray old=saved(c);persist(c,new JSONArray());cancelObsolete(c,old,new JSONArray());
        c.stopService(new Intent(c,ShiftAlarmService.class));
    }
    // Durable full plan plus a rolling window below manufacturer alarm limits.
    // Replacing a plan never clears the previous one before the new one works.
    static synchronized void replacePlan(Context c,JSONArray next){
        requireExact(c);JSONArray old=saved(c);next=active(next);
        try{persist(c,next);armWindow(c,next);cancelObsolete(c,old,next);}
        catch(RuntimeException failure){
            try{persist(c,old);armWindow(c,active(old));cancelObsolete(c,next,active(old));}
            catch(RuntimeException rollback){failure.addSuppressed(rollback);}
            throw failure;
        }
    }
    static synchronized int restore(Context c){
        JSONArray old=saved(c),next=active(old);
        if(next.length()>0){requireExact(c);armWindow(c,next);}
        if(!old.toString().equals(next.toString()))persist(c,next);
        return next.length();
    }
    static synchronized boolean consume(Context c,int id,long at){
        JSONArray old=saved(c),next=new JSONArray();boolean found=false;
        for(int i=0;i<old.length();i++){
            JSONObject a=old.optJSONObject(i);if(a==null)continue;
            if(a.optInt("id")==id&&a.optLong("at")==at)found=true;else next.put(a);
        }
        if(!found)return false; // Ignore canceled or superseded broadcasts.
        persist(c,next);
        try{restore(c);}catch(RuntimeException e){android.util.Log.e("ShiftAlarm","Refill failed; current alarm will still ring",e);}
        return true;
    }
    static synchronized void append(Context c,JSONObject item){
        JSONArray old=saved(c),next=new JSONArray();
        for(int i=0;i<old.length();i++){JSONObject a=old.optJSONObject(i);if(a!=null&&a.optInt("id")!=item.optInt("id"))next.put(a);}
        next.put(item);replacePlan(c,next);
    }
    static void snooze(Context c,Intent i){
        try{append(c,new JSONObject().put("id",i.getIntExtra("id",999)).put("title",i.getStringExtra("title")).put("body",i.getStringExtra("body")).put("at",System.currentTimeMillis()+10*60*1000));}
        catch(Exception e){android.util.Log.e("ShiftAlarm","Snooze failed",e);}
    }
    @PluginMethod public void replace(PluginCall call){
        try{
            JSArray alarms=call.getArray("alarms");if(alarms==null||alarms.length()>5000)throw new IllegalArgumentException("闹钟数据无效，最多保存 5000 条。");
            HashSet<Integer> ids=new HashSet<>();
            for(int i=0;i<alarms.length();i++){
                JSONObject a=alarms.getJSONObject(i);
                if(a.getInt("id")<=0||!ids.add(a.getInt("id"))||a.getLong("at")<=System.currentTimeMillis()||a.getString("title").length()>100)throw new IllegalArgumentException("闹钟时间或编号无效");
            }
            replacePlan(getContext(),alarms);JSObject result=new JSObject();result.put("count",alarms.length());call.resolve(result);
        }catch(Exception e){call.reject("无法安排闹钟："+e.getMessage());}
    }
    @PluginMethod public void restore(PluginCall call){
        try{JSObject result=new JSObject();result.put("count",restore(getContext()));call.resolve(result);}
        catch(Exception e){call.reject("恢复闹钟失败："+e.getMessage());}
    }
    @PluginMethod public void clear(PluginCall call){try{clear(getContext());call.resolve();}catch(Exception e){call.reject(e.getMessage());}}
    @PluginMethod public void health(PluginCall call){
        try{
            Context c=getContext();ensureChannel(c);NotificationManager manager=c.getSystemService(NotificationManager.class);
            JSObject result=new JSObject();result.put("manufacturer",Build.MANUFACTURER);result.put("androidVersion",Build.VERSION.SDK_INT);
            result.put("notifications",NotificationManagerCompat.from(c).areNotificationsEnabled());
            NotificationChannel channel=Build.VERSION.SDK_INT>=26?manager.getNotificationChannel(CHANNEL):null;
            result.put("alarmChannel",Build.VERSION.SDK_INT<26||channel==null||channel.getImportance()>=NotificationManager.IMPORTANCE_HIGH);
            result.put("exact",Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms());
            result.put("fullScreen",Build.VERSION.SDK_INT<34||manager.canUseFullScreenIntent());
            result.put("battery",c.getSystemService(android.os.PowerManager.class).isIgnoringBatteryOptimizations(c.getPackageName()));
            JSONArray plan=saved(c);int count=0;long next=Long.MAX_VALUE;
            for(int i=0;i<plan.length();i++){long at=plan.optJSONObject(i).optLong("at");if(at>System.currentTimeMillis()){count++;next=Math.min(next,at);}}
            result.put("count",count);if(count>0)result.put("nextAt",next);
            result.put("lastTriggeredAt",c.getSharedPreferences(PREFS,0).getLong("lastTriggeredAt",0));call.resolve(result);
        }catch(Exception e){call.reject("无法读取权限状态："+e.getMessage());}
    }
    @PluginMethod public void openSettings(PluginCall call){
        try{JSObject result=new JSObject();result.put("fallback",AlarmSettings.open(getActivity(),call.getString("target","details")));call.resolve(result);}
        catch(Exception e){call.reject("无法打开系统设置，请手动进入应用信息："+e.getMessage());}
    }
    @PluginMethod public void lockScreenSettings(PluginCall call){try{AlarmSettings.open(getActivity(),"fullScreen");call.resolve();}catch(Exception e){call.reject(e.getMessage());}}
    @PluginMethod public void test(PluginCall call){
        try{int seconds=Math.max(5,Math.min(120,call.getInt("delaySeconds",5)));
            append(getContext(),new JSONObject().put("id",999).put("at",System.currentTimeMillis()+seconds*1000L).put("title","值日 · 闹钟测试").put("body","后台与锁屏响铃测试，可停止或延后十分钟。"));call.resolve();
        }catch(Exception e){call.reject("测试失败："+e.getMessage());}
    }
}
