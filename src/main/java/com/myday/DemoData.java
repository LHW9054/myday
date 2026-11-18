package com.myday;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Random;

/** 체험 계정(demo@myday.app / Demo1234!)과 2주치 샘플 데이터를 만든다 */
@Component
public class DemoData implements CommandLineRunner {
    private static final String EMAIL = "demo@myday.app";
    private static final String[] TASKS = {"아침 스트레칭 10분", "Java 문법 복습", "포트폴리오 README 정리", "Spring Boot 강의 1강",
            "일본어 단어 30개", "산책 20분", "이력서 업데이트", "GitHub 커밋 정리", "물 2리터 마시기", "장보기"};
    private static final String[] HL = {"카페에서 집중이 잘 됐다", "새로운 API를 직접 만들어 봤다", "산책하며 머리가 맑아졌다",
            "동료와 즐겁게 대화했다", "미뤄둔 일을 끝냈다", "맛있는 라멘을 먹었다"};
    private static final String[] GR = {"따뜻한 커피 한 잔", "건강하게 하루를 보낸 것", "도와준 친구", "맑은 날씨", "조용한 저녁 시간"};
    private static final String[] TXT = {"차분하게 시작한 하루. 계획한 일을 하나씩 해냈다.", "조금 피곤했지만 포기하지 않고 끝까지 했다.",
            "새로 배운 것을 정리해 두니 마음이 놓인다.", "오늘은 쉬엄쉬엄. 그래도 한 걸음은 나아갔다.", "눈 덮인 거리를 걸으며 생각을 정리했다."};
    private static final int[] MOOD = {3, 4, 2, 3, 4, 5, 4, 3, 4, 4, 5, 3, 4, 5};
    private static final int[] ENERGY = {3, 3, 2, 3, 4, 4, 5, 3, 3, 4, 4, 2, 4, 4};
    private static final String[][] HABITS = {{"💧", "물 8잔 마시기"}, {"🏃", "운동 30분"}, {"📚", "독서 15분"}, {"🧘", "명상 5분"}};

    private final JdbcTemplate jdbc;

    @Value("${app.demo.enabled:true}")
    private boolean enabled;

    public DemoData(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        if (!enabled) return;
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email=?", Integer.class, EMAIL);
        if (n == null || n == 0) seedUser();
        long uid = jdbc.queryForObject("SELECT id FROM users WHERE email=?", Long.class, EMAIL);
        Integer h = jdbc.queryForObject("SELECT COUNT(*) FROM habits WHERE user_id=?", Integer.class, uid);
        if (h == null || h == 0) seedExtras(uid); // 이전 버전으로 만든 데모 계정에도 새 기능 데이터를 채운다
    }

    private void seedUser() {
        jdbc.update("INSERT INTO users(email,nickname,password,email_verified) VALUES(?,?,?,1)",
                EMAIL, "데모", new BCryptPasswordEncoder().encode("Demo1234!"));
        long uid = jdbc.queryForObject("SELECT id FROM users WHERE email=?", Long.class, EMAIL);
        Random rnd = new Random(7);
        LocalDate today = LocalDateTime.now(U.TOKYO).toLocalDate();
        for (int i = 13; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            int k = 13 - i;
            if (i != 9 && i != 0) { // 9일 전은 비워 두고, 오늘은 직접 기록해 볼 수 있게 비워 둔다
                jdbc.update("INSERT INTO entries(user_id,entry_date,mood,energy,content,highlight,gratitude) VALUES(?,?,?,?,?,?,?)",
                        uid, d, MOOD[k], ENERGY[k], TXT[rnd.nextInt(TXT.length)], HL[rnd.nextInt(HL.length)], GR[rnd.nextInt(GR.length)]);
            }
            int cnt = i == 0 ? 5 : 3 + rnd.nextInt(3);
            for (int j = 0; j < cnt; j++) {
                boolean done = i == 0 ? j < 2 : rnd.nextInt(100) < 75;
                jdbc.update("INSERT INTO tasks(user_id,title,done,priority,task_date,done_at) VALUES(?,?,?,?,?,?)",
                        uid, TASKS[(k * 3 + j) % TASKS.length], done, 1 + (j % 3), d, done ? LocalDateTime.now(U.TOKYO) : null);
            }
        }
    }

    private void seedExtras(long uid) {
        Random rnd = new Random(11);
        LocalDate today = LocalDateTime.now(U.TOKYO).toLocalDate();
        for (String[] hb : HABITS) {
            jdbc.update("INSERT INTO habits(user_id,name,emoji) VALUES(?,?,?)", uid, hb[1], hb[0]);
            long hid = jdbc.queryForObject("SELECT MAX(id) FROM habits WHERE user_id=?", Long.class, uid);
            for (int i = 13; i >= 1; i--)
                if (rnd.nextInt(100) < 72) jdbc.update("INSERT INTO habit_logs(habit_id,log_date) VALUES(?,?)", hid, today.minusDays(i));
        }
        for (int i = 6; i >= 1; i--) {
            jdbc.update("INSERT INTO daily_stats(user_id,stat_date,sleep_hours,water_cups,exercise_min) VALUES(?,?,?,?,?)",
                    uid, today.minusDays(i), 5.5 + rnd.nextInt(5) * 0.5, 3 + rnd.nextInt(6), rnd.nextInt(5) * 15);
            if (rnd.nextBoolean())
                jdbc.update("INSERT INTO focus_sessions(user_id,minutes,label,session_date) VALUES(?,?,?,?)", uid, 25, "", today.minusDays(i));
        }
    }
}
