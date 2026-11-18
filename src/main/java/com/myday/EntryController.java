package com.myday;

import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 하루 기록(기분 · 에너지 · 일기) */
@RestController
@RequestMapping("/api/entries")
public class EntryController {
    private final JdbcTemplate jdbc;

    public EntryController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static List<Map<String, Object>> fix(List<Map<String, Object>> rows) {
        rows.forEach(r -> r.put("date", U.ld(r.remove("dt")).toString()));
        return rows;
    }

    /** 일기 · 하이라이트 · 감사한 일에서 키워드 검색 */
    @GetMapping("/search")
    public List<Map<String, Object>> search(@RequestParam String q, HttpSession s) {
        String k = q.trim();
        if (k.isEmpty()) return Collections.emptyList();
        if (k.length() > 50) k = k.substring(0, 50);
        String like = "%" + k.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return fix(jdbc.queryForList(
                "SELECT entry_date AS dt,mood,energy,highlight,LEFT(content,140) AS snippet FROM entries "
                        + "WHERE user_id=? AND (content LIKE ? OR highlight LIKE ? OR gratitude LIKE ?) "
                        + "ORDER BY entry_date DESC LIMIT 30", U.uid(s), like, like, like));
    }

    @GetMapping("/{date}")
    public Map<String, Object> get(@PathVariable String date, HttpSession s) {
        List<Map<String, Object>> r = fix(jdbc.queryForList(
                "SELECT entry_date AS dt,mood,energy,content,highlight,gratitude FROM entries WHERE user_id=? AND entry_date=?",
                U.uid(s), U.date(date)));
        Map<String, Object> res = new HashMap<>();
        res.put("entry", r.isEmpty() ? null : r.get(0));
        return res;
    }

    @PutMapping("/{date}")
    public Map<String, Object> save(@PathVariable String date, @RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        int mood = U.num(b.get("mood"), 0), energy = U.num(b.get("energy"), 0);
        if (mood < 1 || mood > 5 || energy < 1 || energy > 5) throw new ApiException(400, "기분과 에너지는 1~5 사이로 골라 주세요.");
        String content = U.str(b.get("content")), hl = U.str(b.get("highlight")), gr = U.str(b.get("gratitude"));
        if (content.length() > 5000) throw new ApiException(400, "기록은 5000자까지 쓸 수 있어요.");
        if (hl.length() > 200 || gr.length() > 200) throw new ApiException(400, "하이라이트와 감사한 일은 200자까지예요.");
        jdbc.update("INSERT INTO entries(user_id,entry_date,mood,energy,content,highlight,gratitude) VALUES(?,?,?,?,?,?,?) "
                        + "ON DUPLICATE KEY UPDATE mood=VALUES(mood),energy=VALUES(energy),content=VALUES(content),"
                        + "highlight=VALUES(highlight),gratitude=VALUES(gratitude)",
                uid, U.date(date), mood, energy, content, hl, gr);
        return U.m("ok", true);
    }

    @DeleteMapping("/{date}")
    public Map<String, Object> delete(@PathVariable String date, HttpSession s) {
        jdbc.update("DELETE FROM entries WHERE user_id=? AND entry_date=?", U.uid(s), U.date(date));
        return U.m("ok", true);
    }

    @GetMapping
    public List<Map<String, Object>> recent(@RequestParam(defaultValue = "14") int limit, HttpSession s) {
        int n = Math.max(1, Math.min(60, limit));
        return fix(jdbc.queryForList(
                "SELECT entry_date AS dt,mood,energy,highlight,LEFT(content,140) AS snippet FROM entries "
                        + "WHERE user_id=? ORDER BY entry_date DESC LIMIT ?", U.uid(s), n));
    }
}
