# AI 평가

## 무료 공개 문제 힌트

공개 문제 페이지의 **AI 풀이 방향**은 Cloudflare Workers AI의 `@cf/openai/gpt-oss-120b`를 사용합니다. Workers Free 계정에서 Workers AI를 사용할 수 있는 API 토큰을 발급하고 기존 Render 서비스에 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `FREE_AI_HINTS_ENABLED=true`를 추가합니다. 유료 Workers 플랜이나 유료 AI Gateway를 연결하지 않습니다. [무료 한도](https://developers.cloudflare.com/workers-ai/platform/pricing/)

슈퍼 관리자만 생성할 수 있습니다. 생성 전 전송 동의가 필요하며, Cloudflare에 공개 문제 본문만 보냅니다. 풀이 제출 기록과 비공개 문제는 포함하지 않습니다. 문제 본문이 바뀌기 전까지 저장된 결과를 재사용합니다.

## OpenAI 서버 분석 시작하기

OpenAI 서버 분석은 승인된 성인 검토 계정으로 시작합니다. OpenAI 프로젝트에 서비스용 API 키를 만들고 Render의 **기존 solveoj 서비스 → Environment**에서 아래 값을 입력합니다. 프로젝트의 결제·크레딧과 사용량이 별도로 적용됩니다. 키는 채팅, GitHub, 클라이언트 코드에 적지 않습니다.

| Key | Value |
| --- | --- |
| `AI_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | OpenAI 프로젝트 API 키 |
| `OPENAI_MODEL` | `gpt-6.2-sol` (옵션, 기본값) |
| `OPENAI_REVIEWER_IDS` | 승인한 성인 검토 계정의 번호 목록. 내 번호는 슈퍼 관리자 로그인 후 `/admin/solvex`에서 확인 |
| `AI_ENABLED` | 사용량과 비용에 동의하고 활성화할 때 `true` |

기존 `DATABASE_URL`을 유지하세요. 먼저 승인된 본인만 연결하고, 실제 호스팅에서 개인정보 없는 짧은 증명 하나로 확인하세요. 기본 한도는 사용자당 하루 3회, 전체 하루 20회입니다. `AI_DAILY_GLOBAL_LIMIT`을 낮춰 시작할 수 있습니다. OpenAI 프로젝트의 월 예산 알림은 앱의 요청 제한과 별개입니다. [시작 가이드](https://developers.openai.com/api/docs/quickstart) · [API 가격](https://developers.openai.com/api/docs/pricing)

전송 동의가 없거나 승인 목록에 없는 요청은 OpenAI에 전달하지 않습니다. 사진은 OpenAI 분석에서 지원하지 않습니다. OpenAI 요청의 `store:false`는 별도 Zero Data Retention 승인과 동일하지 않습니다. 성인 검토자만 승인하고 미성년자의 개인정보를 보내지 마세요. [데이터 제어 안내](https://developers.openai.com/api/docs/guides/your-data)

공개 분석실은 브라우저의 WebGPU에서 Qwen2.5-1.5B-Instruct를 실행합니다. 로그인, API 키, 성인 인증 없이 직접 입력한 텍스트를 분석하며 입력과 결과를 서버로 보내거나 저장하지 않습니다. 첫 실행 시 Hugging Face에서 모델 파일을 내려받으므로 네트워크와 그래픽 메모리가 필요합니다. 공개 분석은 텍스트 입력을 지원하며 결과는 공식 점수가 아닙니다. 모델 로딩 실패 시 고정 예시를 확인할 수 있습니다.

웹 앱은 npm에 고정한 WebLLM 런타임을 같은 출처에서 전송합니다. 모델은 별도 브라우저 작업 스레드에서 실행합니다. 공개 배포에 AI API 환경 변수나 별도 서버는 필요 없습니다.

공개 데모에서는 Gemini가 꺼져 있습니다. [Gemini API 추가 약관](https://ai.google.dev/gemini-api/terms)은 미성년자가 이용할 가능성이 높은 서비스에서 사용을 제한하고, 무료 API 처리 과정에서 제출 내용이 제품 개선 및 검토에 사용될 수 있다고 설명합니다.

실제 호출은 별도 비공개 성인 검토 환경에서만 하세요. 운영 DB 대신 검증 전용 Postgres, 성인 검토 계정 ID 목록 `GEMINI_REVIEWER_IDS`, 비공개 주소 `APP_BASE_URL`, `AI_ENABLED=true`, `GEMINI_PRIVATE_REVIEW=true`, `GEMINI_API_KEY`, 프로젝트에서 사용 가능한 `GEMINI_MODEL`을 설정합니다. 결제 수단이나 유료 쿼터를 임의로 연결하지 않습니다. 공개 주소에서는 설정을 바꾸어도 Gemini가 열리지 않습니다.

모델에는 문제, 입력, 맥락과 선택한 이미지가 전송됩니다. 사진은 PNG/JPEG 1MB로 제한하며 원본을 저장하지 않습니다. 평가에는 점수 범위, 오류 위치, 근거, 수정 방향, 단계별 힌트와 불확실성이 포함됩니다. 사진 인식 내용은 결과 화면에서 확인하고 텍스트로 고쳐 다시 입력할 수 있습니다. 코드는 실행 없이 분석되고 반례는 미검증으로 표시됩니다. [구조화 응답](https://ai.google.dev/gemini-api/docs/structured-output) · [이미지 입력](https://ai.google.dev/gemini-api/docs/image-understanding)

실제 모델 평가를 승인한 뒤에는 올바른 증명, 다른 올바른 접근, 계산 오류, 핵심 발상만 제시, 논리적 비약, 정리 조건 누락, 틀린 결론, 사진 인식 오류를 각각 사람이 검토하고 결과를 기록하세요. 현재 자동 테스트는 모의 응답을 사용합니다.
