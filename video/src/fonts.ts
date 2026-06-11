/* 수동 폰트 로더 — @remotion/fonts의 loadFont 대신 사용.
   탭 재시작 시 delayRender가 영구히 안 풀리는 문제를 피하기 위해
   어떤 경우에도 8초 안에 continueRender를 보장한다 (data URL이라 실제로는 ms 단위). */
import { JBM_MD, PRETENDARD_MD, PRETENDARD_XB } from "./fontdata";

const FONTS: Array<[string, string, string]> = [
  ["Pretendard", PRETENDARD_XB, "800"],
  ["Pretendard", PRETENDARD_MD, "500"],
  ["JetBrains Mono", JBM_MD, "500"],
];

if (typeof document !== "undefined") {
  // delayRender 없이 동기 등록 — data URL 폰트는 즉시 적용되고,
  // 탭이 얼어붙어도 렌더 전체를 취소시키지 않는다.
  for (const [family, url, weight] of FONTS) {
    const face = new FontFace(family, `url(${url}) format('woff2')`, { weight });
    document.fonts.add(face);
    face.load().catch(() => {});
  }
}
