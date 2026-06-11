/* ============================================================
   Mock data — 영상 아카이브 & 검수 시스템
   (백엔드 연동 전까지 사용하는 데모 데이터)
   ============================================================ */

// 방송심의 규정 기준 8종
export const CATEGORIES = [
  { id: "성표현", code: "SEX" },
  { id: "폭력", code: "VIO" },
  { id: "충격혐오", code: "SHK" },
  { id: "유해행위", code: "HRM" },
  { id: "인격권", code: "PRV" },
  { id: "차별증오", code: "DSC" },
  { id: "아동청소년", code: "MNR" },
  { id: "광고저작권", code: "ADV" },
];

// severity: 0 통과 / 1-2 주의 / 3 경고(검토필요) / 4-5 방영불가
export const VIDEOS = [
  {
    id: "v-angae-07",
    title: "드라마_안개도시_7회_심의용.mp4",
    duration: "47:12", durationSec: 2832,
    size: "3.8 GB", uploadedAt: "2026-06-11 09:24",
    status: "done", captionSource: "임베디드 자막",
    counts: { violation: 5, review: 2, pass: 0 }, maxSev: 5,
  },
  {
    id: "v-byeolbit-38",
    title: "주말극_별빛아래_38회_가편.mp4",
    duration: "61:40", durationSec: 3700,
    size: "5.1 GB", uploadedAt: "2026-06-11 08:02",
    status: "done", captionSource: "임베디드 자막",
    counts: { violation: 2, review: 3, pass: 0 }, maxSev: 4,
  },
  {
    id: "v-dosi-grim",
    title: "시사기획_도시의그늘_본편.mp4",
    duration: "52:18", durationSec: 3138,
    size: "4.2 GB", uploadedAt: "2026-06-10 22:47",
    status: "done", captionSource: "음성 인식(STT)",
    counts: { violation: 0, review: 1, pass: 0 }, maxSev: 3,
  },
  {
    id: "v-bulgeum",
    title: "예능_불금파티_12회.mp4",
    duration: "73:05", durationSec: 4385,
    size: "6.4 GB", uploadedAt: "2026-06-11 10:11",
    status: "processing", captionSource: "—",
    counts: { violation: 0, review: 0, pass: 0 }, maxSev: 0,
  },
  {
    id: "v-yasaeng-04",
    title: "다큐_야생의기록_4부.mp4",
    duration: "44:50", durationSec: 2690,
    size: "3.5 GB", uploadedAt: "2026-06-10 19:30",
    status: "done", captionSource: "임베디드 자막",
    counts: { violation: 0, review: 0, pass: 12 }, maxSev: 0,
  },
  {
    id: "v-news-0610",
    title: "뉴스특보_0610.mp4",
    duration: "18:22", durationSec: 1102,
    size: "1.2 GB", uploadedAt: "2026-06-10 18:00",
    status: "done", captionSource: "음성 인식(STT)",
    counts: { violation: 0, review: 0, pass: 6 }, maxSev: 0,
  },
];

// processing stages for the in-flight video (영상 내 병렬)
export const PROCESSING = {
  videoId: "v-bulgeum",
  stages: [
    { name: "자막 추출", pct: 100, state: "done" },
    { name: "자막 교정", pct: 72, state: "run" },
    { name: "장면 분석", pct: 64, state: "run" },
    { name: "기술 검토", pct: 88, state: "run" },
    { name: "프레임 샘플링", pct: 54, state: "run" },
    { name: "프레임별 금칙 판정", pct: 31, state: "run" },
    { name: "색인 생성", pct: 0, state: "wait" },
    { name: "종합 판정", pct: 0, state: "wait" },
  ],
};

// detailed report for the focus video (안개도시 7회)
export const REPORT = {
  videoId: "v-angae-07",
  summary: {
    verdict: "방영 불가",
    maxSev: 5,
    framesSampled: 2784,
    violation: 5,
    review: 2,
    categoriesHit: ["폭력", "성표현", "인격권"],
  },
  // timeline segments as % of duration; type: normal|silence|black|review|violation
  timeline: [
    { type: "black", from: 0, to: 0.8 },
    { type: "normal", from: 0.8, to: 14 },
    { type: "silence", from: 14, to: 15.2 },
    { type: "normal", from: 15.2, to: 23.5 },
    { type: "review", from: 23.5, to: 24.6 },
    { type: "normal", from: 24.6, to: 38 },
    { type: "violation", from: 38, to: 39.1 },
    { type: "normal", from: 39.1, to: 47 },
    { type: "silence", from: 47, to: 47.6 },
    { type: "normal", from: 47.6, to: 55 },
    { type: "violation", from: 55, to: 56.4 },
    { type: "normal", from: 56.4, to: 62 },
    { type: "review", from: 62, to: 62.9 },
    { type: "normal", from: 62.9, to: 71 },
    { type: "violation", from: 71, to: 72.2 },
    { type: "normal", from: 72.2, to: 83 },
    { type: "violation", from: 83, to: 84.3 },
    { type: "normal", from: 84.3, to: 91 },
    { type: "violation", from: 91, to: 92.4 },
    { type: "normal", from: 92.4, to: 99.2 },
    { type: "black", from: 99.2, to: 100 },
  ],
  ticks: ["00:00", "11:48", "23:36", "35:24", "47:12"],
  // flagged frames (위반 + 검토필요)
  frames: [
    {
      tc: "18:04", category: "폭력", sev: 5,
      rule: "방송심의규정 §36(폭력묘사) ②",
      reason: "연속 3프레임에서 뺨을 가격하는 동작의 흐름이 확인됨. 직전 대사 '너 같은 건…'과 비명 소리가 판단 근거에 포함됨.",
      sound: "비명 · 타격음",
    },
    {
      tc: "26:11", category: "성표현", sev: 5,
      rule: "방송심의규정 §35(성표현) ①",
      reason: "의도적 탈의 및 성적 어필 장면. 기준 개정(의도적 탈의=4)에 따라 방영 불가로 상향됨.",
      sound: "배경음악",
    },
    {
      tc: "33:28", category: "폭력", sev: 4,
      rule: "방송심의규정 §36(폭력묘사) ①",
      reason: "머리채를 잡고 끌고 가는 연속 동작. 정지 화면 단독으로는 모호하나 2~3장 묶음에서 명확히 판정됨.",
      sound: "고성 · 욕설",
    },
    {
      tc: "39:02", category: "인격권", sev: 4,
      rule: "방송심의규정 §20(인권보호) ②",
      reason: "특정인 비하 발언과 모욕적 제스처가 동시에 표출됨.",
      sound: "욕설",
    },
    {
      tc: "43:15", category: "폭력", sev: 4,
      rule: "방송심의규정 §36(폭력묘사) ②",
      reason: "밀치기 후 넘어지는 장면. 충격 강도가 높아 방영 불가로 판정됨.",
      sound: "타격음 · 신음",
    },
    {
      tc: "11:06", category: "충격혐오", sev: 3,
      rule: "방송심의규정 §37(충격·혐오감) ①",
      reason: "혈흔이 비치는 장면. 노출 정도가 경계 사례로 사람의 최종 확인이 필요함.",
      sound: "무음 구간 인접",
    },
    {
      tc: "29:34", category: "성표현", sev: 3,
      rule: "방송심의규정 §35(성표현) ②",
      reason: "밀착 장면의 수위가 모호함. 맥락상 연출 의도 확인이 필요해 검토필요로 분류됨.",
      sound: "대사 없음",
    },
  ],
  // analysis tab
  meta: {
    filename: "드라마_안개도시_7회_심의용.mp4",
    size: "3.8 GB", duration: "47:12", uploadedAt: "2026-06-11 09:24",
    captionSource: "임베디드 자막 (영상 내 자막 트랙 추출)",
    resolution: "1920×1080 · 23.976fps", codec: "H.264 / AAC",
  },
  tech: {
    silence: ["14:02–15:12", "47:00–47:36"],
    black: ["00:00–00:22", "47:00–47:12 (엔딩)"],
    freeze: ["31:40–31:44"],
    clipping: ["18:03–18:06 (타격음)", "55:11–55:13"],
  },
  scenes: [
    { tc: "02:14", desc: "비 내리는 도심 야경. 우산을 든 주인공이 횡단보도에서 누군가를 기다리는 설정 샷." },
    { tc: "11:06", desc: "병원 복도. 인물이 벽에 기대 주저앉아 있고 바닥에 붉은 얼룩이 비침 — 충격혐오 검토 대상." },
    { tc: "18:04", desc: "실내 거실, 두 인물이 다투는 중 한쪽이 다른 쪽의 뺨을 가격 — 폭력 위반." },
    { tc: "26:11", desc: "침실, 인물이 의도적으로 옷을 벗는 연출 — 성표현 위반." },
    { tc: "33:28", desc: "골목, 머리채를 잡고 끌고 가는 동작이 이어짐 — 폭력 위반." },
  ],
  corrections: [
    { tc: "06:32", orig: "이 도시는 안게로 가득 차 있어", fix: "이 도시는 안개로 가득 차 있어" },
    { tc: "19:48", orig: "그 사람 일흠도 모르잖아", fix: "그 사람 이름도 모르잖아" },
    { tc: "37:15", orig: "재발 부탁이야 한 번만", fix: "제발 부탁이야 한 번만" },
    { tc: "44:02", orig: "비가 오는 날엔 항상 그래", fix: "비가 오는 날엔 항상 그랬어" },
  ],
  transcript: [
    { tc: "00:24", text: "비가 그치질 않네요." },
    { tc: "02:14", text: "여기서 기다린 지 한 시간째예요." },
    { tc: "06:32", text: "이 도시는 안개로 가득 차 있어.", corrected: true },
    { tc: "11:06", text: "괜찮아요? 일어날 수 있겠어요?" },
    { tc: "15:40", text: "(무음 구간 — 대사 없음)" },
    { tc: "18:04", text: "너 같은 건 처음부터 믿지 말았어야 했어!", flag: true },
    { tc: "19:48", text: "그 사람 이름도 모르잖아.", corrected: true },
    { tc: "26:11", text: "(배경음악 — 대사 없음)" },
    { tc: "33:28", text: "놓으라고! 이거 안 놔?!", flag: true },
    { tc: "37:15", text: "제발 부탁이야 한 번만.", corrected: true },
    { tc: "44:02", text: "비가 오는 날엔 항상 그랬어.", corrected: true },
  ],
};

export const SEARCH = {
  suggested: ["비 내리는 야경", "다투는 장면", "병원 복도", "무음 구간", "욕설이 포함된 대사"],
  results: [
    {
      videoId: "v-angae-07", videoTitle: "드라마_안개도시_7회_심의용.mp4",
      tc: "02:14", source: "both",
      snippet: "비 내리는 도심 야경 — 우산을 든 주인공이 횡단보도에서 대기. 설정 샷으로 분위기를 잡는 장면.",
      reason: "키워드 '야경·비' 일치 + 장면 설명 벡터 유사도 0.89",
    },
    {
      videoId: "v-byeolbit-38", videoTitle: "주말극_별빛아래_38회_가편.mp4",
      tc: "31:52", source: "vector",
      snippet: "공원 벤치에서 두 인물이 우산 하나를 나눠 쓰고 대화하는 야간 장면.",
      reason: "의미 유사 — '비 오는 밤 분위기' 벡터 매칭 0.81",
    },
    {
      videoId: "v-dosi-grim", videoTitle: "시사기획_도시의그늘_본편.mp4",
      tc: "08:40", source: "keyword",
      snippet: "도심 항공 야경 위로 내레이션 — '이 도시의 밤은 누군가에겐 낮보다 길다'.",
      reason: "자막 키워드 '도시·야경·밤' 정확 일치",
    },
    {
      videoId: "v-angae-07", videoTitle: "드라마_안개도시_7회_심의용.mp4",
      tc: "11:06", source: "both",
      snippet: "병원 복도, 벽에 기대 주저앉은 인물 — 검수에서 충격혐오 검토 대상으로 표시된 구간.",
      reason: "키워드 '병원·복도' + 장면 벡터 0.84 · 검수 플래그 연동",
    },
  ],
};

export function sevLabel(s) {
  if (s >= 4) return { label: "방영 불가", cls: "s-block", code: s };
  if (s === 3) return { label: "검토 필요", cls: "s-review", code: s };
  if (s >= 1) return { label: "주의", cls: "s-caution", code: s };
  return { label: "통과", cls: "s-pass", code: s };
}
