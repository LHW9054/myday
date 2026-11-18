package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.web.bind.annotation.*;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** 체크리스트 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private static final String SEL = "SELECT id,title,done,priority,task_date AS dt FROM tasks ";
    private final JdbcTemplate jdbc;

    public TaskController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static List<Map<String, Object>> fix(List<Map<String, Object>> rows) {
        rows.forEach(r -> r.put("date", U.ld(r.remove("dt")).toString()));
        return rows;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestParam String date, HttpSession s) {
        return fix(jdbc.queryForList(SEL + "WHERE user_id=? AND task_date=? ORDER BY done, priority, id",
                U.uid(s), U.date(date)));
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        String title = U.str(b.get("title"));
        if (title.isEmpty() || title.length() > 200) throw new ApiException(400, "할 일은 1~200자로 입력해 주세요.");
        LocalDate d = U.date(U.str(b.get("date")));
        int p = Math.max(1, Math.min(3, U.num(b.get("priority"), 2)));
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(
                    "INSERT INTO tasks(user_id,title,priority,task_date) VALUES(?,?,?,?)", Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, uid);
            ps.setString(2, title);
            ps.setInt(3, p);
            ps.setObject(4, d);
            return ps;
        }, kh);
        return fix(jdbc.queryForList(SEL + "WHERE id=?", kh.getKey().longValue())).get(0);
    }

    @PatchMapping("/{id}")
    public Map<String, Object> patch(@PathVariable long id, @RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        if (b.containsKey("done")) {
            boolean done = U.bool(b.get("done"));
            jdbc.update("UPDATE tasks SET done=?, done_at=" + (done ? "NOW()" : "NULL") + " WHERE id=? AND user_id=?", done, id, uid);
        }
        if (b.containsKey("title")) {
            String t = U.str(b.get("title"));
            if (t.isEmpty() || t.length() > 200) throw new ApiException(400, "할 일은 1~200자로 입력해 주세요.");
            jdbc.update("UPDATE tasks SET title=? WHERE id=? AND user_id=?", t, id, uid);
        }
        if (b.containsKey("priority"))
            jdbc.update("UPDATE tasks SET priority=? WHERE id=? AND user_id=?",
                    Math.max(1, Math.min(3, U.num(b.get("priority"), 2))), id, uid);
        List<Map<String, Object>> r = fix(jdbc.queryForList(SEL + "WHERE id=? AND user_id=?", id, uid));
        if (r.isEmpty()) throw new ApiException(404, "할 일을 찾을 수 없어요.");
        return r.get(0);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable long id, HttpSession s) {
        jdbc.update("DELETE FROM tasks WHERE id=? AND user_id=?", id, U.uid(s));
        return U.m("ok", true);
    }

    /** 완료한 항목 한꺼번에 정리 */
    @DeleteMapping("/completed")
    public Map<String, Object> clearDone(@RequestParam String date, HttpSession s) {
        int n = jdbc.update("DELETE FROM tasks WHERE user_id=? AND task_date=? AND done=1", U.uid(s), U.date(date));
        return U.m("deleted", n);
    }

    /** 끝내지 못한 할 일을 다른 날짜로 넘기기 */
    @PostMapping("/carry")
    public Map<String, Object> carry(@RequestBody Map<String, Object> b, HttpSession s) {
        int n = jdbc.update("UPDATE tasks SET task_date=? WHERE user_id=? AND task_date=? AND done=0",
                U.date(U.str(b.get("to"))), U.uid(s), U.date(U.str(b.get("from"))));
        return U.m("moved", n);
    }
}
