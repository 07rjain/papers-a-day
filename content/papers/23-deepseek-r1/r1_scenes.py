# Manim Community Edition scenes for paper #23: DeepSeek-R1
# "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning" (DeepSeek-AI; arXiv 2501.12948, v1 22 Jan 2025)
# Render: manim -qm r1_scenes.py GRPOGroupAdvantage AhaMoment R1Pipeline
# Text-only (no LaTeX). GRPO objective + advantage = Section 2.2.1, Eq. 1-3; rule-based rewards = 2.2.2; template = Table 1;
# AIME 15.6% -> 71.0% (86.7% majority vote) = Section 2.2.4 / Table 2; aha moment = Table 3; pipeline = Section 2.3;
# distillation = Section 2.4 / Table 5; 800k samples = 2.3.3.
# The example rewards for the 8 sampled answers are ILLUSTRATIVE (toy). The SHAPE of the AIME and response-length curves is
# illustrative (only the start/end values 15.6% / 71.0% / 86.7% are from the paper; the length curve has no exact values in the text).
from manim import *
import numpy as np

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"; CYAN_ = "#22d3ee"
config.background_color = BG


def box(label, col, w=1.8, h=0.6, fs=18, op=0.15):
    r = RoundedRectangle(corner_radius=0.12, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=op, stroke_width=2.5)
    t = Text(label, font_size=fs, color=WHITE, line_spacing=0.8)
    if t.width > w - 0.2:
        t.scale_to_fit_width(w - 0.2)
    if t.height > h - 0.12:
        t.scale_to_fit_height(h - 0.12)
    t.move_to(r)
    return VGroup(r, t)


def title(s):
    return Text(s, font_size=30, color=WHITE, weight=BOLD).to_edge(UP, buff=0.3)


class GRPOGroupAdvantage(Scene):
    def construct(self):
        tt = title("GRPO: grade each answer against its own group")
        self.play(Write(tt))
        q = box("Question q:  a maths problem with one checkable final answer", BLUE_, 8.6, 0.6, 18).move_to([0, 2.45, 0])
        self.play(FadeIn(q, shift=DOWN * 0.2))
        pol = box("policy model\n(samples G answers)", PURP_, 2.6, 0.8, 16).move_to([-5.1, 1.2, 0])
        self.play(FadeIn(pol))
        G = 8
        rewards = [1, 0, 1, 0, 0, 1, 0, 0]  # toy
        xs = [-3.15 + i * 1.05 for i in range(G)]
        outs = VGroup(*[box(f"o{i+1}", GREY_, 0.85, 0.6, 18) for i in range(G)])
        for i, o in enumerate(outs):
            o.move_to([xs[i] + 1.2, 1.2, 0])
        arrows = VGroup(*[Arrow(pol.get_right(), o.get_left() + LEFT * 0.0, buff=0.08, stroke_width=1.5, color=GREY_, max_tip_length_to_length_ratio=0.06) for o in outs[:1]])
        self.play(GrowArrow(arrows[0]), LaggedStart(*[FadeIn(o, shift=RIGHT * 0.3) for o in outs], lag_ratio=0.1))
        note = Text("each oᵢ = <think> reasoning </think> <answer> … </answer>   (Table 1 template)", font_size=14, color=GREY_).move_to([1.2, 0.6, 0])
        self.play(FadeIn(note))
        # rule-based reward
        rule = box("rule-based reward: is the final answer right? (+ format check)\nno neural reward model, no human grader", YEL_, 7.4, 0.8, 15).move_to([1.2, -0.2, 0])
        self.play(FadeIn(rule))
        marks = VGroup()
        for i, o in enumerate(outs):
            c = GREEN_ if rewards[i] else RED_
            self.add(o)
            marks.add(Text(f"r={rewards[i]}", font_size=16, color=c).next_to(o, DOWN, buff=0.08))
        self.play(*[o[0].animate.set_stroke(GREEN_ if rewards[i] else RED_).set_fill(GREEN_ if rewards[i] else RED_, 0.25) for i, o in enumerate(outs)], FadeIn(marks), run_time=1.2)
        self.wait(0.5)
        self.play(FadeOut(rule), FadeOut(note))
        mean = float(np.mean(rewards)); std = float(np.std(rewards))
        stats = Text(f"group mean = {mean:.3f}     group std = {std:.3f}", font_size=20, color=WHITE).move_to([1.2, -0.25, 0])
        formula = Text("advantage  Aᵢ = (rᵢ − mean) / std      (Eq. 3)", font_size=22, color=YEL_).move_to([1.2, -0.85, 0])
        self.play(FadeIn(stats), Write(formula))
        # advantage bars
        base = -2.55
        line = Line([-2.4, base, 0], [5.2, base, 0], color=GREY_, stroke_width=1.5)
        self.play(Create(line))
        bars = VGroup(); labs = VGroup()
        for i in range(G):
            a = (rewards[i] - mean) / std
            h = abs(a) * 0.55
            col = GREEN_ if a > 0 else RED_
            b = Rectangle(width=0.55, height=h, fill_color=col, fill_opacity=0.85, stroke_width=0)
            x = outs[i].get_center()[0]
            b.move_to([x, base + (h / 2 if a > 0 else -h / 2), 0])
            bars.add(b)
            labs.add(Text(f"{a:+.2f}", font_size=13, color=col).move_to([x, base + (h + 0.15 if a > 0 else -h - 0.15), 0]))
        self.play(LaggedStart(*[GrowFromEdge(b, DOWN if (rewards[i] - mean) > 0 else UP) for i, b in enumerate(bars)], lag_ratio=0.08), FadeIn(labs))
        lab_up = Text("above the group average → make more likely", font_size=15, color=GREEN_).move_to([-4.6, -2.0, 0])
        lab_dn = Text("below → make less likely", font_size=15, color=RED_).move_to([-4.6, -3.1, 0])
        self.play(FadeIn(lab_up), FadeIn(lab_dn))
        self.wait(0.6)
        # policy update
        self.play(*[outs[i].animate.scale(1.18) for i in range(G) if rewards[i]], *[outs[i].animate.scale(0.82).set_opacity(0.5) for i in range(G) if not rewards[i]], run_time=1.2)
        foot = Text("No critic (value) network: the group itself is the baseline. Clipped ratio + small KL penalty keep each step small (Eq. 1).", font_size=14, color=GREY_).to_edge(DOWN, buff=0.15)
        self.play(FadeIn(foot))
        self.wait(2)


class AhaMoment(Scene):
    def construct(self):
        tt = title("R1-Zero: pure RL, and the model learns to think longer")
        self.play(Write(tt))
        # left: AIME accuracy
        ax = Axes(x_range=[0, 10, 2], y_range=[0, 100, 20], x_length=5.2, y_length=3.6, tips=False,
                  axis_config={"color": GREY_, "stroke_width": 1.5, "include_ticks": False}).move_to([-3.4, -0.4, 0])
        yl = VGroup(*[Text(f"{v}%", font_size=12, color=GREY_).next_to(ax.c2p(0, v), LEFT, buff=0.1) for v in [0, 20, 40, 60, 80, 100]])
        xl = Text("RL training steps (thousands) →", font_size=13, color=GREY_).next_to(ax, DOWN, buff=0.15)
        hdr = Text("AIME 2024 pass@1", font_size=18, color=WHITE).next_to(ax, UP, buff=0.15)
        self.play(Create(ax), FadeIn(yl), FadeIn(xl), FadeIn(hdr))
        f = lambda x: 15.6 + (71.0 - 15.6) * (1 - np.exp(-x / 3.2)) / (1 - np.exp(-10 / 3.2))
        curve = ax.plot(f, x_range=[0, 10], color=BLUE_, stroke_width=4)
        o1 = DashedLine(ax.c2p(0, 74.4), ax.c2p(10, 74.4), color=GREY_, stroke_width=1.5)
        o1l = Text("o1-0912: 74.4", font_size=11, color=GREY_).next_to(ax.c2p(10, 74.4), UP, buff=0.05).shift(LEFT * 0.6)
        dot = Dot(ax.c2p(0, 15.6), color=YEL_)
        start = Text("15.6%", font_size=15, color=YEL_).next_to(dot, RIGHT, buff=0.1)
        self.play(FadeIn(dot), FadeIn(start), Create(o1), FadeIn(o1l))
        self.play(Create(curve), MoveAlongPath(dot, curve), run_time=3, rate_func=linear)
        end = Text("71.0%", font_size=16, color=BLUE_).move_to(ax.c2p(8.6, 60))
        maj = Dot(ax.c2p(10, 86.7), color=GREEN_)
        majl = Text("86.7% majority vote", font_size=13, color=GREEN_).next_to(maj, LEFT, buff=0.1)
        self.play(FadeIn(end), FadeIn(maj), FadeIn(majl))
        # right: response length
        ax2 = Axes(x_range=[0, 10, 2], y_range=[0, 10, 2], x_length=4.6, y_length=3.6, tips=False,
                   axis_config={"color": GREY_, "stroke_width": 1.5, "include_ticks": False}).move_to([3.6, -0.4, 0])
        hdr2 = Text("average response length", font_size=18, color=WHITE).next_to(ax2, UP, buff=0.15)
        xl2 = Text("RL training steps →", font_size=13, color=GREY_).next_to(ax2, DOWN, buff=0.15)
        g = lambda x: 0.6 + 8.6 * (x / 10) ** 1.3 + 0.25 * np.sin(3 * x)
        c2 = ax2.plot(g, x_range=[0, 10], color=ORANGE_, stroke_width=4)
        lo = Text("hundreds of tokens", font_size=12, color=GREY_).move_to(ax2.c2p(2.6, 2.6))
        hi = Text("thousands of tokens", font_size=12, color=ORANGE_).next_to(ax2.c2p(10, 9.2), LEFT, buff=0.2)
        self.play(Create(ax2), FadeIn(hdr2), FadeIn(xl2))
        self.play(Create(c2), FadeIn(lo), run_time=2.5)
        self.play(FadeIn(hi))
        toy = Text("curve shapes illustrative; start/end AIME numbers from Section 2.2.4 / Table 2 (v1)", font_size=12, color=GREY_).to_edge(DOWN, buff=0.15)
        self.play(FadeIn(toy))
        self.wait(1)
        # aha moment
        self.play(*[FadeOut(m) for m in [ax, yl, xl, hdr, curve, o1, o1l, dot, start, end, maj, majl, ax2, hdr2, xl2, c2, lo, hi]])
        card = RoundedRectangle(corner_radius=0.2, width=10.5, height=3.6, stroke_color=PURP_, fill_color=PURP_, fill_opacity=0.08).move_to([0, -0.1, 0])
        l1 = Text("<think>  To solve the equation, let's start by squaring both sides …", font_size=18, color=GREY_)
        l2 = Text("… x⁴ − 2a x² − x + (a² − a) = 0  …", font_size=18, color=GREY_)
        l3 = Text("Wait, wait. Wait. That's an aha moment I can flag here.", font_size=24, color=YEL_, weight=BOLD)
        l4 = Text("Let's reevaluate this step-by-step …", font_size=18, color=WHITE)
        lines = VGroup(l1, l2, l3, l4).arrange(DOWN, buff=0.35, aligned_edge=LEFT).move_to(card)
        cap = Text("Table 3: an intermediate R1-Zero checkpoint stops, re-checks and changes course.\nNobody taught it to say 'wait': it was only rewarded for correct final answers.", font_size=15, color=GREY_).next_to(card, DOWN, buff=0.25)
        self.play(FadeIn(card))
        self.play(FadeIn(l1, shift=RIGHT * 0.2)); self.play(FadeIn(l2, shift=RIGHT * 0.2))
        self.play(Write(l3), run_time=1.5)
        self.play(Indicate(l3, color=YEL_, scale_factor=1.08))
        self.play(FadeIn(l4, shift=RIGHT * 0.2), FadeIn(cap))
        self.wait(2.5)


class R1Pipeline(Scene):
    def construct(self):
        tt = title("From R1-Zero to R1: four stages, then distillation")
        self.play(Write(tt))
        base = box("DeepSeek-V3-Base\n(671B MoE, 37B active)", GREY_, 3.0, 0.85, 16).move_to([-5.3, 2.1, 0])
        zero = box("R1-Zero: pure RL (GRPO)\nno SFT at all", BLUE_, 3.2, 0.85, 16).move_to([0, 2.1, 0])
        zl = Text("strong reasoning, but poor readability\nand language mixing", font_size=14, color=RED_).next_to(zero, RIGHT, buff=0.3)
        self.play(FadeIn(base))
        self.play(GrowArrow(Arrow(base.get_right(), zero.get_left(), buff=0.08, color=GREY_)), FadeIn(zero))
        self.play(FadeIn(zl))
        self.wait(0.5)
        stages = [
            ("1 · Cold-start SFT", "thousands of long,\nreadable CoT examples", ORANGE_),
            ("2 · Reasoning RL", "GRPO + rule rewards\n+ language-consistency", BLUE_),
            ("3 · Rejection sampling SFT", "~600k reasoning +\n~200k other = 800k", GREEN_),
            ("4 · RL, all scenarios", "rules for reasoning, reward\nmodels for helpful/harmless", PURP_),
        ]
        boxes = VGroup()
        for i, (h, d, c) in enumerate(stages):
            b = box(h + "\n" + d, c, 2.9, 1.25, 15).move_to([-4.65 + i * 3.1, 0.2, 0])
            boxes.add(b)
        a0 = Arrow(base.get_bottom(), boxes[0].get_top(), buff=0.08, color=GREY_)
        self.play(GrowArrow(a0), FadeIn(boxes[0], shift=DOWN * 0.2))
        for i in range(1, 4):
            self.play(GrowArrow(Arrow(boxes[i - 1].get_right(), boxes[i].get_left(), buff=0.05, color=GREY_)), FadeIn(boxes[i], shift=RIGHT * 0.2), run_time=0.9)
        r1 = box("DeepSeek-R1\n≈ OpenAI-o1-1217 on reasoning", YEL_, 4.2, 0.85, 17, 0.2).move_to([4.0, -1.7, 0])
        self.play(GrowArrow(Arrow(boxes[3].get_bottom(), r1.get_top() + RIGHT * 1.0, buff=0.08, color=GREY_)), FadeIn(r1, scale=0.9))
        res = Text("AIME 2024 79.8% · MATH-500 97.3%\nCodeforces 96.3 percentile (Table 4)", font_size=15, color=WHITE).next_to(r1, DOWN, buff=0.2)
        self.play(FadeIn(res))
        # distillation
        teacher = Text("Distillation: SFT small open models on the same 800k R1-generated samples (no RL)", font_size=15, color=CYAN_).move_to([-2.6, -1.35, 0])
        teacher.scale_to_fit_width(6.2)
        self.play(FadeIn(teacher))
        models = [("Qwen-1.5B", 28.9), ("Qwen-7B", 55.5), ("Qwen-14B", 69.7), ("Qwen-32B", 72.6), ("Llama-8B", 50.4), ("Llama-70B", 70.0)]
        bars = VGroup()
        y0 = -3.55
        for i, (nm, v) in enumerate(models):
            x = -5.8 + i * 1.0
            h = v * 0.02
            r = Rectangle(width=0.7, height=h, fill_color=CYAN_, fill_opacity=0.85, stroke_width=0).move_to([x, y0 + h / 2, 0])
            bars.add(VGroup(r, Text(f"{v}", font_size=12).next_to(r, UP, buff=0.04), Text(nm, font_size=10, color=GREY_).next_to(r, DOWN, buff=0.04)))
        ref = DashedLine([-6.3, y0 + 9.3 * 0.02, 0], [-0.4, y0 + 9.3 * 0.02, 0], color=RED_, stroke_width=1.5)
        refl = Text("GPT-4o: 9.3", font_size=11, color=RED_).next_to(ref, RIGHT, buff=0.05)
        cap = Text("AIME 2024 pass@1, distilled models (Table 5)", font_size=12, color=GREY_).move_to([-2.6, -1.75, 0])
        self.play(FadeIn(cap), LaggedStart(*[GrowFromEdge(b[0], DOWN) for b in bars], lag_ratio=0.12), *[FadeIn(b[1]) for b in bars], *[FadeIn(b[2]) for b in bars])
        self.play(Create(ref), FadeIn(refl))
        self.wait(2.5)
