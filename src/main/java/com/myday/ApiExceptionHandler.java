package com.myday;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    /** 한국어 메시지 -> 일본어 (요청 헤더 X-Lang: ja 일 때 사용) */
    private static final Map<String, String> JA = Map.ofEntries(
            Map.entry("로그인이 필요해요.", "ログインが必要です。"),
            Map.entry("날짜 형식이 올바르지 않아요.", "日付の形式が正しくありません。"),
            Map.entry("메일을 보내지 못했어요. SMTP 설정(local.properties)을 확인해 주세요.", "メールを送信できませんでした。SMTP設定(local.properties)を確認してください。"),
            Map.entry("닉네임은 1~20자로 입력해 주세요.", "ニックネームは1〜20文字で入力してください。"),
            Map.entry("이미 가입된 이메일이에요.", "このメールアドレスはすでに登録されています。"),
            Map.entry("이메일 또는 비밀번호가 올바르지 않아요.", "メールアドレスまたはパスワードが正しくありません。"),
            Map.entry("이메일 형식이 올바르지 않아요.", "メールアドレスの形式が正しくありません。"),
            Map.entry("비밀번호는 8자 이상, 영문과 숫자를 포함해 주세요.", "パスワードは8文字以上で、英字と数字を含めてください。"),
            Map.entry("코드가 만료됐거나 없어요. 새 코드를 받아 주세요.", "コードが期限切れか見つかりません。新しいコードを取得してください。"),
            Map.entry("시도 횟수를 넘었어요. 새 코드를 받아 주세요.", "試行回数を超えました。新しいコードを取得してください。"),
            Map.entry("코드가 일치하지 않아요.", "コードが一致しません。"),
            Map.entry("현재 비밀번호가 올바르지 않아요.", "現在のパスワードが正しくありません。"),
            Map.entry("비밀번호가 올바르지 않아요.", "パスワードが正しくありません。"),
            Map.entry("할 일은 1~200자로 입력해 주세요.", "タスクは1〜200文字で入力してください。"),
            Map.entry("할 일을 찾을 수 없어요.", "タスクが見つかりません。"),
            Map.entry("기분과 에너지는 1~5 사이로 골라 주세요.", "気分とエネルギーは1〜5で選んでください。"),
            Map.entry("기록은 5000자까지 쓸 수 있어요.", "記録は5000文字まで書けます。"),
            Map.entry("하이라이트와 감사한 일은 200자까지예요.", "ハイライトと感謝は200文字までです。"),
            Map.entry("습관 이름은 1~100자로 입력해 주세요.", "習慣名は1〜100文字で入力してください。"),
            Map.entry("습관은 최대 20개까지 만들 수 있어요.", "習慣は最大20個まで作れます。"),
            Map.entry("습관을 찾을 수 없어요.", "習慣が見つかりません。"),
            Map.entry("수면은 0~24시간, 물은 0~30잔, 운동은 0~600분 사이로 입력해 주세요.", "睡眠は0〜24時間、水は0〜30杯、運動は0〜600分で入力してください。"),
            Map.entry("집중 시간은 1~180분 사이여야 해요.", "集中時間は1〜180分の間にしてください。"),
            Map.entry("월 형식이 올바르지 않아요.", "月の形式が正しくありません。")
    );

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> api(ApiException e, HttpServletRequest req) {
        String m = e.getMessage();
        if (U.ja(req.getHeader("X-Lang"))) m = JA.getOrDefault(m, m);
        return ResponseEntity.status(e.status).body(Map.of("message", m));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> other(Exception e, HttpServletRequest req) {
        log.error("Unhandled error", e);
        String m = U.ja(req.getHeader("X-Lang"))
                ? "サーバーで問題が発生しました。しばらくしてからもう一度お試しください。"
                : "서버에서 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
        return ResponseEntity.status(500).body(Map.of("message", m));
    }
}
