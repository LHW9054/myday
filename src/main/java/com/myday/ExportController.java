package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

/** 내 데이터 내려받기 (JSON) */
@RestController
@RequestMapping("/api/export")
public class ExportController {
    private final JdbcTemplate jdbc;
    private final UserDao users;

    public ExportController(JdbcTemplate jdbc, UserDao users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    @GetMapping
    public Map<String, Object> export(HttpSession s) {
        long uid = U.uid(s);
        return U.m("exportedAt", LocalDateTime.now(U.TOKYO).toString(),
                "user", users.get(uid),
                "entries", U.fixDates(jdbc.queryForList("SELECT entry_date AS dt,mood,energy,highlight,gratitude,content FROM entries WHERE user_id=? ORDER BY entry_date", uid)),
                "tasks", U.fixDates(jdbc.queryForList("SELECT task_date AS dt,title,done,priority FROM tasks WHERE user_id=? ORDER BY task_date,id", uid)),
                "habits", jdbc.queryForList("SELECT id,name,emoji FROM habits WHERE user_id=? ORDER BY id", uid),
                "habitLogs", U.fixDates(jdbc.queryForList("SELECT h.name AS name, l.log_date AS dt FROM habit_logs l JOIN habits h ON h.id=l.habit_id WHERE h.user_id=? ORDER BY l.log_date", uid)),
                "stats", U.fixDates(jdbc.queryForList("SELECT stat_date AS dt,sleep_hours AS sleep,water_cups AS water,exercise_min AS exercise FROM daily_stats WHERE user_id=? ORDER BY stat_date", uid)),
                "focus", U.fixDates(jdbc.queryForList("SELECT session_date AS dt,minutes,label FROM focus_sessions WHERE user_id=? ORDER BY id", uid)));
    }
}
