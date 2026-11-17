# Manim Community Edition scenes for paper #19: Toolformer
# "Toolformer: Language Models Can Teach Themselves to Use Tools"
# (Schick, Dwivedi-Yu, Dessi, Raileanu, Lomeli, Zettlemoyer, Cancedda, Scialom; Meta AI; NeurIPS 2023; arXiv 2302.04761)
# Render: manim -qm toolformer_scenes.py SampleExecuteFilter BuildAndFinetune ToolCallAtInference
# Text-only (no LaTeX). Pittsburgh example = paper Figure 2; calculator example = Figure 1;
# counts = Table 2; scores = Table 10; results = Tables 3, 4, 7, 8. Loss bar heights in scene 1 are illustrative.
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"
config.background_color = BG


def box(label, col, w=1.8, h=0.6, fs=18):
    r = RoundedRectangle(corner_radius=0.12, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.15, stroke_width=2.5)
    t = Text(label, font_size=fs, color=WHITE)
    if t.width > w - 0.15:
        t.scale_to_fit_width(w - 0.15)
    t.move_to(r)
    return VGroup(r, t)


def note(label, col, w=3.0, fs=13):
    t = Text(label, font_size=fs, color=WHITE, line_spacing=0.8)
    if t.width > w - 0.2:
        t.scale_to_fit_width(w - 0.2)
    r = RoundedRectangle(corner_radius=0.08, width=w, height=t.height + 0.25, stroke_color=col, fill_color=col, fill_opacity=0.18, stroke_width=2)
    t.move_to(r)
    return VGroup(r, t)


class SampleExecuteFilter(Scene):
    """Figure 2: sample API calls at a position, execute them, keep only those that lower the loss on the next tokens."""
    def construct(self):
        title = Text("Toolformer, steps 1-3: sample, execute, filter", font_size=30).to_edge(UP)
        self.play(Write(title))
        left = Text("Pittsburgh is also known as", font_size=24, color=WHITE)
        right = Text("the Steel City", font_size=24, color=YEL_)
        sent = VGroup(left, right).arrange(RIGHT, buff=0.5).move_to([0, 2.3, 0])
        self.play(FadeIn(sent))
        caret = Line(UP * 0.25, DOWN * 0.25, color=BLUE_, stroke_width=5).move_to((left.get_right() + right.get_left()) / 2)
        pi = Text("P(<API> here) is high  ->  try a call at this position", font_size=16, color=BLUE_).next_to(sent, DOWN, buff=0.25)
        self.play(Create(caret), FadeIn(pi))
        self.wait(0.4)
        # 1. sample
        s1 = Text("1 · Sample candidate calls (the LM writes them, from a few examples in its prompt)", font_size=16, color=GREY_).move_to([0, 1.0, 0])
        c1 = note('QA("What other name is Pittsburgh known by?")', BLUE_, 5.4, 15).move_to([-3.4, 0.25, 0])
        c2 = note('QA("Which country is Pittsburgh in?")', BLUE_, 5.4, 15).move_to([3.4, 0.25, 0])
        self.play(FadeOut(pi), FadeIn(s1))
        self.play(FadeIn(c1, shift=DOWN * 0.3), FadeIn(c2, shift=DOWN * 0.3))
        # 2. execute
        s2 = Text("2 · Execute them: the QA tool answers", font_size=16, color=GREY_).move_to(s1)
        r1 = Text("-> Steel City", font_size=17, color=GREEN_).next_to(c1, DOWN, buff=0.12)
        r2 = Text("-> United States", font_size=17, color=ORANGE_).next_to(c2, DOWN, buff=0.12)
        self.play(Transform(s1, s2))
        self.play(FadeIn(r1, shift=UP * 0.2), FadeIn(r2, shift=UP * 0.2))
        self.wait(0.4)
        # 3. filter by loss on next tokens
        s3 = Text('3 · Filter: does the call + its answer make "the Steel City" easier to predict?', font_size=16, color=GREY_).move_to(s1)
        self.play(Transform(s1, s3))
        base_y = -2.75

        def bars(cx, vals, cols, labs):
            g = VGroup()
            for k, (v, c, l) in enumerate(zip(vals, cols, labs)):
                x = cx - 1.25 + 1.25 * k
                r = Rectangle(width=0.75, height=v, stroke_width=0, fill_color=c, fill_opacity=0.85).move_to([x, base_y, 0], aligned_edge=DOWN)
                t = Text(l, font_size=11, color=GREY_).next_to(r, DOWN, buff=0.06)
                g.add(VGroup(r, t))
            return g
        labs = ["no call", "call, no answer", "call + answer"]
        b1 = bars(-3.4, [1.6, 1.5, 0.35], [GREY_, GREY_, GREEN_], labs)
        b2 = bars(3.4, [1.6, 1.5, 1.55], [GREY_, GREY_, ORANGE_], labs)
        lossl = Text("loss on the next few tokens (illustrative heights)", font_size=13, color=GREY_).move_to([0, -0.7, 0])
        self.play(FadeIn(lossl), *[GrowFromEdge(b[0], DOWN) for b in b1], *[GrowFromEdge(b[0], DOWN) for b in b2], *[FadeIn(b[1]) for b in list(b1) + list(b2)], run_time=1.2)
        k1 = Text("loss drops a lot: KEEP", font_size=18, color=GREEN_).move_to([-3.4, -1.05, 0])
        k2 = Text("no help: DROP", font_size=18, color=RED_).move_to([3.4, -1.05, 0])
        self.play(FadeIn(k1), FadeIn(k2))
        self.play(VGroup(c2, r2).animate.set_opacity(0.25), b2.animate.set_opacity(0.3))
        self.wait(0.8)
        rule = note("Keep a call only if   L-  minus  L+   >=  threshold  (tau_f = 1.0 by default)\n"
                    "L+ = loss with the call and its answer;  L- = the smaller of: no call, or call without answer", YEL_, 11.5, 15).move_to([0, -1.6, 0])
        self.play(FadeOut(b1), FadeOut(b2), FadeOut(lossl), FadeOut(k1), FadeOut(k2), FadeIn(rule))
        self.wait(1.0)
        final = Text('Pittsburgh is also known as [QA(What other name is Pittsburgh known by?) -> Steel City] the Steel City.', font_size=17, color=WHITE)
        final.scale_to_fit_width(12.6).move_to([0, -2.9, 0])
        self.play(FadeIn(final, shift=UP * 0.2))
        foot = Text("No human labeled this. The model's own loss decided.", font_size=20, color=YEL_).to_edge(DOWN, buff=0.12)
        self.play(final.animate.shift(UP * 0.35), Write(foot))
        self.wait(1.5)


class BuildAndFinetune(Scene):
    """Section 2 + 4.1: annotate CCNet with five tools, merge into C*, fine-tune GPT-J on it."""
    def construct(self):
        title = Text("Build the training set, then fine-tune the model on it", font_size=30).to_edge(UP)
        self.play(Write(title))
        C = box("C: plain web text\n(CCNet subset)", GREY_, 2.6, 1.2, 16).move_to([-5.2, 0.6, 0])
        self.play(FadeIn(C))
        tools = [("Question answering (Atlas)", BLUE_, "18,526"), ("Wikipedia search (BM25)", PURP_, "60,974"),
                 ("Calculator (+ - x /)", ORANGE_, "994"), ("Calendar (today's date)", GREEN_, "20,587"),
                 ("Translation (NLLB 600M)", PINK_, "1,034")]
        rows = VGroup()
        for name, col, n in tools:
            rows.add(box(name, col, 3.4, 0.55, 15))
        rows.arrange(DOWN, buff=0.18).move_to([-1.2, 0.6, 0])
        arrows = VGroup(*[Arrow(C.get_right(), r.get_left(), buff=0.08, color=GREY_, stroke_width=2, max_tip_length_to_length_ratio=0.08) for r in rows])
        cap = Text("for each tool: a few hand-written examples in a prompt -> sample -> execute -> filter", font_size=15, color=GREY_).next_to(rows, DOWN, buff=0.3)
        self.play(LaggedStart(*[GrowArrow(a) for a in arrows], lag_ratio=0.1), LaggedStart(*[FadeIn(r) for r in rows], lag_ratio=0.15), FadeIn(cap))
        counts = VGroup()
        for r, (_, col, n) in zip(rows, tools):
            counts.add(Text(n, font_size=16, color=col).next_to(r, RIGHT, buff=0.25))
        ct = Text("examples kept (tau_f = 1.0, Table 2)", font_size=13, color=GREY_).next_to(counts, UP, buff=0.15).shift(RIGHT * 0.4)
        self.play(LaggedStart(*[FadeIn(c, shift=LEFT * 0.2) for c in counts], lag_ratio=0.15), FadeIn(ct))
        Cs = box("C*: the same texts\n+ the useful API calls", YEL_, 2.8, 1.2, 16).move_to([5.1, 0.6, 0])
        merge = VGroup(*[Arrow(c.get_right(), Cs.get_left(), buff=0.1, color=YEL_, stroke_width=2, max_tip_length_to_length_ratio=0.08) for c in counts])
        self.play(LaggedStart(*[GrowArrow(m) for m in merge], lag_ratio=0.1), FadeIn(Cs))
        self.wait(0.6)
        self.play(FadeOut(arrows), FadeOut(merge), FadeOut(cap), FadeOut(ct), FadeOut(counts), FadeOut(rows), FadeOut(C), Cs.animate.move_to([-4.2, 0.4, 0]))
        model = box("GPT-J\n6.7B parameters", BLUE_, 2.8, 1.2, 18).move_to([1.2, 0.4, 0])
        ft = Arrow(Cs.get_right(), model.get_left(), buff=0.1, color=YEL_)
        ftl = Text("ordinary next-word\ntraining", font_size=13, color=YEL_).next_to(ft, DOWN, buff=0.12)
        self.play(FadeIn(model), GrowArrow(ft), FadeIn(ftl))
        spec = Text("up to 25k examples per API · batch 128 · lr 1e-5 · 8 A100 GPUs · up to 2k steps", font_size=15, color=GREY_).next_to(VGroup(Cs, model), DOWN, buff=0.4)
        self.play(FadeIn(spec))
        tf = box("Toolformer", GREEN_, 2.4, 0.8, 20).move_to([5.0, 0.4, 0])
        self.play(GrowArrow(Arrow(model.get_right(), tf.get_left(), buff=0.1, color=GREEN_)), FadeIn(tf))
        self.play(Flash(tf, color=GREEN_))
        why = note("Same text as before, so it keeps its language skills:\n"
                   "perplexity on held-out CCNet 10.5 vs 10.5 without tools (Table 8).\n"
                   "Calls sit exactly where they helped, so it learns WHEN and HOW to call.", GREEN_, 10.5, 16).move_to([0, -2.4, 0])
        self.play(FadeIn(why, shift=UP * 0.2))
        self.wait(2.0)


class ToolCallAtInference(Scene):
    """Section 2 'Inference' + Figure 1: decode until '->', pause, run the tool, insert the result, continue."""
    def construct(self):
        title = Text("At answer time: the model calls the tool itself", font_size=30).to_edge(UP)
        self.play(Write(title))
        parts = [("Out of 1400 participants, 400 (or", WHITE), ("[Calculator(400 / 1400)", ORANGE_), ("->", YEL_)]
        line = VGroup(*[Text(p, font_size=24, color=c) for p, c in parts]).arrange(RIGHT, buff=0.16).move_to([-0.6, 1.8, 0])
        self.play(AddTextLetterByLetter(line[0]), run_time=1.2)
        self.play(AddTextLetterByLetter(line[1]), run_time=0.9)
        self.play(FadeIn(line[2]))
        pause = Text('"->" means: stop writing, I need the answer', font_size=17, color=YEL_).next_to(line, DOWN, buff=0.35)
        self.play(FadeIn(pause), Indicate(line[2], color=YEL_))
        calc = box("Calculator\n400 / 1400", ORANGE_, 2.6, 1.1, 18).move_to([0, -0.6, 0])
        a1 = Arrow(line[1].get_bottom(), calc.get_top(), buff=0.1, color=ORANGE_)
        self.play(GrowArrow(a1), FadeIn(calc))
        res = Text("0.29", font_size=26, color=GREEN_).next_to(calc, RIGHT, buff=0.5)
        self.play(FadeIn(res, shift=RIGHT * 0.2))
        ins = VGroup(Text("0.29]", font_size=24, color=GREEN_), Text("29%) passed the test.", font_size=24, color=WHITE))
        self.play(FadeOut(a1), FadeOut(pause))
        full = VGroup(*[m.copy() for m in line], *ins).arrange(RIGHT, buff=0.16)
        full.scale_to_fit_width(13.0).move_to([0, 1.8, 0])
        self.play(Transform(line, VGroup(*full[:3])), res.animate.move_to(full[3]).set_opacity(0))
        self.play(FadeIn(full[3]))
        self.play(AddTextLetterByLetter(full[4]), run_time=1.0)
        cont = Text("the tool's result is pasted in, then the model keeps writing", font_size=17, color=GREY_).next_to(full, DOWN, buff=0.3)
        self.play(FadeIn(cont), FadeOut(calc))
        self.wait(0.6)
        tricks = note("Decoding tweaks (Section 4.2): start a call if <API> is among the top k = 10 next tokens\n"
                      "(not only the single most likely one) · at most one API call per input", PURP_, 11.5, 15).move_to([0, 0.2, 0])
        self.play(FadeIn(tricks))
        self.wait(1.2)
        self.play(FadeOut(tricks), FadeOut(cont))
        h = Text("Math word problems, zero-shot (Table 4)", font_size=19, color=BLUE_).move_to([0, 0.3, 0])
        self.play(FadeIn(h))
        data = [("ASDiv", 14.0, 40.4), ("SVAMP", 10.0, 29.4), ("MAWPS", 19.8, 44.0)]
        base_y = -3.2
        for i, (n, g3, tf) in enumerate(data):
            x = -4 + 4 * i
            for dx, v, c, lab in [(-0.5, g3, GREY_, "GPT-3 175B"), (0.5, tf, GREEN_, "Toolformer 6.7B")]:
                r = Rectangle(width=0.8, height=v / 50 * 2.6, stroke_width=0, fill_color=c, fill_opacity=0.85).move_to([x + dx, base_y, 0], aligned_edge=DOWN)
                self.play(GrowFromEdge(r, DOWN), run_time=0.35)
                self.add(Text(f"{v}", font_size=15).next_to(r, UP, buff=0.05), Text(lab, font_size=10, color=GREY_).next_to(r, DOWN, buff=0.05))
            self.add(Text(n, font_size=17, color=WHITE).move_to([x, base_y - 0.45, 0]))
        foot = Text("It asked the calculator on 97.9% of these problems", font_size=18, color=YEL_).move_to([0, -0.2, 0])
        self.play(FadeIn(foot))
        self.wait(2.0)
