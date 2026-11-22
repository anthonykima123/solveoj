# 기존 Render 서비스 배포

1. 변경 브랜치를 검토하고 CI를 통과시킵니다. 운영 배포는 운영자가 승인한 후 진행합니다.
2. 기존 Render 서비스에서 Postgres `DATABASE_URL`을 유지하고 백업을 확보합니다. 비밀값은 Render 환경 변수에 둡니다.
3. `NODE_ENV=production`, 32자 이상 무작위 `SESSION_SECRET`, `APP_BASE_URL=https://solveoj.onrender.com`, `AI_ENABLED=false`를 설정합니다. 기존 세션 비밀값이 32자 미만이면 교체 후 다시 로그인해야 합니다.
4. 같은 Render 서비스의 연결된 운영 브랜치에 변경을 반영합니다. 설치 `npm ci`, 시작 `npm start`, 상태 경로 `/health`입니다. 새 서비스를 만들 필요가 없습니다.
5. 배포 후 홈과 두 예시, 기존 계정 로그인, 기존 문제와 제출 기록, 관리자 접근 권한을 확인합니다. 장애 시 이전 배포를 선택하고 DB 연결은 유지합니다. 이전 버전은 서버 직접 코드 실행 경로를 다시 열 수 있으므로 롤백 전에 그 노출도 검토하세요.

[Render 무료 플랜](https://render.com/docs/free)은 유휴 시 절전되고 로컬 파일 보존을 지원하지 않습니다. 공개 예시는 모델 호출 비용이 없습니다. 기존 무료 인프라의 사용 한도를 확인하세요.

향후 자체 도메인을 구입했다면 기존 Render 서비스에서 Custom Domain을 추가하고, Render가 표시하는 DNS 기록을 Cloudflare에 맞춘 뒤 HTTPS 동작을 확인하세요. 도메인 전환 후 `APP_BASE_URL`도 같은 주소로 설정합니다.
