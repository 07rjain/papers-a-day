# Manim Community Edition scenes for paper #18: Reflexion
# "Reflexion: Language Agents with Verbal Reinforcement Learning"
# (Shinn, Cassano, Berman, Gopinath, Narasimhan, Yao — Northeastern, MIT, Princeton; NeurIPS 2023; arXiv 2303.11366)
# Render: manim -qm reflexion_scenes.py ReflexionLoop MugAndLamp ResultsAndAblations
# Text-only (no LaTeX). Mug/desklamp trials and reflection text follow the paper's ALFWorld appendix example;
# numbers from Tables 1-3, Section 4 and Figure 3.
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


class ReflexionLoop(Scene):
    """Figure 2: Actor -> Environment -> Evaluator -> Self-Reflection -> Memory -> Actor."""
    def construct(self):
        title = Text("Reflexion: learn from a failure by writing it down", font_size=30).to_edge(UP)
        self.play(Write(title))
        actor = box("Actor (LM)", BLUE_).move_to([-3.6, 1.2, 0])
        env = box("Environment", GREY_).move_to([0, 1.2, 0])
        ev = box("Evaluator", ORANGE_).move_to([3.6, 1.2, 0])
        sr = box("Self-Reflection (LM)", PINK_, 2.4).move_to([3.6, -1.4, 0])
        mem = RoundedRectangle(corner_radius=0.12, width=3.6, height=2.6, stroke_color=GREEN_, stroke_width=2.5).move_to([-2.4, -1.75, 0])
        memt = Text("Memory (last 3 lessons)", font_size=16, color=GREEN_).next_to(mem, UP, buff=0.08)
        self.play(LaggedStart(FadeIn(actor), FadeIn(env), FadeIn(ev), FadeIn(sr), Create(mem), FadeIn(memt), lag_ratio=0.2))
        arrs = [
            Arrow(actor.get_right(), env.get_left(), color=BLUE_, buff=0.1),
            Arrow(env.get_right(), ev.get_left(), color=GREY_, buff=0.1),
            Arrow(ev.get_bottom(), sr.get_top(), color=ORANGE_, buff=0.1),
            Arrow(sr.get_left(), mem.get_right() + UP * 0.35, color=PINK_, buff=0.1),
            Arrow(mem.get_top() + LEFT * 1.2 + UP * 0.3, actor.get_bottom(), color=GREEN_, buff=0.1),
        ]
        lbls = [Text("actions", font_size=13, color=BLUE_).next_to(arrs[0], UP, buff=0.05),
                Text("trajectory", font_size=13, color=GREY_).next_to(arrs[1], UP, buff=0.05),
                Text("pass / fail", font_size=13, color=ORANGE_).next_to(arrs[2], RIGHT, buff=0.08),
                Text("a lesson in words", font_size=13, color=PINK_).next_to(arrs[3], DOWN, buff=0.05),
                Text("read before next try", font_size=13, color=GREEN_).next_to(arrs[4], LEFT, buff=0.08)]
        self.play(*[GrowArrow(a) for a in arrs], *[FadeIn(l) for l in lbls], run_time=1.2)
        lessons = ["Trial 1: I looked for the mug first; find the desklamp first.",
                   "Trial 2: desk 1 has the lamp; go there straight away.",
                   "Trial 3: I thought I held the mug but didn't; take it first.",
                   "Trial 4: drawers 1-3 were empty; check the shelf next."]
        cards = []
        counter = Text("Trial 1", font_size=22, color=YEL_).to_corner(UL).shift(DOWN * 0.8)
        self.play(FadeIn(counter))
        path = [actor.get_center(), env.get_center(), ev.get_center(), sr.get_center(), mem.get_center(), actor.get_center()]
        for i, ls in enumerate(lessons):
            dot = Dot(path[0], color=YEL_, radius=0.11)
            self.add(dot)
            for p in path[1:4]:
                self.play(dot.animate.move_to(p), run_time=0.3)
            fail = Text("FAIL", font_size=16, color=RED_).next_to(ev, UP, buff=0.08)
            self.play(FadeIn(fail), run_time=0.2)
            c = note(ls, GREEN_, 3.3, 12)
            c.move_to(sr.get_center())
            self.play(FadeOut(dot), FadeOut(fail), c.animate.move_to(mem.get_top() + DOWN * (0.45 + 0.7 * min(len(cards), 2))), run_time=0.7)
            cards.append(c)
            if len(cards) > 3:
                old = cards.pop(0)
                self.play(FadeOut(old, shift=LEFT), *[cc.animate.shift(UP * 0.7) for cc in cards[:-1]], cards[-1].animate.move_to(mem.get_top() + DOWN * (0.45 + 1.4)), run_time=0.6)
            self.play(Transform(counter, Text(f"Trial {i + 2}", font_size=22, color=YEL_).move_to(counter)), run_time=0.3)
        foot = Text("No weights are trained. Only the text in memory changes between tries.", font_size=20, color=YEL_).to_edge(DOWN, buff=0.15)
        self.play(Write(foot))
        self.wait(1.5)


class MugAndLamp(Scene):
    """Paper Figure 5 (ALFWorld): 'examine the mug with the desklamp' — trial 1 fails, a reflection, trial 2 succeeds."""
    def construct(self):
        title = Text("Task: examine the mug with the desklamp", font_size=30).to_edge(UP)
        self.play(Write(title))
        places = ["drawer 1", "drawer 2", "drawer 3", "drawer 4", "drawer 5", "drawer 6", "desk 1", "desk 2"]
        spots = VGroup(*[box(p, GREY_, 1.35, 0.5, 14) for p in places]).arrange(RIGHT, buff=0.18).shift(UP * 1.5)
        self.play(LaggedStart(*[FadeIn(s) for s in spots], lag_ratio=0.08))
        lamp = Text("desklamp 1", font_size=13, color=YEL_).next_to(spots[6], DOWN, buff=0.08)
        mug = Text("mug 1", font_size=13, color=ORANGE_).next_to(lamp, DOWN, buff=0.04)
        self.play(FadeIn(lamp), FadeIn(mug))
        t1 = Text("Trial 1   plan: find and take a mug, then find a desklamp", font_size=19, color=BLUE_).shift(UP * 0.1)
        self.play(FadeIn(t1))
        agent = Dot(spots[0].get_bottom() + DOWN * 0.95, color=BLUE_, radius=0.13)
        self.play(FadeIn(agent))
        for i in range(6):
            self.play(agent.animate.move_to(spots[i].get_bottom() + DOWN * 0.95), spots[i][0].animate.set_stroke(RED_), run_time=0.28)
        self.play(agent.animate.move_to(spots[6].get_bottom() + DOWN * 0.95), run_time=0.35)
        self.play(mug.animate.next_to(agent, DOWN, buff=0.05), run_time=0.4)
        took = Text("> take mug 1 from desk 1   (it walks right past the lamp)", font_size=15, color=WHITE).shift(DOWN * 0.75)
        self.play(FadeIn(took))
        self.play(agent.animate.move_to(spots[7].get_bottom() + DOWN * 0.95), mug.animate.move_to(spots[7].get_bottom() + DOWN * 1.25), run_time=0.45)
        nh = Text("> use desklamp 1  ->  Nothing happens.   (twice)", font_size=15, color=RED_).next_to(took, DOWN, buff=0.12)
        self.play(FadeIn(nh))
        status = Text("Status: Fail", font_size=22, color=RED_).next_to(nh, DOWN, buff=0.15)
        self.play(FadeIn(status))
        self.wait(0.6)
        self.play(FadeOut(took), FadeOut(nh), FadeOut(status))
        refl = note("Reflection: In this environment, my plan was to find a mug then find and use a desklamp. However,\n"
                    "the task says to examine the mug with the desklamp. I should have looked for the desklamp first, then\n"
                    "looked for the mug. I noticed that the desklamp was found on desk 1. In the next trial, I will go to\n"
                    "desk 1, find the lamp, then look for the mug and examine it with the desklamp.", PINK_, 12.8, 15).shift(DOWN * 1.6)
        self.play(FadeIn(refl, shift=UP * 0.2), run_time=1.0)
        self.wait(3.0)
        self.play(FadeOut(t1), refl.animate.scale(0.7).to_edge(DOWN, buff=0.12), *[s[0].animate.set_stroke(GREY_) for s in spots[:6]],
                  agent.animate.move_to(spots[0].get_bottom() + DOWN * 0.95), mug.animate.next_to(lamp, DOWN, buff=0.04))
        t2 = Text("Trial 2   (reads its reflection first, environment reset)", font_size=19, color=GREEN_).shift(UP * 0.1)
        self.play(FadeIn(t2))
        self.play(agent.animate.move_to(spots[6].get_bottom() + DOWN * 0.95).set_color(GREEN_), run_time=0.9)
        steps = VGroup(*[Text(s, font_size=16, color=WHITE) for s in ["> go to desk 1", "> take mug 1 from desk 1", "> use desklamp 1  ->  You turn on the desklamp 1.", "Status: Success"]]).arrange(DOWN, aligned_edge=LEFT, buff=0.1).shift(DOWN * 0.95)
        steps[-1].set_color(GREEN_)
        for s in steps:
            self.play(FadeIn(s, shift=RIGHT * 0.2), run_time=0.4)
        self.play(spots[6][0].animate.set_stroke(GREEN_, width=5), Flash(agent, color=GREEN_), lamp.animate.set_color(WHITE))
        self.wait(1.5)


class ResultsAndAblations(Scene):
    def construct(self):
        title = Text("What the paper measured", font_size=32).to_edge(UP)
        self.play(Write(title))
        # HumanEval
        h = Text("HumanEval (Python), pass@1", font_size=20, color=BLUE_).move_to([-3.4, 2.4, 0])
        self.play(FadeIn(h))
        base_y = -0.2
        def bar(x, val, col, lab, top=100.0, hmax=2.2):
            r = Rectangle(width=0.9, height=0.01, stroke_width=0, fill_color=col, fill_opacity=0.85).move_to([x, base_y, 0], aligned_edge=DOWN)
            t = Text(lab, font_size=13, color=GREY_).next_to(r, DOWN, buff=0.1)
            return r, t, val / top * hmax
        items = [(-5.2, 65.8, GREY_, "CodeT+GPT-3.5"), (-3.6, 80.1, ORANGE_, "GPT-4"), (-2.0, 91.0, GREEN_, "Reflexion")]
        for x, v, c, l in items:
            r, t, hh = bar(x, v, c, l)
            self.add(r, t)
            self.play(r.animate.stretch_to_fit_height(hh).move_to([x, base_y, 0], aligned_edge=DOWN), run_time=0.6)
            self.play(FadeIn(Text(f"{v}%", font_size=16).next_to(r, UP, buff=0.05)), run_time=0.2)
        # right side: other benchmarks
        rows = [("ALFWorld (134 household tasks)", "130 / 134 solved, +22 pts over ReAct alone"),
                ("HotpotQA (100 questions)", "about +20 pts over baselines that just retry"),
                ("Leetcode Hard (Python, 40)", "GPT-4 7.5%  ->  Reflexion 15.0%"),
                ("MBPP (Python)", "80.1% -> 77.1%: worse! (flaky self-tests)")]
        grp = VGroup()
        for a, b in rows:
            g = VGroup(Text(a, font_size=17, color=PINK_), Text(b, font_size=15, color=WHITE)).arrange(DOWN, aligned_edge=LEFT, buff=0.06)
            grp.add(g)
        grp.arrange(DOWN, aligned_edge=LEFT, buff=0.3).move_to([3.2, 1.0, 0])
        self.play(LaggedStart(*[FadeIn(g, shift=LEFT * 0.3) for g in grp], lag_ratio=0.35), run_time=2.2)
        self.wait(1.2)
        # ablation
        ab = Text("Ablation, 50 hardest HumanEval-Rust problems (Table 3)", font_size=19, color=YEL_).move_to([0, -1.25, 0])
        self.play(FadeIn(ab))
        abl = [("base", 0.60), ("no self-tests", 0.52), ("no reflection", 0.60), ("full Reflexion", 0.68)]
        cols = [GREY_, RED_, ORANGE_, GREEN_]
        for i, ((n, v), c) in enumerate(zip(abl, cols)):
            y = -1.75 - 0.42 * i
            lab = Text(n, font_size=15, color=c).move_to([-3.6, y, 0])
            r = Rectangle(width=0.01, height=0.28, stroke_width=0, fill_color=c, fill_opacity=0.85).move_to([-2.4, y, 0], aligned_edge=LEFT)
            self.add(lab, r)
            self.play(r.animate.stretch_to_fit_width(v * 8).move_to([-2.4, y, 0], aligned_edge=LEFT), run_time=0.45)
            self.add(Text(f"{int(v*100)}%", font_size=15).next_to(r, RIGHT, buff=0.1))
        self.wait(2)
