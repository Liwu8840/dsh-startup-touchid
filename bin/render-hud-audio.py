"""整理固定语音的空白与断句，并生成可在本地播放的 AAC 音频。"""

import argparse
import array
import json
import math
from pathlib import Path
import subprocess
import tempfile
import wave


def quiet_spans(samples, rate):
    """返回低于 -43 dB 的连续 20 毫秒区间，单位为样本位置。"""
    window = round(rate * 0.02)
    threshold = (32768 * 10 ** (-43 / 20)) ** 2
    start = None
    spans = []
    for offset in range(0, len(samples), window):
        part = samples[offset:offset + window]
        quiet = sum(value * value for value in part) / len(part) < threshold
        if quiet and start is None:
            start = offset
        if not quiet and start is not None:
            spans.append((start, offset))
            start = None
    if start is not None:
        spans.append((start, len(samples)))
    return spans


def tighten_speech(samples, rate):
    """缩短首尾空白与超过 280 毫秒的停顿，保留短停顿及语音样本。"""
    spans = quiet_spans(samples, rate)
    cuts = []
    for start, end in spans:
        if start == 0:
            cuts.append((start, max(start, end - round(rate * 0.025))))
        elif end == len(samples):
            cuts.append((min(end, start + round(rate * 0.08)), end))
        elif end - start >= round(rate * 0.28):
            keep = round(rate * 0.07)
            cuts.append((start + keep, end - keep))
    result = []
    cursor = 0
    for start, end in cuts:
        result.extend(samples[cursor:start])
        cursor = end
    result.extend(samples[cursor:])
    fade = min(round(rate * 0.006), len(result) // 2)
    for index in range(fade):
        gain = index / max(1, fade)
        result[index] *= gain
        result[-index - 1] *= gain
    return result


def spatial_voice(samples, rate, cue=False):
    """加入低电平短延迟和淡入淡出；提示音仅用于进入工作台的欢迎语。"""
    lead = round(rate * (0.09 if cue else 0.015))
    tail = round(rate * 0.13)
    length = lead + len(samples) + tail
    channels = [[0.0] * length, [0.0] * length]
    for channel, delay in zip(channels, (0.009, 0.014)):
        delayed = round(rate * delay)
        for index, value in enumerate(samples):
            channel[lead + index] += value
            if lead + index + delayed < length:
                channel[lead + index + delayed] += value * 0.035
    if cue:
        count = round(rate * 0.075)
        for index in range(count):
            t = index / rate
            envelope = math.sin(math.pi * index / count) ** 2
            chirp = math.sin(2 * math.pi * (1400 * t + 8500 * t * t)) * envelope * 650
            channels[0][index] += chirp
            channels[1][index] += chirp
    peak = max((abs(value) for channel in channels for value in channel), default=1)
    gain = min(1.0, 29000 / max(1, peak))
    output = array.array('h')
    for left, right in zip(*channels):
        output.extend((round(left * gain), round(right * gain)))
    return output


def decode(source, target):
    """使用 macOS 音频工具解码为单声道 16 位 PCM。"""
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16', '-c', '1', str(source), str(target)], check=True)
    with wave.open(str(target)) as audio:
        if audio.getsampwidth() != 2 or audio.getnchannels() != 1:
            raise ValueError('源音频必须解码为单声道 16 位 PCM')
        rate = audio.getframerate()
        samples = array.array('h', audio.readframes(audio.getnframes()))
    return samples, rate


def render(source, destination, cue=False):
    """生成 AAC 文件并返回处理前后的时长与静音区间。"""
    with tempfile.TemporaryDirectory(prefix='dsh-voice-') as temporary:
        wav = Path(temporary) / 'source.wav'
        original, rate = decode(source, wav)
        tightened = tighten_speech(original, rate)
        stereo = spatial_voice(tightened, rate, cue)
        output_wav = Path(temporary) / 'output.wav'
        with wave.open(str(output_wav), 'wb') as audio:
            audio.setnchannels(2)
            audio.setsampwidth(2)
            audio.setframerate(rate)
            audio.writeframes(stereo.tobytes())
        encoded = Path(temporary) / 'output.m4a'
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', str(output_wav), str(encoded)], check=True)
        encoded.replace(destination)
    return {
        'beforeSeconds': round(len(original) / rate, 3),
        'afterSeconds': round(len(stereo) / (2 * rate), 3),
        'beforeQuietSpans': [[round(a / rate, 3), round(b / rate, 3)] for a, b in quiet_spans(original, rate) if b - a >= rate * 0.1],
        'afterQuietSpans': [[round(a / rate, 3), round(b / rate, 3)] for a, b in quiet_spans(tightened, rate) if b - a >= rate * 0.1],
    }


def main():
    """重建素材清单中的音频，额外提供不含提示音的进入欢迎语。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assets', type=Path, default=Path(__file__).resolve().parents[1] / 'lib' / 'assets')
    parser.add_argument('--report', type=Path)
    options = parser.parse_args()
    manifest_file = options.assets / 'hud-voice.json'
    manifest = json.loads(manifest_file.read_text())
    rendered = {}
    report = {}
    for name in manifest['lines']:
        cue = name in ('hud-entry', 'hud-entry-extended')
        rendered[name] = name + '.m4a'
        report[name] = render(options.assets / (name + '.mp3'), options.assets / rendered[name], cue)
        if cue:
            render(options.assets / (name + '.mp3'), options.assets / (name + '-clean.m4a'))
    manifest['rendered'] = rendered
    manifest['processing'] = {'quietThresholdDb': -43, 'longPauseMs': 280, 'retainedPauseMs': 140, 'echoGain': 0.035, 'entryCueMs': 75}
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    if options.report:
        options.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
