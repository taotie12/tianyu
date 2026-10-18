package cn.sanzhi.calendar;

import org.junit.Test;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import static org.junit.Assert.*;

public class WidgetScheduleTest {
    private long at(String value) { return Instant.parse(value).toEpochMilli(); }

    @Test public void todayUsesShanghaiEvenWhenDeviceUsesAnotherZone() {
        TimeZone original = TimeZone.getDefault();
        try {
            TimeZone.setDefault(TimeZone.getTimeZone("America/Los_Angeles"));
            assertEquals("2026-10-19", WidgetSchedule.dateAt(at("2026-10-18T16:00:00Z")));
            assertEquals("2026-10-18", WidgetSchedule.dateAt(at("2026-10-18T15:59:59Z")));
            List<WidgetSchedule.Day> days = WidgetSchedule.days(Map.of(), at("2026-10-18T16:00:00Z"));
            assertEquals(7, days.size());
            assertEquals("2026-10-19", days.get(0).date);
            assertEquals("周一", days.get(0).week);
            assertEquals("10/25", days.get(6).shortDate);
        } finally { TimeZone.setDefault(original); }
    }

    @Test public void nightTransitionsKeepOriginalDaysAndUseNextDay() {
        Map<String,String> schedule = new HashMap<>(Map.of("2026-10-19","A","2026-10-20","A","2026-10-21","O","2026-10-22","N","2026-10-23","N","2026-10-24","O","2026-10-25","T"));
        List<WidgetSchedule.Day> days = WidgetSchedule.days(schedule, at("2026-10-19T04:00:00Z"));
        assertEquals("中班", days.get(0).label());
        assertEquals("上夜", days.get(2).label());
        assertEquals("夜班", days.get(3).label());
        assertEquals("下夜", days.get(4).label());
        assertEquals("休息", days.get(5).label());
        assertEquals("培训", days.get(6).label());
        assertEquals("今天培训 · 打开应用核对培训安排", days.get(6).detail(Map.of()));
        assertTrue(days.get(2).detail(Map.of()).contains("今晚22:10班车，次日00:00上班"));
        assertTrue(days.get(4).detail(Map.of()).contains("08:00下班，今晚无夜班车"));
        assertEquals("O", schedule.get("2026-10-21"));
        assertEquals(7, schedule.size());
    }

    @Test public void lastVisibleDayAlsoReadsFollowingInvisibleDay() {
        List<WidgetSchedule.Day> days = WidgetSchedule.days(Map.of("2026-10-25","O","2026-10-26","N"), at("2026-10-19T04:00:00Z"));
        assertEquals("上夜", days.get(6).label());
        assertEquals("未排", days.get(0).label());
        assertTrue(days.get(0).detail(Map.of()).contains("未排班"));
    }

    @Test public void unknownNextDayDoesNotInventLastNightOrRest() {
        List<WidgetSchedule.Day> days = WidgetSchedule.days(Map.of("2026-10-19","N"), at("2026-10-19T04:00:00Z"));
        assertEquals("夜班", days.get(0).label());
        assertFalse(days.get(0).nightBusTonight);
        assertFalse(days.get(0).detail(Map.of()).contains("班车"));
        assertEquals("未排", days.get(1).label());
    }

    @Test public void nightTransitionsAcrossMonthAndYear() {
        List<WidgetSchedule.Day> days = WidgetSchedule.days(Map.of("2026-12-31","O","2027-01-01","N","2027-01-02","D"), at("2026-12-31T04:00:00Z"));
        assertEquals("上夜", days.get(0).label());
        assertEquals("2027-01-01", days.get(1).date);
        assertEquals("下夜", days.get(1).label());
        assertEquals("早班", days.get(2).label());
        days = WidgetSchedule.days(Map.of("2028-02-29","O","2028-03-01","N"), at("2028-02-29T04:00:00Z"));
        assertEquals("上夜", days.get(0).label());
        assertEquals("2028-03-01", days.get(1).date);
    }

    @Test public void todayDetailsUseSavedCustomHoursAndBusTimes() {
        List<WidgetSchedule.Day> days = WidgetSchedule.days(Map.of("2026-10-19","D","2026-10-20","A","2026-10-21","O","2026-10-22","N","2026-10-23","O"), at("2026-10-19T04:00:00Z"));
        Map<String,String> times = Map.of("D.start","08:30","D.end","16:30","bus.D","07:20","bus.N","22:20","N.start","00:10","N.end","08:10");
        assertEquals("今天早班 · 08:30–16:30 · 07:20班车", days.get(0).detail(times));
        assertTrue(days.get(1).detail(times).contains("16:00–次日00:00"));
        assertTrue(days.get(2).detail(times).contains("今晚22:20班车，次日00:10上班"));
        assertTrue(days.get(3).detail(times).contains("08:10下班"));
    }

    @Test public void refreshTargetsNextChinaMidnightAndMovesAfterRollover() {
        assertEquals(at("2026-10-18T16:00:00Z"), WidgetSchedule.nextMidnight(at("2026-10-18T04:00:00Z")));
        assertEquals(at("2026-10-19T16:00:00Z"), WidgetSchedule.nextMidnight(at("2026-10-18T16:00:00Z")));
        assertEquals(at("2027-01-01T16:00:00Z"), WidgetSchedule.nextMidnight(at("2027-01-01T15:59:59Z")));
        assertEquals("2027-01-02", WidgetSchedule.days(Map.of(), at("2027-01-01T16:00:00Z")).get(0).date);
    }

    @Test public void validatesRealSupportedDates() {
        assertTrue(WidgetSchedule.validDate("2028-02-29"));
        for (String date : new String[]{"2026-02-29","2026-02-30","2026-13-01","2026-01-32","2026-1-01","1999-12-31","2100-01-01","2026-01-01x"}) assertFalse(date, WidgetSchedule.validDate(date));
    }
}
