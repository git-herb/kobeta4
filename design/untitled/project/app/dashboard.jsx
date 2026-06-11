/* ============================================================
   Dashboard (영상 인덱스) + Upload (실시간 진행)
   ============================================================ */

function Marquee() {
  const words = ["성표현", "폭력", "충격혐오", "유해행위", "인격권", "차별증오", "아동청소년", "광고저작권"];
  const seq = words.concat(words);
  return (
    <div className="marquee">
      <div className="marquee-track">
        {seq.map((w, i) => (
          <span key={i} className={"marquee-item" + (i % 2 ? " outline" : "")}>
            {w}<span className="star">✳</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ go }) {
  useReveal();
  const M = window.MOCK;
  const done = M.videos.filter(v => v.status === "done");
  const totalViol = done.reduce((a, v) => a + v.counts.violation, 0);
  const totalReview = done.reduce((a, v) => a + v.counts.review, 0);
  const processing = M.videos.filter(v => v.status === "processing").length;

  return (
    <React.Fragment>
      <div className="page">
        <PageHead
          label="001 — 아카이브 인덱스"
          title={<React.Fragment>검수 <span className="stroke">대시보드</span></React.Fragment>}
        />
      </div>

      <Marquee />

      <div className="page">
        {/* summary stats */}
        <div className="stat-grid reveal" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 52, marginBottom: 8 }}>
          <div className="stat-cell"><div className="k">아카이브 영상</div><div className="v">{M.videos.length}</div></div>
          <div className="stat-cell"><div className="k">처리 중</div><div className="v cit">{processing}</div></div>
          <div className="stat-cell"><div className="k">방영 불가 프레임</div><div className="v">{totalViol}</div></div>
          <div className="stat-cell"><div className="k">검토 필요</div><div className="v">{totalReview}</div></div>
        </div>

        {/* index list */}
        <div className="section-label" style={{ marginTop: 64, marginBottom: 8, display: "block" }}>002 — 영상 목록</div>
        <div className="index-list reveal">
          {M.videos.map((v, i) => (
            <VideoRow key={v.id} v={v} num={i + 1} go={go} />
          ))}
        </div>
      </div>
    </React.Fragment>
  );
}

function VideoRow({ v, num, go }) {
  const M = window.MOCK;
  const processing = v.status === "processing";
  const verdict = v.counts.violation > 0
    ? M.sevLabel(v.maxSev)
    : v.counts.review > 0 ? M.sevLabel(3) : M.sevLabel(0);
  const onClick = () => processing ? go("upload") : go("report", { id: v.id });
  return (
    <div className="index-row" onClick={onClick}>
      <span className="row-num">/{String(num).padStart(2, "0")}</span>
      <div>
        <div className="row-title">{v.title}</div>
        <div className="row-sub">{v.duration} · {v.size} · {v.captionSource} · {v.uploadedAt}</div>
      </div>
      <div className="row-tech">
        {processing
          ? <span className="stage-flag run">처리 중 · 병렬 8단계</span>
          : (<div className="flex gap-s wrap">
              {v.counts.violation > 0 && <span className="sev s-block">위반 {v.counts.violation}</span>}
              {v.counts.review > 0 && <span className="sev s-review">검토 {v.counts.review}</span>}
              {v.counts.violation === 0 && v.counts.review === 0 && <span className="sev s-pass">통과 {v.counts.pass}</span>}
            </div>)
        }
      </div>
      <div className="hide-sm">
        {!processing && <SevTag sev={verdict.code} />}
      </div>
      <span className="row-arrow">→</span>
    </div>
  );
}

/* ---------- Upload ---------- */
function Upload({ go }) {
  useReveal();
  const M = window.MOCK;
  const [stages, setStages] = useState(() => M.processing.stages.map(s => ({ ...s })));
  const [started, setStarted] = useState(true);

  // animate the running stages a bit for life
  useEffect(() => {
    const t = setInterval(() => {
      setStages(prev => prev.map(s => {
        if (s.state === "run" && s.pct < 99) return { ...s, pct: Math.min(99, s.pct + Math.random() * 3) };
        return s;
      }));
    }, 900);
    return () => clearInterval(t);
  }, []);

  const overall = Math.round(stages.reduce((a, s) => a + s.pct, 0) / stages.length);

  return (
    <div className="page">
      <PageHead
        label="003 — 업로드 & 처리"
        title={<React.Fragment>업로드 &amp; <span className="stroke">파이프라인</span></React.Fragment>}
        meta="브라우저에서 영상 업로드 · 1개 이상 누적 가능 · 단계별 진행 상황 실시간 표시"
      />

      {/* dropzone */}
      <div className="dropzone reveal" style={{ marginTop: 48 }} onClick={() => {}}>
        <div className="mono" style={{ marginBottom: 18 }}>DROP / SELECT — .MP4 .MOV .MKV</div>
        <div className="big">영상을 여기에 끌어다 놓기</div>
        <div className="dim" style={{ marginTop: 16, fontSize: 14 }}>업로드 즉시 아카이브 + 검수가 동시에 시작됩니다</div>
        <button className="btn primary" style={{ marginTop: 28 }} onClick={(e) => e.stopPropagation()}>파일 선택 →</button>
      </div>

      {/* active processing */}
      <div className="between reveal" style={{ marginTop: 64, marginBottom: 22, flexWrap: "wrap", gap: 16 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>004 — 처리 중 · 영상 내 병렬</div>
        <div className="mono">예능_불금파티_12회.mp4 · 전체 {overall}%</div>
      </div>

      <div className="proc-card reveal">
        <div className="proc-stage" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="pname cit">전체 진행률</div>
          <div className="ppct cit">{overall}%</div>
          <div className="ptrack prog-track" style={{ marginTop: 6 }}>
            <div className="prog-fill shimmer" style={{ width: overall + "%" }}></div>
          </div>
        </div>
        {stages.map((s, i) => (
          <ProcStage key={i} s={s} />
        ))}
      </div>

      <div className="mono reveal" style={{ marginTop: 22, color: "var(--paper-faint)" }}>
        ✳ 한 단계가 실패해도 나머지 병렬 단계는 계속 진행됩니다. 처리 완료 시 텔레그램으로 결과 요약이 전송됩니다.
      </div>
    </div>
  );
}

function ProcStage({ s }) {
  const pct = Math.round(s.pct);
  const stateCls = s.state === "done" ? "done" : s.state === "failed" ? "failed" : "";
  const flag = s.state === "done"
    ? <span className="stage-flag">완료</span>
    : s.state === "run" ? <span className="stage-flag run">실행 중</span>
    : s.state === "failed" ? <span className="stage-flag err">실패 · 건너뜀</span>
    : <span className="stage-flag">대기</span>;
  return (
    <div className={"proc-stage " + stateCls}>
      <div className="flex center gap-s">
        <span className="pname">{s.name}</span>
        {flag}
      </div>
      <div className="ppct">{s.state === "wait" ? "—" : pct + "%"}</div>
      <div className="ptrack prog-track" style={{ marginTop: 4 }}>
        <div className={"prog-fill" + (s.state === "run" ? " shimmer" : "")} style={{ width: pct + "%" }}></div>
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, Upload, Marquee });
