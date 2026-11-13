# Manim Community Edition scenes for paper #15: Self-Consistency
# "Self-Consistency Improves Chain of Thought Reasoning in Language Models"
# (Wang, Wei, Schuurmans, Le, Chi, Narang, Chowdhery, Zhou — Google Research, Brain Team, ICLR 2023, arXiv 2203.11171)
# Render: manim -qm sc_scenes.py SampleAndVote GainsByModel Aggregation
# Text-only (no LaTeX). Example problem and outputs are from the paper's Figure 1; numbers from Tables 1 and 2.
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"
config.background_color = BG


def panel(w, h, col):
    return RoundedRectangle(corner_radius=0.2, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.08, stroke_width=2.5)


class SampleAndVote(Scene):
    """Paper Figure 1: greedy decode gives $14 (wrong); sampling several paths and voting gives $18."""
    def construct(self):
        title = Text("Don't trust one answer: sample several, then vote", font_size=30).to_edge(UP)
        self.play(Write(title))
        q = Text("Janet's ducks lay 16 eggs a day. She eats 3 and bakes with 4.\nShe sells the rest for $2 each. How much does she make a day?", font_size=20, line_spacing=0.9).next_to(title, DOWN, buff=0.3)
        self.play(FadeIn(q, shift=DOWN * 0.2))
        lm = panel(1.8, 1.2, BLUE_).move_to([-5.2, -1.2, 0])
        lmt = Text("language\nmodel", font_size=20, color=BLUE_).move_to(lm)
        self.play(Create(lm), FadeIn(lmt))
        # greedy
        g = Text("Greedy (one path): 3 + 4 = 7 eggs ... 7 x $2 = $14", font_size=18, color=ORANGE_).move_to([0.6, 0.55, 0])
        ga = Arrow(lm.get_right(), g.get_left(), color=ORANGE_, buff=0.1, stroke_width=4)
        self.play(GrowArrow(ga), Write(g), run_time=1.2)
        gx = Text("$14  ✗", font_size=24, color=RED_).next_to(g, RIGHT, buff=0.3)
        self.play(FadeIn(gx, scale=1.4))
        self.wait(0.4)
        self.play(FadeOut(ga), g.animate.set_opacity(0.3), gx.animate.set_opacity(0.3))
        paths = [
            ("16 - 3 - 4 = 9 eggs left, 9 x $2 = $18", "$18", GREEN_),
            ("$2 x (16 - 4 - 3) = $26   (arithmetic slip)", "$26", RED_),
            ("16 - 3 = 13, then 13 - 4 = 9, 9 x $2 = $18", "$18", GREEN_),
        ]
        outs = []
        for i, (s, a, col) in enumerate(paths):
            y = -0.45 - i * 0.85
            t = Text(s, font_size=17).move_to([0.2, y, 0])
            ar = CurvedArrow(lm.get_right() + RIGHT * 0.05, t.get_left() + LEFT * 0.1, color=GREY_, angle=-0.25 + i * 0.2)
            at = Text(a, font_size=24, color=col).move_to([4.6, y, 0])
            self.play(Create(ar), Write(t), run_time=0.8)
            self.play(FadeIn(at, shift=RIGHT * 0.2), run_time=0.35)
            outs.append(at)
        st = Text("sampled paths (temperature > 0)", font_size=16, color=GREY_).move_to([0.2, -3.0, 0])
        self.play(FadeIn(st))
        # vote
        box = panel(1.9, 2.4, YEL_).move_to([6.1, -1.3, 0])
        vt = Text("vote", font_size=18, color=YEL_).next_to(box.get_top(), DOWN, buff=0.1)
        self.play(Create(box), FadeIn(vt))
        r18 = Text("$18: 2", font_size=22, color=GREEN_).move_to(box.get_center() + UP * 0.2)
        r26 = Text("$26: 1", font_size=22, color=RED_).move_to(box.get_center() + DOWN * 0.4)
        self.play(TransformFromCopy(VGroup(outs[0], outs[2]), r18), TransformFromCopy(outs[1], r26))
        win = SurroundingRectangle(r18, color=YEL_)
        self.play(Create(win))
        note = Text("The answer most paths agree on wins: $18 ✓  (no extra training, no extra model)", font_size=19, color=YEL_).to_edge(DOWN, buff=0.12)
        self.play(FadeIn(note))
        self.wait(1.8)


class GainsByModel(Scene):
    """Paper Table 2, GSM8K: CoT with greedy decoding vs self-consistency (40 sampled paths)."""
    def construct(self):
        title = Text("Same model, same prompt, just sample and vote", font_size=30).to_edge(UP)
        sub = Text("GSM8K grade-school math, accuracy %  (paper Table 2)", font_size=20, color=GREY_).next_to(title, DOWN, buff=0.15)
        self.play(Write(title), FadeIn(sub))
        rows = [("UL2 20B", 4.1, 7.3), ("LaMDA 137B", 17.1, 27.7), ("GPT-3 code-davinci-001", 14.6, 23.4), ("PaLM 540B", 56.5, 74.4), ("GPT-3 code-davinci-002", 60.1, 78.0)]
        scale = 0.075
        x0 = -2.0
        bars = []
        for i, (name, a, b) in enumerate(rows):
            y = 1.5 - i * 0.95
            lab = Text(name, font_size=19).move_to([x0 - 0.25, y, 0], aligned_edge=RIGHT)
            ba = Rectangle(width=a * scale, height=0.32, fill_color=ORANGE_, fill_opacity=0.9, stroke_width=0).move_to([x0, y + 0.18, 0], aligned_edge=LEFT)
            bb = Rectangle(width=b * scale, height=0.32, fill_color=GREEN_, fill_opacity=0.9, stroke_width=0).move_to([x0, y - 0.18, 0], aligned_edge=LEFT)
            ta = Text(f"{a}", font_size=16, color=ORANGE_).next_to(ba, RIGHT, buff=0.1)
            tb = Text(f"{b}  (+{round(b - a, 1)})", font_size=16, color=GREEN_).next_to(bb, RIGHT, buff=0.1)
            self.play(FadeIn(lab), GrowFromEdge(ba, LEFT), run_time=0.5)
            self.play(FadeIn(ta), GrowFromEdge(bb, LEFT), run_time=0.6)
            self.play(FadeIn(tb), run_time=0.25)
            bars.append(bb)
        leg = VGroup(
            VGroup(Square(0.25, fill_color=ORANGE_, fill_opacity=0.9, stroke_width=0), Text("chain of thought, greedy (one answer)", font_size=16, color=ORANGE_)).arrange(RIGHT, buff=0.12),
            VGroup(Square(0.25, fill_color=GREEN_, fill_opacity=0.9, stroke_width=0), Text("self-consistency (40 sampled paths, majority vote)", font_size=16, color=GREEN_)).arrange(RIGHT, buff=0.12),
        ).arrange(RIGHT, buff=0.5).to_edge(DOWN, buff=0.3)
        self.play(FadeIn(leg))
        self.play(Indicate(bars[3], color=YEL_), Indicate(bars[4], color=YEL_))
        self.wait(1.8)


class Aggregation(Scene):
    """Paper Table 1, PaLM-540B on GSM8K: plain majority vote is as good as the best probability-weighted scheme."""
    def construct(self):
        title = Text("How should the paths vote?", font_size=32).to_edge(UP)
        sub = Text("PaLM 540B on GSM8K, accuracy %  (paper Table 1)", font_size=20, color=GREY_).next_to(title, DOWN, buff=0.15)
        self.play(Write(title), FadeIn(sub))
        rows = [
            ("Greedy decode (one path)", 56.5, GREY_),
            ("Weighted average, normalized", 22.1, RED_),
            ("Weighted average, unnormalized", 56.3, PINK_),
            ("Weighted sum, unnormalized", 59.9, ORANGE_),
            ("Weighted sum, normalized", 74.1, BLUE_),
            ("Unweighted sum = majority vote", 74.4, GREEN_),
        ]
        scale = 0.07
        x0 = -0.6
        objs = []
        for i, (name, v, col) in enumerate(rows):
            y = 1.55 - i * 0.78
            lab = Text(name, font_size=19, color=col).move_to([x0 - 0.25, y, 0], aligned_edge=RIGHT)
            bar = Rectangle(width=v * scale, height=0.45, fill_color=col, fill_opacity=0.85, stroke_width=0).move_to([x0, y, 0], aligned_edge=LEFT)
            val = Text(f"{v}%", font_size=19).next_to(bar, RIGHT, buff=0.12)
            self.play(FadeIn(lab), GrowFromEdge(bar, LEFT), run_time=0.6)
            self.play(FadeIn(val), run_time=0.2)
            objs.append(bar)
        note = Text("Just counting answers works as well as anything fancier: the model rates\nits paths as about equally likely, so its own probabilities add little.", font_size=19, color=YEL_, line_spacing=0.9).to_edge(DOWN, buff=0.15)
        self.play(FadeIn(note))
        self.play(Indicate(objs[-1], color=YEL_, scale_factor=1.05))
        self.wait(1.8)
