"""OpenAI API 래퍼 — 자막 교정 / 장면 분석 / 금칙 판정 (structured outputs)."""
from __future__ import annotations

import base64
import json

CATEGORIES = ["성표현", "폭력", "충격혐오", "유해행위", "인격권", "차별증오", "아동청소년", "광고저작권", "정상"]

_CORR_SCHEMA = {
    "name": "corrections",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "corrections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"tc": {"type": "string"}, "orig": {"type": "string"}, "fix": {"type": "string"}},
                    "required": ["tc", "orig", "fix"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["corrections"],
        "additionalProperties": False,
    },
}

_JUDGE_SCHEMA = {
    "name": "judgement",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "category": {"type": "string", "enum": CATEGORIES},
            "sev": {"type": "integer", "enum": [0, 1, 2, 3, 4, 5]},
            "rule": {"type": "string"},
            "reason": {"type": "string"},
            "sound": {"type": "string"},
        },
        "required": ["category", "sev", "rule", "reason", "sound"],
        "additionalProperties": False,
    },
}


def get_client():
    from openai import OpenAI

    return OpenAI()


def _text(response) -> str:
    return response.choices[0].message.content or ""


def _img_block(jpeg: bytes) -> dict:
    return {
        "type": "image_url",
        "image_url": {"url": f"data:image/jpeg;base64,{base64.b64encode(jpeg).decode()}"},
    }


def correct_captions(client, model: str, lines: list[dict]) -> list[dict]:
    """오탈자·잘못 들린 단어 교정 — 바뀐 문장만 반환 (PRD 4-2)."""
    if not lines:
        return []
    listing = "\n".join(f"[{l['tc']}] {l['text']}" for l in lines)
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "너는 한국어 방송 자막 교정자다. 오탈자, 음성 인식 오류로 잘못 적힌 단어, 맞춤법 오류만 고친다. "
                    "문체나 표현은 바꾸지 않는다. 고칠 필요가 있는 줄만 corrections에 담아라. "
                    "고칠 것이 없으면 빈 배열을 반환하라. orig는 원문 그대로, fix는 교정문 전체."
                ),
            },
            {"role": "user", "content": listing},
        ],
        response_format={"type": "json_schema", "json_schema": _CORR_SCHEMA},
    )
    try:
        data = json.loads(_text(resp))
        return [c for c in data.get("corrections", []) if c.get("orig") != c.get("fix")]
    except (json.JSONDecodeError, KeyError):
        return []


def analyze_scene(client, model: str, jpeg: bytes, tc: str) -> str:
    """대표 화면 1장을 보고 검색에 쓸 한 줄 설명 생성 (PRD 4-2 장면 분석)."""
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "영상 아카이브 검색용 장면 설명을 만든다. 화면에 보이는 장소·인물·행동·분위기를 한국어 1~2문장으로 구체적으로 묘사하라. 설명 문장만 출력.",
            },
            {"role": "user", "content": [_img_block(jpeg), {"type": "text", "text": f"타임코드 {tc} 장면을 설명하라."}]},
        ],
    )
    return _text(resp).strip()


def judge_window(client, model: str, frames_jpeg: list[bytes], transcript_snippet: str, rules_text: str, tc: str) -> dict:
    """연속 2~3프레임 + 대사·소리 근거로 금칙 판정 (PRD 4-4 v1.1).

    실패 시 정상(0) 처리하고 계속 진행한다.
    """
    fallback = {"category": "정상", "sev": 0, "rule": "", "reason": "", "sound": ""}
    try:
        content: list[dict] = [_img_block(j) for j in frames_jpeg]
        content.append({
            "type": "text",
            "text": (
                f"연속 {len(frames_jpeg)}장의 프레임이다 (타임코드 {tc} 부근, 1초 간격). "
                f"동작의 흐름을 보고 금칙 여부를 판정하라.\n\n해당 구간 대사/자막:\n{transcript_snippet or '(없음)'}"
            ),
        })
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "너는 방송 금칙 검수 심의관이다. 아래 판정 기준 문서만 근거로 판정한다.\n"
                        "정지 화면 한 장이 아니라 연속 프레임의 동작 흐름으로 판단하고, 대사·소리(비명·욕설·타격음)도 근거에 포함하라.\n"
                        "모호하면 sev 3(검토 필요)로 분류한다. 위반이 없으면 category 정상, sev 0.\n"
                        "rule에는 근거 조문(예: 방송심의규정 §36(폭력묘사) ②), sound에는 소리 근거를 적는다.\n\n"
                        f"--- 판정 기준 ---\n{rules_text}"
                    ),
                },
                {"role": "user", "content": content},
            ],
            response_format={"type": "json_schema", "json_schema": _JUDGE_SCHEMA},
        )
        data = json.loads(_text(resp))
        if data.get("category") not in CATEGORIES:
            return fallback
        data["sev"] = int(data.get("sev", 0))
        return data
    except Exception:
        return fallback
