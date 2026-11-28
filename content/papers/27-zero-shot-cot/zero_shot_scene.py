"""Render with Manim CE at 1920×1080 from the narration timing directory."""
import json
from pathlib import Path

from manim import (
    DOWN, LEFT, RIGHT, UP, Arrow, FadeIn, FadeOut, Line, RoundedRectangle,
    Scene, Text, VGroup,
)

CUE, WORK, ANSWER = "#72C8FD", "#FFCD72", "#B5A0FF"
WHITE, FAINT = "#EDF2F9", "#8D9AAF"


def label(value, size=28, color=WHITE):
    return Text(value, font="DejaVu Sans", font_size=size, color=color)


def left_at(item, x, y):
    return item.move_to([x, y, 0], aligned_edge=LEFT)


def card(title, color, x):
    box = RoundedRectangle(
        width=3.62, height=1.43, corner_radius=0.13, stroke_width=2,
        color=color, fill_color="#121821", fill_opacity=1,
    ).move_to([x, 0.6, 0])
    return VGroup(box, left_at(label(title, 23, color), x - 1.55, 0.98))


class ZeroShotCoT(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        timing = json.loads(Path("timing.json").read_text())
        colors = (CUE, WORK, ANSWER)
        cards = [card(title, color, x) for title, color, x in zip(
            ("Question + cue", "Generated working", "Extracted answer"),
            colors, (-4.55, 0, 4.55),
        )]
        arrows = VGroup(*[
            Arrow(a.get_right(), b.get_left(), buff=0.06, color=FAINT, stroke_width=2.6)
            for a, b in zip(cards, cards[1:])
        ])
        legend = VGroup(*[
            label("●  " + name, 21, color)
            for name, color in zip(("Prompt cue", "Reasoning", "Final answer"), colors)
        ]).arrange(RIGHT, buff=0.6).move_to([0, 2.15, 0])
        rule = Line([-6.35, 1.72, 0], [6.35, 1.72, 0], color="#394453", stroke_width=1)
        self.add(*cards, arrows, legend, rule)

        # Each beat starts at its spoken sentence. The same cards persist throughout.
        beats = [
            [
                (0, "Toy problem", "4 boxes × 6 pencils each. Give away 7."),
                (0, "Direct prompt", "Q: How many pencils are left?   A: The answer is …"),
            ],
            [
                (0, "Few-shot CoT", "Worked examples → new question"),
                (0, "Zero-shot CoT", "New question → one general instruction"),
                (0, "Reasoning prompt", "A: Let’s think step by step."),
            ],
            [
                (1, "First model call", "4 × 6 = 24"),
                (1, "Reuse the completion", "4 × 6 = 24, then 24 − 7 = 17"),
                (2, "Second model call", "Original prompt + working + “Therefore, the answer (arabic numerals) is”"),
                (2, "Parse the completion", "Final answer  17"),
            ],
            [
                (2, "MultiArith · text-davinci-002 · Table 4", "Direct zero-shot   17.7%"),
                (0, "Two instructive cues", "“Let’s think step by step.”   78.7%      “Let’s think”   57.5%"),
                (0, "More prompts, same model and benchmark", "“First,”   77.3%      “Abrakadabra!”   15.5%"),
                (1, "A cue can change the continuation", "Several instructions elicited useful intermediate steps."),
            ],
            [
                (2, "GSM8K · PaLM 8B · Table 27", "Direct zero-shot   2.1%    →    Zero-shot CoT   2.4%"),
                (2, "GSM8K · PaLM 540B · Table 27", "Direct zero-shot   12.5%    →    Zero-shot CoT   43.0%"),
                (2, "PaLM 540B with self-consistency · Table 25", "40 sampled paths → vote on answers → 70.1% on GSM8K"),
                (2, "CommonsenseQA · text-davinci-002 · Table 1", "Direct zero-shot   68.8%    →    Zero-shot CoT   64.6%"),
            ],
            [
                (1, "One general instruction, two model calls", "Use the intermediate steps as context for the final answer."),
                (2, "Score the answer on the task", "A clear-looking chain can still contain a mistake."),
            ],
        ]
        card_changes = {
            (0, 0): {0: "4 boxes · 6 each · give 7"},
            (1, 2): {0: "Let’s think step by step."},
            (2, 0): {1: "4 × 6 = 24"},
            (2, 1): {1: "24 − 7 = 17"},
            (2, 3): {2: "17"},
            (3, 0): {0: "Direct zero-shot", 1: "Direct completion", 2: "17.7% accuracy"},
            (3, 1): {0: "Step by step / Think", 1: "One path per question", 2: "78.7% / 57.5%"},
            (3, 2): {0: "First, / Abrakadabra!", 2: "77.3% / 15.5%"},
            (4, 0): {0: "PaLM 8B", 2: "2.1% → 2.4%"},
            (4, 1): {0: "PaLM 540B", 2: "12.5% → 43.0%"},
            (4, 2): {1: "40 sampled paths", 2: "70.1% after voting"},
            (4, 3): {0: "CommonsenseQA", 1: "One path per question", 2: "68.8% → 64.6%"},
            (5, 0): {0: "Let’s think step by step.", 1: "24 − 7 = 17", 2: "17"},
        }
        header = note = focus = None
        values = {}
        for section_index, (section, annotations) in enumerate(zip(timing, beats, strict=True)):
            for beat_index, (duration, (active, title, detail)) in enumerate(
                zip(section["lines"], annotations, strict=True)
            ):
                animations = []
                if beat_index == 0:
                    next_header = label(section["title"], 36)
                    if next_header.width > 12.7:
                        next_header.scale_to_fit_width(12.7)
                    left_at(next_header, -6.35, 3.13)
                    if header:
                        animations.append(FadeOut(header))
                    animations.append(FadeIn(next_header))
                    header = next_header

                outline = cards[active][0].copy().scale(1.045).set_fill(opacity=0)
                next_note = VGroup(label(title, 28, colors[active]), label(detail, 24))
                next_note.arrange(DOWN, aligned_edge=LEFT, buff=0.2)
                if next_note.width > 12.7:
                    next_note.scale_to_fit_width(12.7)
                left_at(next_note, -6.35, -1.27)
                if note:
                    animations.extend((FadeOut(note), FadeOut(focus)))
                animations.extend((FadeIn(next_note, shift=0.08 * UP), FadeIn(outline)))
                note, focus = next_note, outline

                for index, value in card_changes.get((section_index, beat_index), {}).items():
                    box = cards[index][0]
                    new_value = label(value, 22)
                    if new_value.width > 3.12:
                        new_value.scale_to_fit_width(3.12)
                    left_at(new_value, box.get_left()[0] + 0.25, 0.36)
                    if index in values:
                        animations.append(FadeOut(values[index]))
                    animations.append(FadeIn(new_value))
                    values[index] = new_value

                self.play(*animations, run_time=0.28)
                self.wait(duration - 0.28)
