package com.myday;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** 하루 리포트 메일 (한국어/일본어) */
@Service
public class ReportService {
    private final JdbcTemplate jdbc;
    private final InsightService insights;
    private final MailService mail;

    public ReportService(JdbcTemplate jdbc, InsightService insights, MailService mail) {
        this.jdbc = jdbc;
        this.insights = insights;
        this.mail = mail;
    }

    public void send(long uid) {
        send(uid, null);
    }

    @SuppressWarnings("unchecked")
    public void send(long uid, String langOverride) {
        Map<String, Object> u = jdbc.queryForList("SELECT email,nickname FROM users WHERE id=?", uid).get(0);
        String lang = langOverride;
        if (lang == null || lang.isBlank()) {
            List<Map<String, Object>> r = jdbc.queryForList("SELECT lang FROM user_settings WHERE user_id=?", uid);
            lang = r.isEmpty() ? "ko" : String.valueOf(r.get(0).get("lang"));
        }
        boolean ja = U.ja(lang);
        String nick = HtmlUtils.htmlEscape(String.valueOf(u.get("nickname")));
        LocalDate today = LocalDateTime.now(U.TOKYO).toLocalDate();
        Map<String, Object> ins = insights.build(uid, today, 21, lang);
        Map<String, Object> t = (Map<String, Object>) ins.get("today");

        StringBuilder b = new StringBuilder();
        b.append("<p style='margin:0 0 16px;color:#cfd6f5;line-height:1.7'>")
                .append(ja ? nick + "さん、今日もお疲れさまでした。" : nick + "님, 오늘 하루도 수고했어요.").append("</p>");
        b.append("<table style='width:100%;border-collapse:collapse;margin-bottom:18px'><tr>")
                .append(cell(ja ? "今日の完了" : "오늘 완료", t.get("done") + " / " + t.get("total")))
                .append(cell(ja ? "連続記録" : "연속 기록", ins.get("streak") + (ja ? "日" : "일")))
                .append(cell(ja ? "週の完了率" : "주간 완료율", ins.get("rate") + "%"))
                .append("</tr></table>");
        b.append("<div style='background:rgba(255,255,255,.06);border-radius:14px;padding:16px;color:#e8ecff;line-height:1.7;margin-bottom:18px'>")
                .append(HtmlUtils.htmlEscape(String.valueOf(ins.get("summary")))).append("</div>");
        for (Map<String, Object> r : (List<Map<String, Object>>) ins.get("recs")) {
            b.append("<div style='margin:0 0 10px;color:#cfd6f5'><b style='color:#ffd08a'>")
                    .append(r.get("icon")).append(" ").append(HtmlUtils.htmlEscape(String.valueOf(r.get("title"))))
                    .append("</b><br><span style='font-size:13px;color:#aab3de'>")
                    .append(HtmlUtils.htmlEscape(String.valueOf(r.get("desc")))).append("</span></div>");
        }
        String title = ja ? "今日のレポート" : "오늘의 리포트";
        mail.send(String.valueOf(u.get("email")), "[My Day] " + today + " " + title, mail.shell(title, b.toString()));
    }

    private static String cell(String label, Object value) {
        return "<td style='text-align:center;padding:12px 4px;background:rgba(255,255,255,.06);border-radius:12px'>"
                + "<div style='font-size:20px;font-weight:700;color:#ffd08a'>" + value + "</div>"
                + "<div style='font-size:11px;color:#8e97c4;margin-top:4px'>" + label + "</div></td>";
    }
}
