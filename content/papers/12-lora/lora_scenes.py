# Manim Community Edition scenes for paper #12: LoRA
# "LoRA: Low-Rank Adaptation of Large Language Models" (Hu et al., Microsoft, 2021, arXiv 2106.09685)
# Render: manim -qm lora_scenes.py FrozenPlusLowRank ParameterCount MergeNoLatency
# Text-only (no LaTeX). Numbers are from the paper: d_model = 12,288 for GPT-3 175B,
# h = W0 x + B A x, B in R^{d x r}, A in R^{r x k}, B starts at zero.
from manim import *
import numpy as np

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"
config.background_color = BG


def grid_rect(w, h, col, n_w, n_h, op=0.25):
    r = Rectangle(width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=op, stroke_width=3)
    lines = VGroup()
    for i in range(1, n_w):
        x = -w / 2 + w * i / n_w
        lines.add(Line([x, -h / 2, 0], [x, h / 2, 0], stroke_width=1, stroke_color=col, stroke_opacity=0.35))
    for j in range(1, n_h):
        y = -h / 2 + h * j / n_h
        lines.add(Line([-w / 2, y, 0], [w / 2, y, 0], stroke_width=1, stroke_color=col, stroke_opacity=0.35))
    return VGroup(r, lines)


class FrozenPlusLowRank(Scene):
    """Frozen W0 plus a thin B times a flat A."""
    def construct(self):
        title = Text("LoRA: keep the big matrix frozen, learn a thin update", font_size=30).to_edge(UP)
        self.play(Write(title))
        W = grid_rect(3.2, 3.2, GREY_, 12, 12, 0.18).shift(LEFT * 4.2 + DOWN * 0.3)
        wl = Text("W0  (d × d)", font_size=22, color=GREY_).next_to(W, DOWN)
        lock = Text("frozen: no training", font_size=18, color=BLUE_).next_to(W, UP, buff=0.15)
        self.play(FadeIn(W, scale=0.9), FadeIn(wl))
        self.play(FadeIn(lock, shift=DOWN * 0.2)); self.wait(0.4)
        plus = Text("+", font_size=48).next_to(W, RIGHT, buff=0.45)
        B = grid_rect(0.4, 3.2, ORANGE_, 1, 12, 0.5).next_to(plus, RIGHT, buff=0.45)
        bl = Text("B (d × r)", font_size=20, color=ORANGE_).next_to(B, DOWN)
        A = grid_rect(3.2, 0.4, GREEN_, 12, 1, 0.5).next_to(B, RIGHT, buff=0.35).align_to(B, UP)
        al = Text("A (r × d)", font_size=20, color=GREEN_).next_to(A, DOWN)
        self.play(Write(plus))
        self.play(FadeIn(B, shift=RIGHT * 1.5), FadeIn(bl), run_time=1.0)
        self.play(FadeIn(A, shift=UP * 1.5), FadeIn(al), run_time=1.0)
        train = Text("only B and A are trained", font_size=20, color=YEL_).next_to(A, UP, buff=1.2)
        self.play(Write(train))
        self.play(Indicate(B, color=YEL_), Indicate(A, color=YEL_)); self.wait(0.4)
        # B times A spreads into a full d x d update
        dW = grid_rect(3.2, 3.2, PINK_, 12, 12, 0.3).move_to(VGroup(B, A).get_center() + DOWN * 0.2)
        dwl = Text("ΔW = B·A  (d × d, but rank r)", font_size=20, color=PINK_).next_to(dW, DOWN)
        self.play(ReplacementTransform(VGroup(B, A), dW), ReplacementTransform(VGroup(bl, al), dwl), FadeOut(train), run_time=1.6)
        eq = Text("h = W0·x + B·A·x", font_size=30, color=YEL_).to_edge(DOWN, buff=0.35)
        self.play(Write(eq)); self.wait(0.6)
        init = Text("B starts at zero, so training begins exactly at the pre-trained model", font_size=20, color=GREY_).next_to(title, DOWN)
        self.play(FadeIn(init)); self.wait(1.8)


class ParameterCount(Scene):
    """How many numbers you train, as the rank r grows (one GPT-3 sized matrix, d = 12,288)."""
    def construct(self):
        d = 12288
        title = Text("How many numbers do you train? (one GPT-3 matrix, d = 12,288)", font_size=26).to_edge(UP)
        self.play(Write(title))
        r = ValueTracker(1)
        full = d * d
        ax_left = LEFT * 5.5 + DOWN * 2.4
        maxw = 10.5
        def logw(v):
            return maxw * np.log10(v) / np.log10(full)
        full_bar = Rectangle(width=logw(full), height=0.7, fill_color=GREY_, fill_opacity=0.8, stroke_width=0).move_to(ax_left + UP * 2.6, aligned_edge=LEFT)
        full_t = Text(f"full fine-tuning: d × d = {full:,}", font_size=20).next_to(full_bar, UP, buff=0.1).align_to(full_bar, LEFT)
        self.play(GrowFromEdge(full_bar, LEFT), FadeIn(full_t), run_time=1.2)
        lora_bar = always_redraw(lambda: Rectangle(width=logw(2 * d * r.get_value()), height=0.7, fill_color=ORANGE_, fill_opacity=0.9, stroke_width=0).move_to(ax_left + UP * 0.9, aligned_edge=LEFT))
        lora_t = always_redraw(lambda: Text(f"LoRA, rank r = {int(round(r.get_value()))}: 2 × d × r = {2 * d * int(round(r.get_value())):,}", font_size=20, color=ORANGE_).next_to(ax_left + UP * 1.25, UP, buff=0.1).align_to(full_bar, LEFT))
        ratio = always_redraw(lambda: Text(f"{full / (2 * d * int(round(r.get_value()))):,.0f}× fewer trainable numbers", font_size=30, color=YEL_).move_to(UP * 2.0))
        self.play(FadeIn(lora_bar), FadeIn(lora_t), FadeIn(ratio))
        self.wait(0.8)
        for target in [2, 4, 8, 64]:
            self.play(r.animate.set_value(target), run_time=1.1, rate_func=smooth)
            self.wait(0.4)
        self.play(r.animate.set_value(4), run_time=1.0)
        note = Text("bars on a log scale", font_size=16, color=GREY_).next_to(full_bar, RIGHT, buff=0.15)
        self.play(FadeIn(note))
        paper = Text("Paper: r = 1 or 2 already works for GPT-3 (WikiSQL, MultiNLI)", font_size=22, color=GREEN_).to_edge(DOWN, buff=0.9)
        paper2 = Text("Whole GPT-3: 4.7M trainable vs 175,255.8M for full fine-tuning", font_size=22, color=GREEN_).to_edge(DOWN, buff=0.35)
        self.play(Write(paper)); self.play(Write(paper2)); self.wait(2)


class MergeNoLatency(Scene):
    """After training, fold B·A into W: one matrix, zero extra delay. Swap tasks by swapping B·A."""
    def construct(self):
        title = Text("Deploying: merge the update into the weights", font_size=30).to_edge(UP)
        self.play(Write(title))
        W = grid_rect(2.4, 2.4, GREY_, 10, 10, 0.18).shift(LEFT * 3.6)
        wl = Text("W0", font_size=24, color=GREY_).next_to(W, DOWN)
        plus = Text("+", font_size=44).next_to(W, RIGHT, buff=0.4)
        dW = grid_rect(2.4, 2.4, PINK_, 10, 10, 0.3).next_to(plus, RIGHT, buff=0.4)
        dl = Text("B·A (task: SQL)", font_size=22, color=PINK_).next_to(dW, DOWN)
        self.play(FadeIn(W), FadeIn(wl), Write(plus), FadeIn(dW), FadeIn(dl))
        eq = Text("=", font_size=44).next_to(dW, RIGHT, buff=0.4)
        M = grid_rect(2.4, 2.4, YEL_, 10, 10, 0.25).next_to(eq, RIGHT, buff=0.4)
        ml = Text("W = W0 + B·A", font_size=22, color=YEL_).next_to(M, DOWN)
        self.play(Write(eq))
        self.play(TransformFromCopy(VGroup(W, dW), M), FadeIn(ml), run_time=1.5)
        same = Text("Same shape as W0: one matrix multiply, exactly like the original model", font_size=22, color=GREEN_).to_edge(DOWN, buff=1.2)
        self.play(Write(same)); self.wait(0.8)
        lat = Text("No extra inference latency. Adapters add layers: +20.7% to +30.3% at batch 1 (paper, Table 1)", font_size=18, color=GREY_).to_edge(DOWN, buff=0.6)
        self.play(FadeIn(lat)); self.wait(1.0)
        # swap tasks
        dW2 = grid_rect(2.4, 2.4, BLUE_, 10, 10, 0.3).move_to(dW)
        dl2 = Text("B'·A' (task: summaries)", font_size=22, color=BLUE_).next_to(dW2, DOWN)
        swap = Text("New task? subtract B·A, add B'·A' (about 35MB, not 350GB)", font_size=22, color=YEL_).next_to(title, DOWN)
        self.play(FadeIn(swap))
        ml2 = Text("W = W0 + B'·A'", font_size=22, color=BLUE_).move_to(ml)
        self.play(ReplacementTransform(dW, dW2), ReplacementTransform(dl, dl2), ReplacementTransform(ml, ml2), M[0].animate.set_fill(BLUE_, 0.3).set_stroke(BLUE_), run_time=1.4)
        self.wait(2)
