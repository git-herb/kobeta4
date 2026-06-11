# 영상 아카이브 & 검수 시스템 — 프론트엔드

PRD(`../PRD_영상아카이브검수시스템.md`) v1.1과 Claude Design 핸드오프 번들(`../design/`)의
**"Dark Brutalist Editorial / Citron Accent"** 디자인을 React로 구현한 운영 콘솔 UI입니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 빌드 → dist/
```

## 화면

| 화면 | 내용 |
|------|------|
| 대시보드 | 거대 타이포 타이틀, 금칙 카테고리 8종 마퀴, 통계 그리드, 번호 인덱스 영상 목록 |
| 업로드 | 드롭존 + 영상 내 병렬 8단계 실시간 프로그레스 |
| 검색 | 자연어 입력 + 4모드(hybrid/keyword/vector/filter), 썸네일·출처·매칭 이유 결과 |
| 금칙 검수 리포트 | 종합 판정, 구간별 타임라인(위반/검토/무음/블랙), 위반 프레임 그리드, 프레임 상세 모달(연속 3프레임·규정·소리 근거) |
| 분석 리포트 | 메타데이터, 기술 검토(무음/블랙/프리즈/클리핑), 장면 분석, "원본 → 교정" 자막 diff, 자막 전문 |

영상 삭제는 리포트 화면에서 확인 다이얼로그를 거쳐 동작합니다(PRD 4-6).

## 디자인 시스템

- 배경 `#0b0b09`(따뜻한 검정) · 텍스트 `#f4f1e6`(크림) · 액센트 `#ccff00`(시트론) 단 하나
- 본문 Pretendard Medium, 라벨·메타·숫자 JetBrains Mono 대문자
- 심각도는 색을 늘리지 않고 솔리드(방영불가) / 아웃라인(검토필요) / 디밍(통과)으로 구분
- 시그니처: 필름 그레인, 시트론 커스텀 커서, 무한 마퀴, 스크롤 리빌

## 구조

```
src/
  main.jsx       엔트리
  App.jsx        라우팅 (dashboard / search / upload / report)
  shell.jsx      공용 컴포넌트 — Nav, Foot, Modal, Thumb, SevTag, 커서, 리빌 훅
  dashboard.jsx  대시보드 + 업로드 화면
  search.jsx     검색 화면
  report.jsx     검수/분석 리포트 화면
  data.js        목 데이터 (백엔드 연동 전 데모용)
  styles.css     디자인 시스템 전체 (핸드오프 원본 그대로)
```

썸네일은 실제 프레임 이미지가 생기기 전까지 브루탈리스트 줄무늬 플레이스홀더로 표시됩니다.
백엔드 연동 시 `data.js`의 목 데이터를 API 응답으로 교체하면 됩니다.
