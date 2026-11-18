#!/usr/bin/env bash
# 사용법: ./logs.sh [app|login|access|out]   (Ctrl+C 로 종료)
cd "$(dirname "$0")" || exit 1
case "${1:-app}" in
  login)  tail -n 50 -F logs/login.log ;;
  access) tail -n 50 -F logs/access.log ;;
  out)    tail -n 100 -F logs/server.out ;;
  *)      tail -n 100 -F logs/myday.log ;;
esac
