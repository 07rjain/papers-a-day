"""Render with Manim CE at 1080p24 from a directory containing timing.json."""
import json
from pathlib import Path

from manim import (
    DOWN, LEFT, RIGHT, UP, Arrow, FadeIn, FadeOut, Indicate, Line,
    RoundedRectangle, Scene, Text, VGroup,
)

RETAIN = "#65D8FE"
WRITE = "#FFD17C"
READ = "#BDA6FF"
INK = "#ECF0FA"
MUTED = "#8593AB"


def label(value, size=28, color=INK):
    return Text(value, font="DejaVu Sans", font_size=size, color=color)


def block(value, x, color):
    outline = RoundedRectangle(
        width=2.26, height=0.94, corner_radius=0.13, color=color, stroke_width=2,
        fill_color="#101723", fill_opacity=1,
    ).move_to([x, 0.58, 0])
    return VGroup(outline, label(value, 21, color).move_to(outline))


class Mamba(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        timing = json.loads(Path("timing.json").read_text())
        old = block("Previous state", -4.8, RETAIN)
        update = block("Scale + add", -1.6, WRITE)
        new = block("Updated state", 1.6, RETAIN)
        output = block("Output", 4.8, READ)
        chain = [old, update, new, output]
        arrows = VGroup(*[
            Arrow(a.get_right(), b.get_left(), buff=0.1, color=MUTED, stroke_width=3)
            for a, b in zip(chain, chain[1:])
        ])
        legend = VGroup(
            label("●  Δ  Retain", 23, RETAIN),
            label("●  B  Write", 23, WRITE),
            label("●  C  Read", 23, READ),
        ).arrange(RIGHT, buff=0.55).move_to([0, 2.47, 0])
        token = label("Current token  xₜ", 25, WRITE).move_to([-1.6, 1.85, 0])
        token_arrow = Arrow(token.get_bottom(), update.get_top(), buff=0.1, color=WRITE)
        self.add(*chain, arrows, legend, token, token_arrow)

        # The chain stays on screen while the annotations and focus move with the narration.
        sections = [
            [("Keep the digits", "Let the background chatter pass.", WRITE, update)],
            [
                ("Transformer", "Compare the current position with earlier positions.", MUTED, old),
                ("State space model", "Update one running summary per sequence.", RETAIN, old),
                ("The discrete update", "hₜ = Āₜ hₜ₋₁ + B̄ₜ xₜ     •     yₜ = Cₜ hₜ", RETAIN, new),
            ],
            [
                ("Retention", "Δ changes the decay in Āₜ and also affects B̄ₜ.", RETAIN, old),
                ("Writing and reading", "Bₜ sets the write direction. Cₜ reads from hₜ.", WRITE, update),
                ("Selective copying · Table 1", "99.8% accuracy on the synthetic task", READ, output),
            ],
            [
                ("Each token defines a map", "Fₜ(h) = aₜ h + bₜ   (scalar example)", WRITE, update),
                ("Compose neighboring maps", "F₂ ∘ F₁(h) = (a₂ a₁) h + (a₂ b₁ + b₂)", WRITE, new),
                ("Parallel prefix scan", "Group the maps. Keep their order. Get every prefix.", RETAIN, new),
            ],
            [
                ("Fused kernel · on-chip SRAM", "Discretize → scan → read out", WRITE, update),
                ("Recompute expanded states", "Write outputs to HBM. Rebuild intermediates for gradients.", RETAIN, new),
                ("Generation · Figure 8", "4–5× Transformer throughput in the reported benchmark", READ, output),
            ],
            [("One selective state", "Learn what to retain, write, and read.", RETAIN, new)],
        ]
        # Start each annotation at the corresponding narration line within its section.
        cue_lines = [[0], [0, 2, 3], [0, 2, 4], [0, 2, 3], [0, 1, 3], [0]]
        captions = Path("captions.vtt").read_text().strip().split("\n\n")[1:]
        starts = []
        for cue in captions:
            hours, minutes, seconds = cue.split()[0].split(":")
            starts.append(3600 * int(hours) + 60 * int(minutes) + float(seconds))
        line_counts = [3, 5, 5, 6, 5, 1]
        elapsed = 0.0
        line = 0
        header = panel = enclosure = None
        for section, ((title, duration), slides) in enumerate(zip(timing, sections, strict=True)):
            heading = label(title, 43).to_corner(UP + LEFT, buff=0.5)
            times = [starts[line + offset] for offset in cue_lines[section]] + [elapsed + duration]
            for index, ((name, detail, color, focus), begin, end) in enumerate(
                zip(slides, times[:-1], times[1:], strict=True)
            ):
                card = VGroup(label(name, 29, color), label(detail, 28)).arrange(DOWN, buff=0.18)
                card.move_to([0, -1.47, 0])
                animations = [FadeIn(card), Indicate(focus, color=color, scale_factor=1.05)]
                if panel is not None:
                    animations.append(FadeOut(panel))
                if index == 0:
                    animations.append(FadeIn(heading))
                    if header is not None:
                        animations.append(FadeOut(header))
                    header = heading
                if section == 4 and index == 0:
                    enclosure = VGroup(
                        Line([-3, -0.18, 0], [3, -0.18, 0], color=WRITE, stroke_width=2),
                        label("On-chip SRAM", 18, WRITE).move_to([0, -0.42, 0]),
                    )
                    animations.append(FadeIn(enclosure))
                if section == 5 and enclosure is not None:
                    animations.append(FadeOut(enclosure))
                self.play(*animations, run_time=0.5)
                panel = card
                # Snap to global frame boundaries so narration cannot drift between cues.
                self.wait(max(1 / 24, (round(end * 24) - round(begin * 24) - 12) / 24))
            elapsed += duration
            line += line_counts[section]
