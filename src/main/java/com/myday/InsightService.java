package com.myday;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

/** 주간 요약 · 연속 기록 · 오늘의 추천을 계산한다 (규칙 기반, 한국어/일본어) */
@Service
public class InsightService {
    private static final String[] DOW_KO = {"월", "화", "수", "목", "금", "토", "일"};
    private static final String[] DOW_JA = {"月", "火", "水", "木", "金", "土", "日"};
    private static final String[] Q_KO = {
            "오늘 나를 가장 웃게 만든 순간은 무엇이었나요?", "오늘 내가 잘 해낸 일 한 가지는?",
            "지금 마음속에 남아 있는 생각을 한 줄로 적어 본다면?", "내일의 나에게 부탁하고 싶은 것은 무엇인가요?",
            "오늘 새롭게 배운 것이 있다면?", "오늘 에너지를 가장 많이 쓴 일은 무엇이었나요?",
            "오늘 고마웠던 사람이나 일이 있다면?", "지금 가장 기대되는 것은 무엇인가요?",
            "오늘 하루를 색깔로 표현한다면 어떤 색일까요?", "오늘 미뤄둔 일이 있다면, 그 이유는 무엇일까요?",
            "오늘 나를 위해 한 작은 행동은?", "이번 주에 꼭 지키고 싶은 한 가지는?",
            "오늘 들은 말 중 마음에 남은 한마디는?", "내일 아침의 나는 어떤 모습이면 좋겠나요?"};
    private static final String[] Q_JA = {
            "今日あなたを一番笑顔にした瞬間は何でしたか？", "今日うまくできたことを一つ挙げるなら？",
            "今、心に残っている思いを一行で書くと？", "明日の自分にお願いしたいことは？",
            "今日新しく学んだことはありますか？", "今日いちばんエネルギーを使ったことは何でしたか？",
            "今日感謝したい人やできごとはありますか？", "今いちばん楽しみにしていることは？",
            "今日一日を色で表すと何色ですか？", "今日後回しにしたことがあれば、その理由は？",
            "今日自分のためにした小さな行動は？", "今週どうしても守りたいことを一つ挙げるなら？",
            "今日聞いた言葉で心に残ったものは？", "明日の朝の自分はどんな姿でいたいですか？"};

    private final JdbcTemplate jdbc;

    public InsightService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static String t(boolean ja, String ko, String jp) {
        return ja ? jp : ko;
    }

    private int count(String sql, Object... args) {
        Integer n = jdbc.queryForObject(sql, Integer.class, args);
        return n == null ? 0 : n;
    }

    public Map<String, Object> build(long uid, LocalDate today, int hour, String lang) {
        final boolean ja = U.ja(lang);
        final String[] dow = ja ? DOW_JA : DOW_KO;
        LocalDate from = today.minusDays(6);

        // 최근 7일 할 일 집계
        Map<LocalDate, int[]> tk = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT task_date AS d, COUNT(*) AS c, COALESCE(SUM(done),0) AS s FROM tasks "
                        + "WHERE user_id=? AND task_date BETWEEN ? AND ? GROUP BY task_date", uid, from, today))
            tk.put(U.ld(r.get("d")), new int[]{((Number) r.get("c")).intValue(), ((Number) r.get("s")).intValue()});

        // 최근 7일 기분 / 에너지
        Map<LocalDate, int[]> en = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT entry_date AS d, mood, energy FROM entries WHERE user_id=? AND entry_date BETWEEN ? AND ?", uid, from, today))
            en.put(U.ld(r.get("d")), new int[]{((Number) r.get("mood")).intValue(), ((Number) r.get("energy")).intValue()});

        List<Map<String, Object>> days = new ArrayList<>();
        int totalT = 0, doneT = 0, moodN = 0, moodSum = 0, enSum = 0;
        List<Integer> moods = new ArrayList<>();
        Map<String, Object> best = null;
        for (int i = 0; i < 7; i++) {
            LocalDate d = from.plusDays(i);
            int[] tt = tk.getOrDefault(d, new int[]{0, 0});
            int[] e = en.get(d);
            String label = dow[d.getDayOfWeek().getValue() - 1];
            totalT += tt[0];
            doneT += tt[1];
            if (e != null) {
                moodN++;
                moodSum += e[0];
                enSum += e[1];
                moods.add(e[0]);
                if (best == null || e[0] > (Integer) best.get("mood"))
                    best = U.m("date", d.toString(), "label", label, "mood", e[0]);
            }
            days.add(U.m("date", d.toString(), "label", label, "mood", e == null ? null : e[0],
                    "energy", e == null ? null : e[1], "total", tt[0], "done", tt[1]));
        }
        double avgMood = moodN == 0 ? 0 : Math.round(moodSum * 10.0 / moodN) / 10.0;
        double avgEnergy = moodN == 0 ? 0 : Math.round(enSum * 10.0 / moodN) / 10.0;
        int rate = totalT == 0 ? 0 : (int) Math.round(doneT * 100.0 / totalT);

        // 요일별 평균 기분(최근 90일, 월요일부터)
        double[] ws = new double[7];
        int[] wc = new int[7];
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT entry_date AS d, mood FROM entries WHERE user_id=? AND entry_date>=?", uid, today.minusDays(89))) {
            int wd = U.ld(r.get("d")).getDayOfWeek().getValue() - 1;
            ws[wd] += ((Number) r.get("mood")).intValue();
            wc[wd]++;
        }
        List<Double> weekday = new ArrayList<>();
        for (int i = 0; i < 7; i++) weekday.add(wc[i] == 0 ? 0.0 : Math.round(ws[i] * 10.0 / wc[i]) / 10.0);

        // 연속 기록(기록 · 완료한 할 일 · 체크한 습관이 있는 날)
        Set<LocalDate> active = new HashSet<>();
        LocalDate since = today.minusDays(120);
        for (Map<String, Object> r : jdbc.queryForList("SELECT entry_date AS d FROM entries WHERE user_id=? AND entry_date>=?", uid, since))
            active.add(U.ld(r.get("d")));
        for (Map<String, Object> r : jdbc.queryForList("SELECT DISTINCT task_date AS d FROM tasks WHERE user_id=? AND done=1 AND task_date>=?", uid, since))
            active.add(U.ld(r.get("d")));
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT DISTINCT l.log_date AS d FROM habit_logs l JOIN habits h ON h.id=l.habit_id WHERE h.user_id=? AND l.log_date>=?", uid, since))
            active.add(U.ld(r.get("d")));
        int streak = 0;
        LocalDate cur = active.contains(today) ? today : today.minusDays(1);
        while (active.contains(cur)) {
            streak++;
            cur = cur.minusDays(1);
        }

        int entryCount = count("SELECT COUNT(*) FROM entries WHERE user_id=?", uid);
        int doneAll = count("SELECT COUNT(*) FROM tasks WHERE user_id=? AND done=1", uid);
        int focusAll = count("SELECT COALESCE(SUM(minutes),0) FROM focus_sessions WHERE user_id=?", uid);
        int focusWeek = count("SELECT COALESCE(SUM(minutes),0) FROM focus_sessions WHERE user_id=? AND session_date BETWEEN ? AND ?", uid, from, today);
        int habitsTotal = count("SELECT COUNT(*) FROM habits WHERE user_id=?", uid);
        int habitsDone = count("SELECT COUNT(*) FROM habit_logs l JOIN habits h ON h.id=l.habit_id WHERE h.user_id=? AND l.log_date=?", uid, today);
        List<Map<String, Object>> wr = jdbc.queryForList("SELECT water_cups FROM daily_stats WHERE user_id=? AND stat_date=?", uid, today);
        int water = wr.isEmpty() ? 0 : ((Number) wr.get(0).get("water_cups")).intValue();

        // 오늘 상태
        int[] te = en.get(today);
        int[] tt = tk.getOrDefault(today, new int[]{0, 0});
        String topPending = null;
        List<Map<String, Object>> pend = jdbc.queryForList(
                "SELECT title FROM tasks WHERE user_id=? AND task_date=? AND done=0 ORDER BY priority, id LIMIT 1", uid, today);
        if (!pend.isEmpty()) topPending = String.valueOf(pend.get(0).get("title"));
        Map<String, Object> todayInfo = U.m("mood", te == null ? null : te[0], "energy", te == null ? null : te[1],
                "total", tt[0], "done", tt[1]);

        // 요약 문장
        String summary;
        if (moodN == 0 && totalT == 0) {
            summary = t(ja, "아직 최근 7일의 기록이 없어요. 오늘의 기분과 할 일을 남기면 여기에 나만의 요약이 만들어져요.",
                    "直近7日間の記録はまだありません。今日の気分とやることを残すと、ここにあなただけのまとめが作られます。");
        } else {
            StringBuilder sb = new StringBuilder(t(ja, "최근 7일 동안 ", "直近7日間で、"));
            if (moodN > 0) sb.append(String.format(Locale.ROOT, t(ja, "평균 기분은 %.1f/5, ", "平均気分は%.1f/5、"), avgMood));
            if (totalT > 0)
                sb.append(String.format(Locale.ROOT, t(ja, "할 일 %d개 중 %d개를 끝내 완료율은 %d%%예요. ", "タスク%d件中%d件を終えて、完了率は%d%%です。"), totalT, doneT, rate));
            else sb.append(t(ja, "기록을 남겼어요. ", "記録を残しました。"));
            if (best != null && moodN >= 2)
                sb.append(t(ja, "가장 기분이 좋았던 날은 " + best.get("label") + "요일이었어요. ",
                        "いちばん気分が良かったのは" + best.get("label") + "曜日でした。"));
            if (moods.size() >= 4) {
                int h = moods.size() / 2;
                double a = moods.subList(0, h).stream().mapToInt(x -> x).average().orElse(0);
                double b = moods.subList(moods.size() - h, moods.size()).stream().mapToInt(x -> x).average().orElse(0);
                if (b - a >= 0.5) sb.append(t(ja, "기분이 점점 올라가는 흐름이에요 📈 ", "気分が少しずつ上向いています 📈 "));
                else if (a - b >= 0.5)
                    sb.append(t(ja, "요즘 조금 지친 흐름이에요. 쉬어가는 시간도 챙겨 주세요 🌿 ", "最近は少しお疲れ気味です。休む時間も大切にしてくださいね 🌿 "));
            }
            if (streak >= 2) sb.append(t(ja, streak + "일 연속으로 하루를 챙기고 있어요.", streak + "日連続で一日を大切にしています。"));
            summary = sb.toString().trim();
        }

        // 지금 시간·상태에 맞는 추천 (우선순위 순)
        List<Map<String, Object>> recs = new ArrayList<>();
        Integer mood = te == null ? null : te[0], energy = te == null ? null : te[1];
        if ((mood != null && mood <= 2) || (energy != null && energy <= 2))
            recs.add(rec("🌿", t(ja, "회복 모드", "回復モード"), t(ja, "10분 산책이나 따뜻한 차 한 잔으로 천천히 시작해요. 오늘은 가벼운 일부터요.", "10分の散歩や温かいお茶でゆっくり始めましょう。今日は軽いことからで大丈夫です。")));
        else if (energy != null && energy >= 4)
            recs.add(rec("🔥", t(ja, "딥워크 타임", "ディープワークタイム"), t(ja, "에너지가 좋을 때예요. 가장 중요한 일 하나를 90분 동안 집중해서 끝내 보세요.", "エネルギーが高い今がチャンス。いちばん大事なことを90分集中して終わらせましょう。")));
        if (topPending != null && tt[0] > 0)
            recs.add(rec("🎯", t(ja, "지금 하나만 한다면", "今ひとつだけやるなら"), t(ja, "‘" + topPending + "’ 부터 끝내 볼까요?", "「" + topPending + "」から片づけてみませんか？")));
        if (tt[0] > 0 && tt[1] == tt[0])
            recs.add(rec("🎉", t(ja, "오늘 올 클리어!", "今日はオールクリア！"), t(ja, "계획한 일을 모두 끝냈어요. 스스로를 충분히 칭찬해 주세요.", "予定をすべて終えました。自分をたっぷり褒めてあげてくださいね。")));
        if (hour < 10)
            recs.add(rec("🌅", t(ja, "아침 시동 걸기", "朝のスタート"), t(ja, "물 한 잔과 5분 스트레칭, 그리고 오늘의 TOP 3를 정해 보세요.", "水を一杯飲んで5分ストレッチ。今日のTOP3を決めてみましょう。")));
        else if (hour < 14)
            recs.add(rec("☀️", t(ja, "점심 전 집중 블록", "お昼前の集中ブロック"), t(ja, "산만해지기 전에 오전 중요한 일을 마무리해 두면 오후가 가벼워져요.", "気が散る前に午前中の大事なことを終えておくと、午後が軽くなります。")));
        else if (hour < 18)
            recs.add(rec("☕", t(ja, "오후 리프레시", "午後のリフレッシュ"), t(ja, "졸음이 올 시간이에요. 자리에서 일어나 5분만 걷고 와 보세요.", "眠くなる時間です。席を立って5分だけ歩いてきましょう。")));
        else if (hour < 21)
            recs.add(rec("🍽️", t(ja, "저녁 정리 시간", "夕方の整理時間"), t(ja, "일정을 마무리하고 따뜻한 저녁으로 하루의 속도를 낮춰 보세요.", "予定を片づけて、温かい夕食で一日のペースを落としましょう。")));
        else
            recs.add(rec("🌙", t(ja, "하루 마무리", "一日の締めくくり"), t(ja, "3줄 일기를 쓰고, 끝내지 못한 일은 내일로 넘겨 두세요.", "3行日記を書いて、終わらなかったことは明日に回しておきましょう。")));
        if (habitsTotal > habitsDone && hour >= 12)
            recs.add(rec("🔁", t(ja, "남은 습관", "残りの習慣"), t(ja, "오늘 남은 습관이 " + (habitsTotal - habitsDone) + "개예요. 잊기 전에 체크해 보세요.", "今日の残りの習慣は" + (habitsTotal - habitsDone) + "個です。忘れないうちにチェックしましょう。")));
        if (water < 4 && hour >= 12)
            recs.add(rec("💧", t(ja, "수분 보충", "水分補給"), t(ja, "오늘은 물을 " + water + "잔 마셨어요. 틈틈이 마셔 보세요.", "今日はまだ水を" + water + "杯。こまめに飲みましょう。")));
        if (mood == null)
            recs.add(rec("📝", t(ja, "오늘의 기분 체크", "今日の気分チェック"), t(ja, "기분을 기록하면 주간 요약이 더 정확해져요.", "気分を記録すると、週のまとめがより正確になります。")));
        if (streak >= 3)
            recs.add(rec("⚡", t(ja, streak + "일 연속 기록 중", streak + "日連続で記録中"), t(ja, "오늘도 기록하면 " + (streak + 1) + "일째예요. 이 흐름을 이어가 봐요.", "今日も記録すれば" + (streak + 1) + "日目です。この流れを続けましょう。")));
        if (recs.size() > 4) recs = new ArrayList<>(recs.subList(0, 4));

        String[] qs = ja ? Q_JA : Q_KO;
        String question = qs[today.getDayOfYear() % qs.length];

        Map<String, Object> out = U.m("days", days, "avgMood", avgMood, "avgEnergy", avgEnergy, "rate", rate,
                "totalTasks", totalT, "doneTasks", doneT, "streak", streak, "entryCount", entryCount,
                "best", best, "today", todayInfo, "summary", summary, "recs", recs, "question", question);
        out.put("doneAll", doneAll);
        out.put("focusAll", focusAll);
        out.put("focusWeek", focusWeek);
        out.put("habitsTotal", habitsTotal);
        out.put("habitsDone", habitsDone);
        out.put("weekday", weekday);
        return out;
    }

    private static Map<String, Object> rec(String icon, String title, String desc) {
        return U.m("icon", icon, "title", title, "desc", desc);
    }
}
