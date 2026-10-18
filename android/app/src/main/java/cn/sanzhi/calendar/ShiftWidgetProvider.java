package cn.sanzhi.calendar;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

public class ShiftWidgetProvider extends AppWidgetProvider {
    private static final String REFRESH = "cn.sanzhi.calendar.WIDGET_REFRESH";
    private static final String MIDNIGHT = "cn.sanzhi.calendar.WIDGET_MIDNIGHT";
    private static final int[] DATES = {R.id.widget_date_0,R.id.widget_date_1,R.id.widget_date_2,R.id.widget_date_3,R.id.widget_date_4,R.id.widget_date_5,R.id.widget_date_6};
    private static final int[] WEEKS = {R.id.widget_week_0,R.id.widget_week_1,R.id.widget_week_2,R.id.widget_week_3,R.id.widget_week_4,R.id.widget_week_5,R.id.widget_week_6};
    private static final int[] SHIFTS = {R.id.widget_shift_0,R.id.widget_shift_1,R.id.widget_shift_2,R.id.widget_shift_3,R.id.widget_shift_4,R.id.widget_shift_5,R.id.widget_shift_6};

    static int[] ids(Context context) {
        return AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, ShiftWidgetProvider.class));
    }

    // Serialize complete render passes so an older broadcast cannot paint over
    // a newly committed calendar while the WebView is changing teams.
    static synchronized void refreshAll(Context context) {
        int[] ids = ids(context);
        if (ids.length == 0) { cancelMidnight(context); return; }
        ShiftWidgetStore.Snapshot data = ShiftWidgetStore.read(context);
        long now = System.currentTimeMillis();
        RemoteViews views = render(context, data, now);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : ids) manager.updateAppWidget(id, views);
        scheduleMidnight(context, now);
    }

    private static RemoteViews render(Context context, ShiftWidgetStore.Snapshot data, long now) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.shift_widget);
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launch = PendingIntent.getActivity(context, 410, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, launch);
        views.setOnClickPendingIntent(R.id.widget_refresh, broadcast(context, REFRESH));
        views.setTextViewText(R.id.widget_title, data.team == null ? "值日 · 倒班日历" : data.team + " · 值日");
        views.setContentDescription(R.id.widget_title, data.team == null ? "打开值日导入班组" : "当前班组：" + data.team + "，点击查看日历");
        views.setViewVisibility(R.id.widget_days, data.team == null ? View.GONE : View.VISIBLE);
        views.setViewVisibility(R.id.widget_empty, data.team == null ? View.VISIBLE : View.GONE);
        List<WidgetSchedule.Day> days = WidgetSchedule.days(data.schedule, now);
        for (int i = 0; i < days.size(); i++) {
            WidgetSchedule.Day day = days.get(i);
            views.setTextViewText(DATES[i], day.shortDate);
            views.setTextViewText(WEEKS[i], i == 0 ? "今天" : day.week);
            views.setTextColor(WEEKS[i], Color.parseColor(i == 0 ? "#137E69" : "#687A73"));
            views.setTextViewText(SHIFTS[i], day.label());
            views.setTextColor(SHIFTS[i], shiftColor(day.kind));
            views.setInt(SHIFTS[i], "setBackgroundResource", shiftBackground(day.kind));
            views.setContentDescription(SHIFTS[i], day.date + " " + day.week + " " + (day.kind.isEmpty() ? "未排班" : day.label()));
        }
        views.setTextViewText(R.id.widget_detail, data.team == null ? "点击打开应用，导入或选择班组" : days.get(0).detail(data.times));
        return views;
    }

    private static int shiftColor(String kind) {
        switch (kind) {
            case "D": return Color.rgb(159,111,22);
            case "A": return Color.rgb(62,107,159);
            case "N": case "U": return Color.rgb(116,83,153);
            case "L": return Color.rgb(72,107,131);
            case "O": return Color.rgb(23,119,88);
            case "T": return Color.rgb(154,83,47);
            default: return Color.rgb(125,137,131);
        }
    }
    private static int shiftBackground(String kind) {
        switch (kind) {
            case "D": return R.drawable.widget_badge_day;
            case "A": case "L": return R.drawable.widget_badge_blue;
            case "N": case "U": return R.drawable.widget_badge_night;
            case "O": return R.drawable.widget_badge_rest;
            case "T": return R.drawable.widget_badge_training;
            default: return R.drawable.widget_badge_empty;
        }
    }
    private static PendingIntent broadcast(Context context, String action) {
        return PendingIntent.getBroadcast(context, 411, new Intent(context, ShiftWidgetProvider.class).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    private static void scheduleMidnight(Context context, long now) {
        // Inexact: widget refresh never needs notification/exact-alarm access.
        // The system's 30-minute widget updates also recover delayed refreshes.
        try {
            AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            alarm.setAndAllowWhileIdle(AlarmManager.RTC, WidgetSchedule.nextMidnight(now) + 1000, broadcast(context, MIDNIGHT));
        } catch (RuntimeException error) { android.util.Log.w("ShiftWidget", "Daily refresh delayed; periodic updates remain enabled", error); }
    }
    private static void cancelMidnight(Context context) {
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        alarm.cancel(broadcast(context, MIDNIGHT));
    }

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) { refreshAll(context); }
    @Override public void onEnabled(Context context) { refreshAll(context); }
    @Override public void onDisabled(Context context) { cancelMidnight(context); }
    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) { refreshAll(context); }
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (REFRESH.equals(action) || MIDNIGHT.equals(action) || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action) || Intent.ACTION_DATE_CHANGED.equals(action)) refreshAll(context);
    }
}
