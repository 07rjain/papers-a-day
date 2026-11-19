# Manim Community Edition scenes for paper #21: Constitutional AI
# "Constitutional AI: Harmlessness from AI Feedback" (Bai, Kadavath, Kundu, Askell, ... Kaplan; Anthropic; arXiv 2212.08073, Dec 2022)
# Render: manim -qm cai_scenes.py CritiqueRevise AIFeedbackLabels ParetoShift
# Text-only (no LaTeX). Wifi example = Section 3.1; principles = Appendix C; counts = Sections 3.2 and 4.2;
# clamping = Section 4.1/4.3; boilerplate example = Section 4.3. Bar heights, probabilities and curve shapes are illustrative (toy),
# following the qualitative trends of Figures 2, 5 and 8 (the paper gives these only as plots).
from manim import *

BG = "#0b1020"
BLUE_ = "#5aa9ff"; GREEN_ = "#4ade80"; ORANGE_ = "#fb923c"; PINK_ = "#f472b6"; GREY_ = "#94a3b8"; YEL_ = "#facc15"; RED_ = "#f87171"; PURP_ = "#a78bfa"
config.background_color = BG


def box(label, col, w=1.8, h=0.6, fs=18):
    r = RoundedRectangle(corner_radius=0.12, width=w, height=h, stroke_color=col, fill_color=col, fill_opacity=0.15, stroke_width=2.5)
    t = Text(label, font_size=fs, color=WHITE, line_spacing=0.8)
    if t.width > w - 0.2:
        t.scale_to_fit_width(w - 0.2)
    if t.height > h - 0.12:
        t.scale_to_fit_height(h - 0.12)
    t.move_to(r)
    return VGroup(r, t)


def title(s):
    return Text(s, font_size=30, color=WHITE, weight=BOLD).to_edge(UP, buff=0.3)


class CritiqueRevise(Scene):
    def construct(self):
        tt = title("Stage 1 · Critique → Revision → Supervised learning")
        self.play(Write(tt))
        h = box("Human: Can you help me hack into my neighbor's wifi?", BLUE_, 7.6, 0.6, 18).move_to([-2.4, 2.4, 0])
        a0 = box("Assistant: Sure thing, you can use an app called VeryEasyHack...", RED_, 7.6, 0.6, 18).move_to([-2.4, 1.6, 0])
        tag = Text("helpful-only RLHF model (harmful advice is fabricated in the paper)", font_size=13, color=GREY_).next_to(a0, DOWN, buff=0.08)
        self.play(FadeIn(h, shift=DOWN * 0.2))
        self.play(FadeIn(a0, shift=DOWN * 0.2), FadeIn(tag))
        p = box("Principle (1 of 16, drawn at random)", YEL_, 4.0, 0.55, 16).move_to([4.4, 2.4, 0])
        self.play(FadeIn(p, scale=0.8))
        cr = box("Critique Request: Identify specific ways the last response is\nharmful, unethical, racist, sexist, toxic, dangerous, or illegal.", YEL_, 7.6, 0.8, 15).move_to([-2.4, 0.5, 0])
        c = box("Critique: hacking into someone else's wifi is an invasion\nof their privacy and is possibly illegal.", ORANGE_, 7.6, 0.8, 16).move_to([-2.4, -0.45, 0])
        self.play(TransformFromCopy(p, cr))
        self.play(FadeIn(c, shift=RIGHT * 0.3))
        rr = box("Revision Request: rewrite the response to remove any and all harmful content.", YEL_, 7.6, 0.55, 15).move_to([-2.4, -1.35, 0])
        r1 = box("Revision: Hacking into your neighbor's wifi is an invasion of their privacy,\nand I strongly advise against it. It may also land you in legal trouble.", GREEN_, 7.6, 0.8, 15).move_to([-2.4, -2.3, 0])
        self.play(FadeIn(rr))
        self.play(FadeIn(r1, shift=UP * 0.2))
        self.wait(0.6)
        # harmlessness meter (illustrative)
        ax_x = 3.0
        lab = Text("harmlessness PM score\n(illustrative, Fig. 5 trend)", font_size=13, color=GREY_).move_to([4.4, 1.5, 0])
        base = Line([ax_x, -2.7, 0], [ax_x + 3.0, -2.7, 0], color=GREY_)
        self.play(FadeIn(lab), Create(base))
        heights = [0.4, 1.6, 2.1, 2.4, 2.6]
        bars = VGroup()
        for i, hh in enumerate(heights):
            b = Rectangle(width=0.42, height=hh, fill_color=GREEN_ if i else RED_, fill_opacity=0.8, stroke_width=0).move_to([ax_x + 0.35 + i * 0.6, -2.7 + hh / 2, 0])
            t = Text(str(i), font_size=14, color=GREY_).next_to(b, DOWN, buff=0.08)
            bars.add(VGroup(b, t))
        cap = Text("revision # (0 = original)", font_size=12, color=GREY_).next_to(base, DOWN, buff=0.35)
        self.play(GrowFromEdge(bars[0][0], DOWN), FadeIn(bars[0][1]), FadeIn(cap))
        for i in range(1, 5):
            self.play(Indicate(p, color=YEL_, scale_factor=1.08), run_time=0.4)
            self.play(GrowFromEdge(bars[i][0], DOWN), FadeIn(bars[i][1]), run_time=0.5)
        self.wait(0.4)
        self.play(*[FadeOut(m) for m in [h, a0, tag, cr, c, rr, r1, p, lab, base, bars, cap]])
        # data + finetune
        d1 = box("182,831 red-team prompts\n(42,496 human-written + 140,335 model-written)\n× 4 critique-revision pairs", RED_, 5.4, 1.2, 17).move_to([-3.4, 1.0, 0])
        d2 = box("135,296 human-written helpfulness prompts\n× 2 responses from the helpful model", BLUE_, 5.4, 1.0, 17).move_to([-3.4, -0.6, 0])
        pre = box("pre-trained 52B LM", GREY_, 2.8, 0.7, 18).move_to([2.6, 1.0, 0])
        sl = box("SL-CAI", GREEN_, 2.8, 0.8, 26).move_to([2.6, -0.8, 0])
        self.play(FadeIn(d1, shift=RIGHT * 0.3), FadeIn(d2, shift=RIGHT * 0.3))
        self.play(FadeIn(pre))
        a1 = Arrow(d1.get_right(), pre.get_left(), color=GREY_); a2 = Arrow(d2.get_right(), pre.get_left(), color=GREY_)
        self.play(GrowArrow(a1), GrowArrow(a2))
        a3 = Arrow(pre.get_bottom(), sl.get_top(), color=GREEN_)
        ft = Text("fine-tune 1 epoch on the final revisions\n+ helpful samples", font_size=14, color=GREY_).next_to(a3, RIGHT, buff=0.15)
        self.play(GrowArrow(a3), FadeIn(ft), FadeIn(sl, scale=0.8))
        foot = Text("No human ever labeled a response as harmful. The only human input for harmlessness: 16 written principles + a few examples.", font_size=16, color=YEL_).to_edge(DOWN, buff=0.5)
        self.play(Write(foot), run_time=1.6)
        self.wait(1.5)


class AIFeedbackLabels(Scene):
    def construct(self):
        tt = title("Stage 2 · RL from AI Feedback (RLAIF)")
        self.play(Write(tt))
        pr = box("red-team prompt", RED_, 2.6, 0.6, 18).move_to([-5.2, 2.0, 0])
        slm = box("SL-CAI\nsamples 2 responses", GREEN_, 2.6, 0.9, 16).move_to([-5.2, 0.7, 0])
        A = box("(A) ...", BLUE_, 1.7, 0.55, 18).move_to([-6.1, -0.7, 0])
        B = box("(B) ...", PINK_, 1.7, 0.55, 18).move_to([-4.2, -0.7, 0])
        self.play(FadeIn(pr)); self.play(FadeIn(slm, shift=DOWN * 0.2)); self.play(FadeIn(A), FadeIn(B))
        q = box("Which of these assistant responses is less harmful? Choose the response that a\nwise, ethical, polite and friendly person would more likely say.\nOptions: (A) ... (B) ...   The answer is:", YEL_, 6.6, 1.25, 15).move_to([1.6, 1.6, 0])
        self.play(FadeIn(q, shift=LEFT * 0.3))
        fm = box("feedback model\n(a pre-trained LM)", PURP_, 3.0, 0.9, 18).move_to([1.6, 0.0, 0])
        self.play(GrowArrow(Arrow(q.get_bottom(), fm.get_top(), color=PURP_, buff=0.05)), FadeIn(fm))
        # soft label bars
        bA = Rectangle(width=0.6, height=2.2 * 0.73, fill_color=BLUE_, fill_opacity=0.85, stroke_width=0)
        bB = Rectangle(width=0.6, height=2.2 * 0.27, fill_color=PINK_, fill_opacity=0.85, stroke_width=0)
        bA.move_to([4.6, -2.6 + bA.height / 2, 0]); bB.move_to([5.6, -2.6 + bB.height / 2, 0])
        tA = Text("A 0.73", font_size=16).next_to(bA, UP, buff=0.08); tB = Text("B 0.27", font_size=16).next_to(bB, UP, buff=0.08)
        lab = Text("normalized log-probs of (A) vs (B)\n= a SOFT label (numbers illustrative)", font_size=13, color=GREY_).move_to([5.1, -3.1, 0])
        self.play(GrowFromEdge(bA, DOWN), GrowFromEdge(bB, DOWN), FadeIn(tA), FadeIn(tB), FadeIn(lab))
        self.wait(0.5)
        ds = box("182,831 AI harmlessness comparisons\n+ 135,296 human helpfulness comparisons", ORANGE_, 5.0, 0.9, 16).move_to([-1.0, -1.9, 0])
        self.play(TransformFromCopy(VGroup(bA, bB), ds))
        pm = box("preference model", ORANGE_, 2.6, 0.6, 18).move_to([-1.0, -3.1, 0])
        self.play(GrowArrow(Arrow(ds.get_bottom(), pm.get_top(), buff=0.05, color=ORANGE_)), FadeIn(pm))
        rl = box("RL against the PM\n→ RL-CAI", GREEN_, 2.6, 0.8, 16).move_to([-4.8, -3.0, 0])
        self.play(GrowArrow(Arrow(pm.get_left(), rl.get_right(), buff=0.05, color=GREEN_)), FadeIn(rl))
        same = Text("from here on: exactly the same pipeline as RLHF", font_size=14, color=GREY_).next_to(pm, DOWN, buff=0.12)
        self.play(FadeIn(same))
        self.wait(1.2)
        self.play(*[FadeOut(m) for m in self.mobjects if m is not tt])
        # CoT + clamp
        sub = Text("With chain of thought (\"Let's think step-by-step\"), labels get overconfident", font_size=20, color=WHITE).move_to([0, 2.2, 0])
        self.play(FadeIn(sub))
        line = NumberLine(x_range=[0, 1, 0.1], length=9, include_numbers=False, color=GREY_).move_to([0, 0, 0])
        nums = VGroup(*[Text(f"{v/10:.1f}", font_size=16, color=GREY_).next_to(line.n2p(v/10), DOWN, buff=0.15) for v in range(11)])
        self.play(Create(line), FadeIn(nums))
        dots = VGroup(*[Dot(line.n2p(v), color=YEL_, radius=0.1) for v in [0.02, 0.04, 0.97, 0.99, 0.95, 0.01]])
        self.play(LaggedStart(*[FadeIn(d, scale=0.5) for d in dots], lag_ratio=0.15))
        band = Rectangle(width=line.n2p(0.6)[0] - line.n2p(0.4)[0], height=0.8, fill_color=GREEN_, fill_opacity=0.25, stroke_color=GREEN_).move_to(line.n2p(0.5))
        bl = Text("clamp to 40-60%", font_size=18, color=GREEN_).next_to(band, DOWN, buff=0.45)
        self.play(FadeIn(band), FadeIn(bl))
        self.play(*[d.animate.move_to(line.n2p(0.4 if d.get_center()[0] < line.n2p(0.5)[0] else 0.6)) for d in dots], run_time=1.2)
        why = Text("Without clamping, RL-CAI learned to give more extreme responses (Section 4.1).\n20-80% helped a little; 40-60% helped more and was used for the main results.", font_size=16, color=GREY_).move_to([0, -2.2, 0])
        self.play(FadeIn(why))
        self.wait(2)


class ParetoShift(Scene):
    def construct(self):
        tt = title("Harmless and still helpful: shifting the trade-off")
        self.play(Write(tt))
        ax = Axes(x_range=[0, 10, 2], y_range=[0, 10, 2], x_length=6.5, y_length=4.6, tips=False, axis_config={"color": GREY_, "include_ticks": False}).move_to([-2.4, -0.5, 0])
        xl = Text("helpfulness Elo →", font_size=16, color=GREY_).next_to(ax, DOWN, buff=0.15)
        yl = Text("harmlessness Elo →", font_size=16, color=GREY_).rotate(PI / 2).next_to(ax, LEFT, buff=0.15)
        self.play(Create(ax), FadeIn(xl), FadeIn(yl))
        note = Text("curve shapes illustrative, after Fig. 2 (52B RL runs; later RL steps = further along)", font_size=12, color=GREY_).next_to(ax, UP, buff=0.1)
        self.play(FadeIn(note))
        start = ax.c2p(2, 2)
        def path(pts, col):
            return VMobject(color=col, stroke_width=5).set_points_smoothly([ax.c2p(*p) for p in pts])
        helpful = path([(2, 2), (4, 2.6), (6, 2.8), (8.3, 2.4)], BLUE_)
        hh = path([(2, 2), (3.6, 4.0), (5.0, 4.8), (5.8, 4.6)], PURP_)
        cai = path([(4.2, 4.4), (5.6, 6.4), (6.6, 7.8), (7.2, 8.8)], GREEN_)
        self.play(Create(helpful), run_time=1.5)
        self.play(FadeIn(Text("Helpful RLHF", font_size=15, color=BLUE_).next_to(ax.c2p(8.3, 2.4), UP, buff=0.1)))
        self.play(Create(hh), run_time=1.5)
        self.play(FadeIn(Text("HH RLHF", font_size=15, color=PURP_).next_to(ax.c2p(5.8, 4.6), RIGHT, buff=0.1)))
        sl = Dot(ax.c2p(4.2, 4.4), color=YEL_); sll = Text("SL-CAI start", font_size=14, color=YEL_).next_to(sl, LEFT, buff=0.1)
        self.play(FadeIn(sl), FadeIn(sll))
        self.play(Create(cai), run_time=1.8)
        self.play(FadeIn(Text("RL-CAI", font_size=17, color=GREEN_, weight=BOLD).next_to(ax.c2p(7.2, 8.8), RIGHT, buff=0.1)))
        arr = Arrow(ax.c2p(5.6, 4.7), ax.c2p(6.4, 7.2), color=YEL_, buff=0)
        pl = Text("Pareto improvement:\nless harmful at the\nsame helpfulness", font_size=15, color=YEL_).move_to([3.0, 1.6, 0])
        self.play(GrowArrow(arr), FadeIn(pl))
        self.wait(1)
        ev = box("HH RLHF often: \"I can't answer that.\"\n(harmless, but evasive)", PURP_, 4.6, 0.9, 15).move_to([3.6, -0.2, 0])
        nv = box("RL-CAI: engages and explains its objection\n(\"...an invasion of their privacy... may land you in legal trouble\")", GREEN_, 4.6, 0.9, 13).move_to([3.6, -1.3, 0])
        self.play(FadeIn(ev, shift=LEFT * 0.2)); self.play(FadeIn(nv, shift=LEFT * 0.2))
        gh = box("Over-trained RL-CAI Goodharts: boilerplate like\n\"you are valid, valued, and cared for\" (Section 4.3)", ORANGE_, 4.6, 0.9, 13).move_to([3.6, -2.4, 0])
        self.play(FadeIn(gh, shift=LEFT * 0.2))
        self.wait(2)
