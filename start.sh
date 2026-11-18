#!/usr/bin/env bash
# My Day 서버를 터미널을 닫아도 계속 도는 백그라운드 서버로 실행합니다. (로그: logs/)
cd "$(dirname "$0")" || exit 1
mkdir -p logs
if [ -f myday.pid ] && kill -0 "$(cat myday.pid)" 2>/dev/null; then
  echo "이미 실행 중이에요 (PID $(cat myday.pid)).  ./stop.sh 로 끌 수 있어요."; exit 0
fi
echo "▶ 빌드 중... (처음엔 몇 분 걸려요)"
./mvnw -q -DskipTests package || { echo "✖ 빌드 실패. 위 메시지를 확인해 주세요."; exit 1; }
JAR=$(ls target/myday-*.jar 2>/dev/null | head -n1)
[ -z "$JAR" ] && { echo "✖ jar 파일을 찾지 못했어요."; exit 1; }
nohup java -Dfile.encoding=UTF-8 -Duser.timezone=Asia/Tokyo -jar "$JAR" > logs/server.out 2>&1 &
echo $! > myday.pid
# 서버가 도는 동안 맥이 잠자기에 들어가지 않게 함 (서버가 꺼지면 같이 종료)
command -v caffeinate >/dev/null && caffeinate -i -w "$(cat myday.pid)" >/dev/null 2>&1 &
echo -n "▶ 시작 중"
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:8090/; then echo; echo "✔ 실행 중 (PID $(cat myday.pid))  →  http://localhost:8090"; break; fi
  kill -0 "$(cat myday.pid)" 2>/dev/null || { echo; echo "✖ 서버가 바로 종료됐어요. ./logs.sh out 으로 원인을 확인해 주세요."; rm -f myday.pid; exit 1; }
  echo -n "."; sleep 1
done
echo "  로그 보기:  ./logs.sh          (전체)"
echo "              ./logs.sh login    (로그인 기록)"
echo "              ./logs.sh access   (API 접근 기록)"
