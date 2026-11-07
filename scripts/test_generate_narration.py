"""Unit tests for the pure helpers in generate-narration.py (no network)."""

import importlib.util
import unittest
from pathlib import Path

_PATH = Path(__file__).resolve().parent / "generate-narration.py"
_spec = importlib.util.spec_from_file_location("generate_narration", _PATH)
gn = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gn)


class TicksToMs(unittest.TestCase):
    def test_converts_100ns_ticks(self):
        self.assertEqual(gn.ticks_to_ms(12_340_000), 1234)

    def test_rounds_to_nearest(self):
        self.assertEqual(gn.ticks_to_ms(15_000), 2)


class TextHash(unittest.TestCase):
    def test_stable(self):
        self.assertEqual(gn.text_hash("Hi.", "v"), gn.text_hash("Hi.", "v"))

    def test_changes_with_text_or_voice(self):
        base = gn.text_hash("Hi.", "v")
        self.assertNotEqual(base, gn.text_hash("Hi!", "v"))
        self.assertNotEqual(base, gn.text_hash("Hi.", "w"))
        self.assertEqual(len(base), 64)


class SplitSentences(unittest.TestCase):
    def test_splits_on_terminators(self):
        self.assertEqual(gn.split_sentences("A. B! C?"), ["A.", "B!", "C?"])

    def test_keeps_trailing_fragment_and_trims(self):
        self.assertEqual(gn.split_sentences("  One. Two  "), ["One.", "Two"])

    def test_empty(self):
        self.assertEqual(gn.split_sentences("  "), [])

    def test_splits_on_japanese_terminators(self):
        self.assertEqual(
            gn.split_sentences("土星には環があります。氷でできています！古いのでしょうか？"),
            ["土星には環があります。", "氷でできています！", "古いのでしょうか？"],
        )

    def test_keeps_decimal_inside_japanese_sentence(self):
        self.assertEqual(
            gn.split_sentences("地軸は約23.5度傾いています。季節が生まれます。"),
            ["地軸は約23.5度傾いています。", "季節が生まれます。"],
        )

    def test_japanese_fallback_cues_cover_every_sentence(self):
        cues = gn.fallback_cues(gn.split_sentences("環があります。氷です！古い？"), 1400)
        self.assertEqual([c["text"] for c in cues], ["環があります。", "氷です！", "古い？"])
        self.assertEqual(cues[0]["startMs"], 0)
        self.assertEqual(cues[-1]["endMs"], 1400)
        for a, b in zip(cues, cues[1:]):
            self.assertEqual(a["endMs"], b["startMs"])


class FallbackCues(unittest.TestCase):
    def test_contiguous_and_covering(self):
        cues = gn.fallback_cues(["Aaaa.", "Bb."], 1000)
        self.assertEqual(cues[0]["startMs"], 0)
        self.assertEqual(cues[-1]["endMs"], 1000)
        self.assertEqual(cues[0]["endMs"], cues[1]["startMs"])
        self.assertEqual([c["text"] for c in cues], ["Aaaa.", "Bb."])

    def test_proportional_to_characters(self):
        cues = gn.fallback_cues(["aaa", "a"], 400)
        self.assertEqual(cues[0]["endMs"], 300)

    def test_empty(self):
        self.assertEqual(gn.fallback_cues([], 500), [])


class MakeContiguous(unittest.TestCase):
    def test_first_cue_starts_at_zero_and_last_ends_at_duration(self):
        cues = [{"startMs": 100, "endMs": 900, "text": "A."}, {"startMs": 900, "endMs": 1500, "text": "B."}]
        out = gn.make_contiguous(cues, 1600)
        self.assertEqual(out[0]["startMs"], 0)
        self.assertEqual(out[-1]["endMs"], 1600)

    def test_closes_gaps_and_overlaps(self):
        cues = [
            {"startMs": 0, "endMs": 3488, "text": "A."},
            {"startMs": 3438, "endMs": 5000, "text": "B."},
            {"startMs": 5010, "endMs": 6000, "text": "C."},
        ]
        out = gn.make_contiguous(cues, 6000)
        self.assertEqual([c["startMs"] for c in out], [0, 3488, 5000])
        self.assertEqual([c["endMs"] for c in out], [3488, 5000, 6000])
        self.assertEqual([c["text"] for c in out], ["A.", "B.", "C."])

    def test_never_inverts_a_cue(self):
        cues = [{"startMs": 0, "endMs": 500, "text": "A."}, {"startMs": 400, "endMs": 450, "text": "B."}]
        out = gn.make_contiguous(cues, 500)
        self.assertGreaterEqual(out[1]["endMs"], out[1]["startMs"])

    def test_idempotent(self):
        cues = [{"startMs": 100, "endMs": 900, "text": "A."}, {"startMs": 850, "endMs": 1500, "text": "B."}]
        once = gn.make_contiguous(cues, 1500)
        self.assertEqual(gn.make_contiguous(once, 1500), once)

    def test_empty(self):
        self.assertEqual(gn.make_contiguous([], 500), [])


class AlignCueText(unittest.TestCase):
    def test_restores_source_punctuation_rewritten_by_the_service(self):
        # Edge TTS returned "ウィリアム、ハーシェル" for the source "ウィリアム・ハーシェル".
        cues = [
            {"startMs": 0, "endMs": 100, "text": "寒いです。"},
            {"startMs": 100, "endMs": 200, "text": "ウィリアム、ハーシェルです。"},
        ]
        out = gn.align_cue_text(cues, "寒いです。ウィリアム・ハーシェルです。")
        self.assertEqual([c["text"] for c in out], ["寒いです。", "ウィリアム・ハーシェルです。"])
        self.assertEqual([(c["startMs"], c["endMs"]) for c in out], [(0, 100), (100, 200)])

    def test_keeps_source_spacing_inside_a_cue(self):
        cues = [{"startMs": 0, "endMs": 1, "text": "Hi  there."}, {"startMs": 1, "endMs": 2, "text": "Bye."}]
        out = gn.align_cue_text(cues, "Hi there. Bye.")
        self.assertEqual([c["text"] for c in out], ["Hi there.", "Bye."])

    def test_leaves_cues_alone_when_lengths_differ(self):
        cues = [{"startMs": 0, "endMs": 1, "text": "Twenty three."}]
        self.assertEqual(gn.align_cue_text(cues, "23."), cues)


class Voices(unittest.TestCase):
    def test_supported_locales_in_order(self):
        self.assertEqual(list(gn.VOICES), ["vi", "en", "ja"])

    def test_keeps_vietnamese_and_english_voices(self):
        self.assertEqual(gn.VOICES["vi"], "vi-VN-HoaiMyNeural")
        self.assertEqual(gn.VOICES["en"], "en-US-AvaNeural")

    def test_japanese_voice_is_a_ja_jp_neural_voice(self):
        self.assertRegex(gn.VOICES["ja"], r"^ja-JP-[A-Za-z]+Neural$")

    def test_every_voice_has_a_tour_source(self):
        for lang in gn.VOICES:
            path = gn.TOUR_DIR / f"{lang}.json"
            self.assertTrue(path.exists(), path)


class NeedsRegen(unittest.TestCase):
    ENTRY = {"hash": "h1"}

    def test_missing_entry(self):
        self.assertTrue(gn.needs_regen(None, "h1", True))

    def test_hash_changed(self):
        self.assertTrue(gn.needs_regen(self.ENTRY, "h2", True))

    def test_mp3_missing(self):
        self.assertTrue(gn.needs_regen(self.ENTRY, "h1", False))

    def test_up_to_date(self):
        self.assertFalse(gn.needs_regen(self.ENTRY, "h1", True))


if __name__ == "__main__":
    unittest.main()
