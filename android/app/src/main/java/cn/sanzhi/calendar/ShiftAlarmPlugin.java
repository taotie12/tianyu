package cn.sanzhi.calendar;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "ShiftAlarm")
public class ShiftAlarmPlugin extends Plugin {
    static final String PREFS = "shift_alarms";
    static synchronized JSONArray saved(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREFS, 0).getString("alarms", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }
    static void persist(Context c, JSONArray a) { c.getSharedPreferences(PREFS, 0).edit().putString("alarms", a.toString()).apply(); }
    static Intent intent(Context c, JSONObject a) {
        return new Intent(c, ShiftAlarmReceiver.class).setAction("cn.sanzhi.FIRE")
            .putExtra("id", a.optInt("id")).putExtra("title", a.optString("title"))
            .putExtra("body", a.optString("body")).putExtra("at", a.optLong("at"));
    }
    static void arm(Context c, JSONObject a) {
        AlarmManager manager = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(Build.VERSION.SDK_INT>=31&&!manager.canScheduleExactAlarms())throw new SecurityException("请允许精确闹钟权限。");
        PendingIntent fire = PendingIntent.getBroadcast(c, a.optInt("id"), intent(c, a), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent show = PendingIntent.getActivity(c, a.optInt("id"), new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(a.optLong("at"), show), fire);
    }
    static synchronized void clear(Context c) {
        JSONArray a = saved(c); AlarmManager m = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        for (int i=0;i<a.length();i++) { JSONObject item=a.optJSONObject(i); if(item==null)continue;
            PendingIntent p=PendingIntent.getBroadcast(c,item.optInt("id"),intent(c,item),PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);
            if(p!=null){m.cancel(p);p.cancel();}
        }
        persist(c,new JSONArray()); c.stopService(new Intent(c, ShiftAlarmService.class));
    }
    // Persist the complete plan, but arm a small rolling window to stay below
    // vendor AlarmManager limits. Each firing and reboot refills the window.
    static synchronized void restore(Context c) {
        AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(Build.VERSION.SDK_INT>=31&&!manager.canScheduleExactAlarms())return;
        JSONArray old=saved(c);java.util.ArrayList<JSONObject> future=new java.util.ArrayList<>();
        for(int i=0;i<old.length();i++){JSONObject a=old.optJSONObject(i);if(a!=null&&a.optLong("at")>System.currentTimeMillis())future.add(a);}
        future.sort(java.util.Comparator.comparingLong(a->a.optLong("at")));
        JSONArray next=new JSONArray();for(JSONObject a:future)next.put(a);persist(c,next);
        for(int i=0;i<Math.min(64,future.size());i++)arm(c,future.get(i));
    }
    static synchronized void consume(Context c,int id){
        JSONArray old=saved(c),next=new JSONArray();for(int i=0;i<old.length();i++){JSONObject a=old.optJSONObject(i);if(a!=null&&a.optInt("id")!=id)next.put(a);}persist(c,next);restore(c);
    }
    static synchronized void append(Context c,JSONObject item){
        JSONArray old=saved(c),next=new JSONArray();for(int i=0;i<old.length();i++){JSONObject a=old.optJSONObject(i);if(a!=null&&a.optInt("id")!=item.optInt("id")&&a.optLong("at")>System.currentTimeMillis())next.put(a);}next.put(item);persist(c,next);restore(c);
    }
    static synchronized void snooze(Context c, Intent i) {
        try {
            JSONObject item=new JSONObject().put("id",i.getIntExtra("id",999)).put("title",i.getStringExtra("title")).put("body",i.getStringExtra("body")).put("at",System.currentTimeMillis()+10*60*1000);
            append(c,item);
        } catch(Exception e) { android.util.Log.e("ShiftAlarm","Snooze failed",e); }
    }
    @PluginMethod public void replace(PluginCall call) {
        try {
            JSArray alarms=call.getArray("alarms");if(alarms==null||alarms.length()>5000){call.reject("闹钟数据无效，最多保存 5000 条。");return;}
            AlarmManager m=(AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE);
            if(Build.VERSION.SDK_INT>=31&&!m.canScheduleExactAlarms()){call.reject("请允许精确闹钟权限。");return;}
            for(int i=0;i<alarms.length();i++){JSONObject a=alarms.getJSONObject(i);if(a.getInt("id")<=0||a.getLong("at")<=System.currentTimeMillis()||a.getString("title").length()>100)throw new IllegalArgumentException("闹钟时间无效");}
            clear(getContext());persist(getContext(),alarms);
            try{restore(getContext());}
            catch(Exception e){clear(getContext());throw e;}
            JSObject result=new JSObject();result.put("count",alarms.length());call.resolve(result);
        }catch(Exception e){call.reject("无法安排闹钟："+e.getMessage());}
    }
    @PluginMethod public void clear(PluginCall call){clear(getContext());call.resolve();}
    @PluginMethod public void lockScreenSettings(PluginCall call){
        Intent settings;
        if(Build.VERSION.SDK_INT>=34)settings=new Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,android.net.Uri.parse("package:"+getContext().getPackageName()));
        else if(Build.VERSION.SDK_INT>=26)settings=new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getContext().getPackageName());
        else settings=new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.parse("package:"+getContext().getPackageName()));
        getActivity().startActivity(settings);call.resolve();
    }
    @PluginMethod public void test(PluginCall call){try{AlarmManager manager=(AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE);if(Build.VERSION.SDK_INT>=31&&!manager.canScheduleExactAlarms()){call.reject("请先允许精确闹钟，再测试响铃。");return;}JSONObject a=new JSONObject().put("id",999).put("at",System.currentTimeMillis()+5000).put("title","值日 · 闹钟测试").put("body","提醒测试成功，可以关闭或延后十分钟。");append(getContext(),a);call.resolve();}catch(Exception e){call.reject("测试失败，请先允许精确闹钟："+e.getMessage());}}
}
