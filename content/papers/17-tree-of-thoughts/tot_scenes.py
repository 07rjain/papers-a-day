# Manim Community Edition scenes for paper #17: Tree of Thoughts
# "Tree of Thoughts: Deliberate Problem Solving with Large Language Models"
# (Yao, Yu, Zhao, Shafran, Griffiths, Cao, Narasimhan — Princeton University + Google DeepMind, NeurIPS 2023, arXiv 2305.10601)
# Render: manim -qm tot_scenes.py ChainVsTree GameOf24Search ResultsAndAblations
# Text-only (no LaTeX). Game of 24 example "4 9 10 13" follows the paper's Figure 2 / Section 4.1; numbers from Tables 2, 3, 7 and Figure 5.
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"
config.background_color = BG


def box(label, col, w=1.5, h=0.5, fs=16):
    r = RoundedRectangle(corner_radius=0.12, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.15, stroke_width=2.5)
    t = Text(label, font_size=fs, color=WHITE)
    if t.width > w - 0.15:
        t.scale_to_fit_width(w - 0.15)
    t.move_to(r)
    return VGroup(r, t)


class ChainVsTree(Scene):
    """Paper Figure 1: IO, CoT, CoT-SC and ToT drawn as shapes of thinking."""
    def construct(self):
        title = Text("Four ways to let a language model think", font_size=32).to_edge(UP)
        self.play(Write(title))
        xs = [-5.2, -2.0, 1.4, 4.8]
        names = ["IO prompting", "Chain of Thought", "CoT-SC (vote)", "Tree of Thoughts"]
        cols = [GREY_, BLUE_, PURP_, GREEN_]
        heads = VGroup(*[Text(n, font_size=18, color=c).move_to([x, 2.5, 0]) for n, x, c in zip(names, xs, cols)])
        self.play(LaggedStart(*[FadeIn(h, shift=DOWN * 0.2) for h in heads], lag_ratio=0.2))
        # IO
        inp = box("Input", GREY_, 1.3).move_to([xs[0], 1.6, 0]); out = box("Output", GREY_, 1.3).move_to([xs[0], -2.2, 0])
        a = Arrow(inp.get_bottom(), out.get_top(), color=GREY_, buff=0.1)
        self.play(FadeIn(inp), GrowArrow(a), FadeIn(out))
        # CoT
        prev = box("Input", BLUE_, 1.3).move_to([xs[1], 1.6, 0]); self.play(FadeIn(prev))
        for i, y in enumerate([0.65, -0.3, -1.25]):
            b = box(f"thought {i+1}", BLUE_, 1.3, 0.42, 14).move_to([xs[1], y, 0])
            self.play(GrowArrow(Arrow(prev.get_bottom(), b.get_top(), color=BLUE_, buff=0.05)), FadeIn(b), run_time=0.45)
            prev = b
        o2 = box("Output", BLUE_, 1.3).move_to([xs[1], -2.2, 0]); self.play(GrowArrow(Arrow(prev.get_bottom(), o2.get_top(), color=BLUE_, buff=0.05)), FadeIn(o2), run_time=0.45)
        # CoT-SC
        i3 = box("Input", PURP_, 1.3).move_to([xs[2], 1.6, 0]); self.play(FadeIn(i3))
        chains = VGroup()
        for dx in [-0.9, 0, 0.9]:
            p = i3
            for y in [0.65, -0.3, -1.1]:
                d = Circle(radius=0.17, color=PURP_, fill_opacity=0.3).move_to([xs[2] + dx, y, 0])
                chains.add(Line(p.get_bottom(), d.get_top(), color=PURP_, stroke_width=2), d); p = d
        vote = box("majority vote", PURP_, 1.6, 0.42, 14).move_to([xs[2], -1.8, 0])
        self.play(Create(chains), run_time=1.2); self.play(FadeIn(vote))
        # ToT
        i4 = box("Input", GREEN_, 1.3).move_to([xs[3], 1.6, 0]); self.play(FadeIn(i4))
        lv1 = [xs[3] - 1.0, xs[3], xs[3] + 1.0]
        n1 = [Circle(radius=0.18, color=GREEN_, fill_opacity=0.3).move_to([x, 0.6, 0]) for x in lv1]
        e1 = [Line(i4.get_bottom(), n.get_top(), color=GREEN_, stroke_width=2) for n in n1]
        self.play(*[Create(e) for e in e1], *[FadeIn(n) for n in n1])
        tags = [Text("sure", font_size=12, color=GREEN_), Text("impossible", font_size=12, color=RED_), Text("maybe", font_size=12, color=YEL_)]
        for t, n in zip(tags, n1):
            t.next_to(n, RIGHT, buff=0.05)
        self.play(*[FadeIn(t) for t in tags])
        self.play(n1[1].animate.set_color(RED_).set_fill(RED_, 0.1), e1[1].animate.set_stroke(RED_, opacity=0.3))
        n2 = [Circle(radius=0.16, color=GREEN_, fill_opacity=0.3).move_to([x, -0.4, 0]) for x in [lv1[0] - 0.35, lv1[0] + 0.35, lv1[2] - 0.35, lv1[2] + 0.35]]
        par = [n1[0], n1[0], n1[2], n1[2]]
        e2 = [Line(p.get_bottom(), n.get_top(), color=GREEN_, stroke_width=2) for p, n in zip(par, n2)]
        self.play(*[Create(e) for e in e2], *[FadeIn(n) for n in n2])
        self.play(n2[0].animate.set_color(RED_), n2[3].animate.set_color(RED_))
        bt = CurvedArrow(n2[0].get_left(), n1[0].get_left(), angle=-1.2, color=ORANGE_)
        btl = Text("backtrack", font_size=13, color=ORANGE_).next_to(bt, LEFT, buff=0.05)
        self.play(Create(bt), FadeIn(btl))
        n3 = Circle(radius=0.16, color=GREEN_, fill_opacity=0.6).move_to([lv1[0] + 0.35, -1.3, 0])
        e3 = Line(n2[1].get_bottom(), n3.get_top(), color=GREEN_, stroke_width=3)
        o4 = box("Output", GREEN_, 1.3).move_to([xs[3], -2.2, 0])
        self.play(Create(e3), FadeIn(n3)); self.play(FadeIn(o4), Create(Line(n3.get_bottom(), o4.get_top(), color=GREEN_, stroke_width=3)))
        foot = Text("ToT: propose several thoughts, let the model grade them, keep the good branches, back up from dead ends.",
                    font_size=17, color=GREY_).to_edge(DOWN, buff=0.2)
        self.play(FadeIn(foot)); self.wait(2)


class GameOf24Search(Scene):
    """Paper Figure 2 / Section 4.1: breadth-first ToT on the Game of 24 input 4 9 10 13."""
    def construct(self):
        title = Text("Game of 24: reach 24 using 4, 9, 10, 13 once each (+ - x /)", font_size=27).to_edge(UP)
        self.play(Write(title))
        root = box("4  9  10  13", GREY_, 2.0, 0.55, 20).move_to([0, 2.3, 0])
        self.play(FadeIn(root))
        lab = Text("Step 1  PROPOSE: the model suggests possible first moves", font_size=18, color=BLUE_).to_edge(LEFT).shift(DOWN * 3.2)
        self.play(FadeIn(lab))
        props = [("4+9=13", "10 13 13", "impossible", RED_), ("10-4=6", "6 9 13", "maybe", YEL_), ("13-9=4", "4 4 10", "sure", GREEN_),
                 ("13-10=3", "3 4 9", "sure", GREEN_), ("9-4=5", "5 10 13", "impossible", RED_), ("4x9=36", "10 13 36", "impossible", RED_)]
        xs = [-5.4, -3.25, -1.1, 1.1, 3.25, 5.4]
        nodes = []
        for (eq, left, v, c), x in zip(props, xs):
            b = box(f"{eq}\nleft: {left}", BLUE_, 1.9, 0.8, 15).move_to([x, 0.8, 0])
            l = Line(root.get_bottom(), b.get_top(), color=GREY_, stroke_width=1.5)
            nodes.append((b, l, v, c))
        self.play(LaggedStart(*[AnimationGroup(Create(l), FadeIn(b)) for b, l, _, _ in nodes], lag_ratio=0.15), run_time=2)
        lab2 = Text("Step 2  EVALUATE: the model grades each state  sure / maybe / impossible", font_size=18, color=YEL_).move_to(lab, aligned_edge=LEFT)
        self.play(Transform(lab, lab2))
        tags = []
        for b, l, v, c in nodes:
            t = Text(v, font_size=15, color=c).next_to(b, DOWN, buff=0.1); tags.append(t)
        self.play(LaggedStart(*[FadeIn(t, scale=1.3) for t in tags], lag_ratio=0.15))
        why = Text("e.g. 10 13 13: \"too big, can't make 24\"   4 4 10: \"(10-4) x 4 = 24, sure\"", font_size=15, color=GREY_).move_to([0, -0.6, 0])
        self.play(FadeIn(why))
        lab3 = Text("Step 3  KEEP the best b states (breadth limit), drop the rest", font_size=18, color=GREEN_).move_to(lab, aligned_edge=LEFT)
        self.play(Transform(lab, lab3))
        drops = [i for i, n in enumerate(nodes) if n[2] == "impossible"]
        self.play(*[nodes[i][0].animate.set_opacity(0.15) for i in drops], *[nodes[i][1].animate.set_opacity(0.1) for i in drops], *[tags[i].animate.set_opacity(0.2) for i in drops], FadeOut(why))
        # expand the "sure" 4 4 10 branch
        keep = nodes[2][0]
        c1 = box("10-4=6\nleft: 4 6", BLUE_, 1.7, 0.75, 15).move_to([-1.1, -1.25, 0])
        c2 = box("4+4=8\nleft: 8 10", BLUE_, 1.7, 0.75, 15).move_to([1.2, -1.25, 0])
        self.play(Create(Line(keep.get_bottom() + DOWN * 0.3, c1.get_top(), color=GREY_)), FadeIn(c1), Create(Line(keep.get_bottom() + DOWN * 0.3, c2.get_top(), color=GREY_)), FadeIn(c2))
        t1 = Text("sure", font_size=14, color=GREEN_).next_to(c1, LEFT, buff=0.1); t2 = Text("impossible", font_size=14, color=RED_).next_to(c2, RIGHT, buff=0.1)
        self.play(FadeIn(t1), FadeIn(t2), c2.animate.set_opacity(0.2))
        fin = box("4 x 6 = 24", GREEN_, 1.8, 0.5, 18).move_to([-1.1, -2.4, 0])
        self.play(Create(Line(c1.get_bottom(), fin.get_top(), color=GREEN_)), FadeIn(fin, scale=1.4))
        ans = Text("(13 - 9) = 4,  10 - 4 = 6,  4 x 6 = 24", font_size=20, color=GREEN_).move_to([3.6, -2.4, 0])
        self.play(Write(ans))
        self.play(Indicate(fin, color=GREEN_))
        lab4 = Text("Chain of thought commits to its first move; ~60% of CoT samples were already doomed after step 1.", font_size=16, color=ORANGE_).move_to(lab, aligned_edge=LEFT)
        self.play(Transform(lab, lab4)); self.wait(2.5)


class ResultsAndAblations(Scene):
    """Table 2 (Game of 24, GPT-4), Table 3 (Mini Crosswords) and Table 7 cost."""
    def construct(self):
        title = Text("What the paper measured (GPT-4)", font_size=32).to_edge(UP)
        self.play(Write(title))
        sub = Text("Game of 24 success rate, 100 hard puzzles (Table 2)", font_size=20, color=GREY_).next_to(title, DOWN, buff=0.2)
        self.play(FadeIn(sub))
        data = [("IO prompt", 7.3, GREY_), ("CoT prompt", 4.0, BLUE_), ("CoT-SC (k=100)", 9.0, PURP_), ("IO + Refine (k=10)", 27, PINK_),
                ("IO best of 100", 33, GREY_), ("CoT best of 100", 49, BLUE_), ("ToT (b=1)", 45, YEL_), ("ToT (b=5)", 74, GREEN_)]
        x0 = -3.0; scale = 0.105
        rows = VGroup()
        for i, (n, v, c) in enumerate(data):
            y = 1.7 - i * 0.48
            lab = Text(n, font_size=16, color=c).move_to([x0 - 0.2, y, 0], aligned_edge=RIGHT)
            bar = Rectangle(width=max(v * scale, 0.02), height=0.32, fill_color=c, fill_opacity=0.85, stroke_width=0).move_to([x0, y, 0], aligned_edge=LEFT)
            num = Text(f"{v:g}%", font_size=16).next_to(bar, RIGHT, buff=0.1)
            rows.add(VGroup(lab, bar, num))
        for r in rows:
            self.play(FadeIn(r[0]), GrowFromEdge(r[1], LEFT), FadeIn(r[2]), run_time=0.45)
        self.play(Indicate(rows[-1], color=GREEN_))
        cost = Text("Cost per puzzle (Table 7): CoT best of 100 $0.47 for 49%  vs  ToT $0.74 for 74%", font_size=16, color=GREY_).move_to([0, -2.4, 0])
        self.play(FadeIn(cost)); self.wait(1.5)
        self.play(FadeOut(rows), FadeOut(cost), FadeOut(sub))
        sub2 = Text("Mini Crosswords, 20 games of 5x5: % words right, % games solved (Table 3)", font_size=20, color=GREY_).next_to(title, DOWN, buff=0.2)
        self.play(FadeIn(sub2))
        cw = [("IO", 14, "0%", GREY_), ("CoT", 15.6, "1%", BLUE_), ("ToT (DFS)", 60, "20% (4/20)", GREEN_), ("ToT, no pruning", 41.5, "5%", YEL_), ("ToT, no backtracking", 20, "5%", RED_)]
        rows2 = VGroup()
        for i, (n, w, g, c) in enumerate(cw):
            y = 1.5 - i * 0.72
            lab = Text(n, font_size=18, color=c).move_to([-3.2, y, 0], aligned_edge=RIGHT)
            bar = Rectangle(width=w * 0.09, height=0.4, fill_color=c, fill_opacity=0.85, stroke_width=0).move_to([-3.0, y, 0], aligned_edge=LEFT)
            num = Text(f"{w:g}% words   games solved {g}", font_size=16).next_to(bar, RIGHT, buff=0.12)
            rows2.add(VGroup(lab, bar, num))
        for r in rows2:
            self.play(FadeIn(r[0]), GrowFromEdge(r[1], LEFT), FadeIn(r[2]), run_time=0.5)
        note = Text("Take away the grading (pruning) or the backing-up, and the tree loses most of its edge.", font_size=17, color=ORANGE_).move_to([0, -2.5, 0])
        self.play(FadeIn(note)); self.wait(2.5)
