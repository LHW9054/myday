package com.myday;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class UserDao {
    private final JdbcTemplate jdbc;

    public UserDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 화면에 내려줄 사용자 정보 (비밀번호 제외) */
    public Map<String, Object> get(long id) {
        List<Map<String, Object>> r = jdbc.queryForList(
                "SELECT u.id,u.email,u.nickname,u.daily_mail,COALESCE(s.lang,'ko') AS lang "
                        + "FROM users u LEFT JOIN user_settings s ON s.user_id=u.id WHERE u.id=?", id);
        if (r.isEmpty()) throw new ApiException(401, "로그인이 필요해요.");
        Map<String, Object> u = r.get(0);
        return U.m("id", u.get("id"), "email", u.get("email"), "nickname", u.get("nickname"),
                "dailyMail", U.bool(u.get("daily_mail")), "lang", u.get("lang"));
    }

    public void setLang(long uid, String lang) {
        String l = U.ja(lang) ? "ja" : "ko";
        jdbc.update("INSERT INTO user_settings(user_id,lang) VALUES(?,?) ON DUPLICATE KEY UPDATE lang=VALUES(lang)", uid, l);
    }
}
