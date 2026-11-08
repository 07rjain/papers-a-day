# Manim Community Edition scenes for paper #10: InstructGPT (Ouyang et al., 2022, arXiv 2203.02155)
# Render: manim -qm instructgpt_scenes.py RLHFPipeline RewardModelRanking KLLeash
# Text-only (no LaTeX needed). Numbers marked "toy" are illustrative, not from the paper.
from manim import *
import numpy as np

BG = "#0b1020"
BLUE_C_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"
config.background_color = BG


def card(label, sub, color, w=3.4, h=1.7):
    box = RoundedRectangle(corner_radius=0.2, width=w, height=h, stroke_color=color, stroke_width=4,
                           fill_color=color, fill_opacity=0.12)
    t = Text(label, font_size=26, weight=BOLD, color=WHITE)
    s = Text(sub, font_size=16, color=GREY_)
    VGroup(t, s).arrange(DOWN, buff=0.15).move_to(box)
    return VGroup(box, t, s)


class RLHFPipeline(Scene):
    def construct(self):
        title = Text("InstructGPT: three steps from GPT-3 to a helpful assistant", font_size=30).to_edge(UP)
        self.play(Write(title), run_time=1.2)
        gpt3 = card("GPT-3", "predicts the next word", GREY_, w=2.9).shift(LEFT * 5.4 + UP * 0.3)
        s1 = card("1. SFT", "copy ~13k human demos", BLUE_C_, w=3.2).shift(LEFT * 1.6 + UP * 0.3)
        s2 = card("2. Reward model", "learn from ~33k prompts' rankings", ORANGE_, w=3.8).shift(RIGHT * 3.0 + UP * 0.3)
        self.play(FadeIn(gpt3, shift=UP))
        a1 = Arrow(gpt3.get_right(), s1.get_left(), color=WHITE, buff=0.1)
        self.play(GrowArrow(a1), FadeIn(s1, shift=RIGHT))
        demo = Text('"Explain the moon landing to a 6 year old"  →  labeler writes a good answer',
                    font_size=20, color=BLUE_C_).shift(DOWN * 1.6)
        self.play(Write(demo), run_time=1.5); self.wait(0.6)
        a2 = Arrow(s1.get_right(), s2.get_left(), color=WHITE, buff=0.1)
        rank = Text("labelers rank 4 to 9 answers:  D > C > A = B", font_size=20, color=ORANGE_).shift(DOWN * 1.6)
        self.play(GrowArrow(a2), FadeIn(s2, shift=RIGHT), ReplacementTransform(demo, rank)); self.wait(0.8)
        s3 = card("3. PPO", "maximize reward, stay close", GREEN_).shift(DOWN * 2.3 + RIGHT * 0.3)
        self.play(FadeOut(rank))
        a3 = CurvedArrow(s2.get_bottom(), s3.get_right(), color=WHITE, angle=-PI / 3)
        a4 = CurvedArrow(s1.get_bottom(), s3.get_left(), color=WHITE, angle=PI / 3)
        self.play(Create(a3), Create(a4), FadeIn(s3, shift=UP))
        # reward pulses from RM into policy
        for _ in range(3):
            dot = Dot(color=ORANGE_, radius=0.12).move_to(s2.get_bottom())
            self.play(MoveAlongPath(dot, a3), run_time=0.6, rate_func=smooth)
            self.play(Flash(s3, color=GREEN_, flash_radius=1.2), FadeOut(dot), run_time=0.35)
        out = Text("InstructGPT 1.3B beats GPT-3 175B in human preference", font_size=26, color=GREEN_).to_edge(DOWN, buff=0.15)
        self.play(s3.animate.scale(1.08), Write(out)); self.wait(1.5)


class RewardModelRanking(Scene):
    def construct(self):
        title = Text("Step 2: turn a ranking into pairwise lessons", font_size=32).to_edge(UP)
        self.play(Write(title))
        labels = ["A", "B", "C", "D"]
        rewards = [0.4, -0.6, 1.3, 2.1]  # toy scores
        cols = [GREY_, GREY_, BLUE_C_, GREEN_]
        cards = VGroup(*[
            VGroup(RoundedRectangle(corner_radius=0.15, width=1.4, height=1.0, stroke_color=c, fill_color=c, fill_opacity=0.15),
                   Text(l, font_size=36, weight=BOLD)) for l, c in zip(labels, cols)
        ]).arrange(RIGHT, buff=0.6).shift(UP * 1.6)
        for g in cards: g[1].move_to(g[0])
        self.play(LaggedStart(*[FadeIn(c, shift=DOWN) for c in cards], lag_ratio=0.2))
        note = Text("labeler's order:  D  >  C  >  A  >  B", font_size=24, color=ORANGE_).next_to(cards, DOWN, buff=0.35)
        order = [3, 2, 0, 1]
        target = cards.copy()
        for slot, idx in enumerate(order):
            target[idx].move_to(cards[slot].get_center())
        self.play(*[cards[i].animate.move_to(target[i]) for i in range(4)], Write(note), run_time=1.4)
        pairs_title = Text("K = 4 answers  →  4 choose 2 = 6 comparisons, one batch", font_size=22, color=GREY_).shift(DOWN * 0.1)
        self.play(FadeIn(pairs_title))
        pairs = [(3, 2), (3, 0), (3, 1), (2, 0), (2, 1), (0, 1)]
        rows = VGroup()
        for w, l in pairs:
            p = 1 / (1 + np.exp(-(rewards[w] - rewards[l])))
            rows.add(Text(f"{labels[w]} beats {labels[l]}:  σ(r{labels[w]} − r{labels[l]}) = {p:.2f}", font_size=20))
        rows.arrange_in_grid(rows=3, cols=2, buff=(0.8, 0.25)).shift(DOWN * 1.5)
        for r, (w, l) in zip(rows, pairs):
            line = Line(cards[w].get_bottom(), cards[l].get_bottom(), color=ORANGE_, stroke_width=2).set_opacity(0.6)
            self.play(Create(line), FadeIn(r, shift=UP * 0.2), run_time=0.45)
            self.play(FadeOut(line), run_time=0.15)
        loss = Text("loss = −log σ(r_winner − r_loser): push winner's score up, loser's down  (scores are toy)",
                    font_size=19, color=ORANGE_).to_edge(DOWN, buff=0.2)
        self.play(Write(loss)); self.wait(1.5)


class KLLeash(Scene):
    def construct(self):
        title = Text("Step 3: chase reward, but on a KL leash", font_size=32).to_edge(UP)
        self.play(Write(title))
        ax = Axes(x_range=[-4, 4, 1], y_range=[0, 1.1, 0.5], x_length=10, y_length=4.2,
                  axis_config={"color": GREY_, "include_ticks": False}).shift(DOWN * 0.6)
        xl = Text("kinds of answers (toy 1-D picture)", font_size=18, color=GREY_).next_to(ax, DOWN, buff=0.15)
        self.play(Create(ax), FadeIn(xl))
        g = lambda m, s: (lambda x: np.exp(-((x - m) ** 2) / (2 * s * s)))
        sft = ax.plot(g(-1.0, 0.8), color=BLUE_C_, stroke_width=4)
        sft_l = Text("SFT model", font_size=20, color=BLUE_C_).next_to(ax.c2p(-1, 1), UP, buff=0.05)
        rm = ax.plot(lambda x: 0.12 + 0.85 / (1 + np.exp(-1.6 * (x - 1.2))), color=ORANGE_, stroke_width=3)
        rm_l = Text("reward model score", font_size=18, color=ORANGE_).next_to(ax.c2p(3.2, 0.97), UP, buff=0.05)
        self.play(Create(sft), FadeIn(sft_l)); self.play(Create(rm), FadeIn(rm_l))
        mu = ValueTracker(-1.0)
        pol = always_redraw(lambda: ax.plot(g(mu.get_value(), 0.7), color=GREEN_, stroke_width=5))
        pol_l = always_redraw(lambda: Text("policy", font_size=20, color=GREEN_).next_to(ax.c2p(mu.get_value(), 1), UP, buff=0.35))
        leash = always_redraw(lambda: Line(ax.c2p(-1, 0.55), ax.c2p(mu.get_value(), 0.55), color=PINK_, stroke_width=3))
        self.play(FadeIn(pol), FadeIn(pol_l), FadeIn(leash))
        cap1 = Text("with β > 0: moves toward higher reward, stays near SFT", font_size=22, color=GREEN_).to_edge(DOWN, buff=0.15)
        self.play(Write(cap1), mu.animate.set_value(0.9), run_time=2.5); self.wait(0.5)
        cap2 = Text("β = 0: no leash, runs off to fool the reward model (reward hacking)", font_size=22, color=PINK_).to_edge(DOWN, buff=0.15)
        self.play(ReplacementTransform(cap1, cap2), FadeOut(leash))
        self.play(mu.animate.set_value(3.6), run_time=2.0, rate_func=rush_into)
        warn = Text("odd, repetitive text the RM happens to love", font_size=20, color=PINK_).next_to(ax.c2p(3.0, 0.6), LEFT)
        self.play(FadeIn(warn)); self.wait(0.8)
        self.play(FadeOut(warn), mu.animate.set_value(0.9), run_time=1.5)
        cap3 = Text("objective = reward − β·KL(policy ‖ SFT)  + γ·pretraining loss term (PPO-ptx)", font_size=21).to_edge(DOWN, buff=0.15)
        self.play(ReplacementTransform(cap2, cap3), FadeIn(leash)); self.wait(1.8)
