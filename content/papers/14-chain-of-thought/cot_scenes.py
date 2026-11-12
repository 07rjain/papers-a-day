# Manim Community Edition scenes for paper #14: Chain-of-Thought Prompting
# "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models"
# (Wei, Wang, Schuurmans, Bosma, Ichter, Xia, Chi, Le, Zhou — Google Research, Brain Team, NeurIPS 2022, arXiv 2201.11903)
# Render: manim -qm cot_scenes.py StandardVsCoT EmergentScale Ablation
# Text-only (no LaTeX). Example problem is from the paper's Figure 1; all numbers are from the paper (Table 2, Table 6).
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"
config.background_color = BG


def panel(w, h, col):
    return RoundedRectangle(corner_radius=0.2, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.08, stroke_width=2.5)


class StandardVsCoT(Scene):
    """Same question; answer-only prompting blurts 27, chain of thought works it out to 9 (paper Figure 1)."""
    def construct(self):
        title = Text("Same question, two ways to answer", font_size=32).to_edge(UP)
        self.play(Write(title))
        q = Text("Q: The cafeteria had 23 apples. They used 20 to make lunch\nand bought 6 more. How many apples do they have?", font_size=22, line_spacing=0.9).next_to(title, DOWN, buff=0.35)
        self.play(FadeIn(q, shift=DOWN * 0.2))
        lp = panel(5.6, 3.8, ORANGE_).move_to([-3.25, -1.5, 0])
        rp = panel(6.6, 3.8, GREEN_).move_to([3.0, -1.5, 0])
        lt = Text("Standard prompting", font_size=22, color=ORANGE_).next_to(lp.get_top(), DOWN, buff=0.18)
        rt = Text("Chain-of-thought prompting", font_size=22, color=GREEN_).next_to(rp.get_top(), DOWN, buff=0.18)
        self.play(Create(lp), Create(rp), FadeIn(lt), FadeIn(rt))
        ex1 = Text("examples show: Q ... A: The answer is 11.", font_size=16, color=GREY_).next_to(lt, DOWN, buff=0.2)
        ex2 = Text("examples show the working: 5 + 6 = 11. The answer is 11.", font_size=16, color=GREY_).next_to(rt, DOWN, buff=0.2)
        self.play(FadeIn(ex1), FadeIn(ex2))
        a1 = Text("A: The answer is 27.", font_size=26).move_to(lp.get_center() + DOWN * 0.3)
        self.play(Write(a1), run_time=0.8)
        x = Text("✗ wrong", font_size=26, color=RED_).next_to(a1, DOWN, buff=0.3)
        self.play(FadeIn(x, scale=1.4))
        steps = [
            "They had 23 apples originally.",
            "They used 20 to make lunch: 23 - 20 = 3.",
            "They bought 6 more: 3 + 6 = 9.",
            "The answer is 9.",
        ]
        prev = ex2
        group = VGroup()
        for i, s in enumerate(steps):
            t = Text(s, font_size=20, color=WHITE if i < 3 else YEL_)
            t.next_to(prev, DOWN, buff=0.18).align_to(rp.get_left() + RIGHT * 0.35, LEFT)
            dot = Dot(color=GREEN_, radius=0.06).next_to(t, LEFT, buff=0.12)
            self.play(FadeIn(dot, scale=2), Write(t), run_time=0.75)
            group.add(dot, t)
            prev = t
        ok = Text("✓ right", font_size=26, color=GREEN_).next_to(prev, RIGHT, buff=0.3)
        self.play(FadeIn(ok, scale=1.4))
        self.play(Indicate(group, color=GREEN_, scale_factor=1.03))
        note = Text("Nothing was retrained: only the examples in the prompt changed.", font_size=20, color=YEL_).to_edge(DOWN, buff=0.12)
        self.play(FadeIn(note))
        self.wait(1.6)


class EmergentScale(Scene):
    """PaLM on GSM8K math word problems (paper Table 2): CoT only pays off at large scale."""
    def construct(self):
        title = Text("Chain of thought only switches on in big models", font_size=30).to_edge(UP)
        self.play(Write(title))
        ax = Axes(x_range=[0, 2.4, 1], y_range=[0, 70, 10], x_length=8.2, y_length=4.6,
                  axis_config={"color": GREY_, "include_tip": False}).shift(DOWN * 0.45 + LEFT * 0.6)
        xs = [0.2, 1.2, 2.2]
        names = ["PaLM 8B", "PaLM 62B", "PaLM 540B"]
        labs = VGroup(*[Text(n, font_size=20, color=GREY_).next_to(ax.c2p(x, 0), DOWN, buff=0.2) for x, n in zip(xs, names)])
        yt = VGroup(*[Text(str(v), font_size=18, color=GREY_).next_to(ax.c2p(0, v), LEFT, buff=0.12) for v in [0, 20, 40, 60]])
        self.add(yt)
        ylab = Text("GSM8K solve rate (%)", font_size=20, color=GREY_).rotate(PI / 2).next_to(ax, LEFT, buff=0.7)
        self.play(Create(ax), FadeIn(labs), FadeIn(ylab))
        prior = DashedLine(ax.c2p(0, 55), ax.c2p(2.4, 55), color=PINK_)
        prior_t = Text("prior best: fine-tuned GPT-3 + verifier (55%)", font_size=17, color=PINK_).next_to(prior, UP, buff=0.08).align_to(prior, LEFT)
        self.play(Create(prior), FadeIn(prior_t))
        std = [4.9, 9.6, 17.9]
        cot = [4.1, 29.9, 56.9]
        def path(vals, col):
            pts = [ax.c2p(x, v) for x, v in zip(xs, vals)]
            line = VMobject(color=col, stroke_width=5).set_points_as_corners(pts)
            dots = VGroup(*[Dot(p, color=col, radius=0.09) for p in pts])
            return line, dots, pts
        l1, d1, p1 = path(std, ORANGE_)
        l2, d2, p2 = path(cot, GREEN_)
        leg = VGroup(
            VGroup(Line(ORIGIN, RIGHT * 0.5, color=ORANGE_, stroke_width=5), Text("standard prompting", font_size=18, color=ORANGE_)).arrange(RIGHT, buff=0.15),
            VGroup(Line(ORIGIN, RIGHT * 0.5, color=GREEN_, stroke_width=5), Text("chain-of-thought prompting", font_size=18, color=GREEN_)).arrange(RIGHT, buff=0.15),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.15).to_corner(UR).shift(DOWN * 1.0)
        self.play(FadeIn(leg))
        self.play(Create(l1), FadeIn(d1), run_time=1.4)
        self.play(Create(l2), FadeIn(d2), run_time=1.8)
        for p, s, c in zip(p2, cot, std):
            t = Text(f"{s}%", font_size=18, color=GREEN_).next_to(p, UP + LEFT * 0.3, buff=0.1)
            self.play(FadeIn(t), run_time=0.3)
        n0 = Text("small: CoT doesn't help (4.9 → 4.1)", font_size=18, color=GREY_).move_to(ax.c2p(0.75, 42))
        self.play(FadeIn(n0))
        jump = Arrow(ax.c2p(2.2, 17.9), ax.c2p(2.2, 56.9), color=YEL_, buff=0.12, stroke_width=6)
        jt = Text("+39 points", font_size=22, color=YEL_).next_to(jump, LEFT, buff=0.15)
        self.play(GrowArrow(jump), FadeIn(jt))
        self.play(Indicate(d2[2], color=YEL_, scale_factor=1.8))
        self.wait(1.8)


class Ablation(Scene):
    """LaMDA 137B on GSM8K (paper Table 6): only real natural-language steps before the answer help."""
    def construct(self):
        title = Text("Is it really the reasoning? The ablation test", font_size=30).to_edge(UP)
        self.play(Write(title))
        rows = [
            ("Standard prompting", 6.5, GREY_, "just the answer"),
            ("Equation only", 5.4, BLUE_, "an equation, then the answer"),
            ("Variable compute only", 6.4, ORANGE_, "dots (. . .) as long as the equation"),
            ("Reasoning after answer", 6.1, PINK_, "answer first, explanation after"),
            ("Chain of thought", 14.3, GREEN_, "steps in words, then the answer"),
        ]
        scale = 0.42
        x0 = -2.2
        objs = []
        for i, (name, v, col, desc) in enumerate(rows):
            y = 1.9 - i * 1.0
            lab = Text(name, font_size=21, color=col).move_to([x0 - 0.2, y + 0.12, 0], aligned_edge=RIGHT)
            sub = Text(desc, font_size=14, color=GREY_).move_to([x0 - 0.2, y - 0.2, 0], aligned_edge=RIGHT)
            bar = Rectangle(width=0.001, height=0.5, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to([x0, y, 0], aligned_edge=LEFT)
            target = Rectangle(width=v * scale, height=0.5, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to([x0, y, 0], aligned_edge=LEFT)
            val = Text(f"{v}%", font_size=20).next_to(target, RIGHT, buff=0.15)
            self.play(FadeIn(lab), FadeIn(sub), run_time=0.35)
            self.play(Transform(bar, target), run_time=0.7)
            self.play(FadeIn(val), run_time=0.25)
            objs.append(bar)
        base = DashedLine([x0 + 6.5 * scale, 2.5, 0], [x0 + 6.5 * scale, -2.5, 0], color=GREY_)
        self.play(Create(base))
        note = Text("LaMDA 137B, GSM8K solve rate. Only real steps in words, before the answer, help.", font_size=19, color=YEL_).to_edge(DOWN, buff=0.25)
        self.play(FadeIn(note))
        self.play(Indicate(objs[-1], color=YEL_, scale_factor=1.05))
        self.wait(1.8)
