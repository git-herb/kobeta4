/* ============================================================
   Dashboard (영상 인덱스) + Upload (실시간 진행)
   백엔드 API 사용 · API가 없으면 데모 목 데이터로 폴백
   ============================================================ */
import { Fragment, useEffect, useRef, useState } from "react";
import { CATEGORIES, VIDEOS, PROCESSING, sevLabel } from "./data.js";
import { useReveal, PageHead, SevTag } from "./shell.jsx";
import { listVideos, uploadVideo, getProgress, getModels, getEstimate, readDuration } from "./api.js";

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
const INTERVALS = [1, 2, 3, 5, 10];

const HIDDEN_MODELS = ["gpt-5.4"];   // 프론트에서만 숨김

export function Upload({ go, route }) {
  useReveal();
  const fileRef = useRef(null);
  const [uploadPct, setUploadPct] = useState(null);   // 업로드 전송률 (전체)
  const [activeIds, setActiveIds] = useState(
    route && route.params && route.params.id ? [route.params.id] : []
  );
  const [progs, setProgs] = useState({});             // id → 파이프라인 진행
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);

  // 모델 · 샘플링 주기 · 비용 추정
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [interval_, setInterval_] = useState(1);
  const [pending, setPending] = useState([]);         // [{ file, duration }]
  const [est, setEst] = useState(null);

  useEffect(() => {
    getModels()
      .then(d => {
        const ms = d.models.filter(m => !HIDDEN_MODELS.includes(m.id));
        setModels(ms);
        setModel(HIDDEN_MODELS.includes(d.default) ? ms[0].id : (d.default || ms[0].id));
        setInterval_(d.defaultInterval || 1);
      })
      .catch(() => {});
  }, []);

  // 모델/주기/파일이 바뀔 때마다 예상 비용 갱신 (파일 없으면 10분 기준)
  const totalDuration = pending.reduce((a, p) => a + (p.duration || 0), 0);
  useEffect(() => {
    if (!model) return;
    getEstimate(totalDuration > 0 ? totalDuration : 600, interval_, model)
      .then(setEst).catch(() => setEst(null));
  }, [model, interval_, totalDuration]);

  // 진행 중 영상 폴링 (여러 개 동시)
  useEffect(() => {
    if (activeIds.length === 0) {
      listVideos()
        .then(v => {
          const ps = v.filter(x => x.status === "processing").map(x => x.id);
          if (ps.length) setActiveIds(ps);
        })
        .catch(() => setDemo(true));
      return;
    }
    let on = true;
    const t = setInterval(() => {
      Promise.all(activeIds.map(id => getProgress(id).catch(() => null)))
        .then(list => {
          if (!on) return;
          const next = {};
          list.forEach(p => { if (p) next[p.id] = p; });
          if (Object.keys(next).length === 0) { setDemo(true); return; }
          setProgs(next);
          if (Object.values(next).every(p => p.status !== "processing")) clearInterval(t);
        });
    }, 1000);
    return () => { on = false; clearInterval(t); };
  }, [activeIds]);

  const pick = () => fileRef.current && fileRef.current.click();

  // 파일 선택(여러 개) → 바로 올리지 않고 길이를 읽어 예상 비용을 먼저 보여준다
  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError("");
    const read = await Promise.all(files.map(async f => ({ file: f, duration: await readDuration(f) })));
    setPending(prev => [...prev, ...read]);
  };

  const startUpload = async () => {
    if (!pending.length) return;
    setError("");
    setUploadPct(0);
    const ids = [];
    try {
      for (let i = 0; i < pending.length; i++) {
        const { id } = await uploadVideo(
          pending[i].file,
          pct => setUploadPct(Math.round(((i + pct / 100) / pending.length) * 100)),
          { model, interval: interval_ },
        );
        ids.push(id);
      }
      setUploadPct(null);
      setPending([]);
      setProgs({});
      setActiveIds(ids);
    } catch (e) {
      setUploadPct(null);
      if (ids.length) setActiveIds(ids);
      setError("업로드 실패 — 백엔드 서버(8000)가 실행 중인지 확인하세요.");
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  };

  const fmtTok = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(n);
  const fmtDur = (d) => `${Math.floor(d / 60)}분 ${Math.round(d % 60)}초`;

  const progList = Object.values(progs);
  const demoStages = demo && progList.length === 0 ? PROCESSING.stages.map(s => ({ ...s, error: "" })) : null;

  return (
    <div className="page">
      <PageHead
        label="003 — 업로드 & 처리"
        title={<Fragment>업로드 &amp; <span className="stroke">파이프라인</span></Fragment>}
        meta="브라우저에서 영상 업로드 · 1개 이상 누적 가능 · 단계별 진행 상황 실시간 표시"
      />

      <input ref={fileRef} type="file" accept="video/*" multiple style={{ display: "none" }}
        onChange={e => { onFiles(e.target.files); e.target.value = ""; }} />

      <div className="dropzone reveal" style={{ marginTop: 48 }} onClick={pick}
        onDragOver={e => e.preventDefault()} onDrop={onDrop}>
        <div className="mono" style={{ marginBottom: 18 }}>DROP / SELECT — .MP4 .MOV .MKV · 여러 개 가능</div>
        <div className="big">
          {uploadPct !== null ? `전송 중 ${uploadPct}%`
            : pending.length === 1 ? pending[0].file.name
            : pending.length > 1 ? `영상 ${pending.length}개 선택됨`
            : "영상을 여기에 끌어다 놓기"}
        </div>
        <div className="dim" style={{ marginTop: 16, fontSize: 14 }}>
          {pending.length
            ? `총 길이 ${fmtDur(totalDuration)} — 아래에서 모델·주기 확인 후 업로드`
            : "업로드 즉시 아카이브 + 검수가 동시에 시작됩니다"}
        </div>
        {pending.length > 1 && (
          <div className="mono-sm mono" style={{ marginTop: 12, color: "var(--paper-faint)" }}>
            {pending.map((p, i) => `${i + 1}. ${p.file.name} (${fmtDur(p.duration)})`).join("  ·  ")}
          </div>
        )}
        <div className="flex gap-s" style={{ marginTop: 28, justifyContent: "center" }}>
          <button className="btn primary"
            onClick={(e) => { e.stopPropagation(); pending.length ? startUpload() : pick(); }}>
            {pending.length ? `업로드 시작 (${pending.length}개) →` : "파일 선택 →"}
          </button>
          {pending.length > 0 && (
            <button className="btn" onClick={(e) => { e.stopPropagation(); pick(); }}>+ 파일 추가</button>
          )}
          {pending.length > 0 && (
            <button className="btn" onClick={(e) => { e.stopPropagation(); setPending([]); }}>비우기</button>
          )}
        </div>
        {error && <div className="mono cit" style={{ marginTop: 18 }}>{error}</div>}
      </div>

      {/* 모델 · 샘플링 주기 · 예상 비용 */}
      {models.length > 0 && (
        <div className="reveal" style={{ marginTop: 36 }}>
          <div className="section-label" style={{ marginBottom: 14 }}>003b — 판정 모델 · 샘플링 주기</div>
          <div className="mode-row" style={{ marginTop: 0 }}>
            {models.map(m => (
              <button key={m.id} className={"mode-chip" + (model === m.id ? " active" : "")} onClick={() => setModel(m.id)}>
                <span>{m.label}</span>
                <small>${m.in}/{m.out} · 1M tok{m.approx ? " · 추정가" : ""}</small>
              </button>
            ))}
          </div>
          <div className="mode-row" style={{ marginTop: 10 }}>
            {INTERVALS.map(s => (
              <button key={s} className={"mode-chip" + (interval_ === s ? " active" : "")} onClick={() => setInterval_(s)}>
                <span>{s}초 간격</span>
                <small>{s === 1 ? "촘촘 · 짧은 장면도 포착" : s >= 5 ? "성김 · 저렴" : "보통"}</small>
              </button>
            ))}
          </div>
          {est && (
            <div className="mono-sm mono" style={{ marginTop: 14, color: "var(--paper-faint)" }}>
              예상 사용량{pending.length ? (pending.length > 1 ? ` (${pending.length}개 합산)` : "") : " (10분 영상 기준)"}
              — 토큰 약 {fmtTok(est.total_tokens)}
              · 비용 {est.approx ? "≈" : "약 "}${est.usd} (₩{est.krw.toLocaleString()})
              · 금칙 판정 {est.judge_calls}회 + 장면 분석 {est.scene_calls}회 호출
              {est.approx ? " · 해당 모델 가격은 추정치" : ""}
            </div>
          )}
        </div>
      )}

      {(progList.length > 0 || demoStages) && (
        <div className="between reveal" style={{ marginTop: 64, marginBottom: 22, flexWrap: "wrap", gap: 16 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>
            004 — 처리 중 · 영상 {progList.length || 1}개 병렬{demoStages ? " (데모)" : ""}
          </div>
        </div>
      )}

      {progList.map(p => (
        <Fragment key={p.id}>
          <div className="proc-card reveal" style={{ marginBottom: 20 }}>
            <div className="proc-stage" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="pname cit">{p.title}</div>
              <div className="ppct cit">{p.overall}%</div>
              <div className="ptrack prog-track" style={{ marginTop: 6 }}>
                <div className="prog-fill shimmer" style={{ width: p.overall + "%" }}></div>
              </div>
            </div>
            {p.stages.map((s, i) => (
              <ProcStage key={i} s={s} />
            ))}
            {p.status === "done" && (
              <button className="btn primary" style={{ marginTop: 18 }} onClick={() => go("report", { id: p.id })}>
                리포트 보기 →
              </button>
            )}
          </div>
        </Fragment>
      ))}

      {demoStages && (
        <div className="proc-card reveal">
          {demoStages.map((s, i) => (
            <ProcStage key={i} s={s} />
          ))}
        </div>
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
