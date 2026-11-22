# AI 평가

공개 데모에서는 Gemini가 꺼져 있습니다. [Gemini API 추가 약관](https://ai.google.dev/gemini-api/terms)은 미성년자가 이용할 가능성이 높은 서비스에서 사용을 제한하고, 무료 API 처리 과정에서 제출 내용이 제품 개선 및 검토에 사용될 수 있다고 설명합니다.

실제 호출은 별도 비공개 성인 검토 환경에서만 하세요. 운영 DB 대신 검증 전용 Postgres, 성인 검토 계정 ID 목록 `GEMINI_REVIEWER_IDS`, 비공개 주소 `APP_BASE_URL`, `AI_ENABLED=true`, `GEMINI_PRIVATE_REVIEW=true`, `GEMINI_API_KEY`, 프로젝트에서 사용 가능한 `GEMINI_MODEL`을 설정합니다. 결제 수단이나 유료 쿼터를 임의로 연결하지 않습니다. 공개 주소에서는 설정을 바꾸어도 Gemini가 열리지 않습니다.

모델에는 문제, 입력, 맥락과 선택한 이미지가 전송됩니다. 사진은 PNG/JPEG 1MB로 제한하며 원본을 저장하지 않습니다. 평가에는 점수 범위, 오류 위치, 근거, 수정 방향, 단계별 힌트와 불확실성이 포함됩니다. 사진 인식 내용은 결과 화면에서 확인하고 텍스트로 고쳐 다시 입력할 수 있습니다. 코드는 실행 없이 분석되고 반례는 미검증으로 표시됩니다. [구조화 응답](https://ai.google.dev/gemini-api/docs/structured-output) · [이미지 입력](https://ai.google.dev/gemini-api/docs/image-understanding)

실제 모델 평가를 승인한 뒤에는 올바른 증명, 다른 올바른 접근, 계산 오류, 핵심 발상만 제시, 논리적 비약, 정리 조건 누락, 틀린 결론, 사진 인식 오류를 각각 사람이 검토하고 결과를 기록하세요. 현재 자동 테스트는 모의 응답을 사용합니다.
