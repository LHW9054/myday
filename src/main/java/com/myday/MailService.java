package com.myday;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class MailService {
    private static final Logger log = LoggerFactory.getLogger(MailService.class);
    private final ObjectProvider<JavaMailSender> sender;

    @Value("${app.mail.from}")
    private String from;

    public MailService(ObjectProvider<JavaMailSender> sender) {
        this.sender = sender;
    }

    /** SMTP 가 설정되지 않았으면 개발 모드 */
    public boolean isDev() {
        return sender.getIfAvailable() == null;
    }

    public void send(String to, String subject, String html) {
        JavaMailSender s = sender.getIfAvailable();
        if (s == null) {
            log.info("\n===== [DEV MAIL] =====\nTo: {}\nSubject: {}\n{}\n======================",
                    to, subject, html.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim());
            return;
        }
        try {
            MimeMessage m = s.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(m, true, "UTF-8");
            h.setFrom(from);
            h.setTo(to);
            h.setSubject(subject);
            h.setText(html, true);
            s.send(m);
        } catch (Exception e) {
            log.warn("Mail send failed: {}", e.getMessage());
            throw new ApiException(502, "메일을 보내지 못했어요. SMTP 설정(local.properties)을 확인해 주세요.");
        }
    }

    public void sendCode(String to, String code, String purpose, String lang) {
        boolean ja = U.ja(lang), reset = "reset".equals(purpose);
        String title = reset ? (ja ? "パスワード再設定コード" : "비밀번호 재설정 코드") : (ja ? "メール認証コード" : "이메일 인증 코드");
        String body = "<p style='margin:0 0 18px;color:#cfd6f5'>"
                + (ja ? "下の6桁のコードを入力してください。10分間有効です。" : "아래 6자리 코드를 입력해 주세요. 10분 동안만 유효해요.") + "</p>"
                + "<div style='font-size:36px;font-weight:700;letter-spacing:12px;color:#ffd08a;"
                + "background:rgba(255,255,255,.06);border-radius:14px;padding:18px 0;text-align:center'>" + code + "</div>"
                + "<p style='margin:18px 0 0;font-size:12px;color:#8e97c4'>"
                + (ja ? "心当たりがない場合は、このメールを無視してください。" : "본인이 요청하지 않았다면 이 메일을 무시해 주세요.") + "</p>";
        send(to, "[My Day] " + title, shell(title, body));
    }

    /** 메일 공통 레이아웃 */
    public String shell(String title, String body) {
        return "<div style='background:#0b1020;padding:32px 12px;font-family:-apple-system,Segoe UI,Noto Sans KR,Noto Sans JP,sans-serif'>"
                + "<div style='max-width:480px;margin:0 auto;background:#151b38;border:1px solid #262f5c;border-radius:20px;padding:32px;color:#f6f3ee'>"
                + "<div style='font-size:22px;font-weight:700;margin-bottom:6px'>My <span style='color:#ffd08a;font-style:italic'>Day</span></div>"
                + "<h2 style='font-size:18px;margin:0 0 22px;color:#f6f3ee'>" + title + "</h2>" + body + "</div></div>";
    }
}
