package cn.sanzhi.calendar;

import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;

/** Pure date/display rules, shared by every widget update (no WebView needed). */
final class WidgetSchedule {
    static final TimeZone ZONE = TimeZone.getTimeZone("Asia/Shanghai");
    private static SimpleDateFormat format(String pattern) {
        SimpleDateFormat result = new SimpleDateFormat(pattern, Locale.ROOT);
        result.setTimeZone(ZONE);
        result.setLenient(false);
        return result;
    }

    static boolean validDate(String date) {
        if (date == null || !date.matches("20\\d{2}-\\d{2}-\\d{2}")) return false;
        ParsePosition position = new ParsePosition(0);
        return format("yyyy-MM-dd").parse(date, position) != null && position.getIndex() == 10;
    }

    static String dateAt(long at) { return format("yyyy-MM-dd").format(at); }

    static long nextMidnight(long now) {
        Calendar day = Calendar.getInstance(ZONE, Locale.ROOT);
        day.setTimeInMillis(now);
        day.set(Calendar.HOUR_OF_DAY, 0);
        day.set(Calendar.MINUTE, 0);
        day.set(Calendar.SECOND, 0);
        day.set(Calendar.MILLISECOND, 0);
        day.add(Calendar.DATE, 1);
        return day.getTimeInMillis();
    }

    static List<Day> days(Map<String, String> schedule, long now) {
        Calendar day = Calendar.getInstance(ZONE, Locale.ROOT);
        day.setTimeInMillis(now);
        List<Day> result = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            String date = dateAt(day.getTimeInMillis());
            String week = "周" + "日一二三四五六".charAt(day.get(Calendar.DAY_OF_WEEK) - 1);
            String shortDate = (day.get(Calendar.MONTH) + 1) + "/" + day.get(Calendar.DAY_OF_MONTH);
            day.add(Calendar.DATE, 1);
            String code = schedule.get(date), next = schedule.get(dateAt(day.getTimeInMillis()));
            String kind = code == null ? "" : code;
            if ("O".equals(code) && "N".equals(next)) kind = "U";
            if ("N".equals(code) && next != null && !"N".equals(next)) kind = "L";
            result.add(new Day(date, shortDate, week, kind, "N".equals(next)));
        }
        return result;
    }

    static final class Day {
        final String date, shortDate, week, kind;
        final boolean nightBusTonight;
        Day(String date, String shortDate, String week, String kind, boolean nightBusTonight) {
            this.date = date; this.shortDate = shortDate; this.week = week;
            this.kind = kind; this.nightBusTonight = nightBusTonight;
        }
        String label() {
            switch (kind) {
                case "D": return "早班";
                case "A": return "中班";
                case "N": return "夜班";
                case "O": return "休息";
                case "T": return "培训";
                case "U": return "上夜";
                case "L": return "下夜";
                default: return "未排";
            }
        }
        private String time(Map<String, String> times, String key, String fallback) {
            String value = times.get(key);
            return value == null ? fallback : value;
        }
        String detail(Map<String, String> times) {
            String nightBus = time(times, "bus.N", "22:10");
            String nightStart = time(times, "N.start", "00:00");
            String nightEnd = time(times, "N.end", "08:00");
            if (kind.isEmpty()) return "今天未排班 · 打开应用导入或检查日期范围";
            if ("U".equals(kind)) return "今天上夜 · 今晚" + nightBus + "班车，次日" + nightStart + "上班";
            if ("L".equals(kind)) return "今天下夜 · " + nightEnd + "下班，今晚无夜班车";
            if ("O".equals(kind)) return "今天休息 · 好好休息，安排自己的时间";
            if ("T".equals(kind)) return "今天培训 · 打开应用核对培训安排";
            String start = time(times, kind + ".start", "A".equals(kind) ? "16:00" : "N".equals(kind) ? "00:00" : "08:00");
            String end = time(times, kind + ".end", "A".equals(kind) ? "00:00" : "N".equals(kind) ? "08:00" : "16:00");
            String result = "今天" + label() + " · " + start + "–" + (end.compareTo(start) <= 0 ? "次日" : "") + end;
            if ("D".equals(kind) || "A".equals(kind)) result += " · " + time(times, "bus." + kind, "D".equals(kind) ? "07:10" : "15:10") + "班车";
            if (nightBusTonight) result += " · 今晚" + nightBus + "夜班车";
            return result;
        }
    }
}
