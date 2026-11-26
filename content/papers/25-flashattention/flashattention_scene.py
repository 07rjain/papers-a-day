"""Render with Manim CE at 1920x1080 from a directory containing timing.json."""

import json
from pathlib import Path

from manim import (
    DOWN, LEFT, RIGHT, UP, Arrow, FadeIn, FadeOut, Rectangle,
    Scene, SurroundingRectangle, Text, VGroup,
)

TILE = "#56e0c1"
SOFTMAX = "#ffd376"
REBUILD = "#b9a6ff"
OUTLINE = "#455064"


def label(value, size=30, color="#edf1fb"):
    return Text(value, font="DejaVu Sans", font_size=size, color=color)


class FlashAttention(Scene):
    def construct(self):
        self.camera.background_color = "#000000"
        timing = json.loads(Path("timing.json").read_text())
        legend = VGroup(
            label("■ Tiling", 20, TILE),
            label("■ Online softmax", 20, SOFTMAX),
            label("■ Recomputation", 20, REBUILD),
        ).arrange(RIGHT, buff=0.3).move_to([3.25, 2.12, 0])

        hbm = Rectangle(width=3.8, height=1.58, color=OUTLINE).move_to([-4.3, 0.92, 0])
        sram = Rectangle(width=2.95, height=1.35, color=TILE).move_to([-4.3, -1.18, 0])
        hbm_text = label("HBM", 32).move_to(hbm.get_center() + UP * 0.34)
        sram_text = label("On-chip SRAM", 28, TILE).move_to(sram.get_center() + UP * 0.30)
        arrow = Arrow(hbm.get_bottom(), sram.get_top(), buff=0.08, color=TILE)
        tiles = VGroup(*[
            Rectangle(width=0.60, height=0.46, color=OUTLINE, stroke_width=2)
            .set_fill("#161d29", opacity=1)
            .move_to([-1.06 + col * 0.62, 1.06 - row * 0.48, 0])
            for row in range(4) for col in range(4)
        ])
        grid_label = label("Score tiles · illustrative", 23).next_to(tiles, UP, buff=0.18)
        row_label = label("Q rows", 20).rotate(1.5708).next_to(tiles, LEFT, buff=0.12)
        col_label = label("K columns", 20).next_to(tiles, DOWN, buff=0.15)
        focus = SurroundingRectangle(tiles[0], color=TILE, buff=0.02, stroke_width=3)
        self.add(hbm, sram, hbm_text, sram_text, arrow, tiles, grid_label, row_label, col_label, legend, focus)

        panels = [
            ("N × N scores", "Each query compares\nwith every key.", TILE, "Q   K   V", "Current tile"),
            ("A100 bandwidth", "HBM  1.5–2.0 TB/s\nSRAM  ≈19 TB/s", TILE, "Large · off chip", "Small · on chip"),
            ("Score tile", "Sᵢⱼ = Qᵢ Kⱼᵀ / √d\nReuse each K/V block.", TILE, "Full Q, K, V", "Qᵢ   Kⱼ   Vⱼ"),
            ("Running softmax", "Scale old sums by eᵐ⁻ᵐ′\nOutput = weighted sum / sum", SOFTMAX, "Partial output + stats", "Update row sums"),
            ("Backward pass", "Pᵢⱼ = exp(Sᵢⱼ − Lᵢ)\nLᵢ is the row log-sum-exp.", REBUILD, "Save output + row stats", "Rebuild P tile"),
            ("Measured results", "Up to 3× faster attention\nUp to 20× more memory-efficient\nBERT-large  20.0 → 17.4 min\nGPT-2 medium  21.0 → 6.9 days", TILE, "Inputs + output + row stats", "One tile at a time"),
            ("Same dense attention", "Quadratic pairwise work\nLinear attention storage", TILE, "Inputs + output + stats", "One tile at a time"),
        ]
        previous = None
        for section, ((header, duration), panel) in enumerate(zip(timing, panels, strict=True)):
            title, body, color, stored, active = panel
            group = VGroup(
                label(header, 45).to_corner(UP + LEFT, buff=0.55),
                label(stored, 20).move_to(hbm.get_center() + DOWN * 0.28),
                label(active, 18, color).move_to(sram.get_center() + DOWN * 0.26),
                VGroup(label(title, 30, color), label(body, 21)).arrange(DOWN, aligned_edge=LEFT, buff=0.28).move_to([1.52, 0.44, 0], aligned_edge=LEFT),
            )
            animations = [FadeIn(group)]
            if previous is not None:
                animations.append(FadeOut(previous))
            self.play(*animations, run_time=0.42)
            previous = group
            changes = {
                2: [4, 8, 1, 5],
                3: [0, 1, 2, 3],
                4: [3, 2, 1, 0],
                5: [5],
            }.get(section, [0])
            span = (duration - 0.42) / len(changes)
            for step, index in enumerate(changes):
                if section == 5 and step == 0:
                    self.play(focus.animate.move_to(tiles[index]).set_color(color), run_time=0.45)
                    self.wait(span * 0.64 - 0.45)
                    paths = VGroup(
                        label("Long-context results", 30, TILE),
                        label("Path-X  ·  16K  ·  61.4%\nPath-256  ·  64K  ·  63.1%\nPath-256 uses block sparsity.", 23),
                    ).arrange(DOWN, aligned_edge=LEFT, buff=0.28).move_to([1.52, 0.44, 0], aligned_edge=LEFT)
                    self.play(FadeOut(group[-1]), FadeIn(paths), run_time=0.42)
                    group.remove(group[-1]).add(paths)
                    self.wait(span * 0.36 - 0.42)
                else:
                    self.play(focus.animate.move_to(tiles[index]).set_color(color), run_time=0.45)
                    self.wait(span - 0.45)
