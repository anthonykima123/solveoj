# SOLVEX 저장소 안내

SOLVEX는 수학 증명과 알고리즘의 사고 과정을 검토하는 올림피아드 학습 플랫폼이다. Express, EJS, 인증 및 Postgres 기록을 사용한다.

- `server.js`에서 SOLVEX와 기존 경로를 연결한다. 학습 대시보드는 `/dashboard`다.
- `solvex/router.js`에서 Math/Code Lens, 분석 기록 및 운영 도구를 관리한다.
- `solvex/provider.js`에서 Gemini 요청과 응답 검증을 처리한다. `solvex/examples.js`에는 공개용 고정 예시가 들어 있다.
- `solvex/store.js`가 별도 Postgres 분석 테이블과 사용량 제한을 관리한다.
- `views/solvex`, `public/css/solvex.css`, `public/js/solvex.js`는 새 UI다. 기존 문제·제출·대회는 `routes`와 `views`에서 유지한다.
- `database.js`, `jsondb.js`, `pgstore.js`에 기존 사용자, 문제, 제출 및 대회 데이터가 있다. 운영 데이터의 일괄 삭제, 초기화, 예시 계정·가짜 판정 삽입을 하지 않는다.

`npm ci`, `npm run check`, `npm test`를 사용한다. 테스트에는 운영 연결 정보를 전달하지 않는다. 공개 Gemini를 켜지 않는다. API 키, DB 연결 정보, 사용자 풀이를 로그나 Git에 남기지 않는다. 코드 실행은 격리 환경이 검증될 때까지 비활성화 상태를 유지한다.

검토용 브랜치에 커밋하고 자동 배포가 걸린 운영 브랜치에는 운영자 승인 후 반영한다. 배포와 복구는 [배포 안내](docs/DEPLOYMENT.md)를 따른다.

데모 제공 범위는 홈, 두 분석실의 고정 예시, 입력 화면, 기존 인증·문제·대회·기록, 비공개 AI 연결, 분석 이력과 운영 페이지다. 수학 문제 DB, LaTeX 렌더링, 재제출 비교, 격리 실행과 부분 점수, 검증된 반례 생성, Insights, Library 및 신규 Arena는 후속 단계다.
