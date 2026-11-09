# Manim Community Edition scenes for paper #11: Chinchilla
# "Training Compute-Optimal Large Language Models" (Hoffmann et al., DeepMind, 2022, arXiv 2203.15556)
# Render: manim -qm chinchilla_scenes.py SameComputeTwoShapes IsoFLOPValleys TenXCompute
# Text-only (no LaTeX). Loss curves use the paper's fitted formula (Approach 3):
#   L(N, D) = 1.69 + 406.4 / N^0.34 + 410.7 / D^0.28, with compute C ~ 6 N D.
from manim import *
import numpy as np

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"
config.background_color = BG

E, A, B, AL, BE = 1.69, 406.4, 410.7, 0.34, 0.28
def loss(N, D):
    return E + A / N ** AL + B / D ** BE


class SameComputeTwoShapes(Scene):
    """Compute ~ 6 x params x tokens: same area, different shape."""
    def construct(self):
        title = Text("Same compute budget, two ways to spend it", font_size=32).to_edge(UP)
        self.play(Write(title))
        sub = Text("compute ≈ 6 × parameters × training tokens   (area of the box)", font_size=20, color=GREY_).next_to(title, DOWN)
        self.play(FadeIn(sub))
        # scale: width ~ params (per 100B = 1 unit), height ~ tokens (per 300B = 1 unit) -> area ~ compute
        sx, sy = 1.6 / 100, 0.75 / 300
        gw, gh = 280 * sx, 300 * sy
        gopher = Rectangle(width=gw, height=gh, stroke_color=ORANGE_, fill_color=ORANGE_, fill_opacity=0.3)
        gopher.move_to(DOWN * 1.2 + LEFT * 0.5)
        gl = VGroup(Text("Gopher", font_size=28, weight=BOLD, color=ORANGE_),
                    Text("280B params, 300B tokens", font_size=18)).arrange(DOWN, buff=0.08).next_to(gopher, UP, buff=0.15)
        self.play(GrowFromPoint(gopher, gopher.get_corner(DL)), FadeIn(gl))
        self.wait(0.8)
        cw, ch = 70 * sx, 1400 * sy
        chin = Rectangle(width=cw, height=ch, stroke_color=GREEN_, fill_color=GREEN_, fill_opacity=0.3)
        chin.move_to(gopher.get_corner(DL), aligned_edge=DL)
        cl = VGroup(Text("Chinchilla", font_size=28, weight=BOLD, color=GREEN_),
                    Text("70B params, 1.4T tokens", font_size=18)).arrange(DOWN, buff=0.08)
        self.play(gl.animate.next_to(gopher, LEFT, buff=0.3).shift(DOWN*0.0).scale(0.8)); self.play(ReplacementTransform(gopher.copy(), chin), run_time=2)
        cl.next_to(chin, RIGHT, buff=0.3).shift(UP * 0.8)
        self.play(FadeIn(cl))
        note = Text("4× smaller model, ~4.7× more data, about the same compute", font_size=22, color=YEL_).to_edge(DOWN, buff=0.9)
        self.play(Write(note)); self.wait(0.8)
        res = Text("Chinchilla wins: MMLU 67.5% vs Gopher's 60.0%", font_size=26, color=GREEN_).to_edge(DOWN, buff=0.3)
        self.play(Write(res), Flash(chin, color=GREEN_, flash_radius=1.5)); self.wait(1.5)


class IsoFLOPValleys(Scene):
    """For each fixed budget, loss vs model size is a valley; the bottoms march up and right."""
    def construct(self):
        title = Text("IsoFLOP valleys: for each budget, one best model size", font_size=30).to_edge(UP)
        self.play(Write(title))
        ax = Axes(x_range=[7.5, 12.5, 1], y_range=[1.85, 3.05, 0.2], x_length=10, y_length=5.2,
                  axis_config={"color": GREY_, "include_tip": False}).shift(DOWN * 0.4)
        xl = Text("model size (parameters, log scale)", font_size=18, color=GREY_).next_to(ax, DOWN, buff=0.15)
        yl = Text("loss", font_size=18, color=GREY_).next_to(ax, LEFT, buff=0.1).shift(UP * 2.4)
        ticks = VGroup(*[Text(s, font_size=16, color=GREY_).next_to(ax.c2p(v, 1.85), DOWN, buff=0.1)
                         for v, s in [(8, "100M"), (9, "1B"), (10, "10B"), (11, "100B"), (12, "1T")]])
        self.play(Create(ax), FadeIn(xl), FadeIn(yl), FadeIn(ticks))
        budgets = [(1e19, "1e19"), (1e20, "1e20"), (1e21, "1e21"), (1e22, "1e22"), (1e23, "1e23"), (5.76e23, "Gopher budget")]
        cols = [BLUE_, "#7c8cff", PINK_, ORANGE_, YEL_, GREEN_]
        mins = []
        for (C, name), col in zip(budgets, cols):
            def f(lx, C=C):
                N = 10 ** lx; return loss(N, C / (6 * N))
            xs = np.linspace(7.5, 12.5, 400); ys = [f(x) for x in xs]
            lo, hi = 7.5, 12.5
            # keep the part inside the y window
            pts = [(x, y) for x, y in zip(xs, ys) if y <= 3.05]
            lo, hi = pts[0][0], pts[-1][0]
            curve = ax.plot(f, x_range=[lo, hi], color=col, stroke_width=4)
            i = int(np.argmin(ys)); bx, by = xs[i], ys[i]
            dot = Dot(ax.c2p(bx, by), color=WHITE, radius=0.08)
            lab = Text(name if name.startswith("Gopher") else name + " FLOPs", font_size=14, color=col).next_to(ax.c2p(hi, f(hi)), UP, buff=0.05)
            self.play(Create(curve), FadeIn(lab), run_time=0.9)
            self.play(FadeIn(dot, scale=2), run_time=0.3)
            mins.append(dot)
        path = VMobject(color=WHITE, stroke_width=3).set_points_smoothly([d.get_center() for d in mins])
        self.play(Create(DashedVMobject(path)), run_time=1.2)
        note = Text("Each white dot is the compute-optimal size. Too small or too big both lose.", font_size=20, color=YEL_).to_edge(DOWN, buff=0.1)
        self.play(Write(note)); self.wait(1.8)


class TenXCompute(Scene):
    """Kaplan 2020 vs Chinchilla 2022: how to split 10x more compute."""
    def construct(self):
        title = Text("You get 10× more compute. Where does it go?", font_size=32).to_edge(UP)
        self.play(Write(title))
        def bars(label, p, d, col, x):
            base = DOWN * 2.3 + RIGHT * x
            h = lambda v: 1.4 * np.log10(v) / np.log10(10) * 2.2 + 0.05
            bp = Rectangle(width=1.0, height=h(p), fill_color=BLUE_, fill_opacity=0.8, stroke_width=0).move_to(base + LEFT * 0.7, aligned_edge=DOWN)
            bd = Rectangle(width=1.0, height=h(d), fill_color=GREEN_, fill_opacity=0.8, stroke_width=0).move_to(base + RIGHT * 0.7, aligned_edge=DOWN)
            tp = Text(f"{p:.1f}× params", font_size=18).next_to(bp, UP, buff=0.1)
            td = Text(f"{d:.1f}× data", font_size=18).next_to(bd, UP, buff=0.1)
            head = Text(label, font_size=24, weight=BOLD, color=col).move_to(base + DOWN * 0.45)
            return bp, bd, tp, td, head
        k = bars("Kaplan et al. 2020", 10 ** 0.73, 10 ** 0.27, ORANGE_, -3.2)
        c = bars("Chinchilla 2022", 10 ** 0.5, 10 ** 0.5, GREEN_, 3.2)
        for g in (k, c):
            bp, bd, tp, td, head = g
            self.play(FadeIn(head))
            self.play(GrowFromEdge(bp, DOWN), GrowFromEdge(bd, DOWN), run_time=1.2)
            self.play(FadeIn(tp), FadeIn(td))
            self.wait(0.5)
        rule = Text("Rule of thumb: about 20 training tokens per parameter", font_size=24, color=YEL_).shift(UP * 2.2)
        self.play(Write(rule))
        ex = Text("1B params → ~20B tokens     10B → ~205B     67B → ~1.5T", font_size=20, color=GREY_).next_to(rule, DOWN)
        self.play(FadeIn(ex)); self.wait(2)
