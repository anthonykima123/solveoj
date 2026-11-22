# SOLVEX · Beyond the Answer.

수학 증명의 논리적 결함과 알고리즘의 취약점을 살펴보는 수학·정보올림피아드 학습 플랫폼 데모입니다. 기존 SolveOJ 저장소와 Render 주소를 유지합니다.

## 로컬에서 열기

Node.js 22 이상에서 `npm ci` 후 `npm start`를 실행하고 [localhost:3000](http://localhost:3000)을 엽니다. 기존 계정을 다루는 테스트에는 별도 임시 저장소를 사용하세요. 빈 개발 DB에서 테스트 계정을 직접 가입할 수 있습니다.

- [Math Lens 예시](http://localhost:3000/lens/math?example=1)
- [Code Lens 예시](http://localhost:3000/lens/code?example=1)
- 기존 문제 `/problems/all`, 내 제출 `/submissions`, 대회 `/contests`, 기존 홈 `/classic`
- 분석 기록 `/analysis-history`, 슈퍼 관리자 운영 `/admin/solvex`

`npm run check`로 문법을 확인하고 `npm test`로 주요 경로를 검증합니다.

## 환경 변수

[.env.example](.env.example)을 참고하세요. 로컬에서 파일을 복사했다면 `node --env-file=.env server.js`로 시작하세요. 공개 데모는 Gemini 키 없이 작동합니다. 비공개 성인 검토 환경에만 [AI 설정](docs/AI_GRADING.md)을 사용합니다.

기존 Render 서비스와 Postgres를 유지하는 절차는 [배포 안내](docs/DEPLOYMENT.md)에 있습니다. 데이터, 운영, 보안, 장애 대응 문서는 [docs](docs/)에서 확인할 수 있습니다.
