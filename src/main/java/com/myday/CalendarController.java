package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/** 월간 달력: 날짜별 기분 · 할 일 달성 */
@RestController
@RequestMapping("/api/calendar")
public class CalendarController {
    private final JdbcTemplate jdbc;

    public CalendarController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> month(@RequestParam String month, HttpSession s) {
        long uid = U.uid(s);
        YearMonth ym;
        try {
            ym = YearMonth.parse(month);
        } catch (Exception e) {
            throw new ApiException(400, "월 형식이 올바르지 않아요.");
        }
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();
        Map<LocalDate, Map<String, Object>> days = new TreeMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT entry_date AS d, mood FROM entries WHERE user_id=? AND entry_date BETWEEN ? AND ?", uid, from, to)) {
            LocalDate d = U.ld(r.get("d"));
            days.put(d, U.m("date", d.toString(), "mood", r.get("mood"), "total", 0, "done", 0));
        }
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT task_date AS d, COUNT(*) AS c, COALESCE(SUM(done),0) AS s FROM tasks "
                        + "WHERE user_id=? AND task_date BETWEEN ? AND ? GROUP BY task_date", uid, from, to)) {
            LocalDate d = U.ld(r.get("d"));
            Map<String, Object> x = days.computeIfAbsent(d, k -> U.m("date", k.toString(), "mood", null, "total", 0, "done", 0));
            x.put("total", ((Number) r.get("c")).intValue());
            x.put("done", ((Number) r.get("s")).intValue());
        }
        return new ArrayList<>(days.values());
    }
}
