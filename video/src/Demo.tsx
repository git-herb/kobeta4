import {
  AbsoluteFill,
  OffthreadVideo,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CATEGORIES, GRAIN, T } from "./theme";
import "./fonts";

/* ---------- 공통 ---------- */

const Grain: React.FC = () => (
  <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none" }} />
);

const Fade: React.FC<{ children: React.ReactNode; durationInFrames: number }> = ({ children, durationInFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 12, durationInFrames - 12, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity, backgroundColor: T.ink }}>{children}</AbsoluteFill>;
};

const SectionLabel: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
    <div style={{ width: 46, height: 2, background: T.citron }} />
    <span style={{ fontFamily: T.mono, fontSize: 24, letterSpacing: "0.14em", color: T.paperDim, textTransform: "uppercase" }}>
      {text}
    </span>
  </div>
);

const Rise: React.FC<{ children: React.ReactNode; delay?: number; style?: React.CSSProperties }> = ({ children, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - delay);
  const opacity = interpolate(t, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(t, [0, 18], [40, 0], { extrapolateRight: "clamp" });
  return <div style={{ opacity, transform: `translateY(${y}px)`, ...style }}>{children}</div>;
};

const Marquee: React.FC<{ y: number; speed?: number }> = ({ y, speed = 3 }) => {
  const frame = useCurrentFrame();
  const words = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES];
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, padding: "26px 0", overflow: "hidden", whiteSpace: "nowrap" }}>
      <div style={{ display: "inline-flex", transform: `translateX(${-((frame * speed) % 1800)}px)` }}>
        {words.map((w, i) => (
          <span
            key={i}
            style={{
              fontFamily: T.mono, fontSize: 30, letterSpacing: "0.1em", padding: "0 38px",
              color: i % 2 ? "transparent" : T.paper,
              WebkitTextStroke: i % 2 ? `1px ${T.paperDim}` : undefined,
            }}
          >
            {w} <span style={{ color: T.citron }}>✳</span>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ---------- 인트로 ---------- */

const Intro: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => (
  <Fade durationInFrames={durationInFrames}>
    <AbsoluteFill style={{ padding: "120px 130px", justifyContent: "center" }}>
      <Rise delay={4}><SectionLabel text="001 — 데모 영상" /></Rise>
      <Rise delay={12}>
        <div style={{ fontFamily: T.sans, fontWeight: 800, fontSize: 150, lineHeight: 0.92, letterSpacing: "-0.04em", color: T.paper, marginTop: 48 }}>
          영상 아카이브
          <br />
          <span style={{ color: "transparent", WebkitTextStroke: `2.5px ${T.paper}` }}>&amp; 검수</span>{" "}
          <span style={{ color: T.citron }}>시스템</span>
        </div>
      </Rise>
      <Rise delay={26}>
        <div style={{ fontFamily: T.mono, fontSize: 26, letterSpacing: "0.1em", color: T.paperDim, marginTop: 54 }}>
          업로드 한 번으로 아카이브 + 금칙 검수 · 자연어 검색 · 방송심의 규정 8종
        </div>
      </Rise>
    </AbsoluteFill>
    <Marquee y={880} />
    <Grain />
  </Fade>
);

/* ---------- 챕터 카드 ---------- */

const Chapter: React.FC<{ num: string; title: string; sub: string; durationInFrames: number }> = ({ num, title, sub, durationInFrames }) => (
  <Fade durationInFrames={durationInFrames}>
    <AbsoluteFill style={{ padding: "0 130px", justifyContent: "center" }}>
      <Rise>
        <div style={{ fontFamily: T.mono, fontSize: 34, color: T.paperFaint, letterSpacing: "0.08em" }}>/{num}</div>
      </Rise>
      <Rise delay={6}>
        <div style={{ fontFamily: T.sans, fontWeight: 800, fontSize: 120, letterSpacing: "-0.04em", lineHeight: 0.95, color: T.paper, marginTop: 26 }}>
          {title}
        </div>
      </Rise>
      <Rise delay={14}>
        <div style={{ fontFamily: T.mono, fontSize: 24, letterSpacing: "0.1em", color: T.paperDim, marginTop: 38 }}>{sub}</div>
      </Rise>
      <Rise delay={20}>
        <div style={{ width: 240, height: 3, background: T.citron, marginTop: 56 }} />
      </Rise>
    </AbsoluteFill>
    <Grain />
  </Fade>
);

/* ---------- 클립 (화면 녹화) ---------- */

const Clip: React.FC<{ src: string; label: string; durationInFrames: number }> = ({ src, label, durationInFrames }) => {
  const { height } = useVideoConfig();
  const frame = useCurrentFrame();
  const innerH = height - 150;
  const innerW = Math.round(innerH * 1.6); // 2560x1600 = 16:10
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.015]);
  return (
    <Fade durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 34 }}>
        <div style={{ width: innerW, height: innerH, border: `1px solid ${T.lineStrong}`, overflow: "hidden", position: "relative", background: T.ink2 }}>
          <OffthreadVideo src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 36, left: 130, right: 130, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel text={label} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: T.mono, fontSize: 20, letterSpacing: "0.12em", color: T.paperDim }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: T.citron, boxShadow: `0 0 16px ${T.citron}` }} />
          ARCHIVE / 운영 콘솔
        </div>
      </div>
      <Grain />
    </Fade>
  );
};

/* ---------- 아웃트로 ---------- */

const Outro: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => (
  <Fade durationInFrames={durationInFrames}>
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Rise>
        <div style={{ display: "flex", alignItems: "center", gap: 26, fontFamily: T.mono, fontSize: 34, letterSpacing: "0.16em", color: T.paper }}>
          <span style={{ width: 18, height: 18, borderRadius: "50%", background: T.citron, boxShadow: `0 0 24px ${T.citron}` }} />
          ARCHIVE <span style={{ color: T.paperFaint }}>/ 영상 검수 시스템</span>
        </div>
      </Rise>
      <Rise delay={12}>
        <div style={{ fontFamily: T.mono, fontSize: 22, letterSpacing: "0.12em", color: T.paperFaint, marginTop: 44 }}>
          방송심의 규정 8종 · 심각도 0–5 · 2026
        </div>
      </Rise>
    </AbsoluteFill>
    <Grain />
  </Fade>
);

/* ---------- 본편 ---------- */

export const CLIP1_FRAMES = Math.round(43.8 * 30);
export const CLIP2_FRAMES = Math.round(68.8 * 30);
export const CLIP3_FRAMES = Math.round(10.2 * 30);
export const INTRO = 110;
export const CHAPTER = 55;
export const OUTRO = 95;
export const TOTAL = INTRO + CHAPTER + CLIP1_FRAMES + CHAPTER + CLIP2_FRAMES + CHAPTER + CLIP3_FRAMES + OUTRO;

export const Demo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: T.ink }}>
    <Series>
      <Series.Sequence durationInFrames={INTRO}>
        <Intro durationInFrames={INTRO} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CHAPTER}>
        <Chapter num="01" title="업로드 & 파이프라인" sub="모델·샘플링 선택 → 병렬 8단계 실시간 처리" durationInFrames={CHAPTER} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CLIP1_FRAMES}>
        <Clip src="clip1.mp4" label="01 — 업로드 데모" durationInFrames={CLIP1_FRAMES} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CHAPTER}>
        <Chapter num="02" title="아카이브 · 리포트 · 검색" sub="타임라인 · 위반 프레임 · 자연어 검색" durationInFrames={CHAPTER} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CLIP2_FRAMES}>
        <Clip src="clip2.mp4" label="02 — 아카이브 데모" durationInFrames={CLIP2_FRAMES} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CHAPTER}>
        <Chapter num="03" title="삭제" sub="원본 + 리포트 · 색인 · 프레임까지 한 번에 정리" durationInFrames={CHAPTER} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={CLIP3_FRAMES}>
        <Clip src="clip3.mp4" label="03 — 삭제 데모" durationInFrames={CLIP3_FRAMES} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={OUTRO}>
        <Outro durationInFrames={OUTRO} />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
