# 윈도우항공 (window-fare)

김해(PUS) / 김포(GMP)에서 출발해 같은 공항으로 돌아오는 왕복을, 여행 가능 기간 안의 모든 일정 후보로 펼쳐 보여 줍니다.

1주일이면 기본값으로 2~6일(1박2일 ~ 5박6일) 후보를 모두 만들고, 네이버 항공권 실시간 요금으로 싼 것부터 정렬합니다. 각 카드에서 스카이스캐너, 구글 플라이트, 카약, 하나투어, 모두투어, 인터파크, 노랑풍선으로 바로 대조할 수 있습니다.

## Live

- Hostinger VPS: https://flight.srv1821288.hstgr.cloud/

## 로컬

```bash
node server.js
```

브라우저에서 http://127.0.0.1:18080

## VPS

`/docker/window-fare` 에서 docker compose. 기존 `flight.srv1821288.hstgr.cloud` 호스트를 사용합니다.

```bash
ssh -i ~/.ssh/hostinger_id root@76.13.223.98
# 또는 Hostinger 웹 콘솔에서
cd /docker/window-fare && docker compose up -d --build
```
