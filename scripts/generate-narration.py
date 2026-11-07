"""Generate Edge TTS narration mp3 files and the cue manifest.

Reads src/data/tour/{vi,en,ja}.json, writes public/audio/narration/<stopId>.<lang>.mp3
and public/audio/narration/manifest.json. edge_tts is imported lazily so the pure
helpers (and their unit tests) work without it.
"""

import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOUR_DIR = ROOT / "src" / "data" / "tour"
OUT_DIR = ROOT / "public" / "audio" / "narration"
MANIFEST_PATH = OUT_DIR / "manifest.json"

VOICES = {"vi": "vi-VN-HoaiMyNeural", "en": "en-US-AvaNeural", "ja": "ja-JP-NanamiNeural"}
RETRY_DELAYS = (2, 4, 8)
MP3_BITRATE = 48_000  # bits per second, used for the duration fallback


def ticks_to_ms(ticks):
    """Convert 100-ns ticks to whole milliseconds."""
    return round(ticks / 10_000)


def text_hash(text, voice):
    return hashlib.sha256(f"{voice}\n{text}".encode("utf-8")).hexdigest()


# A sentence ends at a run of . ! ? or the Japanese terminators; a '.' between two
# digits (23.5) is a decimal point. Mirrors splitSentences() in src/tour/narration.ts.
SENTENCE_RE = re.compile(r"(?:[^.!?。！？]|(?<=\d)\.(?=\d))+(?:[.!?。！？]+|$)")


def split_sentences(text):
    parts = SENTENCE_RE.findall(text.strip())
    return [p.strip() for p in parts if p.strip()]


def fallback_cues(sentences, duration_ms):
    total = sum(len(s) for s in sentences)
    if not sentences or total == 0:
        return []
    cues = []
    consumed = 0
    start = 0
    for i, s in enumerate(sentences):
        consumed += len(s)
        end = duration_ms if i == len(sentences) - 1 else round(duration_ms * consumed / total)
        cues.append({"startMs": start, "endMs": end, "text": s})
        start = end
    return cues


def make_contiguous(cues, duration_ms):
    """Close Edge TTS cue gaps and overlaps so cues tile [0, duration_ms].

    The first cue starts at 0 (absorbing leading silence), each later cue starts
    where the previous one ended, and the last cue ends at duration_ms.
    """
    out = []
    prev_end = 0
    for i, cue in enumerate(cues):
        start = prev_end
        if i == len(cues) - 1:
            end = duration_ms
        else:
            end = max(cue["endMs"], start)
        out.append({"startMs": start, "endMs": end, "text": cue["text"]})
        prev_end = end
    return out


def align_cue_text(cues, text):
    """Replace each cue's text with the matching slice of the source script.

    Edge TTS sometimes rewrites punctuation in its boundary text (Japanese "・"
    comes back as "、"). When the cues hold the same number of non-space
    characters as the source, each cue takes the source slice of its length, so
    subtitles show the script exactly. Otherwise the cues are returned unchanged.
    """
    lengths = [len(re.sub(r"\s+", "", c["text"])) for c in cues]
    if sum(lengths) != len(re.sub(r"\s+", "", text)):
        return cues
    out = []
    pos = 0
    for cue, length in zip(cues, lengths):
        start = pos
        seen = 0
        while seen < length:
            if not text[pos].isspace():
                seen += 1
            pos += 1
        out.append({**cue, "text": text[start:pos].strip()})
    return out


def needs_regen(entry, new_hash, mp3_exists):
    return entry is None or entry.get("hash") != new_hash or not mp3_exists


def estimate_duration_ms(mp3_bytes):
    return round(len(mp3_bytes) * 8 * 1000 / MP3_BITRATE)


async def synthesize(text, voice):
    """Return (mp3_bytes, cues, duration_ms) for one segment."""
    import edge_tts  # lazy: keeps module import-safe without the dependency

    communicate = edge_tts.Communicate(text, voice, boundary="SentenceBoundary")
    audio = bytearray()
    cues = []
    last_end = 0
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "SentenceBoundary":
            start = ticks_to_ms(chunk["offset"])
            end = start + ticks_to_ms(chunk["duration"])
            cues.append({"startMs": start, "endMs": end, "text": chunk["text"]})
            last_end = max(last_end, end)
    data = bytes(audio)
    duration = last_end if cues else estimate_duration_ms(data)
    if not cues:
        cues = fallback_cues(split_sentences(text), duration)
    else:
        cues = align_cue_text(make_contiguous(cues, duration), text)
    return data, cues, duration


async def synthesize_with_retry(text, voice):
    last_error = None
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            return await synthesize(text, voice)
        except Exception as error:  # network/service errors vary; retry all
            last_error = error
            if attempt < len(RETRY_DELAYS):
                await asyncio.sleep(RETRY_DELAYS[attempt])
    raise last_error


def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {"version": 1, "voices": dict(VOICES), "segments": {}}


async def run():
    sources = {}
    for lang in VOICES:
        path = TOUR_DIR / f"{lang}.json"
        if not path.exists():
            print(f"ERROR missing tour data: {path}", file=sys.stderr)
            return 1
        sources[lang] = json.loads(path.read_text(encoding="utf-8"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    manifest["version"] = 1
    manifest["voices"] = dict(VOICES)
    segments = manifest.setdefault("segments", {})
    for stop_id, by_lang in segments.items():
        for lang, entry in by_lang.items():
            cues = make_contiguous(entry["cues"], entry["durationMs"])
            source = sources.get(lang, {}).get(stop_id)
            entry["cues"] = align_cue_text(cues, source["text"]) if source else cues
    failed = False

    for lang, stops in sources.items():
        voice = VOICES[lang]
        for stop_id, stop in stops.items():
            text = stop["text"]
            rel = f"audio/narration/{stop_id}.{lang}.mp3"
            mp3_path = OUT_DIR / f"{stop_id}.{lang}.mp3"
            new_hash = text_hash(text, voice)
            entry = segments.get(stop_id, {}).get(lang)
            if not needs_regen(entry, new_hash, mp3_path.exists()):
                print(f"OK {stop_id}.{lang} (unchanged)")
                continue
            try:
                data, cues, duration = await synthesize_with_retry(text, voice)
            except Exception as error:
                print(f"FAILED {stop_id}.{lang}: {error}", file=sys.stderr)
                failed = True
                continue
            mp3_path.write_bytes(data)
            segments.setdefault(stop_id, {})[lang] = {
                "file": rel,
                "durationMs": duration,
                "hash": new_hash,
                "cues": cues,
            }
            print(f"GENERATED {stop_id}.{lang} ({duration} ms)")

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return 1 if failed else 0


def main():
    return asyncio.run(run())


if __name__ == "__main__":
    sys.exit(main())
