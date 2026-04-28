#!/usr/bin/env python3
import json
import os
import pathlib
import sys
import urllib.request
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]
API_BASE = "http://127.0.0.1:3000/app/api/mixes"
VENICE_URL = "https://api.venice.ai/api/v1/audio/speech"
DEFAULT_VOICE = "am_adam"
MODEL = "tts-kokoro"
SCRIPT_MODEL = "z-ai-glm-5-turbo"
SPEECH_SPEED = 1.08


def fetch_json(url: str, method: str = "GET") -> Any:
    req = urllib.request.Request(url, method=method)
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode())


def render_tts(text: str, dest: pathlib.Path, voice: str) -> None:
    api_key = os.environ.get("VENICE_API_KEY")
    if not api_key:
        raise RuntimeError("VENICE_API_KEY is missing")
    payload = json.dumps({
        "model": MODEL,
        "voice": voice,
        "input": text,
        "response_format": "mp3",
        "speed": SPEECH_SPEED,
        "streaming": False,
    }).encode()
    req = urllib.request.Request(
        VENICE_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        dest.write_bytes(resp.read())


def youtube_video_id(url: str) -> str:
    if not url:
        return ""
    try:
        from urllib.parse import parse_qs, urlparse
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if "youtu.be" in host:
            return parsed.path.replace("/", "").strip()
        if "youtube.com" in host:
            query = parse_qs(parsed.query)
            if query.get("v"):
                return query["v"][0].strip()
            segments = [segment for segment in parsed.path.split("/") if segment]
            if "embed" in segments:
                index = segments.index("embed")
                if index + 1 < len(segments):
                    return segments[index + 1].strip()
    except Exception:
        return ""
    return ""


def track_label(track: dict[str, Any]) -> str:
    title = str(track.get("title") or "").strip()
    artist = str(track.get("artist") or "").strip()
    if title and artist:
        return f"{title} by {artist}"
    return title or artist or "this next track"


def generate_script_json(mix: dict[str, Any], playable_tracks: list[dict[str, Any]]) -> dict[str, str]:
    api_key = os.environ.get("VENICE_API_KEY")
    if not api_key:
        raise RuntimeError("VENICE_API_KEY is missing")

    title = str(mix.get("title") or "").strip()
    vibe = str(mix.get("vibe") or "").strip()
    use_case = str(mix.get("useCase") or "").strip()
    tags = [str(tag).strip() for tag in mix.get("tags", []) if str(tag).strip()]
    tracks_payload = [
        {
            "index": i,
            "title": str(track.get("title") or "").strip(),
            "artist": str(track.get("artist") or "").strip(),
            "energy": str(track.get("energy") or "").strip(),
            "notes": str(track.get("notes") or "").strip(),
            "moodTags": track.get("moodTags", [])[:4],
            "sceneTags": track.get("sceneTags", [])[:4],
        }
        for i, track in enumerate(playable_tracks)
    ]

    system = (
        "You are writing one coherent late-night radio host script for a mixtape. "
        "Be warm, sly, playful, and specific. Never repeat the same opener or catchphrase twice. "
        "Do not sound templated. Do not use bullet points. Keep each segment short enough for a quick radio break. "
        "Mention the songs naturally. Have a little fun, but stay cool and stylish, not wacky. "
        "Return strict JSON only."
    )
    user = {
        "mixTitle": title,
        "vibe": vibe,
        "useCase": use_case,
        "tags": tags,
        "persona": "late-night mixtape host; charming, cinematic, a little mischievous, never repetitive",
        "instructions": {
            "intro": "Welcome listeners into the mood of the tape and mention the first song naturally.",
            "transitions": "Write one unique transition for every playable track after the first. Each should feel distinct from the others and tee up the next song.",
            "outro": "Close the broadcast with a stylish sign-off."
        },
        "tracks": tracks_payload,
        "outputSchema": {
            "intro": "string",
            "transitions": [{"index": "number", "text": "string"}],
            "outro": "string"
        }
    }

    payload = json.dumps({
        "model": SCRIPT_MODEL,
        "temperature": 0.9,
        "max_tokens": 1800,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user)}
        ],
        "response_format": {"type": "json_object"}
    }).encode()

    req = urllib.request.Request(
        "https://api.venice.ai/api/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read().decode())

    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    scripts: dict[str, str] = {
        "intro": str(parsed["intro"]).strip(),
        "outro": str(parsed["outro"]).strip(),
    }
    for item in parsed.get("transitions", []):
        index = int(item["index"])
        if index < 1:
            continue
        scripts[f"transition_{index}"] = str(item["text"]).strip()
    return scripts


def main() -> int:
    mix_id = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    voice = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else DEFAULT_VOICE
    payload = fetch_json(f"{API_BASE}/{mix_id}", method="GET")
    mix = payload["mix"]
    tracks = mix.get("tracks", [])
    playable_tracks = []
    for track in tracks:
        youtube_id = youtube_video_id(str(track.get("youtubeUrl") or ""))
        if not youtube_id:
            continue
        enriched = dict(track)
        enriched["youtubeId"] = youtube_id
        playable_tracks.append(enriched)

    if len(playable_tracks) < 1:
        raise RuntimeError("Need at least one playable YouTube track in the mix to build narration")

    build_dir = ROOT / "data" / "generated-mixtapes" / f"{mix_id}-dj-hosted"
    build_dir.mkdir(parents=True, exist_ok=True)

    scripts = generate_script_json(mix, playable_tracks)

    voice_files: dict[str, str] = {}
    for name, text in scripts.items():
        clip_path = build_dir / f"{name}.mp3"
        render_tts(text, clip_path, voice)
        voice_files[name] = f"/app/api/mixes/{mix_id}/dj-hosted/clip/{name}"

    script_path = build_dir / "dj-script.json"
    result = {
        "mixId": mix_id,
        "mixTitle": mix["title"],
        "voice": voice,
        "model": MODEL,
        "segments": scripts,
        "sourceTracks": playable_tracks[:3],
        "clips": voice_files,
        "streamUrl": f"/app/api/mixes/{mix_id}/dj-hosted/file?mode=stream",
        "downloadUrl": f"/app/api/mixes/{mix_id}/dj-hosted/file?mode=download"
    }
    script_path.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
