package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

/** 집중 타이머 기록 */
@RestController
@RequestMapping("/api/focus")
public class FocusController {
    private final JdbcTemplate jdbc;

    public FocusController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping
    public Map<String, Object> log(@RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        int min = U.num(b.get("minutes"), 0);
        if (min < 1 || min > 180) throw new ApiException(400, "집중 시간은 1~180분 사이여야 해요.");
        String label = U.str(b.get("label"));
        if (label.length() > 200) label = label.substring(0, 200);
        jdbc.update("INSERT INTO focus_sessions(user_id,minutes,label,session_date) VALUES(?,?,?,?)",
                uid, min, label, U.date(U.str(b.get("date"))));
        return U.m("ok", true);
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(@RequestParam String date, HttpSession s) {
        long uid = U.uid(s);
        LocalDate d = U.date(date);
        Integer today = jdbc.queryForObject("SELECT COALESCE(SUM(minutes),0) FROM focus_sessions WHERE user_id=? AND session_date=?", Integer.class, uid, d);
        Integer week = jdbc.queryForObject("SELECT COALESCE(SUM(minutes),0) FROM focus_sessions WHERE user_id=? AND session_date BETWEEN ? AND ?", Integer.class, uid, d.minusDays(6), d);
        return U.m("today", today, "week", week);
    }
}
