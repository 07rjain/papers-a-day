"""Render from the working directory containing the narration's timing.json."""
import json
from pathlib import Path

from manim import (
    Arrow, Circle, Create, DOWN, FadeIn, FadeOut, LEFT, Line, ReplacementTransform,
    RIGHT, RoundedRectangle, Scene, Text, UP, VGroup, config,
)

MODEL = "#A9BDFF"
HELP = "#66E5BE"
SAFE = "#FFBA72"
WHITE = "#F4F6FC"
MUTED = "#A0AABD"
FAINT = "#283146"


def label(text, size=30, color=WHITE):
    return Text(text, font="DejaVu Sans", font_size=size, color=color)


def node(text, position, color, width=2.5):
    return VGroup(
        RoundedRectangle(width=width, height=0.75, corner_radius=0.12,
                         stroke_width=2, color=color, fill_color="#101623", fill_opacity=1),
        label(text, 22, color),
    ).move_to(position)


class Llama2Explainer(Scene):
    def construct(self):
        config.background_color = "#000000"
        self.camera.background_color = "#000000"
        sections = json.loads(Path("timing.json").read_text())
        legend = VGroup(*[
            VGroup(Circle(radius=0.055, color=color, fill_opacity=1),
                   label(name, 22, color)).arrange(RIGHT, buff=0.12)
            for name, color in [("Model training", MODEL), ("Helpfulness", HELP), ("Safety", SAFE)]
        ]).arrange(RIGHT, buff=0.38).move_to(UP * 2.45 + LEFT * 3.55)
        divider = Line(LEFT * 6.35, RIGHT * 6.35, color=FAINT).shift(UP * 2.15)
        boxes = [
            node("Base model", LEFT * 5.0 + UP * 0.4, MODEL),
            node("Supervised tuning", LEFT * 1.7 + UP * 0.4, MODEL, 2.85),
            node("Score replies", RIGHT * 1.7 + UP * 0.4, MODEL),
            node("Update chat", RIGHT * 5.0 + UP * 0.4, MODEL),
        ]
        arrows = VGroup(*[
            Arrow(a.get_right(), b.get_left(), buff=0.10, color=MUTED,
                  stroke_width=2, max_tip_length_to_length_ratio=0.26)
            for a, b in zip(boxes, boxes[1:])
        ])
        self.add(legend, divider, *boxes, arrows)
        panels = [
            ("Llama 2", "From next-token prediction to a multi-turn assistant"),
            ("2 trillion training tokens · 4,096-token context", "Grouped-query attention in the 34B and 70B models"),
            ("27,540 supervised annotations", "Human-written demonstrations establish a starting point"),
            ("Reward routing · §3.2.3", "R = safety score if safety prompt or score < 0.15, otherwise helpfulness"),
            ("Rejection sampling + PPO", "Select strong replies, update the model, then collect fresh comparisons"),
            ("Ghost Attention · repeat during generation", "Fine-tune with the instruction on turn 1 and loss on the final reply"),
            ("Released weights · 7B, 13B, 70B", "Teach by example, score the behavior, and practice it in context"),
        ]
        active = [0, 0, 1, 2, 3, 3, 3]
        previous = None
        total = 0
        for index, ((title, duration), (headline, detail)) in enumerate(zip(sections, panels)):
            heading = label(title, 36).to_edge(LEFT, buff=0.75).set_y(3.12)
            summary = VGroup(label(headline, 36, MODEL), label(detail, 25, MUTED))
            summary.arrange(DOWN, buff=0.2).move_to(DOWN * 1.84)
            if index == 0:
                self.add(heading, summary)
            else:
                self.play(ReplacementTransform(previous[0], heading),
                          ReplacementTransform(previous[1], summary), run_time=0.52)
            highlight = RoundedRectangle(
                width=boxes[active[index]].width + 0.15, height=0.9,
                corner_radius=0.15, color=MODEL, stroke_width=3,
            ).move_to(boxes[active[index]])
            extras = VGroup()
            if index == 3:
                for name, color, x in [("Helpfulness score", HELP, 0.25), ("Safety score", SAFE, 3.15)]:
                    scorer = node(name, RIGHT * x + DOWN * 0.64, color, 2.58)
                    extras.add(scorer, Line(boxes[2].get_bottom(), scorer.get_top(), color=color))
            if index == 4:
                start = boxes[3].get_top()
                end = boxes[2].get_top()
                extras.add(Line(start, start + UP * 0.65, color=MODEL),
                           Line(start + UP * 0.65, end + UP * 0.65, color=MODEL),
                           Arrow(end + UP * 0.65, end, buff=0, color=MODEL, stroke_width=2),
                           label("RLHF-V1 → V5", 23, MODEL).move_to(RIGHT * 1.65 + UP * 1.6))
            if index == 5:
                turns = VGroup(*[node(name, DOWN * 0.68, color, 2.15) for name, color in
                                [("1 · French", MODEL), ("2 · Context", MUTED), ("3 · Target", HELP)]])
                turns.arrange(RIGHT, buff=0.23).move_to(DOWN * 0.7 + RIGHT * 1.72)
                extras.add(turns)
            animations = [Create(highlight)]
            if len(extras):
                animations.append(FadeIn(extras))
            if previous:
                animations.append(FadeOut(previous[2]))
                if len(previous[3]):
                    animations.append(FadeOut(previous[3]))
            self.play(*animations, run_time=0.45)
            previous = heading, summary, highlight, extras
            total += duration
            self.wait(max(0.1, total - self.renderer.time))
