# 문제 해결

- 시작 실패 시 Render 환경의 `DATABASE_URL`, `SESSION_SECRET`, Node 버전과 로그의 `solvex_startup_failed`를 확인하세요.
- 분석 장애는 운영 페이지의 상태와 한국 시간 기준 한도를 확인하세요. 요청 번호로 `solvex_analysis_failed` 로그를 찾을 수 있습니다.
- 공개 사이트에 버튼이 없으면 정상입니다. 실제 분석은 별도 비공개 성인 검토 환경에서만 열립니다.
- 무료 Render가 절전 중이면 첫 요청이 오래 걸릴 수 있습니다. 재시작 후에도 Postgres 기록은 유지됩니다.
