"""验证语音剪辑保留发声、缩短长空白，并能生成不削波的科技提示音。"""

import importlib.util
import math
import itertools
import sys

sys.dont_write_bytecode = True
from pathlib import Path
import shutil
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('audio_render', ROOT / 'bin' / 'render-hud-audio.py')
RENDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RENDER)


class AudioProcessing(unittest.TestCase):
    """使用固定合成音与随包公开台词验证处理结果。"""

    rate = 24000

    def tone(self, seconds):
        """生成固定幅度的合成音，不依赖录音或用户数据。"""
        return [round(8000 * math.sin(2 * math.pi * 300 * i / self.rate)) for i in range(round(seconds * self.rate))]

    def test_long_pause_retains_both_spoken_segments(self):
        """长停顿缩短时，前后的发声样本仍按原顺序保留。"""
        first = self.tone(0.2)
        second = self.tone(0.3)
        source = [0] * 12000 + first + [0] * 14400 + second + [0] * 24000
        edited = RENDER.tighten_speech(source, self.rate)
        self.assertLess(len(edited) / self.rate, 0.8)
        source_voice = [sample for sample in source if abs(sample) > 1000]
        output_voice = [sample for sample in edited if abs(sample) > 1000]
        self.assertEqual(source_voice, output_voice)
        gaps = [(b - a) / self.rate for a, b in RENDER.quiet_spans(edited, self.rate) if a > 0 and b < len(edited)]
        self.assertTrue(gaps)
        self.assertLessEqual(max(gaps), 0.16)

    def test_short_pause_is_preserved(self):
        """正常短断句不被剪掉。"""
        source = [0] * 2400 + self.tone(0.2) + [0] * 2400 + self.tone(0.2) + [0] * 2400
        edited = RENDER.tighten_speech(source, self.rate)
        zero_runs = [sum(1 for _ in group) for silent, group in itertools.groupby(edited, key=lambda sample: sample == 0) if silent]
        original_runs = [sum(1 for _ in group) for silent, group in itertools.groupby(source, key=lambda sample: sample == 0) if silent]
        self.assertGreaterEqual(max(zero_runs), 2400)
        self.assertEqual(max(zero_runs), max(original_runs))

    def test_spatial_mix_does_not_clip(self):
        """立体声与提示音混合后仍保留输出余量。"""
        voice = self.tone(0.4)
        mixed = RENDER.spatial_voice(voice, self.rate, True)
        clean = RENDER.spatial_voice(voice, self.rate, False)
        self.assertEqual(len(mixed) % 2, 0)
        self.assertLessEqual(max(abs(value) for value in mixed), 29000)
        self.assertNotEqual(mixed, clean)
        self.assertGreater(len(mixed), len(clean))

    @unittest.skipUnless(shutil.which('afconvert'), '真实 AAC 测量需要 macOS afconvert')
    def test_shipped_welcome_shortens_measured_silence(self):
        """随包原欢迎语与处理后音频采用同一解码方式比较。"""
        with tempfile.TemporaryDirectory(prefix='dsh-audio-check-') as temporary:
            base = Path(temporary)
            original, rate = RENDER.decode(ROOT / 'lib' / 'assets' / 'hud-entry.mp3', base / 'before.wav')
            processed, output_rate = RENDER.decode(ROOT / 'lib' / 'assets' / 'hud-entry.m4a', base / 'after.wav')
            self.assertLess(len(processed) / output_rate, len(original) / rate * 0.85)
            before = [(b - a) / rate for a, b in RENDER.quiet_spans(original, rate) if a > 0 and b < len(original)]
            after = [(b - a) / output_rate for a, b in RENDER.quiet_spans(processed, output_rate) if a > 0 and b < len(processed)]
            self.assertGreater(max(before), 0.3)
            self.assertLessEqual(max(after), 0.24)


if __name__ == '__main__':
    unittest.main(verbosity=2)
