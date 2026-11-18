#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
./stop.sh && ./start.sh
