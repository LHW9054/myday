package com.myday;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 로그인/인증 이벤트를 logs/login.log + 콘솔 + DB(login_logs)에 남긴다.
 * 비밀번호, 인증 코드, 세션 ID 원문은 절대 기록하지 않는다. (세션은 해시 앞 8자리만)
 */
@Component
public class LoginAudit {
    private static final Logger log = LoggerFactory.getLogger("LOGIN_AUDIT");
    private final JdbcTemplate jdbc;

    public LoginAudit(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void record(HttpServletRequest req, Long uid, String email, String event, String detail) {
        String ip = ip(req);
        String ua = clean(req.getHeader("User-Agent"), 255);
        String device = device(ua);
        String em = clean(email, 190);
        String det = clean(detail, 255);
        try {
            jdbc.update("INSERT INTO login_logs(user_id,email,event,ip,device,user_agent,detail) VALUES(?,?,?,?,?,?,?)",
                    uid, em, event, ip, device, ua, det);
        } catch (Exception e) {
            log.warn("login_logs insert failed: {}", e.getMessage());
        }
        String line = String.format("event=%s uid=%s email=%s ip=%s device=\"%s\" session=%s detail=\"%s\" ua=\"%s\"",
                event, uid == null ? "-" : uid, em.isEmpty() ? "-" : em, ip, device, sessionTag(req), det, ua);
        if (event.endsWith("FAIL")) log.warn(line);
        else log.info(line);
    }

    /** 로그인 실패 기록 + 최근 10분 실패 횟수 (5회 이상이면 경고) */
    public void fail(HttpServletRequest req, String email, String reason) {
        record(req, null, email, "LOGIN_FAIL", reason);
        try {
            Integer n = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM login_logs WHERE email=? AND event='LOGIN_FAIL' AND created_at>DATE_SUB(NOW(), INTERVAL 10 MINUTE)",
                    Integer.class, clean(email, 190));
            if (n != null && n >= 5)
                log.warn("event=BRUTE_FORCE_SUSPECT email={} ip={} fails_in_10min={}", clean(email, 190), ip(req), n);
        } catch (Exception ignored) {
            // 집계 실패는 무시
        }
    }

    public static String ip(HttpServletRequest req) {
        String x = req.getHeader("X-Forwarded-For");
        if (x != null && !x.isBlank()) return clean(x.split(",")[0].trim(), 64);
        return req.getRemoteAddr();
    }

    static String device(String ua) {
        if (ua == null || ua.isEmpty()) return "unknown";
        String os = ua.contains("iPhone") ? "iPhone" : ua.contains("iPad") ? "iPad" : ua.contains("Android") ? "Android"
                : ua.contains("Macintosh") ? "Mac" : ua.contains("Windows") ? "Windows" : ua.contains("Linux") ? "Linux" : "Other";
        String br = ua.contains("Edg/") ? "Edge" : ua.contains("OPR/") ? "Opera" : (ua.contains("Chrome/") || ua.contains("CriOS")) ? "Chrome"
                : (ua.contains("Firefox/") || ua.contains("FxiOS")) ? "Firefox" : ua.contains("Safari/") ? "Safari" : "Other";
        return os + " · " + br;
    }

    private static String sessionTag(HttpServletRequest req) {
        try {
            HttpSession s = req.getSession(false);
            if (s == null) return "-";
            byte[] h = MessageDigest.getInstance("SHA-256").digest(s.getId().getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) sb.append(String.format("%02x", h[i]));
            return sb.toString();
        } catch (Exception e) {
            return "-";
        }
    }

    /** 로그 인젝션 방지: 줄바꿈 제거 + 길이 제한 */
    private static String clean(String s, int max) {
        if (s == null) return "";
        String c = s.replaceAll("[\\r\\n\\t]", " ").replace("\"", "'").trim();
        return c.length() > max ? c.substring(0, max) : c;
    }
}
