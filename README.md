# 영상 아카이브 & 검수 시스템

영상을 올리면 자동으로 분석·저장하고, 자연어로 검색하며, 방영 전 금칙 검수까지 처리하는 웹 서비스 (PRD v1.1).

## 실행

**백엔드** (포트 8000):

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env        # ANTHROPIC_API_KEY 입력 (AI 단계용)
python -m uvicorn app.main:app --port 8000
```

**프론트엔드** (포트 5173):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

브라우저에서 http://localhost:5173 → 업로드 탭에서 영상을 올리면 8단계 병렬 파이프라인이 실시간으로 표시됩니다.

## 키 설정 (.env)

| 변수 | 용도 | 없으면 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | 자막 교정 · 장면 분석 · 금칙 판정 | 해당 단계 실패 처리, 나머지는 정상 진행 |
| `VOYAGE_API_KEY` | 의미(벡터) 검색 임베딩 | 로컬 해시 임베딩으로 폴백 (품질 저하) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | 처리 완료 알림 | 알림 생략 |

## 구조

```
frontend/   React UI — Dark Brutalist Editorial 디자인 (design/ 핸드오프 구현)
backend/    FastAPI — 파이프라인 · 검색 · 리포트
  app/      pipeline.py(8단계 병렬) · search.py(hybrid/keyword/vector/filter)
            ai.py(Claude) · media.py(ffmpeg) · stt.py(faster-whisper)
  rules/금칙기준.md    판정 기준 — 이 파일만 고치면 다음 영상부터 반영
  docs/운영절차서.md   검수 흐름 및 판정 기준 문서
  data/     업로드 원본 · 프레임 · report.json · violations.csv · SQLite
design/     Claude Design 핸드오프 번들 (참고용)
```

요구 도구: Python 3.13+, Node 20+, ffmpeg/ffprobe (PATH).

## 테스트

```bash
cd backend && python -m pytest tests -v   # 11 tests
cd frontend && npm run build
```
