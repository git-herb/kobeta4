/* ============================================================
   Search — 자연어 검색 + 결과(썸네일 / 출처 / 이유)
   ============================================================ */
import { Fragment, useRef, useState } from "react";
import { SEARCH } from "./data.js";
import { useReveal, PageHead, Thumb } from "./shell.jsx";
import { searchApi } from "./api.js";

const SEARCH_MODES = [
  { id: "hybrid", label: "HYBRID", desc: "키워드+의미" },
  { id: "keyword", label: "KEYWORD", desc: "정확 단어" },
  { id: "vector", label: "VECTOR", desc: "의미 유사" },
  { id: "filter", label: "FILTER", desc: "조건 검색" },
];

export function Search({ go }) {
  useReveal();
  const [mode, setMode] = useState("hybrid");
  const [q, setQ] = useState("비 내리는 야경");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState([]);
  const [demo, setDemo] = useState(false);
  const inputRef = useRef(null);

  const run = (val, m) => {
    setSubmitted(val);
    searchApi(val, m || mode)
      .then(r => { setResults(r.results); setDemo(false); })
      .catch(() => { setResults(SEARCH.results); setDemo(true); });
  };
  const onKey = (e) => { if (e.key === "Enter") run(q); };

  return (
    <div className="page page-wide">
      <PageHead
        label="005 — 자연어 검색"
        title={<Fragment>무엇을 <span className="stroke">찾으시나요</span></Fragment>}
      />

      {/* search box */}
      <div className="reveal" style={{ marginTop: 44 }}>
        <div className="search-box">
          <span className="mono cit" style={{ fontSize: 13 }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            placeholder="예) 다투는 장면, 병원 복도, 욕설이 포함된 대사…"
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          <button className="btn primary" onClick={() => run(q)}>검색 →</button>
        </div>

        {/* modes */}
        <div className="mode-row">
          {SEARCH_MODES.map(m => (
            <button key={m.id} className={"mode-chip" + (mode === m.id ? " active" : "")}
              onClick={() => { setMode(m.id); if (submitted) run(submitted, m.id); }}>
              <span>{m.label}{m.id === "hybrid" ? " · 기본" : ""}</span>
              <small>{m.desc}</small>
            </button>
          ))}
        </div>

        {/* suggested */}
        <div className="flex gap-s wrap" style={{ marginTop: 24, alignItems: "center" }}>
          <span className="mono" style={{ color: "var(--paper-faint)" }}>추천</span>
          {SEARCH.suggested.map(s => (
            <button key={s} className="source-tag" style={{ cursor: "pointer", background: "none" }}
              onClick={() => { setQ(s); run(s); }}>{s}</button>
          ))}
        </div>
      </div>

      {/* results */}
      <div className="between reveal" style={{ marginTop: 64, marginBottom: 4, flexWrap: "wrap", gap: 12 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>
          006 — 결과 {results.length}건{demo ? " · 데모 데이터" : ""}
        </div>
        <div className="mono">{submitted ? `“${submitted}” · 모드 ${mode.toUpperCase()}` : "검색어를 입력하세요"}</div>
      </div>

      <div className="index-list reveal">
        {results.map((r, i) => (
          <ResultRow key={i} r={r} go={go} />
        ))}
      </div>

      <div className="mono reveal" style={{ marginTop: 28, color: "var(--paper-faint)" }}>
        ✳ 각 결과는 장면 썸네일 · 타임코드 · 출처(keyword/vector/both) · 매칭 이유를 함께 표시합니다.
      </div>
    </div>
  );
}

function ResultRow({ r, go }) {
  const sourceLabel = r.source === "both" ? "BOTH" : r.source.toUpperCase();
  return (
    <div className="result-row" onClick={() => go("report", { id: r.videoId, tc: r.tc })}>
      <Thumb tc={r.tc} glyph="장면 썸네일" src={r.thumb} />
      <div>
        <div className="res-title">{r.videoTitle}</div>
        <div className="res-snip">{r.snippet}</div>
        <div className="res-reason">이유 — {r.reason}</div>
      </div>
      <div className="flex gap-s" style={{ flexDirection: "column", alignItems: "flex-end" }}>
        <span className={"source-tag" + (r.source === "both" ? " both" : "")}>{sourceLabel}</span>
        <span className="mono" style={{ fontSize: 10, marginTop: 8 }}>{r.tc}</span>
        <span className="row-arrow" style={{ marginTop: 8 }}>→</span>
      </div>
    </div>
  );
}
