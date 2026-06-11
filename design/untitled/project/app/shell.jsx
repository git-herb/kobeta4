/* ============================================================
   App shell — nav, routing, cursor, grain, shared atoms
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;

/* ---------- custom citron cursor ---------- */
function CustomCursor() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    document.body.appendChild(dot);
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let tx = x, ty = y, raf;
    const move = (e) => { tx = e.clientX; ty = e.clientY; };
    const over = (e) => {
      const t = e.target.closest("a,button,.index-row,.result-row,.frame-card,.mode-chip,.tab,.nav-link,.dropzone,.tl-seg,.scene,input");
      dot.classList.toggle("big", !!t);
    };
    const loop = () => {
      x += (tx - x) * 0.2; y += (ty - y) * 0.2;
      dot.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", over);
    loop();
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseover", over); cancelAnimationFrame(raf); dot.remove(); };
  }, []);
  return null;
}

/* ---------- reveal-on-scroll (with guaranteed fallback) ---------- */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal:not(.in)"));
    // Hard-force final visible state — guarantees content even if a transition
    // stalls under compositor throttling (background/offscreen iframes).
    const force = () => els.forEach(e => {
      e.classList.add("in");
      e.style.transition = "none";
      e.style.opacity = "1";
      e.style.transform = "none";
    });
    if (!("IntersectionObserver" in window) || document.hidden) { force(); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
    els.forEach(e => io.observe(e));
    const fb = setTimeout(force, 700);
    return () => { io.disconnect(); clearTimeout(fb); };
  });
}

/* ---------- thumbnail placeholder ---------- */
function Thumb({ tc, glyph, variant, style, className }) {
  const v = variant === "review" ? "cit-edge" : variant === "violation" ? "cit-fill" : "";
  return (
    <div className={"thumb " + v + (className ? " " + className : "")} style={style}>
      {glyph && <div className="glyph">{glyph}</div>}
      {tc && <div className="tc">{tc}</div>}
    </div>
  );
}

/* ---------- severity tag ---------- */
function SevTag({ sev, withCode }) {
  const s = window.MOCK.sevLabel(sev);
  return <span className={"sev " + s.cls}>{withCode ? "[" + sev + "] " : ""}{s.label}</span>;
}

/* ---------- page header ---------- */
function PageHead({ label, title, meta }) {
  return (
    <div className="page-head">
      <div className="section-label">{label}</div>
      <h1 className="page-title" style={{ marginTop: 22 }}>{title}</h1>
      {meta && <div className="mono" style={{ marginTop: 22 }}>{meta}</div>}
    </div>
  );
}

/* ---------- top nav ---------- */
const NAV = [
  { id: "dashboard", label: "대시보드" },
  { id: "search", label: "검색" },
  { id: "upload", label: "업로드" }
];

function Nav({ route, go }) {
  const active = route.name === "report" ? "dashboard" : route.name;
  return (
    <nav className="nav">
      <div className="nav-brand" onClick={() => go("dashboard")} style={{ cursor: "pointer" }}>
        <span className="dot"></span>
        <span>ARCHIVE</span>
        <span className="faint full">/ 영상 검수 시스템</span>
      </div>
      <div className="nav-links">
        {NAV.map(n => (
          <button key={n.id} className={"nav-link" + (active === n.id ? " active" : "")} onClick={() => go(n.id)}>{n.label}</button>
        ))}
      </div>
    </nav>
  );
}

/* ---------- footer ---------- */
function Foot() {
  return (
    <footer className="foot">
      <span>영상 아카이브 &amp; 검수 시스템 · V1.1</span>
      <span>방송심의 규정 8종 · 심각도 0–5</span>
      <span>2026 — 운영 콘솔</span>
    </footer>
  );
}

/* ---------- modal ---------- */
function Modal({ title, onClose, children, className }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={"modal " + (className || "")} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="section-label">{title}</div>
          <button className="x-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

Object.assign(window, { CustomCursor, useReveal, Thumb, SevTag, PageHead, Nav, Foot, Modal });
