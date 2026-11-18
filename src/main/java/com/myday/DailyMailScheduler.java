package com.myday;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/** 설정에서 '매일 리포트 메일'을 켠 사용자에게 매일 21:00(일본 시간)에 발송 */
@Component
public class DailyMailScheduler {
    private static final Logger log = LoggerFactory.getLogger(DailyMailScheduler.class);
    private final JdbcTemplate jdbc;
    private final ReportService report;

    public DailyMailScheduler(JdbcTemplate jdbc, ReportService report) {
        this.jdbc = jdbc;
        this.report = report;
    }

    @Scheduled(cron = "0 0 21 * * *", zone = "Asia/Tokyo")
    public void run() {
        for (Map<String, Object> r : jdbc.queryForList("SELECT id FROM users WHERE daily_mail=1 AND email_verified=1")) {
            try {
                report.send(((Number) r.get("id")).longValue());
            } catch (Exception e) {
                log.warn("Daily mail failed for user {}: {}", r.get("id"), e.getMessage());
            }
        }
    }
}
