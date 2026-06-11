/* ============================================================
   Dashboard (영상 인덱스) + Upload (실시간 진행)
   백엔드 API 사용 · API가 없으면 데모 목 데이터로 폴백
   ============================================================ */
import { Fragment, useEffect, useRef, useState } from "react";
import { CATEGORIES, VIDEOS, PROCESSING, sevLabel } from "./data.js";
import { useReveal, PageHead, SevTag } from "./shell.jsx";
import { listVideos, uploadVideo, getProgress } from "./api.js";

export function Marquee() {
  const words = CATEGORIES.map(c => c.id);
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

export function Dashboard({ go }) {
  useReveal();
  const [videos, setVideos] = useState(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let on = true;
    const load = () => listVideos()
      .then(v => { if (on) { setVideos(v); setLive(true); } })
      .catch(() => { if (on && videos === null) { setVideos(VIDEOS); setLive(false); } });
    load();
    const t = setInterval(load, 3000);
    return () => { on = false; clearInterval(t); };
  }, []);

  const list = videos || [];
  const done = list.filter(v => v.status === "done");
  const totalViol = done.reduce((a, v) => a + v.counts.violation, 0);
  const totalReview = done.reduce((a, v) => a + v.counts.review, 0);
  const processing = list.filter(v => v.status === "processing").length;

  return (
    <Fragment>
      <div className="page">
        <PageHead
          label={"001 — 아카이브 인덱스" + (live ? "" : " · 데모 데이터")}
          title={<Fragment>검수 <span className="stroke">대시보드</span></Fragment>}
        />
      </div>

      <Marquee />

      <div className="page">
        <div className="stat-grid reveal" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 52, marginBottom: 8 }}>
          <div className="stat-cell"><div className="k">아카이브 영상</div><div className="v">{list.length}</div></div>
          <div className="stat-cell"><div className="k">처리 중</div><div className="v cit">{processing}</div></div>
          <div className="stat-cell"><div className="k">방영 불가 프레임</div><div className="v">{totalViol}</div></div>
          <div className="stat-cell"><div className="k">검토 필요</div><div className="v">{totalReview}</div></div>
        </div>

        <div className="section-label" style={{ marginTop: 64, marginBottom: 8, display: "block" }}>002 — 영상 목록</div>
        <div className="index-list reveal">
          {list.map((v, i) => (
            <VideoRow key={v.id} v={v} num={i + 1} go={go} />
          ))}
          {list.length === 0 && (
            <div className="dim" style={{ padding: "40px 0" }}>아직 영상이 없습니다 — 업로드 탭에서 시작하세요.</div>
          )}
        </div>
      </div>
    </Fragment>
  );
}

function VideoRow({ v, num, go }) {
  const processing = v.status === "processing";
  const verdict = v.counts.violation > 0
    ? sevLabel(v.maxSev)
    : v.counts.review > 0 ? sevLabel(3) : sevLabel(0);
  const onClick = () => processing ? go("upload", { id: v.id }) : go("report", { id: v.id });
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
export function Upload({ go, route }) {
  useReveal();
  const fileRef = useRef(null);
  const [uploadPct, setUploadPct] = useState(null);   // 업로드 전송률
  const [activeId, setActiveId] = useState((route && route.params && route.params.id) || null);
  const [prog, setProg] = useState(null);             // 파이프라인 진행
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);

  // 진행 중 영상 폴링
  useEffect(() => {
    if (!activeId) {
      // 백엔드에서 처리 중 영상 찾아 자동 표시
      listVideos()
        .then(v => { const p = v.find(x => x.status === "processing"); if (p) setActiveId(p.id); })
        .catch(() => setDemo(true));
      return;
    }
    let on = true;
    const t = setInterval(() => {
      getProgress(activeId)
        .then(p => { if (on) { setProg(p); if (p.status !== "processing") clearInterval(t); } })
        .catch(() => { if (on) setDemo(true); });
    }, 1000);
    return () => { on = false; clearInterval(t); };
  }, [activeId]);

  const pick = () => fileRef.current && fileRef.current.click();

  const onFile = async (file) => {
    if (!file) return;
    setError("");
    setUploadPct(0);
    try {
      const { id } = await uploadVideo(file, setUploadPct);
      setUploadPct(null);
      setProg(null);
      setActiveId(id);
    } catch (e) {
      setUploadPct(null);
      setError("업로드 실패 — 백엔드 서버(8000)가 실행 중인지 확인하세요.");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    onFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const stages = prog ? prog.stages : (demo ? PROCESSING.stages.map(s => ({ ...s, error: "" })) : null);
  const overall = prog ? prog.overall
    : stages ? Math.round(stages.reduce((a, s) => a + s.pct, 0) / stages.length) : 0;
  const titleLabel = prog ? prog.title : demo ? "예능_불금파티_12회.mp4 (데모)" : "";

  return (
    <div className="page">
      <PageHead
        label="003 — 업로드 & 처리"
        title={<Fragment>업로드 &amp; <span className="stroke">파이프라인</span></Fragment>}
        meta="브라우저에서 영상 업로드 · 1개 이상 누적 가능 · 단계별 진행 상황 실시간 표시"
      />

      <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }}
        onChange={e => onFile(e.target.files && e.target.files[0])} />

      <div className="dropzone reveal" style={{ marginTop: 48 }} onClick={pick}
        onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        <div className="mono" style={{ marginBottom: 18 }}>DROP / SELECT — .MP4 .MOV .MKV</div>
        <div className="big">{uploadPct !== null ? `전송 중 ${uploadPct}%` : "영상을 여기에 끌어다 놓기"}</div>
        <div className="dim" style={{ marginTop: 16, fontSize: 14 }}>업로드 즉시 아카이브 + 검수가 동시에 시작됩니다</div>
        <button className="btn primary" style={{ marginTop: 28 }} onClick={(e) => { e.stopPropagation(); pick(); }}>파일 선택 →</button>
        {error && <div className="mono cit" style={{ marginTop: 18 }}>{error}</div>}
      </div>

      {stages && (
        <Fragment>
          <div className="between reveal" style={{ marginTop: 64, marginBottom: 22, flexWrap: "wrap", gap: 16 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>004 — 처리 중 · 영상 내 병렬</div>
            <div className="mono">{titleLabel} · 전체 {overall}%</div>
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

          {prog && prog.status === "done" && (
            <button className="btn primary" style={{ marginTop: 24 }} onClick={() => go("report", { id: activeId })}>
              리포트 보기 →
            </button>
          )}
        </Fragment>
      )}

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
        {s.error && <span className="mono-sm" style={{ color: "var(--paper-faint)" }}>{s.error}</span>}
      </div>
      <div className="ppct">{s.state === "wait" ? "—" : pct + "%"}</div>
      <div className="ptrack prog-track" style={{ marginTop: 4 }}>
        <div className={"prog-fill" + (s.state === "run" ? " shimmer" : "")} style={{ width: pct + "%" }}></div>
      </div>
    </div>
  );
}
