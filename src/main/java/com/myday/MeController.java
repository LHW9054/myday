package com.myday;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/me")
public class MeController {
    private final JdbcTemplate jdbc;
    private final UserDao users;
    private final ReportService report;
    private final MailService mail;
    private final LoginAudit audit;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public MeController(JdbcTemplate jdbc, UserDao users, ReportService report, MailService mail, LoginAudit audit) {
        this.jdbc = jdbc;
        this.users = users;
        this.report = report;
        this.mail = mail;
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> me(HttpSession s) {
        return users.get(U.uid(s));
    }

    @PutMapping
    public Map<String, Object> update(@RequestBody Map<String, Object> b, HttpSession s) {
        long uid = U.uid(s);
        if (b.containsKey("nickname")) {
            String n = U.str(b.get("nickname"));
            if (n.isEmpty() || n.length() > 20) throw new ApiException(400, "닉네임은 1~20자로 입력해 주세요.");
            jdbc.update("UPDATE users SET nickname=? WHERE id=?", n, uid);
        }
        if (b.containsKey("dailyMail"))
            jdbc.update("UPDATE users SET daily_mail=? WHERE id=?", U.bool(b.get("dailyMail")), uid);
        if (b.containsKey("lang")) users.setLang(uid, U.str(b.get("lang")));
        return users.get(uid);
    }

    @PostMapping("/password")
    public Map<String, Object> password(@RequestBody Map<String, Object> b, HttpServletRequest req, HttpSession s) {
        long uid = U.uid(s);
        String email = String.valueOf(users.get(uid).get("email"));
        String next = U.str(b.get("password"));
        AuthController.checkPassword(next);
        try {
            checkCurrent(uid, U.str(b.get("current")), "현재 비밀번호가 올바르지 않아요.");
        } catch (ApiException e) {
            audit.record(req, uid, email, "PASSWORD_CHANGE_FAIL", "wrong current password");
            throw e;
        }
        jdbc.update("UPDATE users SET password=? WHERE id=?", enc.encode(next), uid);
        audit.record(req, uid, email, "PASSWORD_CHANGE", "");
        return U.m("ok", true);
    }

    /** 오늘의 리포트 메일을 지금 바로 보내 보기 */
    @PostMapping("/test-mail")
    public Map<String, Object> testMail(HttpSession s, @RequestHeader(value = "X-Lang", required = false) String lang) {
        report.send(U.uid(s), lang);
        return U.m("ok", true, "dev", mail.isDev());
    }

    /** 내 계정의 최근 로그인/인증 기록 (성공·실패 포함) */
    @GetMapping("/logins")
    public List<Map<String, Object>> logins(HttpSession s) {
        String email = String.valueOf(users.get(U.uid(s)).get("email"));
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT event,ip,device,created_at FROM login_logs WHERE email=? ORDER BY id DESC LIMIT 20", email);
        for (Map<String, Object> r : rows) {
            Object t = r.remove("created_at");
            r.put("at", t instanceof Timestamp ts ? ts.toLocalDateTime().toString().replace('T', ' ').substring(0, 19) : String.valueOf(t));
        }
        return rows;
    }

    /** 계정과 모든 데이터 삭제 (비밀번호 확인) */
    @DeleteMapping
    public Map<String, Object> delete(@RequestBody Map<String, Object> b, HttpServletRequest req, HttpSession s) {
        long uid = U.uid(s);
        String email = String.valueOf(users.get(uid).get("email"));
        try {
            checkCurrent(uid, U.str(b.get("password")), "비밀번호가 올바르지 않아요.");
        } catch (ApiException e) {
            audit.record(req, uid, email, "ACCOUNT_DELETE_FAIL", "wrong password");
            throw e;
        }
        audit.record(req, uid, email, "ACCOUNT_DELETE", "account and all data deleted");
        jdbc.update("DELETE FROM users WHERE id=?", uid);
        jdbc.update("DELETE FROM login_logs WHERE email=?", email); // DB 기록은 지우고, 로그 파일(logs/login.log)에는 남는다
        s.invalidate();
        return U.m("ok", true);
    }

    private void checkCurrent(long uid, String pw, String msg) {
        String hash = jdbc.queryForObject("SELECT password FROM users WHERE id=?", String.class, uid);
        if (!enc.matches(pw, hash)) throw new ApiException(400, msg);
    }
}
