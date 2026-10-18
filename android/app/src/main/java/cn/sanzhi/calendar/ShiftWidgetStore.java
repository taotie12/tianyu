package cn.sanzhi.calendar;

import android.content.Context;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/** A separate durable snapshot: disabling alarms never clears widget data. */
final class ShiftWidgetStore {
    static final String PREFS = "shift_widget";
    static final class Snapshot {
        String team;
        final Map<String, String> schedule = new HashMap<>();
        final Map<String, String> times = new HashMap<>();
    }

    static Snapshot parse(JSONObject data) throws JSONException {
        Snapshot result = new Snapshot();
        if (!data.isNull("team")) {
            Object name = data.get("team");
            if (!(name instanceof String)) throw new JSONException("班组名称无效");
            result.team = ((String) name).trim();
            if (result.team.isEmpty() || result.team.codePointCount(0, result.team.length()) > 32 || result.team.matches("(?s).*[\\x00-\\x1f\\x7f].*")) throw new JSONException("班组名称无效");
        }
        JSONObject schedule = data.getJSONObject("schedule");
        if (schedule.length() > 36525 || (result.team == null && schedule.length() != 0)) throw new JSONException("排班数据无效");
        for (Iterator<String> it = schedule.keys(); it.hasNext();) {
            String date = it.next(); Object code = schedule.get(date);
            if (!WidgetSchedule.validDate(date) || !(code instanceof String) || !((String) code).matches("[DANOT]")) throw new JSONException("排班日期或班次无效");
            result.schedule.put(date, (String) code);
        }
        JSONObject times = data.getJSONObject("times"), bus = data.getJSONObject("bus");
        for (String kind : new String[]{"D", "A", "N", "T"}) {
            JSONObject hours = times.getJSONObject(kind);
            for (String edge : new String[]{"start", "end"}) result.times.put(kind + "." + edge, validTime(hours.getString(edge)));
        }
        for (String kind : new String[]{"D", "A", "N"}) result.times.put("bus." + kind, validTime(bus.getString(kind)));
        return result;
    }

    private static String validTime(String time) throws JSONException {
        if (!time.matches("([01]\\d|2[0-3]):[0-5]\\d")) throw new JSONException("班次时间无效");
        return time;
    }

    static void save(Context context, JSONObject data) throws JSONException {
        parse(data); // Validate the complete new snapshot before replacing anything.
        if (!context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("snapshot", data.toString()).commit()) throw new IllegalStateException("小部件排班保存失败，请重试");
    }

    static Snapshot read(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("snapshot", null);
        if (raw == null) return new Snapshot();
        try { return parse(new JSONObject(raw)); }
        catch (JSONException error) {
            android.util.Log.e("ShiftWidget", "Invalid saved widget snapshot", error);
            return new Snapshot();
        }
    }
}
