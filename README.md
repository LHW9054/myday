# My Day 🌤

하루를 **기록**하고, **돌아보고**, 지금 필요한 것을 **추천**받는 웹 앱.
Spring Boot 4 + MySQL + Vanilla JS (kintai 와 같은 구성)

## 기능 (v2)
- 🌐 **한국어 / 日本語 전환** (로그인 화면·사이드바·설정, 에러 메시지·추천·이메일까지 번역)
- ⚡ **가벼운 기본 화면**: 커서 따라다니는 빛·블러·그레인 제거. 설정 > '화려한 효과'로 켤 수 있음
- 🔁 습관 트래커 (7일 점, 연속 일수) · 😴💧🏃 수면/물/운동 · ⏱️ 집중 타이머(뽀모도로, 기록 저장)
- 🗓️ 달력(기분 색상) · 🔎 일기 검색 · 🏅 배지 · 요일별 평균 기분 · 데이터 내보내기(JSON/CSV) · 계정 삭제
- 단축키: 1~6 화면 이동, N 할 일 입력, ⌘/Ctrl+S 기록 저장

## 기능 (v1)
- 회원가입 · **이메일 인증(6자리 코드)** · 로그인/로그아웃 · 비밀번호 재설정 (세션 + BCrypt)
- 오늘 화면: 하루 진행 아크, 할 일 진행 링, 기분/에너지 빠른 체크, 시간대별 추천, 오늘의 질문
- 체크리스트: 날짜 이동, 우선순위, 필터, 미완료 항목 내일로 넘기기, 전부 완료 시 confetti
- 하루 기록: 기분 · 에너지 · 하이라이트 · 감사 · 자유 일기, 지난 기록 타임라인 (⌘/Ctrl+S 저장)
- 인사이트: 주간 요약 문장, 연속 기록, 평균 기분, 완료율, 기분/에너지 차트
- 이메일 리포트: 매일 21:00(JST) 자동 발송 + 설정에서 즉시 테스트
- 화면 전환(View Transitions), 시간대별 하늘 배경(새벽/낮/노을/밤), 로고 클릭 시 시간대 미리보기

## 터미널에서 서버로 실행 + 로그
```bash
chmod +x *.sh mvnw     # 처음 한 번 (실행 권한)
./start.sh             # 빌드 후 백그라운드 서버로 실행 (터미널을 닫아도 계속 동작)
./logs.sh login        # 로그인 기록 실시간 보기  (Ctrl+C 로 종료)
./logs.sh              # 전체 로그      ./logs.sh access (API 접근)   ./logs.sh out (콘솔 출력)
./stop.sh              # 서버 끄기      ./restart.sh (다시 시작)
```
| 파일 | 내용 | 보관 |
|---|---|---|
| `logs/login.log` | 가입·인증·로그인 성공/실패·로그아웃·비밀번호 변경 등 (시각, 이메일, IP, 기기, UA, 세션 해시) | 90일 |
| `logs/myday.log` | 서버 전체 로그 (로그인 기록 포함) | 30일 |
| `logs/access.log` | /api 요청마다 1줄 (메서드, 경로, 상태, 시간, 사용자 id, IP) | 14일 |
| DB `login_logs` | 같은 로그인 기록 (설정 화면 '최근 로그인 기록'에 표시) | 계속 |

- **비밀번호, 인증 코드, 세션 ID 원문은 기록하지 않아요.** 최근 10분 안에 같은 이메일로 5번 이상 실패하면 `BRUTE_FORCE_SUSPECT` 경고가 남아요.
- 같은 와이파이의 아이폰으로 접속하면 IP가 `192.168.x.x` 로 찍혀요.

## 실행 (개발용: 터미널에 바로 출력)
1. MySQL 실행. DB 비밀번호는 `local.properties.example` 을 `local.properties` 로 복사해 입력 (또는 환경변수 `DB_PASSWORD`)
   - `myday_db` 와 테이블은 **자동 생성**됩니다.
2. 프로젝트 폴더에서
   ```bash
   ./mvnw spring-boot:run
   ```
3. http://localhost:8090 접속 (kintai 가 8080 이라 포트를 8090 으로 했어요)
4. **체험 계정**: `demo@myday.app` / `Demo1234!` (2주치 샘플 데이터 포함)

## 이메일 설정
- 기본은 **개발 모드**: 메일 대신 서버 콘솔에 내용이 찍히고, 인증 코드는 화면에도 표시돼요.
- 실제 발송: `local.properties.example` 을 `local.properties` 로 복사해 SMTP 정보를 입력 (Gmail 은 앱 비밀번호).

## 구조
```
src/main/java/com/myday   Controller / Service (JdbcTemplate)
src/main/resources        schema.sql, application.properties
src/main/resources/static index.html, app.css, app.js (SPA)
```
