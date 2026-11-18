#!/usr/bin/env bash
# My Day 서버 중지
cd "$(dirname "$0")" || exit 1
[ -f myday.pid ] || { echo "실행 중인 서버가 없어요."; exit 0; }
PID=$(cat myday.pid)
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  for i in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$PID" 2>/dev/null && kill -9 "$PID"
  echo "■ 서버를 껐어요."
else
  echo "이미 꺼져 있어요."
fi
rm -f myday.pid
