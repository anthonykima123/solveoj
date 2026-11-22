# 구조

Express가 기존 라우터와 SOLVEX를 동일한 호스트에서 제공합니다. EJS로 화면을 렌더링하고 분석 폼만 같은 호스트에 multipart 요청을 보냅니다. 공개 예시 데이터는 저장소에 있고 외부 호출이 없습니다.

비공개 검토 흐름은 세션 및 동의 검증 → 요청 한도 예약 → Provider 호출 → JSON 검사 → 사용자 전용 결과 저장입니다. Provider 교체 시 `analyze(input, image)`와 구조화된 결과 계약을 유지하세요.
