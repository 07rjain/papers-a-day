"""Generate timing.json, narration.wav, and WebVTT from the explainer script.

Usage: python render_narration.py narration.txt voice.onnx captions.vtt
Requires piper-tts and a downloaded Piper voice model.
"""
import json
import sys
import textwrap
import wave
from pathlib import Path
from piper import PiperVoice, SynthesisConfig

script, model, captions = map(Path, sys.argv[1:])
voice = PiperVoice.load(model)
sections = []
cues = []
audio = bytearray()
rate = voice.config.sample_rate
for section in script.read_text().strip().split("\n\n"):
    title, *lines = section.splitlines()
    start = len(audio) // 2
    for line in lines:
        cue_start = len(audio) // 2
        for chunk in voice.synthesize(line, SynthesisConfig(length_scale=1.02)):
            audio.extend(chunk.audio_int16_bytes)
        audio.extend(bytes(2 * round(rate * 0.12)))
        cues.append((cue_start / rate, len(audio) / 2 / rate, line))
    audio.extend(bytes(2 * round(rate * 0.65)))
    sections.append([title[2:], (len(audio) // 2 - start) / rate])

def stamp(seconds):
    ms = round(seconds * 1000)
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02}.{ms % 1000:03}"

def cue_text(line):
    for spoken, written in {"Llama Two": "Llama 2", "P P O": "PPO", "R L H F": "RLHF"}.items():
        line = line.replace(spoken, written)
    return "\n".join(textwrap.wrap(line, 64))

captions.write_text("WEBVTT\n\n" + "\n\n".join(f"{stamp(a)} --> {stamp(b)}\n{cue_text(line)}" for a, b, line in cues) + "\n")
Path("timing.json").write_text(json.dumps(sections))
with wave.open("narration.wav", "wb") as out:
    out.setparams((1, 2, rate, 0, "NONE", "not compressed"))
    out.writeframes(audio)
print(len(audio) / 2 / rate)
