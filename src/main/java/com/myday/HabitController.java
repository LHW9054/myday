package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

/** 습관 트래커 */
@RestController
@RequestMapping("/api/habits")
public class HabitController {
    private final JdbcTemplate jdbc;

    public HabitController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam String date, HttpSession s) {
        long uid = U.uid(s);
        LocalDate d = U.date(date);
        List<Map<String, Object>> hs = jdbc.queryForList("SELECT id,name,emoji FROM habits WHERE user_id=? ORDER BY id", uid);
        Map<Long, Set<LocalDate>> logs = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT l.habit_id AS h, l.log_date AS d FROM habit_logs l JOIN habits x ON x.id=l.habit_id "
                        + "WHERE x.user_id=? AND l.log_date BETWEEN ? AND ?", uid, d.minusDays(400), d))
            logs.computeIfAbsent(((Number) r.get("h")).longValue(), k -> new HashSet<>()).add(U.ld(r.get("d")));

        for (Map<String, Object> h : hs) {
            Set<LocalDate> set = logs.getOrDefault(((Number) h.get("id")).longValue(), Collections.emptySet());
            int streak = 0;
            LocalDate cur = set.contains(d) ? d : d.minusDays(1);
            while (set.contains(cur)) {
                streak++;
                cur = cur.minusDays(1);
            }
            List<Map<String, Object>> days = new ArrayList<>();
            for (int i = 6; i >= 0; i--) {
                LocalDate x = d.minusDays(i);
                days.add(U.m("date", x.toString(), "done", set.contains(x)));
            }
            h.put("done", set.contains(d));
            h.put("streak", streak);
            h.put("days", days);
            h.put("total", set.size());
        }
        return hs;
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        String name = U.str(b.get("name")), emoji = U.str(b.get("emoji"));
        if (name.isEmpty() || name.length() > 100) throw new ApiException(400, "습관 이름은 1~100자로 입력해 주세요.");
        if (emoji.isEmpty() || emoji.length() > 16) emoji = "✅";
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM habits WHERE user_id=?", Integer.class, uid);
        if (n != null && n >= 20) throw new ApiException(400, "습관은 최대 20개까지 만들 수 있어요.");
        jdbc.update("INSERT INTO habits(user_id,name,emoji) VALUES(?,?,?)", uid, name, emoji);
        return U.m("ok", true);
    }

    @PostMapping("/{id}/toggle")
    public Map<String, Object> toggle(@PathVariable long id, @RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        LocalDate d = U.date(U.str(b.get("date")));
        Integer own = jdbc.queryForObject("SELECT COUNT(*) FROM habits WHERE id=? AND user_id=?", Integer.class, id, uid);
        if (own == null || own == 0) throw new ApiException(404, "습관을 찾을 수 없어요.");
        boolean done = false;
        if (jdbc.update("DELETE FROM habit_logs WHERE habit_id=? AND log_date=?", id, d) == 0) {
            jdbc.update("INSERT INTO habit_logs(habit_id,log_date) VALUES(?,?)", id, d);
            done = true;
        }
        return U.m("done", done);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable long id, HttpSession s) {
        jdbc.update("DELETE FROM habits WHERE id=? AND user_id=?", id, U.uid(s));
        return U.m("ok", true);
    }
}
