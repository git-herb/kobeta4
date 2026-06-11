/* ============================================================
   Report — 금칙 검수 (타임라인 + 프레임 그리드) / 분석 리포트
   ============================================================ */

function Report({ route, go }) {
  useReveal();
  const M = window.MOCK;
  const R = M.report;
  const video = M.videos.find(v => v.id === route.params.id) || M.videos[0];
  const isFocus = video.id === R.videoId; // detailed report only for 안개도시
  const [tab, setTab] = useState("moderation");
  const [frame, setFrame] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const clean = !isFocus && video.counts.violation === 0 && video.counts.review === 0;

  return (
    <div className="page page-wide">
      {/* header */}
      <div className="page-head">
        <button className="mono" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--paper-dim)", padding: 0, marginBottom: 26 }} onClick={() => go("dashboard")}>← 대시보드</button>
        <div className="section-label">007 — 리포트 · {video.id.toUpperCase()}</div>
        <h1 className="page-title" style={{ marginTop: 20, fontSize: "clamp(30px, 4.6vw, 70px)" }}>{video.title}</h1>
        <div className="between" style={{ marginTop: 26, flexWrap: "wrap", gap: 16 }}>
          <div className="mono">{video.duration} · {video.size} · {video.captionSource} · {video.uploadedAt}</div>
          <div className="flex gap-s center">
            <SevTag sev={isFocus ? R.summary.maxSev : (video.counts.review > 0 ? 3 : 0)} withCode />
            <button className="btn danger" onClick={() => setConfirmDel(true)}>영상 삭제</button>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="tabs">
        <button className={"tab" + (tab === "moderation" ? " active" : "")} onClick={() => setTab("moderation")}>금칙 검수</button>
        <button className={"tab" + (tab === "analysis" ? " active" : "")} onClick={() => setTab("analysis")}>분석 리포트</button>
      </div>

      {tab === "moderation"
        ? (isFocus ? <Moderation R={R} onFrame={setFrame} /> : <CleanModeration video={video} />)
        : (isFocus ? <Analysis R={R} /> : <CleanAnalysis video={video} />)}

      {frame && <FrameModal frame={frame} onClose={() => setFrame(null)} />}
      {confirmDel && <DeleteConfirm video={video} onClose={() => setConfirmDel(false)} onDone={() => go("dashboard")} />}
    </div>
  );
}

/* ---------- Moderation tab ---------- */
function Moderation({ R, onFrame }) {
  const M = window.MOCK;
  return (
    <React.Fragment>
      {/* verdict summary */}
      <div className="block">
        <div className="stat-grid reveal" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          <div className="stat-cell"><div className="k">종합 판정</div><div className="v small" style={{ marginTop: 14 }}><SevTag sev={R.summary.maxSev} withCode /></div></div>
          <div className="stat-cell"><div className="k">샘플링 프레임</div><div className="v">{R.summary.framesSampled.toLocaleString()}</div></div>
          <div className="stat-cell"><div className="k">방영 불가</div><div className="v cit">{R.summary.violation}</div></div>
          <div className="stat-cell"><div className="k">검토 필요</div><div className="v">{R.summary.review}</div></div>
        </div>
        <div className="flex gap-s wrap reveal" style={{ marginTop: 24, alignItems: "center" }}>
          <span className="mono" style={{ color: "var(--paper-faint)" }}>적중 카테고리</span>
          {R.summary.categoriesHit.map(c => <span key={c} className="source-tag both">{c}</span>)}
          <span className="mono" style={{ color: "var(--paper-faint)", marginLeft: 8 }}>· 1초 간격 샘플 · 연속 2~3장 묶음 판정 · 대사·소리 근거 포함</span>
        </div>
      </div>

      {/* timeline */}
      <div className="block">
        <div className="block-head">
          <div>
            <div className="section-label">008 — 영상 타임라인</div>
            <div className="block-title" style={{ marginTop: 16 }}>구간별 분석</div>
          </div>
          <div className="mono">전체 {R.meta.duration}</div>
        </div>
        <div className="timeline-wrap reveal">
          <div className="timeline">
            {R.timeline.map((s, i) => (
              <div key={i}
                className={"tl-seg tl-" + s.type}
                style={{ width: (s.to - s.from) + "%" }}
                title={s.type}></div>
            ))}
          </div>
          <div className="tl-ticks">{R.ticks.map((t, i) => <span key={i} className="tl-tick">{t}</span>)}</div>
          <div className="tl-legend">
            <span className="lg"><span className="sw tl-violation"></span>위반 / 방영불가</span>
            <span className="lg"><span className="sw tl-review"></span>검토 필요</span>
            <span className="lg"><span className="sw tl-silence"></span>무음 구간</span>
            <span className="lg"><span className="sw tl-black"></span>블랙 구간</span>
            <span className="lg"><span className="sw" style={{ background: "transparent" }}></span>정상</span>
          </div>
        </div>
      </div>

      {/* frame grid */}
      <div className="block">
        <div className="block-head">
          <div>
            <div className="section-label">009 — 위반 · 검토 프레임</div>
            <div className="block-title" style={{ marginTop: 16 }}>플래그된 프레임 {R.frames.length}</div>
          </div>
          <div className="mono">클릭 → 상세 판정</div>
        </div>
        <div className="frame-grid reveal">
          {R.frames.map((f, i) => (
            <div key={i} className="frame-card" onClick={() => onFrame(f)}>
              <Thumb tc={f.tc} glyph={f.category} variant={f.sev >= 4 ? "violation" : "review"} />
              <div className="frame-meta">
                <span className="mono" style={{ color: "var(--paper)" }}>{f.category}</span>
                <SevTag sev={f.sev} withCode />
              </div>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------- Frame detail modal ---------- */
function FrameModal({ frame, onClose }) {
  return (
    <Modal title={"프레임 상세 · " + frame.tc} onClose={onClose}>
      <div className="flex gap-s center wrap" style={{ justifyContent: "space-between", marginBottom: 22 }}>
        <span className="mono" style={{ color: "var(--paper)", fontSize: 13 }}>{frame.category}</span>
        <SevTag sev={frame.sev} withCode />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 24 }}>
        <Thumb glyph="−1 프레임" style={{ aspectRatio: "16/9", opacity: 0.55 }} />
        <Thumb glyph="판정 프레임" variant={frame.sev >= 4 ? "violation" : "review"} style={{ aspectRatio: "16/9" }} />
        <Thumb glyph="+1 프레임" style={{ aspectRatio: "16/9", opacity: 0.55 }} />
      </div>
      <div className="mono" style={{ color: "var(--paper-faint)", marginBottom: 22 }}>✳ 연속 2~3장을 묶어 동작의 흐름을 판정합니다</div>
      <table className="kv-table">
        <tbody>
          <tr><td className="k">타임코드</td><td className="v">{frame.tc}</td></tr>
          <tr><td className="k">카테고리</td><td className="v">{frame.category}</td></tr>
          <tr><td className="k">심각도</td><td className="v"><SevTag sev={frame.sev} withCode /></td></tr>
          <tr><td className="k">근거 규정</td><td className="v cit">{frame.rule}</td></tr>
          <tr><td className="k">소리 근거</td><td className="v">{frame.sound}</td></tr>
          <tr><td className="k">판정 이유</td><td className="v">{frame.reason}</td></tr>
        </tbody>
      </table>
    </Modal>
  );
}

/* ---------- Analysis tab ---------- */
function Analysis({ R }) {
  return (
    <React.Fragment>
      {/* metadata */}
      <div className="block">
        <div className="section-label">010 — 메타데이터</div>
        <table className="kv-table reveal" style={{ marginTop: 26 }}>
          <tbody>
            <tr><td className="k">파일명</td><td className="v">{R.meta.filename}</td></tr>
            <tr><td className="k">크기 / 길이</td><td className="v">{R.meta.size} · {R.meta.duration}</td></tr>
            <tr><td className="k">해상도 / 코덱</td><td className="v">{R.meta.resolution} · {R.meta.codec}</td></tr>
            <tr><td className="k">업로드 시각</td><td className="v">{R.meta.uploadedAt}</td></tr>
            <tr><td className="k">자막 출처</td><td className="v cit">{R.meta.captionSource}</td></tr>
          </tbody>
        </table>
      </div>

      {/* technical */}
      <div className="block">
        <div className="section-label">011 — 기술 검토</div>
        <div className="tech-grid reveal" style={{ marginTop: 26 }}>
          <TechCell label="무음 구간" items={R.tech.silence} />
          <TechCell label="블랙 구간" items={R.tech.black} />
          <TechCell label="프리즈 화면" items={R.tech.freeze} />
          <TechCell label="오디오 클리핑" items={R.tech.clipping} />
        </div>
      </div>

      {/* scene analysis */}
      <div className="block">
        <div className="section-label">012 — 장면 분석</div>
        <div className="block-title" style={{ marginTop: 16, marginBottom: 8 }}>구간별 대표 화면 · 설명</div>
        <div className="reveal">
          {R.scenes.map((s, i) => (
            <div key={i} className="scene">
              <Thumb tc={s.tc} glyph="대표 화면" />
              <div>
                <div className="scene-time">{s.tc}</div>
                <div className="scene-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* corrections */}
      <div className="block">
        <div className="section-label">013 — AI 자막 교정 내역</div>
        <div className="block-title" style={{ marginTop: 16, marginBottom: 20 }}>바뀐 문장만 표시</div>
        <div className="reveal">
          {R.corrections.map((c, i) => (
            <div key={i} className="corr">
              <div className="ct">{c.tc}</div>
              <div>
                <span className="orig">{c.orig}</span>
                <span className="arrow">→</span>
                <span className="fix">{c.fix}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* transcript */}
      <div className="block">
        <div className="block-head">
          <div className="section-label">014 — 자막 전문</div>
          <div className="mono">시간순 · 스크롤</div>
        </div>
        <div className="transcript reveal">
          {R.transcript.map((t, i) => (
            <div key={i} className="tx-line">
              <span className="tx-time">{t.tc}</span>
              <span className="tx-text">
                {t.corrected ? <span className="corrected">{t.text}</span> : t.text}
                {t.flag && <span className="mono cit" style={{ marginLeft: 10, fontSize: 9 }}>● 검수 플래그</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

function TechCell({ label, items }) {
  return (
    <div className="tech-cell">
      <div className="tk">{label}</div>
      <div className="tv">{items.length}</div>
      <div className="tlist">
        {items.map((it, i) => <div key={i}>{it}</div>)}
      </div>
    </div>
  );
}

/* ---------- clean (no-violation) states ---------- */
function CleanModeration({ video }) {
  return (
    <div className="block">
      <div className="stat-grid reveal" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="stat-cell"><div className="k">종합 판정</div><div className="v small" style={{ marginTop: 14 }}><SevTag sev={0} /></div></div>
        <div className="stat-cell"><div className="k">통과 구간</div><div className="v">{video.counts.pass}</div></div>
        <div className="stat-cell"><div className="k">위반 / 검토</div><div className="v">0</div></div>
      </div>
      <div className="mono reveal" style={{ marginTop: 32, color: "var(--paper-faint)" }}>✳ 금칙 위반 또는 검토 필요 프레임이 발견되지 않았습니다. 전체 구간 통과.</div>
    </div>
  );
}

function CleanAnalysis({ video }) {
  return (
    <div className="block">
      <div className="section-label">메타데이터</div>
      <table className="kv-table reveal" style={{ marginTop: 26 }}>
        <tbody>
          <tr><td className="k">파일명</td><td className="v">{video.title}</td></tr>
          <tr><td className="k">크기 / 길이</td><td className="v">{video.size} · {video.duration}</td></tr>
          <tr><td className="k">업로드 시각</td><td className="v">{video.uploadedAt}</td></tr>
          <tr><td className="k">자막 출처</td><td className="v cit">{video.captionSource}</td></tr>
        </tbody>
      </table>
      <div className="mono reveal" style={{ marginTop: 28, color: "var(--paper-faint)" }}>✳ 상세 장면 분석 데이터는 안개도시_7회 리포트에서 확인할 수 있습니다 (데모 포커스 영상).</div>
    </div>
  );
}

/* ---------- delete confirm ---------- */
function DeleteConfirm({ video, onClose, onDone }) {
  return (
    <Modal title="영상 삭제" onClose={onClose} className="confirm">
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>이 영상을 삭제할까요?</div>
      <div className="dim" style={{ fontSize: 14, marginBottom: 8 }}>{video.title}</div>
      <div className="dim" style={{ fontSize: 14, marginBottom: 26 }}>
        영상 원본뿐 아니라 <span className="cit">리포트 · 검색 색인 · 프레임 이미지</span> 등 관련 데이터가 모두 함께 지워집니다. 이 작업은 되돌릴 수 없습니다.
      </div>
      <div className="flex gap-s" style={{ justifyContent: "flex-end" }}>
        <button className="btn" onClick={onClose}>취소</button>
        <button className="btn primary" onClick={onDone}>삭제 확인 →</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { Report });
