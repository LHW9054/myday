package com.myday;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** 회원가입 / 이메일 인증 / 로그인 / 비밀번호 재설정 (모든 이벤트는 LoginAudit 로 기록) */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final SecureRandom RND = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final MailService mail;
    private final UserDao users;
    private final LoginAudit audit;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    public AuthController(JdbcTemplate jdbc, MailService mail, UserDao users, LoginAudit audit) {
        this.jdbc = jdbc;
        this.mail = mail;
        this.users = users;
        this.audit = audit;
    }

    @PostMapping("/signup")
    public Map<String, Object> signup(@RequestBody Map<String, Object> b, HttpServletRequest req,
                                      @RequestHeader(value = "X-Lang", required = false) String lang) {
        String email = email(b.get("email"));
        String nick = U.str(b.get("nickname"));
        String pw = U.str(b.get("password"));
        if (nick.isEmpty() || nick.length() > 20) throw new ApiException(400, "닉네임은 1~20자로 입력해 주세요.");
        checkPassword(pw);

        List<Map<String, Object>> ex = jdbc.queryForList("SELECT id,email_verified FROM users WHERE email=?", email);
        if (!ex.isEmpty()) {
            if (U.bool(ex.get(0).get("email_verified"))) {
                audit.record(req, null, email, "SIGNUP_FAIL", "already registered");
                throw new ApiException(409, "이미 가입된 이메일이에요.");
            }
            jdbc.update("UPDATE users SET nickname=?, password=? WHERE email=?", nick, enc.encode(pw), email);
        } else {
            jdbc.update("INSERT INTO users(email,nickname,password) VALUES(?,?,?)", email, nick, enc.encode(pw));
        }
        audit.record(req, null, email, "SIGNUP", "nickname=" + nick + " (awaiting email verification)");
        return issue(email, "verify", lang);
    }

    @PostMapping("/resend")
    public Map<String, Object> resend(@RequestBody Map<String, Object> b, HttpServletRequest req,
                                      @RequestHeader(value = "X-Lang", required = false) String lang) {
        String email = email(b.get("email"));
        List<Map<String, Object>> r = jdbc.queryForList("SELECT email_verified FROM users WHERE email=?", email);
        if (r.isEmpty() || U.bool(r.get(0).get("email_verified"))) return U.m("ok", true);
        audit.record(req, null, email, "CODE_RESEND", "verify");
        return issue(email, "verify", lang);
    }

    @PostMapping("/verify")
    public Map<String, Object> verify(@RequestBody Map<String, Object> b, HttpServletRequest req) {
        String email = email(b.get("email"));
        try {
            consume(email, "verify", U.str(b.get("code")));
        } catch (ApiException e) {
            audit.record(req, null, email, "VERIFY_FAIL", e.getMessage());
            throw e;
        }
        jdbc.update("UPDATE users SET email_verified=1 WHERE email=?", email);
        long id = jdbc.queryForObject("SELECT id FROM users WHERE email=?", Long.class, email);
        start(req, id);
        audit.record(req, id, email, "VERIFY_OK", "email verified, logged in");
        return U.m("ok", true, "user", users.get(id));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> b, HttpServletRequest req,
                                     @RequestHeader(value = "X-Lang", required = false) String lang) {
        String email = U.str(b.get("email")).toLowerCase();
        String pw = U.str(b.get("password"));
        List<Map<String, Object>> r = jdbc.queryForList("SELECT id,password,email_verified FROM users WHERE email=?", email);
        if (r.isEmpty()) {
            audit.fail(req, email, "unknown email");
            throw new ApiException(401, "이메일 또는 비밀번호가 올바르지 않아요.");
        }
        long id = ((Number) r.get(0).get("id")).longValue();
        if (!enc.matches(pw, (String) r.get(0).get("password"))) {
            audit.fail(req, email, "wrong password (uid=" + id + ")");
            throw new ApiException(401, "이메일 또는 비밀번호가 올바르지 않아요.");
        }
        if (!U.bool(r.get(0).get("email_verified"))) {
            audit.record(req, id, email, "LOGIN_UNVERIFIED", "password ok, email not verified -> code sent");
            Map<String, Object> res = issue(email, "verify", lang);
            res.put("needVerify", true);
            return res;
        }
        start(req, id);
        audit.record(req, id, email, "LOGIN_SUCCESS", "");
        return U.m("ok", true, "user", users.get(id));
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest req, HttpSession s) {
        Object uid = s.getAttribute("uid");
        if (uid != null) {
            String email = String.valueOf(users.get((Long) uid).get("email"));
            audit.record(req, (Long) uid, email, "LOGOUT", "");
        }
        s.invalidate();
        return U.m("ok", true);
    }

    @PostMapping("/forgot")
    public Map<String, Object> forgot(@RequestBody Map<String, Object> b, HttpServletRequest req,
                                      @RequestHeader(value = "X-Lang", required = false) String lang) {
        String email = email(b.get("email"));
        List<Map<String, Object>> r = jdbc.queryForList("SELECT id FROM users WHERE email=? AND email_verified=1", email);
        audit.record(req, r.isEmpty() ? null : ((Number) r.get(0).get("id")).longValue(), email,
                "PASSWORD_RESET_REQUEST", r.isEmpty() ? "no such verified account" : "code sent");
        if (r.isEmpty()) return U.m("ok", true); // 가입 여부를 화면에 노출하지 않음
        return issue(email, "reset", lang);
    }

    @PostMapping("/reset")
    public Map<String, Object> reset(@RequestBody Map<String, Object> b, HttpServletRequest req) {
        String email = email(b.get("email"));
        String pw = U.str(b.get("password"));
        checkPassword(pw);
        try {
            consume(email, "reset", U.str(b.get("code")));
        } catch (ApiException e) {
            audit.record(req, null, email, "RESET_FAIL", e.getMessage());
            throw e;
        }
        jdbc.update("UPDATE users SET password=?, email_verified=1 WHERE email=?", enc.encode(pw), email);
        audit.record(req, null, email, "PASSWORD_RESET", "password changed via email code");
        return U.m("ok", true);
    }

    // ---------- helpers ----------

    private String email(Object o) {
        String e = U.str(o).toLowerCase();
        if (e.length() > 190 || !EMAIL.matcher(e).matches()) throw new ApiException(400, "이메일 형식이 올바르지 않아요.");
        return e;
    }

    static void checkPassword(String pw) {
        if (pw.length() < 8 || pw.length() > 72 || !pw.matches(".*[A-Za-z].*") || !pw.matches(".*\\d.*"))
            throw new ApiException(400, "비밀번호는 8자 이상, 영문과 숫자를 포함해 주세요.");
    }

    private void start(HttpServletRequest req, long id) {
        HttpSession s = req.getSession(true);
        req.changeSessionId(); // 세션 고정 공격 방지
        s.setAttribute("uid", id);
    }

    /** 6자리 코드를 만들어 메일로 보낸다. 30초 안에 다시 요청하면 새 코드를 만들지 않는다. */
    private Map<String, Object> issue(String email, String purpose, String lang) {
        Integer recent = jdbc.queryForObject(
                "SELECT COUNT(*) FROM email_codes WHERE email=? AND purpose=? AND created_at>DATE_SUB(NOW(), INTERVAL 30 SECOND)",
                Integer.class, email, purpose);
        Map<String, Object> res = U.m("ok", true, "email", email);
        if (recent != null && recent > 0) return res;

        String code = String.format("%06d", RND.nextInt(1_000_000));
        jdbc.update("UPDATE email_codes SET used=1 WHERE email=? AND purpose=? AND used=0", email, purpose);
        jdbc.update("INSERT INTO email_codes(email,purpose,code,expires_at) VALUES(?,?,?,DATE_ADD(NOW(), INTERVAL 10 MINUTE))",
                email, purpose, code);
        mail.sendCode(email, code, purpose, lang);
        if (mail.isDev()) res.put("devCode", code); // SMTP 미설정 개발 모드에서만 화면에 노출
        return res;
    }

    private void consume(String email, String purpose, String code) {
        List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT id,code,attempts FROM email_codes WHERE email=? AND purpose=? AND used=0 AND expires_at>NOW() ORDER BY id DESC LIMIT 1",
                email, purpose);
        if (r.isEmpty()) throw new ApiException(400, "코드가 만료됐거나 없어요. 새 코드를 받아 주세요.");
        long id = ((Number) r.get(0).get("id")).longValue();
        if (U.num(r.get(0).get("attempts"), 0) >= 5) {
            jdbc.update("UPDATE email_codes SET used=1 WHERE id=?", id);
            throw new ApiException(429, "시도 횟수를 넘었어요. 새 코드를 받아 주세요.");
        }
        if (!String.valueOf(r.get(0).get("code")).equals(code)) {
            jdbc.update("UPDATE email_codes SET attempts=attempts+1 WHERE id=?", id);
            throw new ApiException(400, "코드가 일치하지 않아요.");
        }
        jdbc.update("UPDATE email_codes SET used=1 WHERE id=?", id);
    }
}
