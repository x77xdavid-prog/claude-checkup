// 카테고리 표시 순서 — build-catalog.mjs의 CATEGORY_RULES 순서와 일치(+기타 끝).
// fs 등 서버 전용 모듈 의존 없음 → 클라이언트 컴포넌트(CatalogBrowser)에서 안전하게 import.
export const CATEGORY_ORDER = [
  "프로젝트 관리",
  "보안",
  "자동화·스케줄",
  "오케스트레이션·에이전트",
  "테스트·디버깅",
  "리뷰·품질",
  "프론트엔드·디자인",
  "배포·운영",
  "마케팅·SEO",
  "데이터·분석",
  "문서·글쓰기",
  "검색·리서치",
  "금융·결제",
  "기타",
] as const;
