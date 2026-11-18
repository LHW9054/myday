package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** 하루 바이탈: 수면 · 물 · 운동 */
@RestController
@RequestMapping("/api/stats")
public class StatsController {
    private final JdbcTemplate jdbc;

    public StatsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private Map<String, Object> read(long uid, LocalDate d) {
        List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT sleep_hours,water_cups,exercise_min FROM daily_stats WHERE user_id=? AND stat_date=?", uid, d);
        if (r.isEmpty()) return U.m("sleep", 0.0, "water", 0, "exercise", 0);
        Map<String, Object> x = r.get(0);
        return U.m("sleep", U.dbl(x.get("sleep_hours"), 0), "water", U.num(x.get("water_cups"), 0),
                "exercise", U.num(x.get("exercise_min"), 0));
    }

    @GetMapping("/{date}")
    public Map<String, Object> get(@PathVariable String date, HttpSession s) {
        return read(U.uid(s), U.date(date));
    }

    @PutMapping("/{date}")
    public Map<String, Object> put(@PathVariable String date, @RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        LocalDate d = U.date(date);
        Map<String, Object> cur = read(uid, d);
        double sleep = b.containsKey("sleep") ? U.dbl(b.get("sleep"), 0) : (Double) cur.get("sleep");
        int water = b.containsKey("water") ? U.num(b.get("water"), 0) : (Integer) cur.get("water");
        int ex = b.containsKey("exercise") ? U.num(b.get("exercise"), 0) : (Integer) cur.get("exercise");
        if (sleep < 0 || sleep > 24 || water < 0 || water > 30 || ex < 0 || ex > 600)
            throw new ApiException(400, "수면은 0~24시간, 물은 0~30잔, 운동은 0~600분 사이로 입력해 주세요.");
        sleep = Math.round(sleep * 2) / 2.0;
        jdbc.update("INSERT INTO daily_stats(user_id,stat_date,sleep_hours,water_cups,exercise_min) VALUES(?,?,?,?,?) "
                        + "ON DUPLICATE KEY UPDATE sleep_hours=VALUES(sleep_hours),water_cups=VALUES(water_cups),exercise_min=VALUES(exercise_min)",
                uid, d, sleep, water, ex);
        return read(uid, d);
    }
}
