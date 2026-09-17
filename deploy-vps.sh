#!/bin/bash
set -euo pipefail
HOST=flight.srv1821288.hstgr.cloud
DEST=/docker/window-fare
REPO=https://github.com/kanraaac/window-fare.git
mkdir -p /docker
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin
  git -C "$DEST" reset --hard origin/main
else
  rm -rf "$DEST"
  git clone "$REPO" "$DEST"
fi
cd "$DEST"
docker compose up -d --build
sleep 2
curl -sS -o /dev/null -w "local:%{http_code}\n" "http://127.0.0.1:18080/"
curl -sS -o /dev/null -w "https:%{http_code}\n" "https://${HOST}/" || true
