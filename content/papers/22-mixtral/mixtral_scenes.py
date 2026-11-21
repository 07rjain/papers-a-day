# Manim Community Edition scenes for paper #22: Mixtral of Experts
# "Mixtral of Experts" (Jiang, Sablayrolles, Roux, Mensch, ... El Sayed; Mistral AI; arXiv 2401.04088, Jan 2024)
# Render: manim -qm mixtral_scenes.py RouterTopK SparseVsDense ExpertRouting
# Text-only (no LaTeX). Architecture = Section 2 / Table 1; gating formula = Section 2.1;
# 47B / 13B = Abstract & Section 3; benchmark numbers = Tables 2-3; routing = Section 5, Table 5, Figures 7-8.
# Router logits / gate values and the per-token expert colours are ILLUSTRATIVE (toy); the per-expert parameter
# split (~5.6B per expert FFN stack, ~1.6B shared) is our arithmetic from Table 1, not a number printed in the paper.
from manim import *
import numpy as np

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"
EXP_COLS = ["#5aa9ff", "#4ade80", "#fb923c", "#f472b6", "#facc15", "#a78bfa", "#22d3ee", "#f87171"]
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


class RouterTopK(Scene):
    def construct(self):
        tt = title("One MoE layer: the router picks 2 of 8 experts")
        self.play(Write(tt))
        # dense recap
        recap = Text("Transformer block (paper #5):  attention  →  ONE feed-forward network (FFN)", font_size=18, color=GREY_).move_to([0, 2.5, 0])
        self.play(FadeIn(recap))
        ffn = box("FFN", GREY_, 1.6, 0.8, 24).move_to([0, 1.4, 0])
        self.play(FadeIn(ffn, scale=0.8))
        swap = Text("Mixtral: replace that FFN with 8 FFNs (\"experts\") + a tiny router", font_size=18, color=YEL_).move_to([0, 2.5, 0])
        self.play(Transform(recap, swap))
        experts = VGroup(*[box(f"E{i}", EXP_COLS[i], 1.05, 0.9, 22) for i in range(8)]).arrange(RIGHT, buff=0.3).move_to([0.6, 1.2, 0])
        self.play(ReplacementTransform(ffn, experts), run_time=1.2)
        # token + router
        tok = box("token x\n(4096 numbers)", BLUE_, 2.2, 0.8, 16).move_to([-5.3, -0.1, 0])
        router = box("router\nx · Wg  (4096 × 8)", PURP_, 2.4, 0.8, 16).move_to([-2.4, -0.1, 0])
        self.play(FadeIn(tok, shift=RIGHT * 0.3))
        self.play(GrowArrow(Arrow(tok.get_right(), router.get_left(), buff=0.05, color=GREY_)), FadeIn(router))
        logits = [1.2, -0.4, 2.6, 0.3, -1.1, 0.9, 2.1, -0.2]  # toy
        base_y = -3.3
        bars = VGroup(); labs = VGroup()
        for i, l in enumerate(logits):
            h = (l + 1.5) * 0.3
            b = Rectangle(width=0.5, height=h, fill_color=EXP_COLS[i], fill_opacity=0.85, stroke_width=0).move_to([experts[i].get_center()[0], base_y + h / 2, 0])
            bars.add(b)
            labs.add(Text(f"{l:+.1f}", font_size=13, color=GREY_).next_to(b, UP, buff=0.05))
        cap = Text("8 router logits (toy values)", font_size=14, color=GREY_).move_to([1.6, -0.1, 0])
        self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in bars], lag_ratio=0.08), FadeIn(labs), FadeIn(cap))
        self.wait(0.4)
        top = [2, 6]
        cap2 = Text("TopK(K=2): keep the 2 biggest, set the other 6 to −∞", font_size=14, color=YEL_).move_to([1.6, -0.1, 0])
        self.play(Transform(cap, cap2))
        self.play(*[bars[i].animate.set_fill(opacity=0.12) for i in range(8) if i not in top], *[labs[i].animate.set_opacity(0.25) for i in range(8) if i not in top],
                  *[experts[i].animate.set_opacity(0.25) for i in range(8) if i not in top])
        e = np.exp(np.array([logits[2], logits[6]])); g = e / e.sum()
        cap3 = Text(f"softmax over the survivors → gates {g[0]:.2f} and {g[1]:.2f} (sum = 1)", font_size=14, color=GREEN_).move_to([1.6, -0.1, 0])
        self.play(Transform(cap, cap3))
        for k, i in enumerate(top):
            self.play(Indicate(experts[i], color=EXP_COLS[i], scale_factor=1.15), run_time=0.5)
            self.play(Transform(labs[i], Text(f"{g[k]:.2f}", font_size=16, color=WHITE, weight=BOLD).next_to(bars[i], UP, buff=0.05)), run_time=0.4)
        self.wait(0.5)
        self.play(FadeOut(bars), FadeOut(labs), FadeOut(cap), FadeOut(tok), FadeOut(router), *[FadeOut(m) for m in self.mobjects if isinstance(m, Arrow)])
        # weighted sum
        o1 = box(f"{g[0]:.2f} × E2(x)", EXP_COLS[2], 2.2, 0.6, 18).move_to([-2.2, -0.9, 0])
        o2 = box(f"{g[1]:.2f} × E6(x)", EXP_COLS[6], 2.2, 0.6, 18).move_to([2.2, -0.9, 0])
        self.play(TransformFromCopy(experts[2], o1), TransformFromCopy(experts[6], o2))
        plus = Text("+", font_size=34).move_to([0, -0.9, 0])
        y = box("y  = output for this token", GREEN_, 4.0, 0.6, 18).move_to([0, -2.1, 0])
        self.play(FadeIn(plus)); self.play(FadeIn(y, shift=UP * 0.2))
        f = Text("y = Σ Softmax(Top2(x · Wg))_i · SwiGLU_i(x)    (Section 2.1)", font_size=18, color=WHITE).move_to([0, -3.0, 0])
        self.play(Write(f))
        foot = Text("the 6 dimmed experts are never run for this token: that is the saving", font_size=15, color=GREY_).next_to(f, DOWN, buff=0.15)
        self.play(FadeIn(foot))
        self.wait(1.2)
        note = Text("Every token, at every one of the 32 layers, gets its own pick.", font_size=18, color=YEL_).move_to([0, 2.5, 0])
        self.play(Transform(recap, note))
        self.wait(1.5)


class SparseVsDense(Scene):
    def construct(self):
        tt = title("Stored vs used: 47B parameters, 13B active per token")
        self.play(Write(tt))
        # stacked bar: shared + 8 experts
        unit = 0.55  # screen units per billion /  ~ scale
        shared_h = 1.6 * 0.1; exp_h = 0.45
        x0 = -4.2
        lab = Text("Mixtral 8x7B: all weights in memory", font_size=16, color=GREY_).move_to([x0, 2.4, 0])
        self.play(FadeIn(lab))
        y = -2.8
        sh = Rectangle(width=1.6, height=shared_h * 4, fill_color=GREY_, fill_opacity=0.8, stroke_width=1).move_to([x0, y + shared_h * 2, 0])
        y += shared_h * 4
        blocks = VGroup()
        for i in range(8):
            r = Rectangle(width=1.6, height=exp_h, fill_color=EXP_COLS[i], fill_opacity=0.8, stroke_width=1, stroke_color=BG).move_to([x0, y + exp_h / 2, 0])
            blocks.add(r); y += exp_h
        shl = Text("shared: attention, embeddings, router (~1.6B)", font_size=12, color=GREY_).next_to(sh, RIGHT, buff=0.15)
        self.play(GrowFromEdge(sh, DOWN), FadeIn(shl))
        self.play(LaggedStart(*[GrowFromEdge(b, DOWN) for b in blocks], lag_ratio=0.12), run_time=1.6)
        el = Text("8 experts × ~5.6B\n(32 layers of SwiGLU FFNs each)", font_size=12, color=GREY_).next_to(blocks, RIGHT, buff=0.15)
        tot = Text("≈ 47B total (sparse) parameters", font_size=18, color=WHITE, weight=BOLD).next_to(blocks, UP, buff=0.15)
        self.play(FadeIn(el), FadeIn(tot))
        not56 = Text("Not 8 × 7B = 56B: only the FFNs are copied", font_size=14, color=YEL_).move_to([x0 + 0.6, -3.4, 0])
        self.play(FadeIn(not56))
        self.wait(0.8)
        # active
        x1 = 3.0
        lab2 = Text("what ONE token actually uses", font_size=16, color=GREY_).move_to([x1, 2.4, 0])
        self.play(FadeIn(lab2))
        sh2 = sh.copy(); b2 = blocks[2].copy(); b6 = blocks[6].copy()
        self.play(sh2.animate.move_to([x1, -2.8 + shared_h * 2, 0]),
                  b2.animate.move_to([x1, -2.8 + shared_h * 4 + exp_h / 2, 0]),
                  b6.animate.move_to([x1, -2.8 + shared_h * 4 + exp_h * 1.5, 0]), run_time=1.4)
        self.play(*[blocks[i].animate.set_fill(opacity=0.2) for i in range(8) if i not in (2, 6)])
        act = Text("≈ 13B active parameters\n(shared + 2 experts)", font_size=18, color=GREEN_, weight=BOLD).next_to(b6, UP, buff=0.2)
        self.play(FadeIn(act))
        self.wait(0.6)
        cmp = VGroup(
            Text("Compute per token ∝ active params: 13B (vs 70B for Llama 2 70B → 5x fewer)", font_size=15, color=WHITE),
            Text("Memory to serve ∝ total params: 47B (still smaller than 70B, but every expert must be loaded)", font_size=15, color=ORANGE_),
            Text("split per expert: our arithmetic from Table 1 (dim 4096, hidden 14336, 32 layers), not a figure in the paper", font_size=11, color=GREY_),
        ).arrange(DOWN, buff=0.12).to_edge(DOWN, buff=0.15).shift(RIGHT * 1.6)
        self.play(FadeOut(not56), FadeIn(cmp[0]), FadeIn(cmp[1]), FadeIn(cmp[2]))
        self.wait(1.2)
        self.play(*[FadeOut(m) for m in self.mobjects if m is not tt])
        # benchmark comparison (Table 2 / 3 real numbers)
        sub = Text("Fewer active parameters, same or better scores (Table 2)", font_size=22, color=WHITE).move_to([0, 2.4, 0])
        self.play(FadeIn(sub))
        rows = [("MMLU", 69.9, 70.6), ("GSM8K", 69.6, 74.4), ("HumanEval", 29.3, 40.2), ("MBPP", 49.8, 60.7), ("MATH", 13.8, 28.4)]
        grp = VGroup()
        for k, (name, l, m) in enumerate(rows):
            yy = 1.4 - k * 0.85
            nm = Text(name, font_size=16, color=GREY_).move_to([-5.2, yy, 0])
            bl = Rectangle(width=l * 0.08, height=0.28, fill_color=PURP_, fill_opacity=0.85, stroke_width=0)
            bl.move_to([-4.2 + bl.width / 2, yy + 0.16, 0])
            bm = Rectangle(width=m * 0.08, height=0.28, fill_color=GREEN_, fill_opacity=0.85, stroke_width=0)
            bm.move_to([-4.2 + bm.width / 2, yy - 0.16, 0])
            tl = Text(f"{l}%", font_size=12, color=PURP_).next_to(bl, RIGHT, buff=0.08)
            tm = Text(f"{m}%", font_size=12, color=GREEN_).next_to(bm, RIGHT, buff=0.08)
            grp.add(VGroup(nm, bl, bm, tl, tm))
        leg = VGroup(Text("Llama 2 70B (70B active)", font_size=14, color=PURP_), Text("Mixtral 8x7B (13B active)", font_size=14, color=GREEN_)).arrange(RIGHT, buff=0.6).move_to([0, -2.9, 0])
        self.play(LaggedStart(*[FadeIn(g, shift=RIGHT * 0.2) for g in grp], lag_ratio=0.2), FadeIn(leg), run_time=2)
        side = box("Exception: reading comprehension\n(BoolQ, QuAC) slightly below\nLlama 2 70B (Figure 3)", ORANGE_, 3.6, 1.2, 15).move_to([4.6, 0.2, 0])
        self.play(FadeIn(side))
        self.wait(2)


class ExpertRouting(Scene):
    def construct(self):
        tt = title("Do experts specialise by topic? Mostly no.")
        self.play(Write(tt))
        q = Text("Section 5: route The Pile validation text and count which expert each token picks", font_size=17, color=GREY_).move_to([0, 2.5, 0])
        self.play(FadeIn(q))
        doms = ["ArXiv", "PubMed", "PhilPapers", "GitHub"]
        # toy near-uniform distributions (Figure 7 shows near-uniform, similar across topics; values illustrative)
        rng = np.random.default_rng(3)
        grp = VGroup()
        for d, name in enumerate(doms):
            x0 = -5.2 + d * 3.3
            p = 0.125 + rng.normal(0, 0.018, 8)
            bars = VGroup()
            for i in range(8):
                h = p[i] * 12
                bars.add(Rectangle(width=0.26, height=h, fill_color=EXP_COLS[i], fill_opacity=0.85, stroke_width=0).move_to([x0 + i * 0.31, -0.6 + h / 2, 0]))
            line = DashedLine([x0 - 0.2, -0.6 + 1.5, 0], [x0 + 2.4, -0.6 + 1.5, 0], color=GREY_)
            nm = Text(name, font_size=16, color=WHITE).move_to([x0 + 1.1, -1.0, 0])
            grp.add(VGroup(bars, line, nm))
        self.play(LaggedStart(*[FadeIn(g, shift=UP * 0.2) for g in grp], lag_ratio=0.2), run_time=2)
        c1 = Text("Expert shares look alike for LaTeX papers, biology and philosophy (dashed = 1/8).\nOnly DM Mathematics differs a little. (bar heights illustrative of Figure 7)", font_size=15, color=YEL_).move_to([0, -1.9, 0])
        self.play(FadeIn(c1))
        self.wait(1.5)
        self.play(*[FadeOut(m) for m in self.mobjects if m is not tt])
        # syntax: token strip
        s = Text("Instead, routing follows syntax (Figure 8): same kind of token → same expert", font_size=18, color=WHITE).move_to([0, 2.5, 0])
        self.play(FadeIn(s))
        toks = [("def", 1), ("  ", 4), ("__init__", 3), ("(", 0), ("self", 6), (",", 0), ("x", 2), ("):", 0)]
        toks2 = [("    ", 4), ("self", 6), (".", 0), ("x", 2), (" =", 5), (" x", 2)]
        def strip(tt_, y):
            g = VGroup()
            for w, e in tt_:
                lbl = w if w.strip() else "␣" * max(1, len(w) // 2)
                b = box(lbl, EXP_COLS[e], max(0.55, 0.22 * len(lbl) + 0.3), 0.55, 18, op=0.45)
                g.add(b)
            g.arrange(RIGHT, buff=0.08).move_to([0, y, 0])
            return g
        g1 = strip(toks, 1.3); g2 = strip(toks2, 0.5)
        self.play(LaggedStart(*[FadeIn(b, shift=DOWN * 0.15) for b in g1], lag_ratio=0.1))
        self.play(LaggedStart(*[FadeIn(b, shift=DOWN * 0.15) for b in g2], lag_ratio=0.1))
        self.play(Indicate(g1[4], scale_factor=1.2), Indicate(g2[1], scale_factor=1.2))
        self.play(Indicate(g1[1], scale_factor=1.2), Indicate(g2[0], scale_factor=1.2))
        n = Text("'self' in Python, 'Question' in English, and indentation keep going to the same experts.\n(token colours here are a toy re-creation, not the paper's exact assignments)", font_size=14, color=GREY_).move_to([0, -0.4, 0])
        self.play(FadeIn(n))
        self.wait(1)
        # Table 5 real numbers
        t5 = Text("Consecutive tokens often share an expert (Table 5, first choice, ArXiv)", font_size=17, color=WHITE).move_to([0, -1.2, 0])
        self.play(FadeIn(t5))
        vals = [("layer 0", 14.0), ("layer 15", 27.9), ("layer 31", 22.7)]
        bars = VGroup()
        for k, (nm, v) in enumerate(vals):
            x = -2.5 + k * 2.5
            r = Rectangle(width=1.0, height=v * 0.05, fill_color=GREEN_, fill_opacity=0.85, stroke_width=0).move_to([x, -3.4 + v * 0.025, 0])
            bars.add(VGroup(r, Text(f"{v}%", font_size=14).next_to(r, UP, buff=0.05), Text(nm, font_size=13, color=GREY_).next_to(r, DOWN, buff=0.05)))
        rnd = DashedLine([-3.5, -3.4 + 12.5 * 0.05, 0], [3.5, -3.4 + 12.5 * 0.05, 0], color=RED_)
        rl = Text("random: 12.5%", font_size=12, color=RED_).next_to(rnd, RIGHT, buff=0.1)
        self.play(LaggedStart(*[GrowFromEdge(b[0], DOWN) for b in bars], lag_ratio=0.2), *[FadeIn(b[1]) for b in bars], *[FadeIn(b[2]) for b in bars])
        self.play(Create(rnd), FadeIn(rl))
        self.wait(2)
